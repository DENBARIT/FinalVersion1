import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/db.js';
import { comparePassword, hashPassword } from '../../utils/hashtoken.js';
import { generateAccessToken, generateRefreshToken } from '../../utils/generateToken.js';
import {
  sendOtp,
  sendPasswordResetOtp,
  sendSuperAdminVerificationOtp,
  sendOwnershipTransferNotice,
} from '../../config/email.js';

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'superrefreshsecret';
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

const otpRequestLocks = new Map();

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function normalizeProvider(provider) {
  return String(provider || '')
    .trim()
    .toLowerCase();
}

const LOGIN_ROLE_PRIORITY = [
  'SUBCITY_ADMIN',
  'SUBCITY_BILLING_OFFICER',
  'SUBCITY_COMPLAINT_OFFICER',
  'WOREDA_ADMINS',
  'WOREDA_ADMIN',
  'WOREDA_BILLING_OFFICER',
  'WOREDA_COMPLAINT_OFFICER',
  'SUPER_ADMIN',
  'FIELD_OFFICER',
  'CUSTOMER',
];

function getLoginRolePriority(role) {
  const normalizedRole = String(role || '')
    .trim()
    .toUpperCase();
  const index = LOGIN_ROLE_PRIORITY.indexOf(normalizedRole);
  return index === -1 ? LOGIN_ROLE_PRIORITY.length : index;
}

const WEEK_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const DAY_AMHARIC_MAP = {
  MONDAY: 'ሰኞ',
  TUESDAY: 'ማክሰኞ',
  WEDNESDAY: 'ረቡዕ',
  THURSDAY: 'ሐሙስ',
  FRIDAY: 'ዓርብ',
  SATURDAY: 'ቅዳሜ',
  SUNDAY: 'እሑድ',
};

function toTimeHHMM(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function toTime12(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours %= 12;
  if (hours === 0) {
    hours = 12;
  }

  return `${String(hours).padStart(2, '0')}:${minutes} ${period}`;
}

function normalizeDayName(dayValue, dateValue) {
  const fromValue = String(dayValue || '')
    .trim()
    .toUpperCase();
  if (WEEK_DAYS.includes(fromValue)) {
    return fromValue;
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return WEEK_DAYS[date.getDay()] || '';
}

async function verifyGoogleToken(providerToken) {
  if (!providerToken) {
    return null;
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(providerToken)}`
  );

  if (!response.ok) {
    throw new Error('Google sign-in could not be verified.');
  }

  return response.json();
}

async function verifyFacebookToken(providerToken) {
  if (!providerToken) {
    return null;
  }

  const response = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(
      providerToken
    )}`
  );

  if (!response.ok) {
    throw new Error('Facebook sign-in could not be verified.');
  }

  return response.json();
}

function getOtpRequestKey(purpose, normalizedEmail) {
  return `${purpose}:${normalizedEmail}`;
}

function getCooldownRemainingSeconds(purpose, normalizedEmail) {
  const key = getOtpRequestKey(purpose, normalizedEmail);
  const unlockAt = otpRequestLocks.get(key);

  if (!unlockAt) {
    return 0;
  }

  const remainingMs = unlockAt - Date.now();
  if (remainingMs <= 0) {
    otpRequestLocks.delete(key);
    return 0;
  }

  return Math.ceil(remainingMs / 1000);
}

function applyOtpCooldown(purpose, normalizedEmail) {
  const key = getOtpRequestKey(purpose, normalizedEmail);
  const unlockAt = Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1000;
  otpRequestLocks.set(key, unlockAt);
}

function throwOtpRateLimit(remainingSeconds) {
  const error = new Error(`OTP sent. You can request again in ${remainingSeconds}s.`);
  error.code = 'OTP_RATE_LIMIT';
  error.retryAfterSeconds = remainingSeconds;
  throw error;
}

function isSeededSuperAdmin(user) {
  if (!user || user.role !== 'SUPER_ADMIN') {
    return false;
  }

  const seededPhone = process.env.SEED_SUPER_ADMIN_PHONE || '+251900000000';
  const seededEmail = String(process.env.SEED_SUPER_ADMIN_EMAIL || 'superadmin@citywater.local')
    .trim()
    .toLowerCase();

  return (
    user.phoneE164 === seededPhone ||
    String(user.email || '')
      .trim()
      .toLowerCase() === seededEmail
  );
}

class AuthService {
  _toNotificationFeedItem(notification) {
    const title = notification?.title?.en || notification?.title?.am || '';
    const message = notification?.message?.en || notification?.message?.am || '';

    return {
      id: notification.id,
      title,
      message,
      titleLocalized: notification.title,
      messageLocalized: notification.message,
      createdAt: notification.createdAt,
      isRead: notification.isRead,
      type: notification.type,
      data: notification.data || null,
    };
  }

  _toAnnouncementFeedItem(announcement, userId) {
    const title = announcement?.title?.en || announcement?.title?.am || '';
    const message = announcement?.message?.en || announcement?.message?.am || '';

    return {
      id: announcement.id,
      title,
      message,
      titleLocalized: announcement.title,
      messageLocalized: announcement.message,
      createdAt: announcement.createdAt,
      isRead: announcement.reads.some((read) => read.userId === userId),
    };
  }

  async getAnnouncementsForUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new Error('User not found or inactive');
    }

    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        OR: [{ isBroadcast: true }, { targetUserIds: { has: userId } }],
      },
      include: {
        reads: {
          where: { userId },
          select: { userId: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    const items = announcements.map((announcement) =>
      this._toAnnouncementFeedItem(announcement, userId)
    );
    const unreadCount = items.filter((item) => !item.isRead).length;

    return {
      unreadCount,
      items,
    };
  }

  async getScheduleNotificationsForUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new Error('User not found or inactive');
    }

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        type: 'SCHEDULE_CHANGE',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    const items = notifications.map((notification) => this._toNotificationFeedItem(notification));
    const unreadCount = notifications.filter((notification) => !notification.isRead).length;

    return {
      unreadCount,
      items,
    };
  }

  async getSchedulesForUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        subCityId: true,
        woredaId: true,
      },
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new Error('User not found or inactive');
    }

    const schedules = await prisma.waterSchedule.findMany({
      where: {
        deletedAt: null,
        ...(user.subCityId ? { subCityId: user.subCityId } : {}),
        ...(user.woredaId ? { woredaId: user.woredaId } : {}),
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

    return {
      items: schedules.map((schedule) => ({
        ...(function buildScheduleEntry() {
          const day = normalizeDayName(schedule.dayOfWeek, schedule.startAt);
          const dayLabel = day ? `${day.charAt(0)}${day.slice(1).toLowerCase()}` : '';
          const dayAm = DAY_AMHARIC_MAP[day] || '';
          const startTime = toTimeHHMM(schedule.startAt);
          const endTime = toTimeHHMM(schedule.endAt);
          const startTime12 = toTime12(schedule.startAt);
          const endTime12 = toTime12(schedule.endAt);
          const noteText =
            typeof schedule.note === 'string'
              ? schedule.note
              : schedule.note?.en || schedule.note?.am || '';

          return {
            id: schedule.id,
            day,
            dayLabel,
            dayAm,
            startTime,
            endTime,
            startTime12,
            endTime12,
            note: noteText,
            messageGregorian: `${dayLabel} from ${startTime12} to ${endTime12}`.trim(),
            messageEthiopian: `${dayAm} ከ ${startTime12} እስከ ${endTime12}`.trim(),
            woreda: schedule.woreda,
            createdAt: schedule.createdAt,
            updatedAt: schedule.updatedAt,
          };
        })(),
      })),
    };
  }

  async markAnnouncementAsRead(userId, announcementId) {
    const normalizedAnnouncementId = String(announcementId || '').trim();
    if (!normalizedAnnouncementId) {
      throw new Error('Announcement id is required');
    }

    const target = await prisma.announcement.findFirst({
      where: {
        id: normalizedAnnouncementId,
        isActive: true,
        OR: [{ isBroadcast: true }, { targetUserIds: { has: userId } }],
      },
      select: {
        id: true,
      },
    });

    if (!target) {
      throw new Error('Announcement not found for this user');
    }

    await prisma.announcementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId: target.id,
          userId,
        },
      },
      create: {
        announcementId: target.id,
        userId,
      },
      update: {
        readAt: new Date(),
      },
    });

    await prisma.notification.updateMany({
      where: {
        userId,
        type: 'SYSTEM_ANNOUNCEMENT',
        OR: [{ data: { path: ['announcementId'], equals: target.id } }],
      },
      data: {
        isRead: true,
      },
    });

    const unreadCount = await prisma.announcement.count({
      where: {
        isActive: true,
        OR: [{ isBroadcast: true }, { targetUserIds: { has: userId } }],
        reads: {
          none: { userId },
        },
      },
    });

    return {
      announcementId: target.id,
      unreadCount,
    };
  }

  async registerUser(data) {
    const { fullName, phoneE164, email, password, nationalId, meterNumber, subCityId, woredaId } =
      data;

    if (
      !fullName ||
      !phoneE164 ||
      !email ||
      !password ||
      !nationalId ||
      !meterNumber ||
      !subCityId ||
      !woredaId
    ) {
      throw new Error('All registration fields are required');
    }

    const normalizedEmail = normalizeEmail(email);

    const [
      existingUserByEmail,
      existingUserByPhone,
      existingUserByNationalId,
      pendingByEmail,
      pendingByPhone,
      pendingByNationalId,
      pendingByMeter,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { email: normalizedEmail } }),
      prisma.user.findUnique({ where: { phoneE164 } }),
      prisma.user.findUnique({ where: { nationalId } }),
      prisma.pendingRegistration.findUnique({ where: { email: normalizedEmail } }),
      prisma.pendingRegistration.findUnique({ where: { phoneE164 } }),
      prisma.pendingRegistration.findUnique({ where: { nationalId } }),
      prisma.pendingRegistration.findUnique({ where: { meterNumber } }),
    ]);

    if (existingUserByPhone && existingUserByPhone.email !== normalizedEmail) {
      throw new Error('Phone number is already associated with another account.');
    }

    if (existingUserByNationalId && existingUserByNationalId.email !== normalizedEmail) {
      throw new Error('National ID is already associated with another account.');
    }

    if (pendingByPhone && pendingByPhone.email !== normalizedEmail) {
      throw new Error('Phone number is already associated with another pending registration.');
    }

    if (pendingByNationalId && pendingByNationalId.email !== normalizedEmail) {
      throw new Error('National ID is already associated with another pending registration.');
    }

    if (pendingByMeter && pendingByMeter.email !== normalizedEmail) {
      throw new Error('Meter number is already associated with another pending registration.');
    }

    const existingUser = existingUserByEmail;

    if (existingUser) {
      if (existingUser.emailVerified) {
        throw new Error('User already exists');
      }

      if (existingUser.phoneE164 !== phoneE164) {
        throw new Error('This email is already associated with a different phone number.');
      }

      if (existingUser.nationalId !== nationalId) {
        throw new Error('This email is already associated with a different national ID.');
      }

      const otp = generateOTP();
      const otpHash = await bcrypt.hash(otp, 10);
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);

      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          otp: otpHash,
          otpExpiry,
        },
      });

      await sendOtp(existingUser.email, otp);

      return {
        message: 'OTP sent to your email. Please verify to complete registration.',
        email: existingUser.email,
      };
    }

    const existingMeter = await prisma.meter.findUnique({
      where: { meterNumber },
      select: {
        id: true,
        customerId: true,
        subCityId: true,
        woredaId: true,
        status: true,
      },
    });

    if (existingMeter?.customerId) {
      throw new Error('Meter number already registered');
    }

    if (existingMeter) {
      if (existingMeter.subCityId !== subCityId) {
        throw new Error('Meter number belongs to a different subcity');
      }

      if (existingMeter.woredaId && existingMeter.woredaId !== woredaId) {
        throw new Error('Meter number belongs to a different woreda');
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);

    if (pendingByEmail) {
      if (pendingByEmail.phoneE164 !== phoneE164) {
        throw new Error('This email is already associated with a different phone number.');
      }

      if (pendingByEmail.nationalId !== nationalId) {
        throw new Error('This email is already associated with a different national ID.');
      }

      if (pendingByEmail.meterNumber !== meterNumber) {
        throw new Error('This email is already associated with a different meter number.');
      }

      await prisma.pendingRegistration.update({
        where: { id: pendingByEmail.id },
        data: {
          fullName,
          phoneE164,
          email: normalizedEmail,
          nationalId,
          passwordHash,
          meterNumber,
          subCityId,
          woredaId,
          otp: otpHash,
          otpExpiry,
        },
      });
    } else {
      await prisma.pendingRegistration.create({
        data: {
          fullName,
          phoneE164,
          email: normalizedEmail,
          nationalId,
          passwordHash,
          meterNumber,
          subCityId,
          woredaId,
          otp: otpHash,
          otpExpiry,
        },
      });
    }

    await sendOtp(normalizedEmail, otp);

    return {
      message: 'OTP sent to your email. Please verify to complete registration.',
      email: normalizedEmail,
    };
  }

  async loginUser({ emailOrPhone, phoneE164, password }) {
    const identifier = emailOrPhone || phoneE164;

    if (!identifier || !password) {
      throw new Error('Identifier and password are required');
    }

    const candidates = await prisma.user.findMany({
      where: {
        OR: [{ email: identifier }, { phoneE164: identifier }],
        deletedAt: null,
      },
    });

    const user = candidates
      .slice()
      .sort((left, right) => getLoginRolePriority(left.role) - getLoginRolePriority(right.role))[0];

    if (!user || user.deletedAt) {
      throw new Error('Invalid credentials');
    }

    if (user.status === 'SUSPENDED') {
      throw new Error('Your account has been suspended. Please contact our support team.');
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('Invalid credentials');
    }

    if (!user.emailVerified && !isSeededSuperAdmin(user)) {
      const error = new Error('Email not verified. Please verify your email before logging in.');
      error.code = 'EMAIL_NOT_VERIFIED';
      error.email = user.email;
      throw error;
    }

    const match = await comparePassword(password, user.passwordHash);

    if (!match) {
      throw new Error('Invalid credentials');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        description: 'User logged in',
      },
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return { accessToken, refreshToken, fullName: user.fullName };
  }

  async socialLogin({ provider, email, providerToken }) {
    const normalizedProvider = normalizeProvider(provider);

    if (!normalizedProvider) {
      throw new Error('Provider is required');
    }

    if (!email) {
      throw new Error('Email is required');
    }

    const normalizedEmail = normalizeEmail(email);
    let verifiedEmail = normalizedEmail;

    if (normalizedProvider === 'google') {
      const tokenInfo = await verifyGoogleToken(providerToken);
      if (tokenInfo?.email) {
        verifiedEmail = normalizeEmail(tokenInfo.email);
      }
    } else if (normalizedProvider === 'facebook') {
      const profile = await verifyFacebookToken(providerToken);
      if (profile?.email) {
        verifiedEmail = normalizeEmail(profile.email);
      }
    } else {
      throw new Error('Unsupported social provider');
    }

    if (verifiedEmail !== normalizedEmail) {
      throw new Error('Social account email does not match the requested email.');
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user || user.deletedAt) {
      throw new Error('No registered account found for this email.');
    }

    if (user.status === 'SUSPENDED') {
      throw new Error('Your account has been suspended. Please contact our support team.');
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('Invalid credentials');
    }

    if (!user.emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        description: `User logged in with ${normalizedProvider} sign-in`,
      },
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return { accessToken, refreshToken };
  }

  async validateOtp(email, otp) {
    const normalizedEmail = normalizeEmail(email);

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user) {
      if (user.emailVerified) {
        throw new Error('Email already verified');
      }
      if (!user.otp || !user.otpExpiry) {
        throw new Error('No OTP found, request a new one');
      }
      if (user.otpExpiry < new Date()) {
        throw new Error('OTP expired');
      }

      const isValid = await bcrypt.compare(otp, user.otp);
      if (!isValid) {
        throw new Error('Invalid OTP');
      }

      await prisma.user.update({
        where: { email: normalizedEmail },
        data: { emailVerified: true, otp: null, otpExpiry: null },
      });

      return { message: 'Email verified successfully' };
    }

    const pending = await prisma.pendingRegistration.findUnique({
      where: { email: normalizedEmail },
    });

    if (!pending) {
      throw new Error('No pending registration found');
    }

    if (pending.otpExpiry < new Date()) {
      throw new Error('OTP expired');
    }

    const isValid = await bcrypt.compare(otp, pending.otp);
    if (!isValid) {
      throw new Error('Invalid OTP');
    }

    await prisma.$transaction(async (tx) => {
      const duplicateUser = await tx.user.findFirst({
        where: {
          OR: [
            { email: pending.email },
            { phoneE164: pending.phoneE164 },
            { nationalId: pending.nationalId },
          ],
        },
      });

      if (duplicateUser) {
        throw new Error('User already exists');
      }

      const duplicateMeter = await tx.meter.findUnique({
        where: { meterNumber: pending.meterNumber },
        select: {
          id: true,
          customerId: true,
          subCityId: true,
          woredaId: true,
        },
      });

      if (duplicateMeter?.customerId) {
        throw new Error('Meter number already registered');
      }

      if (duplicateMeter) {
        if (duplicateMeter.subCityId !== pending.subCityId) {
          throw new Error('Meter number belongs to a different subcity');
        }

        if (
          duplicateMeter.woredaId &&
          pending.woredaId &&
          duplicateMeter.woredaId !== pending.woredaId
        ) {
          throw new Error('Meter number belongs to a different woreda');
        }
      }

      const createdUser = await tx.user.create({
        data: {
          fullName: pending.fullName,
          phoneE164: pending.phoneE164,
          email: pending.email,
          nationalId: pending.nationalId,
          passwordHash: pending.passwordHash,
          subCityId: pending.subCityId,
          woredaId: pending.woredaId,
          role: 'CUSTOMER',
          emailVerified: true,
          otp: null,
          otpExpiry: null,
          preference: {
            create: {},
          },
        },
      });

      if (duplicateMeter) {
        await tx.meter.update({
          where: { id: duplicateMeter.id },
          data: {
            customerId: createdUser.id,
            subCityId: pending.subCityId,
            woredaId: pending.woredaId,
            registeredNationalId: pending.nationalId,
            registeredFullName: pending.fullName,
            registeredAt: new Date(),
            registeredById: createdUser.id,
            status: 'ACTIVE',
          },
        });
      } else {
        await tx.meter.create({
          data: {
            meterNumber: pending.meterNumber,
            customerId: createdUser.id,
            subCityId: pending.subCityId,
            woredaId: pending.woredaId,
            registeredNationalId: pending.nationalId,
            registeredFullName: pending.fullName,
            registeredAt: new Date(),
            registeredById: createdUser.id,
          },
        });
      }

      await tx.pendingRegistration.delete({
        where: { id: pending.id },
      });
    });

    return { message: 'Email verified successfully' };
  }

  async resendOtp(email) {
    const normalizedEmail = normalizeEmail(email);

    const cooldownRemaining = getCooldownRemainingSeconds('verify', normalizedEmail);
    if (cooldownRemaining > 0) {
      throwOtpRateLimit(cooldownRemaining);
    }

    applyOtpCooldown('verify', normalizedEmail);

    const pending = await prisma.pendingRegistration.findUnique({
      where: { email: normalizedEmail },
    });

    if (pending) {
      const otp = generateOTP();
      const otpHash = await bcrypt.hash(otp, 10);
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);

      await prisma.pendingRegistration.update({
        where: { id: pending.id },
        data: { otp: otpHash, otpExpiry },
      });

      await sendOtp(normalizedEmail, otp);

      return {
        message: `OTP sent. You can request again in ${OTP_RESEND_COOLDOWN_SECONDS}s.`,
        cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      };
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return {
        message: `If an unverified account exists, a new OTP has been sent. You can request again in ${OTP_RESEND_COOLDOWN_SECONDS}s.`,
        cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      };
    }

    if (user.emailVerified) {
      throw new Error('Email is already verified. OTP resend is not allowed.');
    }

    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);

    await prisma.user.update({
      where: { email: normalizedEmail },
      data: { otp: otpHash, otpExpiry },
    });

    if (user.role === 'SUPER_ADMIN') {
      await sendSuperAdminVerificationOtp(normalizedEmail, {
        otp,
        fullName: user.fullName,
        email: user.email,
        phoneE164: user.phoneE164,
        nationalId: user.nationalId,
        createdAt: user.createdAt,
      });
    } else {
      await sendOtp(normalizedEmail, otp);
    }

    return {
      message: `OTP sent. You can request again in ${OTP_RESEND_COOLDOWN_SECONDS}s.`,
      cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  async forgotPassword(email) {
    const normalizedEmail = normalizeEmail(email);

    const cooldownRemaining = getCooldownRemainingSeconds('reset', normalizedEmail);
    if (cooldownRemaining > 0) {
      throwOtpRateLimit(cooldownRemaining);
    }

    applyOtpCooldown('reset', normalizedEmail);

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user || !user.emailVerified) {
      return {
        message: `If an eligible account exists, a reset OTP has been sent. You can request again in ${OTP_RESEND_COOLDOWN_SECONDS}s.`,
        cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      };
    }

    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);

    await prisma.user.update({
      where: { email: normalizedEmail },
      data: { otp: otpHash, otpExpiry },
    });

    await sendPasswordResetOtp(normalizedEmail, otp);

    return {
      message: `Reset OTP sent. You can request again in ${OTP_RESEND_COOLDOWN_SECONDS}s.`,
      cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  async validateResetOtp({ email, otp }) {
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user || !user.otp || !user.otpExpiry) {
      throw new Error('No OTP found, request a new one');
    }

    if (user.otpExpiry < new Date()) {
      throw new Error('OTP expired');
    }

    const isValid = await bcrypt.compare(otp, user.otp);
    if (!isValid) {
      throw new Error('Invalid OTP');
    }

    return { message: 'OTP verified. Continue to set a new password.' };
  }

  async resetPassword({ email, otp, newPassword }) {
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      throw new Error('User not found');
    }
    if (!user.otp || !user.otpExpiry) {
      throw new Error('No OTP found, request a new one');
    }
    if (user.otpExpiry < new Date()) {
      throw new Error('OTP expired');
    }

    const isValid = await bcrypt.compare(otp, user.otp);
    if (!isValid) {
      throw new Error('Invalid OTP');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        passwordHash,
        otp: null,
        otpExpiry: null,
      },
    });

    return { message: 'Password reset successfully.' };
  }

  async getNewToken(refreshToken) {
    let payload;

    try {
      payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch (_error) {
      throw new Error('Invalid or expired refresh token');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user) {
      throw new Error('User not found');
    }

    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async getMe(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        phoneE164: true,
        email: true,
        nationalId: true,
        role: true,
        status: true,
        subCityId: true,
        woredaId: true,
        meters: {
          select: {
            id: true,
            meterNumber: true,
            status: true,
          },
        },
        preference: true,
      },
    });
  }

  async changePassword(userId, oldPassword, newPassword) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await comparePassword(oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new Error('Old password is incorrect');
    }

    const newHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entity: 'User',
        entityId: userId,
        description: 'Password changed',
      },
    });
  }

  async updateLocation(userId, data, password) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        passwordHash: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new Error('User not found or inactive');
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Password is incorrect');
    }

    const woreda = await prisma.woreda.findUnique({
      where: { id: data.woredaId },
      select: { subCityId: true },
    });

    if (!woreda || woreda.subCityId !== data.subCityId) {
      throw new Error('Invalid Woreda for the selected SubCity');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        subCityId: data.subCityId,
        woredaId: data.woredaId,
      },
      select: {
        id: true,
        fullName: true,
        phoneE164: true,
        subCityId: true,
        woredaId: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entity: 'User',
        entityId: userId,
        description: `User location updated to subCity: ${data.subCityId}, woreda: ${data.woredaId}`,
      },
    });

    return updatedUser;
  }

  async transferMeterOwnership(currentUserId, payload) {
    const currentOwnerEmail = normalizeEmail(String(payload?.currentOwnerEmail || '').trim());
    const meterNumber = String(payload?.meterNumber || '').trim();
    const newOwnerEmail = normalizeEmail(String(payload?.newOwnerEmail || '').trim());
    const newOwnerNationalId = String(payload?.newOwnerNationalId || '').trim();
    const newOwnerPhoneE164 = String(payload?.newOwnerPhoneE164 || '').trim();
    const newOwnerFullName = String(payload?.newOwnerFullName || '').trim();
    const newOwnerPassword = String(payload?.newOwnerPassword || '').trim();

    if (
      !currentOwnerEmail ||
      !meterNumber ||
      !newOwnerEmail ||
      !newOwnerNationalId ||
      !newOwnerPhoneE164 ||
      !newOwnerFullName ||
      !newOwnerPassword
    ) {
      throw new Error('All ownership-change fields are required.');
    }

    if (!newOwnerEmail.includes('@')) {
      throw new Error('A valid new owner email is required.');
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        id: true,
        email: true,
        fullName: true,
        subCityId: true,
        woredaId: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!currentUser || currentUser.deletedAt || currentUser.status !== 'ACTIVE') {
      throw new Error('Current user not found or inactive.');
    }

    if (normalizeEmail(currentUser.email) !== currentOwnerEmail) {
      throw new Error('Current owner email does not match your account.');
    }

    const meter = await prisma.meter.findFirst({
      where: {
        meterNumber,
        deletedAt: null,
      },
      select: {
        id: true,
        meterNumber: true,
        customerId: true,
        subCityId: true,
        woredaId: true,
      },
    });

    if (!meter) {
      throw new Error('Meter not found.');
    }

    if (meter.customerId !== currentUserId) {
      throw new Error('You are not the current owner of this meter.');
    }

    const [userByEmail, userByPhone, userByNationalId] = await Promise.all([
      prisma.user.findUnique({ where: { email: newOwnerEmail } }),
      prisma.user.findUnique({ where: { phoneE164: newOwnerPhoneE164 } }),
      prisma.user.findUnique({ where: { nationalId: newOwnerNationalId } }),
    ]);

    if (userByPhone && normalizeEmail(userByPhone.email) !== newOwnerEmail) {
      throw new Error('Phone number is already used by a different account.');
    }

    if (userByNationalId && normalizeEmail(userByNationalId.email) !== newOwnerEmail) {
      throw new Error('National ID is already used by a different account.');
    }

    let nextOwnerUser = userByEmail;
    const passwordHash = await hashPassword(newOwnerPassword);

    if (nextOwnerUser) {
      if (nextOwnerUser.role !== 'CUSTOMER') {
        throw new Error('The provided email belongs to a non-customer account.');
      }

      if (nextOwnerUser.deletedAt) {
        throw new Error('The provided new owner account is inactive.');
      }

      if (nextOwnerUser.phoneE164 !== newOwnerPhoneE164) {
        throw new Error('The new owner phone number does not match this email account.');
      }

      if (nextOwnerUser.nationalId !== newOwnerNationalId) {
        throw new Error('The new owner national ID does not match this email account.');
      }

      nextOwnerUser = await prisma.user.update({
        where: { id: nextOwnerUser.id },
        data: {
          fullName: newOwnerFullName,
          passwordHash,
          status: 'ACTIVE',
          emailVerified: true,
          deletedAt: null,
          subCityId: meter.subCityId,
          woredaId: meter.woredaId,
        },
      });
    } else {
      nextOwnerUser = await prisma.user.create({
        data: {
          fullName: newOwnerFullName,
          email: newOwnerEmail,
          phoneE164: newOwnerPhoneE164,
          nationalId: newOwnerNationalId,
          passwordHash,
          role: 'CUSTOMER',
          status: 'ACTIVE',
          emailVerified: true,
          subCityId: meter.subCityId,
          woredaId: meter.woredaId,
        },
      });
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.meter.update({
        where: { id: meter.id },
        data: {
          customerId: nextOwnerUser.id,
          registeredNationalId: newOwnerNationalId,
          registeredFullName: newOwnerFullName,
        },
      }),
      prisma.meterOwnershipHistory.updateMany({
        where: {
          meterId: meter.id,
          endDate: null,
        },
        data: {
          endDate: now,
        },
      }),
      prisma.meterOwnershipHistory.create({
        data: {
          meterId: meter.id,
          userId: nextOwnerUser.id,
          startDate: now,
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: currentUserId,
          action: 'UPDATE',
          entity: 'Meter',
          entityId: meter.id,
          description: `Meter ${meter.meterNumber} ownership transferred to ${newOwnerEmail}`,
        },
      }),
    ]);

    await sendOwnershipTransferNotice(newOwnerEmail, {
      meterNumber: meter.meterNumber,
      previousOwnerName: currentUser.fullName,
      previousOwnerEmail: currentUser.email,
      newOwnerName: nextOwnerUser.fullName,
      newOwnerEmail,
    });

    return {
      meterNumber: meter.meterNumber,
      previousOwnerEmail: currentUser.email,
      newOwnerEmail,
      newOwnerUserId: nextOwnerUser.id,
    };
  }

  async getOcrWindowStatus(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subCityId: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

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

    const where = {
      isLateWindow: false,
      ...(user.subCityId ? { subCityId: user.subCityId } : {}),
    };

    const windowRecord = await prisma.oCRWindow.findFirst({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        isActive: true,
        openDate: true,
        closeDate: true,
        month: true,
        year: true,
      },
    });

    if (!windowRecord) {
      return {
        isConfigured: false,
        isOpen: false,
        isScheduled: false,
        isClosed: true,
        startDate: null,
        closeDate: null,
        month: null,
        year: null,
      };
    }

    const start = new Date(windowRecord.openDate);
    const close = new Date(windowRecord.closeDate);
    const isOpen = Boolean(windowRecord.isActive) && now >= start && now <= close;
    const isScheduled = Boolean(windowRecord.isActive) && now < start;

    return {
      isConfigured: true,
      isOpen,
      isScheduled,
      isClosed: !isOpen && !isScheduled,
      startDate: start.toISOString(),
      closeDate: close.toISOString(),
      month: windowRecord.month,
      year: windowRecord.year,
    };
  }
}

export default new AuthService();
