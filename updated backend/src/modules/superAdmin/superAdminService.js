import { prisma } from '../../config/db.js';
import { hashPassword, comparePassword } from '../../utils/hashtoken.js';
import jwt from 'jsonwebtoken';
import {
  sendSuperAdminVerificationOtp,
  sendAdminVerificationOtp,
  sendAnnouncementNotice,
  sendScheduleNotice,
  sendOcrWindowOpenedNotice,
  sendOcrWindowReminderNotice,
  sendOcrWindowClosedNotice,
} from '../../config/email.js';
import { formatDualCalendarDate } from '../../utils/ethiopianCalendar.js';

const OTP_EXPIRY_MS = 10 * 60 * 1000;

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const WEEK_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const WEEK_DAY_INDEX = new Map(WEEK_DAYS.map((day, index) => [day, index]));
const UI_TO_DB_COMPLAINT_STATUS = {
  OPEN: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'REJECTED',
};

const DB_TO_UI_COMPLAINT_STATUS = {
  PENDING: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  ESCALATED: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  REJECTED: 'CLOSED',
};

const OFFICER_UI_TO_ROLE = {
  BILLING_OFFICER: 'WOREDA_BILLING_OFFICER',
  COMPLAINT_OFFICER: 'WOREDA_COMPLAINT_OFFICER',
};

const OFFICER_ROLE_TO_UI = {
  WOREDA_BILLING_OFFICER: 'BILLING_OFFICER',
  WOREDA_COMPLAINT_OFFICER: 'COMPLAINT_OFFICER',
};

const ADMIN_ROLES = new Set(['SUBCITY_ADMIN', 'WOREDA_ADMINS']);
const OFFICER_ROLES = [
  'FIELD_OFFICER',
  'MANUAL_METER_READER',
  'SUBCITY_BILLING_OFFICER',
  'SUBCITY_COMPLAINT_OFFICER',
  'WOREDA_BILLING_OFFICER',
  'WOREDA_COMPLAINT_OFFICER',
];

const normalizeWoredaIds = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  const single = String(value || '').trim();
  return single ? [single] : [];
};

const normalizeScheduleDays = (value) => {
  const rawDays = Array.isArray(value) ? value : [value];
  return rawDays
    .map((item) =>
      String(item || '')
        .trim()
        .toUpperCase()
    )
    .filter((item) => WEEK_DAYS.includes(item));
};

const normalizeScheduleBlocks = (value) => {
  const rawBlocks = Array.isArray(value) ? value : value ? [value] : [];

  return rawBlocks
    .map((block) => ({
      startDay: String(block?.startDay || '')
        .trim()
        .toUpperCase(),
      endDay: String(block?.endDay || '')
        .trim()
        .toUpperCase(),
      startTime: String(block?.startTime || '').trim(),
      endTime: String(block?.endTime || '').trim(),
      note: String(block?.note || '').trim(),
    }))
    .filter((block) => Boolean(block.startDay && block.endDay && block.startTime && block.endTime))
    .filter((block) => WEEK_DAYS.includes(block.startDay) && WEEK_DAYS.includes(block.endDay));
};

const expandDaysInRange = (startDay, endDay) => {
  const startIndex = WEEK_DAY_INDEX.get(startDay);
  const endIndex = WEEK_DAY_INDEX.get(endDay);

  if (startIndex == null || endIndex == null) {
    return [];
  }

  const days = [];
  let cursor = startIndex;

  for (let guard = 0; guard < WEEK_DAYS.length; guard += 1) {
    days.push(WEEK_DAYS[cursor]);
    if (cursor === endIndex) {
      break;
    }
    cursor = (cursor + 1) % WEEK_DAYS.length;
  }

  return days;
};

const buildScheduleSummary = ({ woredas, blocks }) => {
  const woredaNames = woredas.map((item) => item.name).filter(Boolean);
  const woredaText = woredaNames.length ? woredaNames.join(', ') : 'selected woredas';

  const blockText = blocks
    .map((block) => {
      const start = block.startDay.charAt(0) + block.startDay.slice(1).toLowerCase();
      const end = block.endDay.charAt(0) + block.endDay.slice(1).toLowerCase();
      return `${start} to ${end} from ${block.startTime} to ${block.endTime}`;
    })
    .join('; ');

  return `Water will be available for ${woredaText} on ${blockText}.`;
};

const toAnnouncementView = (announcement, currentUserId = null) => {
  const titleText = announcement?.title?.en || announcement?.title?.am || '';
  const bodyText = announcement?.message?.en || announcement?.message?.am || '';

  return {
    id: announcement.id,
    title: titleText,
    message: bodyText,
    titleLocalized: announcement.title,
    messageLocalized: announcement.message,
    targetGroup: null,
    targetLabel: null,
    isBroadcast: Boolean(announcement.isBroadcast),
    targetUserCount: announcement.isBroadcast ? 0 : announcement.targetUserIds.length,
    sentEmailCount: 0,
    subCityId: announcement.subCityId,
    targetWoredaIds: announcement.targetWoredaIds,
    createdBy: announcement.createdBy
      ? {
          id: announcement.createdBy.id,
          fullName: announcement.createdBy.fullName,
          email: announcement.createdBy.email,
          role: announcement.createdBy.role,
        }
      : null,
    createdAt: announcement.createdAt,
    updatedAt: announcement.updatedAt,
    isRead:
      currentUserId == null
        ? undefined
        : announcement.reads.some((entry) => entry.userId === currentUserId),
  };
};

const formatTime = (dateLike) => {
  const date = new Date(dateLike);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const toScheduleView = (schedule) => {
  const rawNote = schedule.note;
  const note =
    typeof rawNote === 'string'
      ? rawNote
      : rawNote && typeof rawNote === 'object'
      ? rawNote.en || rawNote.am || ''
      : '';

  const day = schedule.dayOfWeek || WEEK_DAYS[new Date(schedule.startAt).getDay()];

  return {
    id: schedule.id,
    day,
    startTime: formatTime(schedule.startAt),
    endTime: formatTime(schedule.endAt),
    note,
    woreda: schedule.woreda
      ? {
          id: schedule.woreda.id,
          name: schedule.woreda.name,
        }
      : null,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
};

const buildScheduleDate = (timeHHMM) => {
  const [hours, minutes] = String(timeHHMM || '00:00')
    .split(':')
    .map((v) => Number(v));

  const date = new Date();
  date.setSeconds(0, 0);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
};

const toPlainText = (value) => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.en || value.am || '';
  return '';
};

const buildComplaintStatusFilter = (uiStatus) => {
  if (!uiStatus) return undefined;

  if (uiStatus === 'OPEN') {
    return 'PENDING';
  }

  if (uiStatus === 'IN_PROGRESS') {
    return { in: ['IN_PROGRESS', 'ESCALATED'] };
  }

  if (uiStatus === 'CLOSED') {
    return 'REJECTED';
  }

  return UI_TO_DB_COMPLAINT_STATUS[uiStatus] || uiStatus;
};

const toComplaintView = (complaint) => ({
  id: complaint.id,
  title: toPlainText(complaint.title),
  description: toPlainText(complaint.description),
  status: DB_TO_UI_COMPLAINT_STATUS[complaint.status] || complaint.status,
  createdAt: complaint.createdAt,
  updatedAt: complaint.updatedAt,
  subCity: complaint.subCity
    ? {
        id: complaint.subCity.id,
        name: complaint.subCity.name,
      }
    : null,
  woreda: complaint.woreda
    ? {
        id: complaint.woreda.id,
        name: complaint.woreda.name,
      }
    : null,
  submittedBy: complaint.customer
    ? {
        id: complaint.customer.id,
        fullName: complaint.customer.fullName,
        email: complaint.customer.email,
        phoneE164: complaint.customer.phoneE164,
      }
    : {
        id: '',
        fullName: 'Unknown Customer',
        email: '',
        phoneE164: '',
      },
  assignedTo: complaint.assignedTo
    ? {
        id: complaint.assignedTo.id,
        fullName: complaint.assignedTo.fullName,
        email: complaint.assignedTo.email,
        fieldOfficerType: complaint.assignedTo.fieldOfficerType,
      }
    : null,
});

const toNumber = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (value && typeof value === 'object' && typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  return 0;
};

const resolvePaymentFlag = (status) => {
  if (status === 'OVERDUE') return 'LEGAL_ACTION';
  if (status === 'UNPAID') return 'WARNING';
  return 'NONE';
};

const toBillView = (bill) => {
  const amount = toNumber(bill.totalAmount);
  const originalAmount = toNumber(bill.amount);
  const penaltyAmount = toNumber(bill.latePenaltyAmount);

  return {
    id: bill.id,
    monthYear: `${bill.billYear}-${String(bill.billMonth).padStart(2, '0')}`,
    amount,
    originalAmount,
    penaltyAmount,
    consumption: bill.consumption,
    status: bill.status,
    dueDate: bill.dueDate,
    createdAt: bill.createdAt,
    updatedAt: bill.updatedAt,
    customer: bill.customer
      ? {
          id: bill.customer.id,
          fullName: bill.customer.fullName,
          email: bill.customer.email,
          phoneE164: bill.customer.phoneE164,
          paymentFlag: resolvePaymentFlag(bill.status),
          woreda: bill.customer.woreda
            ? {
                id: bill.customer.woreda.id,
                name: bill.customer.woreda.name,
              }
            : null,
        }
      : null,
    meterReading: bill.reading
      ? {
          id: bill.reading.id,
          readingValue: bill.reading.readingValue,
          readingDate: bill.reading.readingDate,
        }
      : null,
  };
};

const toMeterView = (meter) => ({
  id: meter.id,
  meterNumber: meter.meterNumber,
  createdAt: meter.createdAt,
  status: meter.status,
  assignmentState: meter.customer
    ? 'SIGNED_AUTOMATICALLY'
    : meter.woreda
    ? 'RESERVED'
    : 'UNASSIGNED',
  woreda: meter.woreda
    ? {
        id: meter.woreda.id,
        name: meter.woreda.name,
        subCityId: meter.woreda.subCityId,
      }
    : null,
  customer: meter.customer
    ? {
        id: meter.customer.id,
        fullName: meter.customer.fullName,
        email: meter.customer.email,
        phoneE164: meter.customer.phoneE164,
        paymentFlag: meter.bills.some((b) => b.status === 'OVERDUE')
          ? 'LEGAL_ACTION'
          : meter.bills.some((b) => b.status === 'UNPAID')
          ? 'WARNING'
          : 'NONE',
      }
    : null,
});

const parseISODate = (value, fieldName) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return parsed;
};

const toOcrWindowStatusView = (windowRecord) => {
  if (!windowRecord) {
    return {
      isConfigured: false,
      isOpen: false,
      isScheduled: false,
      isClosed: true,
      startDate: null,
      closeDate: null,
      startDateDual: null,
      closeDateDual: null,
      month: null,
      year: null,
      statusTag: 'EXPIRED',
      updatedAt: null,
    };
  }

  const now = new Date();
  const start = new Date(windowRecord.openDate);
  const close = new Date(windowRecord.closeDate);

  const isOpen = Boolean(windowRecord.isActive) && now >= start && now <= close;
  const isScheduled = Boolean(windowRecord.isActive) && now < start;
  const isClosed = !isOpen && !isScheduled;
  const startDateDual = formatDualCalendarDate(start);
  const closeDateDual = formatDualCalendarDate(close);
  const statusTag = isOpen ? 'ACTIVE' : isScheduled ? 'SCHEDULED' : 'EXPIRED';

  return {
    isConfigured: true,
    isOpen,
    isScheduled,
    isClosed,
    startDate: start.toISOString(),
    closeDate: close.toISOString(),
    startDateDual,
    closeDateDual,
    month: windowRecord.month,
    year: windowRecord.year,
    statusTag,
    updatedAt: windowRecord.updatedAt,
  };
};

const toOcrWindowHistoryItem = (windowRecord) => {
  const start = new Date(windowRecord.openDate);
  const close = new Date(windowRecord.closeDate);
  const now = new Date();

  const isActive = Boolean(windowRecord.isActive) && now >= start && now <= close;
  const isScheduled = Boolean(windowRecord.isActive) && now < start;
  const statusTag = isActive ? 'ACTIVE' : isScheduled ? 'SCHEDULED' : 'EXPIRED';

  return {
    id: windowRecord.id,
    month: windowRecord.month,
    year: windowRecord.year,
    openingDate: start.toISOString(),
    closingDate: close.toISOString(),
    openingDateDual: formatDualCalendarDate(start),
    closingDateDual: formatDualCalendarDate(close),
    statusTag,
    createdAt: windowRecord.createdAt,
    updatedAt: windowRecord.updatedAt,
  };
};

const getUtcDayStart = (dateLike) => {
  const date = new Date(dateLike);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const getDaysRemaining = (now, closeDate) => {
  const todayUtc = getUtcDayStart(now).getTime();
  const closeUtc = getUtcDayStart(closeDate).getTime();
  return Math.floor((closeUtc - todayUtc) / (24 * 60 * 60 * 1000));
};

const hasLifecycleNotificationToday = async (eventCode, now) => {
  const dayStart = getUtcDayStart(now);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const existing = await prisma.notification.findFirst({
    where: {
      type: 'OCR_WINDOW_OPEN',
      createdAt: {
        gte: dayStart,
        lt: dayEnd,
      },
      data: {
        path: ['eventCode'],
        equals: eventCode,
      },
    },
    select: { id: true },
  });

  return Boolean(existing);
};

const createLifecycleMarkerNotifications = async (eventCode) => {
  const recipients = await prisma.user.findMany({
    where: {
      role: 'CUSTOMER',
      deletedAt: null,
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  if (!recipients.length) {
    return;
  }

  await prisma.notification.createMany({
    data: recipients.map((recipient) => ({
      userId: recipient.id,
      type: 'OCR_WINDOW_OPEN',
      title: {
        en: 'OCR Window Notice',
        am: 'የOCR ማሳወቂያ',
      },
      message: {
        en: 'OCR lifecycle notification was issued.',
        am: 'የOCR የሕይወት ዙር ማሳወቂያ ተልኳል።',
      },
      data: {
        eventCode,
      },
      isSent: true,
      sentVia: ['EMAIL', 'IN_APP'],
    })),
  });
};

const toReadingView = (reading) => {
  const billAmount = reading.bill ? toNumber(reading.bill.totalAmount) : 0;
  const consumption = reading.bill?.consumption || 0;
  const unitPrice = consumption > 0 ? (billAmount / consumption).toFixed(2) : '0.00';

  return {
    id: reading.id,
    readingValue: reading.readingValue,
    readingDate: reading.readingDate,
    meter: reading.meter
      ? {
          id: reading.meter.id,
          meterNumber: reading.meter.meterNumber,
        }
      : null,
    createdBy: reading.submittedBy || reading.User || reading.meter?.customer || null,
    tariff: {
      pricePerCubicMeter: Number(unitPrice),
    },
    bill: reading.bill
      ? {
          id: reading.bill.id,
          amount: billAmount,
          consumption: reading.bill.consumption,
          status: reading.bill.status,
          dueDate: reading.bill.dueDate,
        }
      : null,
  };
};

const toTariffView = (tariff) => {
  const sortedBlocks = Array.isArray(tariff.blocks)
    ? [...tariff.blocks].sort((a, b) => a.fromM3 - b.fromM3)
    : [];

  const baseBlock = sortedBlocks[0] || null;
  const priceValue = baseBlock ? toNumber(baseBlock.pricePerM3) : 0;

  return {
    id: tariff.id,
    name: tariff.name,
    version: tariff.version,
    isActive: tariff.isActive,
    effectiveFrom: tariff.effectiveFrom,
    effectiveTo: tariff.effectiveTo,
    createdAt: tariff.createdAt,
    updatedAt: tariff.updatedAt,
    pricePerCubicMeter: priceValue,
    blocks: sortedBlocks.map((block) => ({
      id: block.id,
      fromM3: block.fromM3,
      toM3: block.toM3,
      pricePerM3: toNumber(block.pricePerM3),
    })),
  };
};

const toOfficerView = (user) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phoneE164: user.phoneE164,
  nationalId: user.nationalId,
  role: user.role,
  fieldOfficerType: OFFICER_ROLE_TO_UI[user.role] || 'BILLING_OFFICER',
  status: user.status,
  woreda: user.woreda
    ? {
        id: user.woreda.id,
        name: user.woreda.name,
      }
    : null,
  subCity: user.subCity
    ? {
        id: user.subCity.id,
        name: user.subCity.name,
      }
    : null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

class SuperAdminService {
  // Get all active subcities (for map and list)
  static async getActiveSubCities() {
    return prisma.subCity.findMany({
      where: {
        deletedAt: null,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }
  // 1) Create SuperAdmin
  static async createSuperAdmin(data, createdByUserId = null) {
    const normalizedEmail = String(data.email || '')
      .trim()
      .toLowerCase();

    let resolvedSubCityId = data.subCityId;
    if (!resolvedSubCityId) {
      const fallbackSubCity = await prisma.subCity.findFirst({
        orderBy: { name: 'asc' },
        select: { id: true },
      });
      if (!fallbackSubCity) {
        throw new Error('No subcity found for super admin assignment');
      }
      resolvedSubCityId = fallbackSubCity.id;
    }

    const existing = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN', phoneE164: data.phoneE164, deletedAt: null },
    });
    if (existing) throw new Error('SuperAdmin already exists');

    const existingByEmail = await prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true, role: true, deletedAt: true },
    });
    if (existingByEmail && !existingByEmail.deletedAt) {
      throw new Error('User already exists');
    }

    const passwordHash = await hashPassword(data.password);
    const otp = generateOTP();
    const otpHash = await hashPassword(otp);
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);
    const creator = createdByUserId
      ? await prisma.user.findUnique({
          where: { id: createdByUserId },
          select: { fullName: true, email: true },
        })
      : null;

    try {
      const created =
        existingByEmail?.deletedAt && existingByEmail.role === 'SUPER_ADMIN'
          ? await prisma.user.update({
              where: { id: existingByEmail.id },
              data: {
                fullName: data.fullName,
                email: normalizedEmail,
                phoneE164: data.phoneE164,
                nationalId: data.nationalId,
                subCityId: resolvedSubCityId,
                woredaId: null,
                role: 'SUPER_ADMIN',
                fieldOfficerType: null,
                passwordHash,
                status: 'ACTIVE',
                emailVerified: false,
                otp: otpHash,
                otpExpiry,
                deletedAt: null,
                lastLoginAt: null,
              },
            })
          : await prisma.user.create({
              data: {
                fullName: data.fullName,
                email: normalizedEmail,
                phoneE164: data.phoneE164,
                nationalId: data.nationalId,
                subCityId: resolvedSubCityId,
                role: 'SUPER_ADMIN',
                passwordHash,
                status: 'ACTIVE',
                emailVerified: false,
                otp: otpHash,
                otpExpiry,
              },
            });

      await sendSuperAdminVerificationOtp(normalizedEmail, {
        otp,
        fullName: created.fullName,
        email: created.email,
        phoneE164: created.phoneE164,
        nationalId: created.nationalId,
        password: data.password,
        createdByName: creator?.fullName || 'System',
        createdByEmail: creator?.email || 'system@aquaconnect.local',
        createdAt: created.createdAt,
      });
      return created;
    } catch (error) {
      if (error?.code === 'P2002') {
        throw new Error('User already exists');
      }
      throw error;
    }
  }

  // 2) Login
  static async login(phoneOrEmail, password) {
    const user = await prisma.user.findFirst({
      where: {
        role: 'SUPER_ADMIN',
        OR: [{ phoneE164: phoneOrEmail }, { email: phoneOrEmail }],
      },
    });
    if (!user || user.deletedAt) throw new Error('SuperAdmin not found');

    if (user.status === 'SUSPENDED') {
      throw new Error('Your account has been suspended. Please contact our support team.');
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw new Error('Invalid credentials');

    return jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '12h',
    });
  }

  // 3) SubCity CRUD
  static async createSubCity(data) {
    return prisma.subCity.create({ data });
  }
  static async updateSubCity(id, data) {
    return prisma.subCity.update({ where: { id }, data });
  }
  static async deleteSubCity(id) {
    const existing = await prisma.subCity.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new Error('Subcity not found');
    }

    return prisma.subCity.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  // 4) Woreda CRUD
  static async createWoreda(data) {
    return prisma.woreda.create({ data });
  }
  static async updateWoreda(id, data) {
    return prisma.woreda.update({ where: { id }, data });
  }
  static async deleteWoreda(id) {
    return prisma.woreda.delete({ where: { id } });
  }

  // 5) Get Admins
  static async getAllAdmins(role) {
    return prisma.user.findMany({
      where: {
        ...(role ? { role } : {}),
        deletedAt: null,
      },
      include: {
        subCity: { select: { id: true, name: true } },
        woreda: { select: { id: true, name: true } },
      },
    });
  }
  static async getAdminsByLocation(subCityId, woredaId) {
    return prisma.user.findMany({
      where: {
        ...(subCityId ? { subCityId } : {}),
        ...(woredaId ? { woredaId } : {}),
        deletedAt: null,
      },
      include: {
        subCity: { select: { id: true, name: true } },
        woreda: { select: { id: true, name: true } },
      },
    });
  }

  // 6) Get Users
  static async getAllUsers() {
    return prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        deletedAt: null,
      },
      include: {
        subCity: { select: { id: true, name: true } },
        woreda: { select: { id: true, name: true } },
        meters: {
          select: {
            id: true,
            meterNumber: true,
            status: true,
          },
        },
      },
    });
  }
  static async getUsersByLocation(subCityId, woredaId) {
    return prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        ...(subCityId ? { subCityId } : {}),
        ...(woredaId ? { woredaId } : {}),
        deletedAt: null,
      },
      include: {
        subCity: { select: { id: true, name: true } },
        woreda: { select: { id: true, name: true } },
        meters: {
          select: {
            id: true,
            meterNumber: true,
            status: true,
          },
        },
      },
    });
  }

  static async updateUserStatus(userId, status) {
    const normalizedStatus = String(status || '')
      .trim()
      .toUpperCase();

    if (!['ACTIVE', 'SUSPENDED'].includes(normalizedStatus)) {
      throw new Error('Invalid status. Use ACTIVE or SUSPENDED.');
    }

    const existing = await prisma.user.findFirst({
      where: {
        id: userId,
        role: 'CUSTOMER',
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new Error('Customer not found');
    }

    return prisma.user.update({
      where: { id: userId },
      data: { status: normalizedStatus },
      include: {
        subCity: { select: { id: true, name: true } },
        woreda: { select: { id: true, name: true } },
        meters: {
          select: {
            id: true,
            meterNumber: true,
            status: true,
          },
        },
      },
    });
  }

  // Create Admin
  static async createAdmin(data, createdByUserId = null) {
    const { fullName, email, phone, nationalId, password, role, subCityId, woredaId } = data;
    const normalizedEmail = String(email || '')
      .trim()
      .toLowerCase();

    if (!fullName || String(fullName).trim().split(/\s+/).length < 2) {
      throw new Error('Full name must include first and second name');
    }

    // Validate role
    if (!['SUBCITY_ADMIN', 'WOREDA_ADMINS'].includes(role)) {
      throw new Error('Invalid role');
    }

    // Hash password
    const passwordHash = await hashPassword(password);
    const otp = generateOTP();
    const otpHash = await hashPassword(otp);
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);
    const creator = createdByUserId
      ? await prisma.user.findUnique({
          where: { id: createdByUserId },
          select: { fullName: true, email: true },
        })
      : null;

    try {
      const created = await prisma.user.create({
        data: {
          fullName,
          email: normalizedEmail,
          phoneE164: phone,
          nationalId,
          passwordHash,
          role,
          subCityId: subCityId || null,
          woredaId: woredaId || null,
          emailVerified: false,
          otp: otpHash,
          otpExpiry,
        },
        include: {
          subCity: { select: { id: true, name: true } },
          woreda: { select: { id: true, name: true } },
        },
      });

      await sendAdminVerificationOtp(normalizedEmail, {
        otp,
        role,
        fullName: created.fullName,
        email: created.email,
        phoneE164: created.phoneE164,
        nationalId: created.nationalId,
        password,
        createdByName: creator?.fullName || 'AquaConnect Super Admin',
        createdByEmail: creator?.email || 'system@aquaconnect.local',
        createdAt: created.createdAt,
        assignedSubCity: created.subCity?.name || null,
        assignedWoreda: created.woreda?.name || null,
      });

      return created;
    } catch (error) {
      if (error?.code === 'P2002') {
        throw new Error('User already exists');
      }
      throw error;
    }
  }

  // Update Admin
  static async updateAdmin(id, data) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  // Delete Admin
  static async deleteAdmin(id, actorUserId = null) {
    // Cannot delete seeded superadmin
    const admin = await prisma.user.findUnique({ where: { id } });
    if (!admin) throw new Error('Admin not found');

    if (actorUserId && id === actorUserId) {
      throw new Error('You cannot delete your currently signed-in account');
    }
    const seededPhone = process.env.SEED_SUPER_ADMIN_PHONE || '+251900000000';
    const seededEmail = process.env.SEED_SUPER_ADMIN_EMAIL || 'superadmin@citywater.local';
    const isSeededSuperAdmin =
      admin.role === 'SUPER_ADMIN' &&
      (admin.phoneE164 === seededPhone || String(admin.email || '').toLowerCase() === seededEmail);

    if (isSeededSuperAdmin) throw new Error('Cannot delete seeded superadmin');

    try {
      return await prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      if (error?.code === 'P2003') {
        throw new Error(
          'Cannot hard delete this admin because related records exist. Remove or reassign related data first.'
        );
      }
      throw error;
    }
  }

  // Get Admins
  static async getAdmins({ role, subCityId, woredaId }) {
    const filters = { role, subCityId, woredaId, deletedAt: null };
    Object.keys(filters).forEach((key) => filters[key] === undefined && delete filters[key]);

    return prisma.user.findMany({
      where: filters,
      include: {
        subCity: { select: { id: true, name: true } },
        woreda: { select: { id: true, name: true } },
      },
    });
  }

  static async getRecentAdminsByLoginTimestamp({ limit }) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 100));

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const startOfWeekWindow = new Date(startOfToday);
    startOfWeekWindow.setDate(startOfWeekWindow.getDate() - 7);

    const rows = await prisma.user.findMany({
      where: {
        role: { in: ['SUPER_ADMIN', 'SUBCITY_ADMIN', 'WOREDA_ADMINS'] },
        deletedAt: null,
        lastLoginAt: { not: null, gte: startOfWeekWindow },
      },
      include: {
        subCity: { select: { id: true, name: true } },
        woreda: { select: { id: true, name: true } },
      },
      orderBy: {
        lastLoginAt: 'desc',
      },
      take: safeLimit,
    });

    const grouped = {
      today: [],
      yesterday: [],
      withinWeek: [],
    };

    for (const row of rows) {
      const loginDate = row.lastLoginAt ? new Date(row.lastLoginAt) : null;
      if (!loginDate) continue;

      if (loginDate >= startOfToday) {
        grouped.today.push(row);
        continue;
      }

      if (loginDate >= startOfYesterday) {
        grouped.yesterday.push(row);
        continue;
      }

      grouped.withinWeek.push(row);
    }

    return grouped;
  }

  // Get Complaint Officers
  static async getComplaintOfficers({ subCityId, woredaId }) {
    return prisma.user.findMany({
      where: {
        role: {
          in: ['SUBCITY_COMPLAINT_OFFICER', 'WOREDA_COMPLAINT_OFFICER'],
        },
        ...(subCityId && { subCityId }),
        ...(woredaId && { woredaId }),
        deletedAt: null,
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        subCityId: true,
        woredaId: true,
      },
    });
  }
  static async getBillingOfficers({ subCityId, woredaId }) {
    return prisma.user.findMany({
      where: {
        role: {
          in: ['SUBCITY_BILLING_OFFICER', 'WOREDA_BILLING_OFFICER'],
        },
        ...(subCityId && { subCityId }),
        ...(woredaId && { woredaId }),
        deletedAt: null,
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        subCityId: true,
        woredaId: true,
      },
    });
  }

  static async getComplaints({ status, assignedToId, woredaId, subCityId }) {
    const where = {
      deletedAt: null,
      ...(assignedToId ? { assignedToId } : {}),
      ...(woredaId ? { woredaId } : {}),
      ...(subCityId ? { subCityId } : {}),
    };

    const mappedStatus = buildComplaintStatusFilter(status);
    if (mappedStatus) {
      where.status = mappedStatus;
    }

    const complaints = await prisma.complaint.findMany({
      where,
      include: {
        subCity: {
          select: {
            id: true,
            name: true,
          },
        },
        woreda: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneE164: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            fullName: true,
            email: true,
            fieldOfficerType: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return complaints.map(toComplaintView);
  }

  static async updateComplaintStatus(id, status) {
    const complaint = await prisma.complaint.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!complaint || complaint.deletedAt) {
      throw new Error('Complaint not found');
    }

    const dbStatus = UI_TO_DB_COMPLAINT_STATUS[status] || status;

    const updated = await prisma.complaint.update({
      where: { id },
      data: {
        status: dbStatus,
        ...(dbStatus === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
      },
      include: {
        subCity: {
          select: {
            id: true,
            name: true,
          },
        },
        woreda: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneE164: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            fullName: true,
            email: true,
            fieldOfficerType: true,
          },
        },
      },
    });

    return toComplaintView(updated);
  }

  static async getSchedules({ subCityId, woredaId, day }) {
    const rows = await prisma.waterSchedule.findMany({
      where: {
        ...(subCityId ? { subCityId } : {}),
        ...(woredaId ? { woredaId } : {}),
        ...(day ? { dayOfWeek: day } : {}),
        deletedAt: null,
      },
      include: {
        woreda: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startAt: 'asc' }],
    });

    return rows.map(toScheduleView);
  }

  static async getBills({ subCityId, woredaId }) {
    const rows = await prisma.bill.findMany({
      where: {
        ...(subCityId ? { subCityId } : {}),
        ...(woredaId
          ? {
              customer: {
                woredaId,
              },
            }
          : {}),
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneE164: true,
            woreda: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        reading: {
          select: {
            id: true,
            readingValue: true,
            readingDate: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return rows.map(toBillView);
  }

  static async markBillPaid(id, amount) {
    const existing = await prisma.bill.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        subCityId: true,
        totalAmount: true,
      },
    });

    if (!existing) {
      throw new Error('Bill not found');
    }

    const defaultAmount = toNumber(existing.totalAmount);
    const paidAmount =
      Number.isFinite(Number(amount)) && Number(amount) > 0 ? Number(amount) : defaultAmount;

    await prisma.$transaction(async (tx) => {
      await tx.bill.update({
        where: { id },
        data: {
          status: 'PAID',
          paidAmount,
        },
      });

      await tx.payment.create({
        data: {
          billId: existing.id,
          customerId: existing.customerId || null,
          subCityId: existing.subCityId,
          amount: paidAmount,
          method: 'BANK_TRANSFER',
          status: 'SUCCESS',
          paidAt: new Date(),
        },
      });
    });

    const updated = await prisma.bill.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneE164: true,
            woreda: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        reading: {
          select: {
            id: true,
            readingValue: true,
            readingDate: true,
          },
        },
      },
    });

    return toBillView(updated);
  }

  static async waiveBillPenalty(id) {
    const existing = await prisma.bill.findUnique({
      where: { id },
      select: {
        id: true,
        amount: true,
        status: true,
      },
    });

    if (!existing) {
      throw new Error('Bill not found');
    }

    await prisma.bill.update({
      where: { id },
      data: {
        lateDays: 0,
        latePenaltyAmount: 0,
        totalAmount: existing.amount,
        ...(existing.status !== 'PAID' ? { status: 'UNPAID' } : {}),
      },
    });

    const updated = await prisma.bill.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneE164: true,
            woreda: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        reading: {
          select: {
            id: true,
            readingValue: true,
            readingDate: true,
          },
        },
      },
    });

    return toBillView(updated);
  }

  static async getPublicStats() {
    const [metersCount, activeMetersCount, usersCount, subCitiesCount] = await Promise.all([
      prisma.meter.count({
        where: {
          deletedAt: null,
        },
      }),
      prisma.meter.count({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
        },
      }),
      prisma.user.count({
        where: {
          deletedAt: null,
        },
      }),
      prisma.subCity.count({
        where: {
          deletedAt: null,
          isActive: true,
        },
      }),
    ]);

    return {
      metersCount,
      usersCount,
      subCitiesCount,
      monitoringActiveCount: activeMetersCount,
      updatedAt: new Date().toISOString(),
    };
  }

  static async getMeters({ subCityId, woredaId }) {
    const rows = await prisma.meter.findMany({
      where: {
        deletedAt: null,
        ...(subCityId ? { subCityId } : {}),
        ...(woredaId
          ? {
              OR: [{ woredaId }, { customer: { woredaId } }],
            }
          : {}),
      },
      include: {
        woreda: {
          select: {
            id: true,
            name: true,
            subCityId: true,
          },
        },
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneE164: true,
          },
        },
        bills: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return rows.map(toMeterView);
  }

  static async createMeters(data) {
    const requestedSubCityId = String(data?.subCityId || '').trim();
    const woredaId = String(data?.woredaId || '').trim();
    const count = Math.max(0, Math.min(Number(data?.count) || 0, 1000));

    if (!woredaId) {
      throw new Error('Woreda is required');
    }

    if (!Number.isInteger(count) || count < 1) {
      throw new Error('Count must be at least 1');
    }

    const woreda = await prisma.woreda.findFirst({
      where: {
        id: woredaId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        subCityId: true,
      },
    });

    if (!woreda) {
      throw new Error('Woreda not found');
    }

    // Keep generation resilient by deriving subCityId from the selected woreda.
    const subCityId = woreda.subCityId || requestedSubCityId;

    if (!subCityId) {
      throw new Error('Unable to resolve subcity for selected woreda');
    }

    const [existingMeters, pendingRegistrations] = await Promise.all([
      prisma.meter.findMany({
        where: { deletedAt: null },
        select: { meterNumber: true },
      }),
      prisma.pendingRegistration.findMany({
        select: { meterNumber: true },
      }),
    ]);

    const reservedNumbers = new Set(
      [...existingMeters, ...pendingRegistrations].map((row) => row.meterNumber)
    );

    const createdMeters = [];
    const targetCount = Math.min(count, 1000);
    let attempts = 0;
    const maxAttempts = targetCount * 80;

    while (createdMeters.length < targetCount && attempts < maxAttempts) {
      attempts += 1;
      const meterNumber = Math.floor(Math.random() * 100000)
        .toString()
        .padStart(5, '0');

      if (reservedNumbers.has(meterNumber)) {
        continue;
      }

      try {
        const meter = await prisma.meter.create({
          data: {
            meterNumber,
            subCityId,
            woredaId,
            status: 'ACTIVE',
          },
          include: {
            woreda: {
              select: { id: true, name: true, subCityId: true },
            },
            customer: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneE164: true,
              },
            },
            bills: {
              select: { id: true, status: true },
            },
          },
        });

        reservedNumbers.add(meterNumber);
        createdMeters.push(toMeterView(meter));
      } catch (error) {
        if (error?.code === 'P2002') {
          reservedNumbers.add(meterNumber);
          continue;
        }
        throw error;
      }
    }

    if (createdMeters.length !== targetCount) {
      throw new Error('Unable to generate enough unique meter numbers');
    }

    return {
      message: `${createdMeters.length} meter numbers generated successfully`,
      woreda,
      meters: createdMeters,
    };
  }

  static async getReadings({ subCityId, woredaId }) {
    const meterFilter = {
      ...(subCityId ? { subCityId } : {}),
      ...(woredaId
        ? {
            customer: {
              woredaId,
            },
          }
        : {}),
    };

    const rows = await prisma.meterReading.findMany({
      where: {
        ...(Object.keys(meterFilter).length > 0
          ? {
              meter: meterFilter,
            }
          : {}),
      },
      include: {
        meter: {
          select: {
            id: true,
            meterNumber: true,
            customer: {
              select: {
                id: true,
                fullName: true,
                role: true,
              },
            },
          },
        },
        submittedBy: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
        User: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
        bill: {
          select: {
            id: true,
            totalAmount: true,
            consumption: true,
            status: true,
            dueDate: true,
          },
        },
      },
      orderBy: {
        readingDate: 'desc',
      },
    });

    return rows.map(toReadingView);
  }

  static async getWoredaFieldOfficers({ woredaId, subCityId, status }) {
    const rows = await prisma.user.findMany({
      where: {
        role: {
          in: ['WOREDA_BILLING_OFFICER', 'WOREDA_COMPLAINT_OFFICER'],
        },
        deletedAt: null,
        ...(woredaId ? { woredaId } : {}),
        ...(subCityId ? { subCityId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        woreda: {
          select: {
            id: true,
            name: true,
          },
        },
        subCity: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return rows.map(toOfficerView);
  }

  static async createWoredaFieldOfficer(data) {
    const role = OFFICER_UI_TO_ROLE[data.fieldOfficerType];
    if (!role) {
      throw new Error('Invalid field officer type');
    }

    if (!data.woredaId) {
      throw new Error('woredaId is required');
    }

    const woreda = await prisma.woreda.findUnique({
      where: { id: data.woredaId },
      select: { id: true, subCityId: true },
    });

    if (!woreda) {
      throw new Error('Woreda not found');
    }

    const passwordHash = await hashPassword(data.password);

    const created = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        phoneE164: data.phoneNumber,
        nationalId: data.nationalId,
        passwordHash,
        role,
        status: 'ACTIVE',
        subCityId: woreda.subCityId,
        woredaId: woreda.id,
      },
      include: {
        woreda: {
          select: {
            id: true,
            name: true,
          },
        },
        subCity: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return toOfficerView(created);
  }

  static async updateWoredaFieldOfficer(id, data) {
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new Error('Officer not found');
    }

    if (!OFFICER_ROLE_TO_UI[existing.role]) {
      throw new Error('User is not a woreda field officer');
    }

    const role = data.fieldOfficerType ? OFFICER_UI_TO_ROLE[data.fieldOfficerType] : existing.role;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(data.fullName ? { fullName: data.fullName } : {}),
        ...(data.email ? { email: data.email } : {}),
        ...(data.phoneNumber ? { phoneE164: data.phoneNumber } : {}),
        ...(data.nationalId ? { nationalId: data.nationalId } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(role ? { role } : {}),
      },
      include: {
        woreda: {
          select: {
            id: true,
            name: true,
          },
        },
        subCity: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return toOfficerView(updated);
  }

  static async deleteWoredaFieldOfficer(id) {
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new Error('Officer not found');
    }

    if (!OFFICER_ROLE_TO_UI[existing.role]) {
      throw new Error('User is not a woreda field officer');
    }

    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'DEACTIVATED',
      },
    });

    return { success: true };
  }

  static async createSchedule(data) {
    const subCityId = String(data?.subCityId || '').trim();
    const woredaIds = normalizeWoredaIds(data?.woredaIds || data?.woredaId);
    const blocks = normalizeScheduleBlocks(data?.scheduleBlocks);
    const fallbackDays = normalizeScheduleDays(data?.days || data?.day);
    const fallbackStartTime = String(data?.startTime || '').trim();
    const fallbackEndTime = String(data?.endTime || '').trim();
    const fallbackNoteText = String(data?.note || '').trim();

    if (!subCityId) {
      throw new Error('subCityId is required');
    }

    if (!woredaIds.length) {
      throw new Error('At least one woreda is required');
    }

    const normalizedBlocks =
      blocks.length > 0
        ? blocks
        : fallbackDays.length && fallbackStartTime && fallbackEndTime
        ? [
            {
              startDay: fallbackDays[0],
              endDay: fallbackDays[fallbackDays.length - 1],
              startTime: fallbackStartTime,
              endTime: fallbackEndTime,
              note: fallbackNoteText,
            },
          ]
        : [];

    if (!normalizedBlocks.length) {
      throw new Error('At least one schedule block is required');
    }

    const woredas = await prisma.woreda.findMany({
      where: {
        id: { in: woredaIds },
        subCityId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        subCityId: true,
      },
    });

    if (woredas.length !== woredaIds.length) {
      throw new Error('One or more woredas were not found');
    }

    const createdSchedules = await prisma.$transaction(async (tx) => {
      const rows = [];

      for (const woreda of woredas) {
        for (const block of normalizedBlocks) {
          const activeDays = expandDaysInRange(block.startDay, block.endDay);

          for (const day of activeDays) {
            const created = await tx.waterSchedule.create({
              data: {
                subCityId,
                woredaId: woreda.id,
                dayOfWeek: day,
                startAt: buildScheduleDate(block.startTime),
                endAt: buildScheduleDate(block.endTime),
                note: block.note ? { en: block.note, am: block.note } : null,
                isRecurring: true,
              },
              include: {
                woreda: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            });

            rows.push(created);
          }
        }
      }

      return rows;
    });

    const uniqueUsers = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        deletedAt: null,
        status: 'ACTIVE',
        subCityId,
        woredaId: { in: woredaIds },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        woredaId: true,
        woreda: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const usersById = new Map();
    for (const user of uniqueUsers) {
      if (!usersById.has(user.id)) {
        usersById.set(user.id, user);
      }
    }

    const recipients = Array.from(usersById.values());
    const createdScheduleIds = createdSchedules.map((schedule) => schedule.id);
    const summary = buildScheduleSummary({
      woredas,
      blocks: normalizedBlocks,
    });

    if (recipients.length) {
      await prisma.notification.createMany({
        data: recipients.map((recipient) => ({
          userId: recipient.id,
          type: 'SCHEDULE_CHANGE',
          title: {
            en: 'Water Schedule Update',
            am: 'የውሃ መርሃ ግብር ማሳወቂያ',
          },
          message: {
            en: summary,
            am: summary,
          },
          data: {
            subCityId,
            woredaIds,
            blocks: normalizedBlocks,
            scheduleIds: createdScheduleIds,
          },
          isRead: false,
          isSent: true,
          sentVia: recipient.email ? ['EMAIL', 'IN_APP'] : ['IN_APP'],
        })),
      });

      await Promise.allSettled(
        recipients
          .filter((recipient) => recipient.email)
          .map((recipient) =>
            sendScheduleNotice(recipient.email, {
              title: 'Water Schedule Update',
              summary,
              woredas: woredas.map((woreda) => woreda.name),
              blocks: normalizedBlocks,
              createdByName: 'Subcity Admin',
            })
          )
      );
    }

    return {
      message: 'Schedules created successfully',
      schedules: createdSchedules.map(toScheduleView),
      notifiedUserCount: recipients.length,
    };
  }

  static async updateSchedule(id, data) {
    const existing = await prisma.waterSchedule.findUnique({
      where: { id },
      select: {
        id: true,
        woredaId: true,
        subCityId: true,
        note: true,
        dayOfWeek: true,
        deletedAt: true,
      },
    });

    if (!existing || existing.deletedAt) {
      throw new Error('Schedule not found');
    }

    let nextWoredaId = existing.woredaId;
    let nextSubCityId = existing.subCityId;

    if (data.woredaId && data.woredaId !== existing.woredaId) {
      const woreda = await prisma.woreda.findUnique({
        where: { id: data.woredaId },
        select: { id: true, subCityId: true },
      });

      if (!woreda) {
        throw new Error('Woreda not found');
      }

      nextWoredaId = woreda.id;
      nextSubCityId = woreda.subCityId;
    }

    const updated = await prisma.waterSchedule.update({
      where: { id },
      data: {
        woredaId: nextWoredaId,
        subCityId: nextSubCityId,
        dayOfWeek: data.day || existing.dayOfWeek,
        ...(data.startTime ? { startAt: buildScheduleDate(data.startTime) } : {}),
        ...(data.endTime ? { endAt: buildScheduleDate(data.endTime) } : {}),
        ...(Object.prototype.hasOwnProperty.call(data, 'note')
          ? { note: data.note ? { en: data.note } : null }
          : {}),
      },
      include: {
        woreda: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return toScheduleView(updated);
  }

  static async deleteSchedule(id) {
    const existing = await prisma.waterSchedule.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new Error('Schedule not found');
    }

    await prisma.waterSchedule.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  static async getTariffs() {
    const rows = await prisma.tariff.findMany({
      include: {
        blocks: {
          orderBy: {
            fromM3: 'asc',
          },
        },
      },
      orderBy: {
        effectiveFrom: 'desc',
      },
    });

    return rows.map(toTariffView);
  }

  static async getOcrWindowStatus() {
    await this.processOcrWindowLifecycle();

    const now = new Date();

    await prisma.oCRWindow.updateMany({
      where: {
        isActive: true,
        closeDate: { lt: now },
      },
      data: {
        isActive: false,
      },
    });

    const latest = await prisma.oCRWindow.findFirst({
      where: {
        isLateWindow: false,
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { updatedAt: 'desc' }],
    });

    return toOcrWindowStatusView(latest);
  }

  static async getOcrWindowHistory(limit = 12) {
    await this.processOcrWindowLifecycle();

    const rows = await prisma.oCRWindow.findMany({
      where: {
        isLateWindow: false,
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      distinct: ['year', 'month', 'isLateWindow'],
      take: Number(limit) > 0 ? Number(limit) : 12,
    });

    return rows.map(toOcrWindowHistoryItem);
  }

  static async processOcrWindowLifecycle() {
    const now = new Date();

    await prisma.oCRWindow.updateMany({
      where: {
        isActive: true,
        closeDate: { lt: now },
      },
      data: {
        isActive: false,
      },
    });

    const latest = await prisma.oCRWindow.findFirst({
      where: {
        isLateWindow: false,
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { updatedAt: 'desc' }],
    });

    if (!latest) {
      return { processed: false };
    }

    const closeDate = new Date(latest.closeDate);
    const startDate = new Date(latest.openDate);
    const daysRemaining = getDaysRemaining(now, closeDate);
    const closeDual = formatDualCalendarDate(closeDate);
    const startDual = formatDualCalendarDate(startDate);

    if ([3, 2, 1].includes(daysRemaining)) {
      const eventCode = `OCR_REMINDER_${daysRemaining}_DAYS`;
      const alreadyNotified = await hasLifecycleNotificationToday(eventCode, now);

      if (!alreadyNotified) {
        const customers = await prisma.user.findMany({
          where: {
            role: 'CUSTOMER',
            deletedAt: null,
            status: 'ACTIVE',
            email: {
              not: '',
            },
          },
          select: {
            email: true,
          },
        });

        const emailTargets = customers
          .map((customer) => String(customer.email || '').trim())
          .filter(Boolean);

        if (emailTargets.length) {
          await Promise.allSettled(
            emailTargets.map((email) =>
              sendOcrWindowReminderNotice(email, {
                daysRemaining,
                closeDate,
                closeDateEthiopian: closeDual?.combinedWithAm,
              })
            )
          );
        }

        await createLifecycleMarkerNotifications(eventCode);
      }
    }

    if (daysRemaining < 0) {
      const eventCode = 'OCR_CLOSED';
      const alreadyNotified = await hasLifecycleNotificationToday(eventCode, now);

      if (!alreadyNotified) {
        const customers = await prisma.user.findMany({
          where: {
            role: 'CUSTOMER',
            deletedAt: null,
            status: 'ACTIVE',
            email: {
              not: '',
            },
          },
          select: {
            email: true,
          },
        });

        const emailTargets = customers
          .map((customer) => String(customer.email || '').trim())
          .filter(Boolean);

        if (emailTargets.length) {
          await Promise.allSettled(
            emailTargets.map((email) =>
              sendOcrWindowClosedNotice(email, {
                closeDate,
                closeDateEthiopian: closeDual?.combinedWithAm,
              })
            )
          );
        }

        await createLifecycleMarkerNotifications(eventCode);
      }
    }

    return {
      processed: true,
      window: {
        startDate: latest.openDate,
        closeDate: latest.closeDate,
        startDateEthiopian: startDual?.combinedWithAm || null,
        closeDateEthiopian: closeDual?.combinedWithAm || null,
      },
    };
  }

  static async openOcrWindow({ startDate, closeDate }, openedById) {
    const parsedStartDate = parseISODate(startDate, 'startDate');
    const parsedCloseDate = parseISODate(closeDate, 'closeDate');

    if (parsedCloseDate <= parsedStartDate) {
      throw new Error('closeDate must be after startDate');
    }

    const year = parsedStartDate.getFullYear();
    const month = parsedStartDate.getMonth() + 1;

    const activeSubCities = await prisma.subCity.findMany({
      where: {
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    });

    if (!activeSubCities.length) {
      throw new Error('No active subcities found to open OCR window');
    }

    const subCityIds = activeSubCities.map((subCity) => subCity.id);

    const { customers } = await prisma.$transaction(
      async (tx) => {
        await tx.oCRWindow.updateMany({
          where: {
            isActive: true,
            subCityId: { in: subCityIds },
          },
          data: {
            isActive: false,
          },
        });

        await Promise.all(
          subCityIds.map((subCityId) =>
            tx.oCRWindow.upsert({
              where: {
                subCityId_month_year_isLateWindow: {
                  subCityId,
                  month,
                  year,
                  isLateWindow: false,
                },
              },
              update: {
                openDate: parsedStartDate,
                closeDate: parsedCloseDate,
                isActive: true,
                openedById: openedById || null,
              },
              create: {
                subCityId,
                month,
                year,
                openDate: parsedStartDate,
                closeDate: parsedCloseDate,
                isLateWindow: false,
                isActive: true,
                openedById: openedById || null,
              },
            })
          )
        );

        const customers = await tx.user.findMany({
          where: {
            role: 'CUSTOMER',
            deletedAt: null,
            status: 'ACTIVE',
            email: {
              not: '',
            },
          },
          select: {
            id: true,
            email: true,
          },
        });

        if (customers.length) {
          await tx.notification.createMany({
            data: customers.map((customer) => ({
              userId: customer.id,
              type: 'OCR_WINDOW_OPEN',
              title: {
                en: 'OCR Window Open',
                am: 'የOCR መስኮት ተከፍቷል',
              },
              message: {
                en: 'The OCR meter reading window is now open. Please submit your reading before the closing date.',
                am: 'የOCR የሜትር ንባብ መስኮት አሁን ተከፍቷል። እባክዎ የመዝጊያ ቀን ከመድረሱ በፊት ንባብዎን ያስገቡ።',
              },
              data: {
                startDate: parsedStartDate.toISOString(),
                closeDate: parsedCloseDate.toISOString(),
              },
              isSent: true,
              sentVia: ['EMAIL', 'IN_APP'],
            })),
          });
        }

        return { customers };
      },
      {
        maxWait: 10000,
        timeout: 30000,
      }
    );

    const emailTargets = customers
      .map((customer) => String(customer.email || '').trim())
      .filter(Boolean);

    // Send emails in background so the API response is not blocked by SMTP latency.
    if (emailTargets.length) {
      void Promise.allSettled(
        emailTargets.map((email) =>
          sendOcrWindowOpenedNotice(email, {
            startDate: parsedStartDate,
            closeDate: parsedCloseDate,
            startDateEthiopian: formatDualCalendarDate(parsedStartDate)?.combinedWithAm,
            closeDateEthiopian: formatDualCalendarDate(parsedCloseDate)?.combinedWithAm,
          })
        )
      ).then((results) => {
        const emailed = results.filter((result) => result.status === 'fulfilled').length;
        const emailFailed = results.length - emailed;
        console.log(
          `OCR window emails processed: sent=${emailed}, failed=${emailFailed}, queued=${results.length}`
        );
      });
    }

    return {
      message: 'OCR window has been scheduled and opened successfully',
      window: {
        startDate: parsedStartDate.toISOString(),
        closeDate: parsedCloseDate.toISOString(),
        startDateDual: formatDualCalendarDate(parsedStartDate),
        closeDateDual: formatDualCalendarDate(parsedCloseDate),
        month,
        year,
      },
      affectedSubCities: subCityIds.length,
      customersNotified: emailTargets.length,
      emailsSent: 0,
      emailFailures: 0,
      emailQueued: emailTargets.length,
    };
  }

  static async getAnnouncements({ limit } = {}) {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);

    const rows = await prisma.announcement.findMany({
      where: {
        isActive: true,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        reads: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take,
    });

    return rows.map((announcement) => ({
      ...toAnnouncementView(announcement),
      readCount: announcement.reads.length,
    }));
  }

  static async createAnnouncement(data, createdById) {
    const title = String(data?.title || '').trim();
    const message = String(data?.message || '').trim();
    const targetGroup = String(data?.targetGroup || '').trim();
    const subCityId = String(data?.subCityId || '').trim() || null;
    const targetWoredaIds = normalizeWoredaIds(data?.targetWoredaIds);
    const sendEmail = data?.sendEmail !== false;

    if (!title) {
      throw new Error('Title is required');
    }

    if (!message) {
      throw new Error('Message is required');
    }

    if (!targetGroup) {
      throw new Error('Target group is required');
    }

    let userWhere = {
      deletedAt: null,
      status: 'ACTIVE',
    };
    let targetLabel = '';
    let audience = 'ALL';

    switch (targetGroup) {
      case 'ALL_USERS':
        targetLabel = 'All active users';
        audience = 'ALL';
        break;
      case 'SUBCITY_USERS':
        if (!subCityId) {
          throw new Error('Subcity is required for this target group');
        }
        userWhere = { ...userWhere, role: 'CUSTOMER', subCityId };
        targetLabel = 'Users in selected subcity';
        audience = 'CUSTOMERS';
        break;
      case 'WOREDA_USERS':
        if (!targetWoredaIds.length) {
          throw new Error('At least one woreda is required for this target group');
        }
        userWhere = {
          ...userWhere,
          role: 'CUSTOMER',
          woredaId: { in: targetWoredaIds },
        };
        targetLabel =
          targetWoredaIds.length > 1 ? 'Users in selected woredas' : 'Users in selected woreda';
        audience = 'CUSTOMERS';
        break;
      case 'SUBCITY_ADMINS':
        userWhere = {
          ...userWhere,
          role: 'SUBCITY_ADMIN',
          ...(subCityId ? { subCityId } : {}),
        };
        targetLabel = 'Subcity admins';
        audience = 'SUBCITY_ADMINS';
        break;
      case 'WOREDA_ADMINS':
        userWhere = {
          ...userWhere,
          role: 'WOREDA_ADMINS',
          ...(targetWoredaIds.length ? { woredaId: { in: targetWoredaIds } } : {}),
        };
        targetLabel = 'Woreda admins';
        audience = 'WOREDA_ADMINS';
        break;
      case 'OFFICERS':
        userWhere = {
          ...userWhere,
          role: { in: OFFICER_ROLES },
          ...(subCityId ? { subCityId } : {}),
          ...(targetWoredaIds.length ? { woredaId: { in: targetWoredaIds } } : {}),
        };
        targetLabel = 'Officers';
        audience = 'FIELD_OFFICERS';
        break;
      case 'SUBCITY_USERS_AND_ADMINS':
        if (!subCityId) {
          throw new Error('Subcity is required for this target group');
        }
        userWhere = {
          ...userWhere,
          subCityId,
          role: { in: ['CUSTOMER', 'SUBCITY_ADMIN'] },
        };
        targetLabel = 'Subcity users and subcity admins';
        audience = 'ALL';
        break;
      default:
        throw new Error('Unsupported target group');
    }

    const recipients = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    if (!recipients.length) {
      throw new Error('No recipients found for the selected target group');
    }

    const broadcast = targetGroup === 'ALL_USERS';
    const targetUserIds = broadcast ? [] : recipients.map((user) => user.id);
    const emailRecipients = sendEmail
      ? recipients
          .filter((user) => ADMIN_ROLES.has(user.role) || OFFICER_ROLES.includes(user.role))
          .map((user) => ({
            id: user.id,
            email: String(user.email || '').trim(),
            role: user.role,
          }))
          .filter((user) => user.email)
      : [];
    const emailRecipientIds = new Set(emailRecipients.map((item) => item.id));

    const createdBy = createdById
      ? await prisma.user.findUnique({
          where: { id: createdById },
          select: { id: true, fullName: true, email: true },
        })
      : null;

    const announcement = await prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({
        data: {
          subCityId,
          targetWoredaIds,
          type: 'GENERAL',
          priority: 'MEDIUM',
          title: {
            en: title,
            am: title,
          },
          message: {
            en: message,
            am: message,
          },
          mediaUrls: [],
          isActive: true,
          isBroadcast: broadcast,
          audience,
          targetUserIds,
          createdById: createdBy?.id || null,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
          reads: {
            select: {
              id: true,
            },
          },
        },
      });

      await tx.notification.createMany({
        data: recipients.map((recipient) => ({
          userId: recipient.id,
          type: 'SYSTEM_ANNOUNCEMENT',
          title: {
            en: title,
            am: title,
          },
          message: {
            en: message,
            am: message,
          },
          data: {
            announcementId: created.id,
            targetGroup,
          },
          isRead: false,
          isSent: true,
          sentVia: emailRecipientIds.has(recipient.id) ? ['IN_APP', 'EMAIL'] : ['IN_APP'],
        })),
      });

      return created;
    });

    if (emailRecipients.length) {
      void Promise.allSettled(
        emailRecipients.map((recipient) =>
          sendAnnouncementNotice(recipient.email, {
            title,
            message,
            targetLabel,
            senderName: createdBy?.fullName || 'Super Admin',
            senderEmail: createdBy?.email || '',
          })
        )
      );
    }

    return {
      message: 'Announcement sent successfully',
      announcement: toAnnouncementView(announcement),
      targetUserCount: recipients.length,
      sentEmailCount: emailRecipients.length,
    };
  }

  static async createTariff({ pricePerM3, effectiveFrom }) {
    const parsedPrice = Number(pricePerM3);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      throw new Error('Valid pricePerM3 is required');
    }

    const parsedEffectiveFrom = new Date(effectiveFrom);
    if (Number.isNaN(parsedEffectiveFrom.getTime())) {
      throw new Error('Valid effectiveFrom is required');
    }

    const now = new Date();
    const activateNow = parsedEffectiveFrom <= now;

    const latest = await prisma.tariff.findFirst({
      orderBy: {
        version: 'desc',
      },
      select: {
        version: true,
      },
    });

    const nextVersion = (latest?.version || 0) + 1;

    const created = await prisma.$transaction(async (tx) => {
      if (activateNow) {
        await tx.tariff.updateMany({
          where: {
            isActive: true,
            effectiveTo: null,
          },
          data: {
            isActive: false,
            effectiveTo: now,
          },
        });
      }

      return tx.tariff.create({
        data: {
          name: `Tariff v${nextVersion}`,
          version: nextVersion,
          isActive: activateNow,
          effectiveFrom: parsedEffectiveFrom,
          blocks: {
            create: [
              {
                fromM3: 0,
                toM3: null,
                pricePerM3: parsedPrice,
              },
            ],
          },
        },
        include: {
          blocks: {
            orderBy: {
              fromM3: 'asc',
            },
          },
        },
      });
    });

    return toTariffView(created);
  }
}

export default SuperAdminService;
