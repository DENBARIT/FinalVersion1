import 'dart:math' as math;

import 'package:city_water_flutter/my_flutter_app/main.dart' as aqua_home;
import 'package:city_water_flutter/screens/meter_scan_screen.dart';
import 'package:city_water_flutter/services/announcement_service.dart';
import 'package:city_water_flutter/services/complaint_service.dart';
import 'package:city_water_flutter/services/ownership_change_service.dart';
import 'package:city_water_flutter/services/schedule_notification_service.dart';
import 'package:city_water_flutter/services/ocr_window_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum DashboardFeature {
  notifications,
  bill,
  complaints,
  consumption,
  ocr,
  schedules,
}

class PostSignInPage extends StatefulWidget {
  const PostSignInPage({super.key, this.username, this.onThemeChanged});

  final String? username;
  final ValueChanged<bool>? onThemeChanged;

  @override
  State<PostSignInPage> createState() => _PostSignInPageState();
}

class _PostSignInPageState extends State<PostSignInPage>
    with TickerProviderStateMixin {
  static const Color _lightBg = Color(0xFFEAF4FF);
  static const Color _lightTopBar = Color(0xFF0B3B67);
  static const Color _lightAccent = Color(0xFF1E90FF);
  static const Color _darkBg = Color(0xFF08121D);
  static const Color _darkSurface = Color(0xFF0F172A);
  static const Color _darkBorder = Color(0xFF24364A);
  static const Color _darkMuted = Color(0xFFCBD5E1);
  static const String _navPrefsKey = 'dashboard_visible_features';
  static const String _langKey = 'app_language';
  static const String _usernameKey = 'logged_in_username';
  static const String _darkModeKey = 'is_dark_mode';
  static const String _ocrSubmissionKey = 'ocr_last_submitted_cycle';

  final List<DashboardFeature> _allFeatures = const [
    DashboardFeature.notifications,
    DashboardFeature.bill,
    DashboardFeature.complaints,
    DashboardFeature.consumption,
    DashboardFeature.ocr,
    DashboardFeature.schedules,
  ];
  List<DashboardFeature> _visibleFeatures = const [
    DashboardFeature.notifications,
    DashboardFeature.bill,
    DashboardFeature.complaints,
    DashboardFeature.ocr,
  ];

  String _username = 'User';
  String _language = 'en';
  bool _isDarkMode = false;
  bool _showLogoutLabel = false;
  bool _showOcrWindowBanner = true;
  bool _isLoadingOcrWindow = false;
  bool _ocrWindowOpen = false;
  bool _isOcrActionBusy = false;
  bool _ocrButtonHovered = false;
  bool _ocrButtonPressed = false;
  bool _ocrIconHovered = false;
  bool _ocrIconPressed = false;
  bool _bannerDismissed = false;
  String _lastOcrSubmissionCycle = '';
  int _selectedIndex = 0;
  int _unreadAnnouncementCount = 0;
  bool _isLoadingAnnouncements = false;
  List<UserAnnouncement> _announcements = const [];
  final Set<String> _markingAnnouncementIds = <String>{};
  bool _isLoadingScheduleNotifications = false;
  int _scheduleUnreadCount = 0;
  List<WaterScheduleItem> _scheduleNotifications = const [];
  DateTime _scheduleCalendarMonth = DateTime(
    DateTime.now().year,
    DateTime.now().month,
    1,
  );
  DateTime _selectedScheduleDate = DateTime.now();
  DateTime? _ocrWindowStart;
  DateTime? _ocrWindowClose;
  bool _isLoadingComplaintLocation = false;
  bool _isSubmittingComplaint = false;
  String _registeredSubCityName = '';
  String _registeredWoredaName = '';
  String _selectedComplaintCategory = 'OTHER';
  final TextEditingController _complaintTitleController =
      TextEditingController();
  final TextEditingController _complaintBodyController =
      TextEditingController();
  late final AnimationController _ocrAmbientController;
  late final AnimationController _ocrIntroController;
  late final AnimationController _ocrShimmerController;
  late final List<_FloatingOrbSpec> _ocrOrbs;
  late final List<_FloatingParticleSpec> _ocrParticles;
  late final List<_FloatingHalfCircleSpec> _ocrHalfCircles;

  @override
  void initState() {
    super.initState();
    _ocrAmbientController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 14),
    )..repeat();
    _ocrIntroController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..forward();
    _ocrShimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
    final random = math.Random(42);
    _ocrOrbs = List.generate(3, (index) {
      return _FloatingOrbSpec(
        baseX: 0.12 + (index * 0.34),
        baseY: 0.1 + (index * 0.18),
        size: 180 + (index * 45).toDouble(),
        driftX: 18 + (index * 10).toDouble(),
        driftY: 14 + (index * 8).toDouble(),
        phase: random.nextDouble() * math.pi * 2,
        speed: 0.35 + (index * 0.08),
        opacity: 0.18 + (index * 0.06),
      );
    });
    _ocrParticles = List.generate(8, (index) {
      return _FloatingParticleSpec(
        baseX: random.nextDouble(),
        baseY: 0.12 + random.nextDouble() * 0.72,
        size: 6 + random.nextDouble() * 7,
        driftX: 6 + random.nextDouble() * 16,
        driftY: 8 + random.nextDouble() * 18,
        phase: random.nextDouble() * math.pi * 2,
        speed: 0.55 + random.nextDouble() * 0.55,
        opacity: 0.22 + random.nextDouble() * 0.28,
      );
    });
    _ocrHalfCircles = [
      _FloatingHalfCircleSpec(
        baseX: 0.02,
        baseY: 0.08,
        radius: 88,
        driftX: 7,
        driftY: 6,
        phase: random.nextDouble() * math.pi * 2,
        speed: 0.24,
        opacity: 0.28,
      ),
      _FloatingHalfCircleSpec(
        baseX: 0.98,
        baseY: 0.1,
        radius: 94,
        driftX: 8,
        driftY: 6,
        phase: random.nextDouble() * math.pi * 2,
        speed: 0.27,
        opacity: 0.28,
      ),
      _FloatingHalfCircleSpec(
        baseX: 0.52,
        baseY: 0.94,
        radius: 110,
        driftX: 7,
        driftY: 7,
        phase: random.nextDouble() * math.pi * 2,
        speed: 0.22,
        opacity: 0.25,
      ),
    ];
    _loadPreferences();
  }

  @override
  void dispose() {
    _complaintTitleController.dispose();
    _complaintBodyController.dispose();
    _ocrAmbientController.dispose();
    _ocrIntroController.dispose();
    _ocrShimmerController.dispose();
    super.dispose();
  }

  String _t(String en, String am) {
    return _language == 'am' ? am : en;
  }

  String _cycleKey(DateTime dateTime) {
    final year = dateTime.year.toString().padLeft(4, '0');
    final month = dateTime.month.toString().padLeft(2, '0');
    return '$year-$month';
  }

  bool get _hasSubmittedCurrentCycle {
    return _lastOcrSubmissionCycle == _cycleKey(DateTime.now());
  }

  IconData _iconFor(DashboardFeature feature) {
    switch (feature) {
      case DashboardFeature.notifications:
        return Icons.notifications_outlined;
      case DashboardFeature.bill:
        return Icons.payments_outlined;
      case DashboardFeature.complaints:
        return Icons.feedback_outlined;
      case DashboardFeature.consumption:
        return Icons.bar_chart_outlined;
      case DashboardFeature.ocr:
        return Icons.document_scanner_outlined;
      case DashboardFeature.schedules:
        return Icons.calendar_month_outlined;
    }
  }

  String _labelFor(DashboardFeature feature) {
    switch (feature) {
      case DashboardFeature.notifications:
        return _t('Notification', 'ማሳወቂያ');
      case DashboardFeature.bill:
        return _t('Bill', 'ቢል');
      case DashboardFeature.complaints:
        return _t('Complaints', 'ቅሬታ');
      case DashboardFeature.consumption:
        return _t('Consumption', 'ፍጆታ');
      case DashboardFeature.ocr:
        return _t('OCR', 'OCR');
      case DashboardFeature.schedules:
        return _t('Schedules', 'መርሃ ግብር');
    }
  }

  DashboardFeature? _featureFromId(String value) {
    for (final feature in _allFeatures) {
      if (feature.name == value) {
        return feature;
      }
    }
    return null;
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    final storedVisible = prefs.getStringList(_navPrefsKey) ?? const [];
    final storedLanguage = prefs.getString(_langKey) ?? 'en';
    final storedName = prefs.getString(_usernameKey);
    final storedDarkMode = prefs.getBool(_darkModeKey) ?? false;
    final storedSubmissionCycle = prefs.getString(_ocrSubmissionKey) ?? '';

    if (!mounted) {
      return;
    }

    setState(() {
      _language = storedLanguage;
      _isDarkMode = storedDarkMode;
      _username = (widget.username?.trim().isNotEmpty == true)
          ? widget.username!.trim()
          : (storedName?.trim().isNotEmpty == true
                ? storedName!.trim()
                : 'User');
      _lastOcrSubmissionCycle = storedSubmissionCycle;

      if (storedVisible.isNotEmpty) {
        final parsed = storedVisible
            .map(_featureFromId)
            .whereType<DashboardFeature>()
            .toList();
        if (parsed.isNotEmpty) {
          _visibleFeatures = parsed.take(4).toList();
        }
      }

      if (_selectedIndex >= _visibleFeatures.length) {
        _selectedIndex = 0;
      }

      _showOcrWindowBanner = !_hasSubmittedCurrentCycle;
    });

    await _syncOcrWindowStatus();
    await _loadAnnouncements();
    await _loadScheduleNotifications();
    await _loadComplaintLocation();
  }

  Future<void> _loadComplaintLocation() async {
    if (!mounted) {
      return;
    }

    setState(() {
      _isLoadingComplaintLocation = true;
    });

    try {
      final location = await ComplaintService.fetchRegisteredLocation();
      if (!mounted) {
        return;
      }

      setState(() {
        _registeredSubCityName = location.subCityName;
        _registeredWoredaName = location.woredaName;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _registeredSubCityName = '';
        _registeredWoredaName = '';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingComplaintLocation = false;
        });
      }
    }
  }

  String _categoryLabel(String key) {
    switch (key) {
      case 'BILLING':
        return _t('Billing Issue', 'የክፍያ ችግኝ');
      case 'NO_WATER':
        return _t('No Water Supply', 'የውሃ አቅርቦት የለም');
      case 'LOW_PRESSURE':
        return _t('Low Water Pressure', 'ዝቅተኛ የውሃ ግፊት');
      case 'LEAKAGE':
        return _t('Leakage / Pipe Damage', 'ፍሳሽ / የቧንቧ ጉዳት');
      case 'METER':
        return _t('Meter Problem', 'የሜትር ችግኝ');
      default:
        return _t('Other', 'ሌላ');
    }
  }

  Future<void> _submitComplaint() async {
    final title = _complaintTitleController.text.trim();
    final body = _complaintBodyController.text.trim();

    if (title.isEmpty || body.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _t(
              'Please provide complaint title and details before submitting.',
              'እባክዎ ከማስገባት በፊት ርዕስ እና ዝርዝር ያስገቡ።',
            ),
          ),
        ),
      );
      return;
    }

    setState(() {
      _isSubmittingComplaint = true;
    });

    final locationLine =
        '${_t('Subcity', 'ክፍለ ከተማ')}: ${_registeredSubCityName.isNotEmpty ? _registeredSubCityName : _t('Not set', 'አልተሞላም')}  |  ${_t('Woreda', 'ወረዳ')}: ${_registeredWoredaName.isNotEmpty ? _registeredWoredaName : _t('Not set', 'አልተሞላም')}';

    final composedText =
        '${_t('Complaint Category', 'የቅሬታ ምድብ')}: ${_categoryLabel(_selectedComplaintCategory)}\n${_t('Title', 'ርዕስ')}: $title\n$locationLine\n\n${_t('Details', 'ዝርዝር')}:\n$body';

    await Clipboard.setData(ClipboardData(text: composedText));

    if (!mounted) {
      return;
    }

    setState(() {
      _isSubmittingComplaint = false;
      _complaintTitleController.clear();
      _complaintBodyController.clear();
      _selectedComplaintCategory = 'OTHER';
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        content: Text(
          _t(
            'Complaint submitted. A formatted copy has been copied for sharing.',
            'ቅሬታዎ ተልኳል። ለመጋራት ቅጂ ተቀድቷል።',
          ),
        ),
      ),
    );
  }

  Future<void> _copyComplaintDraft(
    _ComplaintDraft draft,
    String language,
  ) async {
    final text = language == 'am' ? draft.amharic : draft.english;
    await Clipboard.setData(ClipboardData(text: text));

    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        content: Text(
          language == 'am'
              ? _t('Amharic draft copied.', 'የአማርኛ ድራፍት ተቀድቷል።')
              : _t('English draft copied.', 'የእንግሊዝኛ ድራፍት ተቀድቷል።'),
        ),
      ),
    );
  }

  Future<void> _loadAnnouncements() async {
    if (!mounted) {
      return;
    }

    setState(() {
      _isLoadingAnnouncements = true;
    });

    try {
      final feed = await AnnouncementService.fetchAnnouncements();
      if (!mounted) {
        return;
      }

      setState(() {
        _announcements = feed.items;
        _unreadAnnouncementCount = feed.unreadCount;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _announcements = const [];
        _unreadAnnouncementCount = 0;
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingAnnouncements = false;
        });
      }
    }
  }

  Future<void> _loadScheduleNotifications() async {
    if (!mounted) {
      return;
    }

    setState(() {
      _isLoadingScheduleNotifications = true;
    });

    try {
      final feed = await WaterScheduleService.fetchSchedules();
      if (!mounted) {
        return;
      }

      setState(() {
        _scheduleNotifications = feed.items;
        _scheduleUnreadCount = feed.items.length;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _scheduleNotifications = const [];
        _scheduleUnreadCount = 0;
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingScheduleNotifications = false;
        });
      }
    }
  }

  Future<void> _markAnnouncementAsRead(UserAnnouncement announcement) async {
    if (announcement.isRead ||
        _markingAnnouncementIds.contains(announcement.id)) {
      return;
    }

    setState(() {
      _markingAnnouncementIds.add(announcement.id);
    });

    try {
      final unreadCount = await AnnouncementService.markAnnouncementAsRead(
        announcement.id,
      );
      if (!mounted) {
        return;
      }

      setState(() {
        _unreadAnnouncementCount = unreadCount;
        _announcements = _announcements
            .map(
              (item) => item.id == announcement.id
                  ? UserAnnouncement(
                      id: item.id,
                      title: item.title,
                      message: item.message,
                      createdAt: item.createdAt,
                      isRead: true,
                    )
                  : item,
            )
            .toList();
      });
    } catch (_) {
      // Keep the item unread if marking fails.
    } finally {
      if (mounted) {
        setState(() {
          _markingAnnouncementIds.remove(announcement.id);
        });
      }
    }
  }

  bool _isLongAnnouncement(UserAnnouncement announcement) {
    final combined = '${announcement.title} ${announcement.message}'.trim();
    return combined.length > 110;
  }

  String _timeAgoLabel(DateTime? dateTime) {
    if (dateTime == null) {
      return _t('Now', 'አሁን');
    }

    final now = DateTime.now();
    final diff = now.difference(dateTime.toLocal());
    if (diff.inMinutes < 1) {
      return _t('Now', 'አሁን');
    }
    if (diff.inHours < 1) {
      final m = diff.inMinutes;
      return _t('$m min ago', 'ከ$m ደቂቃ በፊት');
    }
    if (diff.inDays < 1) {
      final h = diff.inHours;
      return _t('$h hr ago', 'ከ$h ሰዓት በፊት');
    }
    final d = diff.inDays;
    return _t('$d days ago', 'ከ$d ቀን በፊት');
  }

  String _weekdayKey(DateTime date) {
    switch (date.weekday) {
      case DateTime.monday:
        return 'MONDAY';
      case DateTime.tuesday:
        return 'TUESDAY';
      case DateTime.wednesday:
        return 'WEDNESDAY';
      case DateTime.thursday:
        return 'THURSDAY';
      case DateTime.friday:
        return 'FRIDAY';
      case DateTime.saturday:
        return 'SATURDAY';
      case DateTime.sunday:
        return 'SUNDAY';
      default:
        return '';
    }
  }

  String _weekdayAmharic(String dayKey) {
    switch (dayKey.toUpperCase()) {
      case 'MONDAY':
        return 'ሰኞ';
      case 'TUESDAY':
        return 'ማክሰኞ';
      case 'WEDNESDAY':
        return 'ረቡዕ';
      case 'THURSDAY':
        return 'ሐሙስ';
      case 'FRIDAY':
        return 'ዓርብ';
      case 'SATURDAY':
        return 'ቅዳሜ';
      case 'SUNDAY':
        return 'እሑድ';
      default:
        return '';
    }
  }

  String _monthLabel(DateTime date) {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    return '${months[date.month - 1]} ${date.year}';
  }

  String _formatGregorianDate(DateTime date) {
    const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    return '${shortDays[date.weekday - 1]}, ${months[date.month - 1]} ${date.day}, ${date.year}';
  }

  Widget _buildCornerRefreshButton({
    required bool isLoading,
    required VoidCallback onPressed,
    required String tooltip,
  }) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: isLoading ? null : onPressed,
          borderRadius: BorderRadius.circular(18),
          child: Ink(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFF1E90FF).withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: const Color(0xFF1E90FF).withValues(alpha: 0.35),
              ),
            ),
            child: Center(
              child: isLoading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(
                      Icons.refresh,
                      size: 18,
                      color: Color(0xFF1E90FF),
                    ),
            ),
          ),
        ),
      ),
    );
  }

  List<DateTime?> _calendarMonthGrid(DateTime month) {
    final firstDay = DateTime(month.year, month.month, 1);
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final leadingEmptyCells = (firstDay.weekday + 6) % 7;

    final dates = List<DateTime?>.filled(
      leadingEmptyCells,
      null,
      growable: true,
    );
    for (var day = 1; day <= daysInMonth; day += 1) {
      dates.add(DateTime(month.year, month.month, day));
    }

    final trailingEmptyCells = (7 - (dates.length % 7)) % 7;
    for (var i = 0; i < trailingEmptyCells; i += 1) {
      dates.add(null);
    }

    return dates;
  }

  bool _hasScheduleOnDate(DateTime date) {
    final weekday = _weekdayKey(date);
    return _scheduleNotifications.any(
      (item) => item.day.toUpperCase() == weekday,
    );
  }

  List<WaterScheduleItem> _schedulesForDate(DateTime date) {
    final weekday = _weekdayKey(date);
    return _scheduleNotifications
        .where((item) => item.day.toUpperCase() == weekday)
        .toList();
  }

  void _openScheduleDetail(WaterScheduleItem item, DateTime selectedDate) {
    final bodyColor = _isDarkMode ? _darkMuted : const Color(0xFF334155);
    final dayAm = item.dayAm.trim().isNotEmpty
        ? item.dayAm.trim()
        : _weekdayAmharic(item.day);
    final note = item.note.trim();

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _isDarkMode
          ? const Color(0xFF0B1B2F)
          : const Color(0xFFF8FBFF),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _t('Schedule Detail', 'የመርሃ ግብር ዝርዝር'),
                style: GoogleFonts.syne(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: _isDarkMode ? Colors.white : const Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                '${item.startTime12} - ${item.endTime12}${item.woredaName.trim().isNotEmpty ? ' • ${item.woredaName}' : ''}',
                style: TextStyle(color: bodyColor, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              Text(
                'Gregorian: ${_formatGregorianDate(selectedDate)}\n${item.messageGregorian}',
                style: TextStyle(
                  color: bodyColor,
                  fontSize: 13.2,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Ethiopian: $dayAm\n${item.messageEthiopian}',
                style: TextStyle(
                  color: bodyColor,
                  fontSize: 13.2,
                  height: 1.45,
                ),
              ),
              if (note.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  '${_t('Note', 'ማስታወሻ')}: $note',
                  style: TextStyle(color: bodyColor, fontSize: 12.8),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Future<void> _openAnnouncementDetail(UserAnnouncement announcement) async {
    if (!mounted) {
      return;
    }

    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => _AnnouncementDetailPage(
          announcement: announcement,
          isDarkMode: _isDarkMode,
          titleText: _t('Announcement', 'ማስታወቂያ'),
          postedText: _t('Posted', 'የተለቀቀ'),
          timeAgo: _timeAgoLabel(announcement.createdAt),
        ),
      ),
    );

    await _markAnnouncementAsRead(announcement);
  }

  Future<void> _syncOcrWindowStatus() async {
    if (!mounted) {
      return;
    }

    setState(() {
      _isLoadingOcrWindow = true;
    });

    try {
      final status = await OcrWindowService.getOcrWindowStatus();
      final isOpen = status['isOpen'] == true;
      final start = _parseDate(status['startDate']);
      final close = _parseDate(status['closeDate']);

      if (!mounted) {
        return;
      }

      setState(() {
        _ocrWindowOpen = isOpen;
        _ocrWindowStart = start;
        _ocrWindowClose = close;
        _showOcrWindowBanner =
            isOpen && !_hasSubmittedCurrentCycle && !_bannerDismissed;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _ocrWindowOpen = false;
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingOcrWindow = false;
        });
      }
    }
  }

  DateTime? _parseDate(dynamic value) {
    if (value is! String || value.trim().isEmpty) {
      return null;
    }
    return DateTime.tryParse(value);
  }

  Future<void> _persistVisibleFeatures() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
      _navPrefsKey,
      _visibleFeatures.map((feature) => feature.name).toList(),
    );
  }

  Future<void> _persistLanguage(String code) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_langKey, code);
  }

  Future<void> _markCurrentCycleSubmitted() async {
    final cycle = _cycleKey(DateTime.now());
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_ocrSubmissionKey, cycle);

    if (!mounted) {
      return;
    }

    setState(() {
      _lastOcrSubmissionCycle = cycle;
      _showOcrWindowBanner = false;
      _bannerDismissed = true;
    });
  }

  Future<void> _openOcrScanner() async {
    final messenger = ScaffoldMessenger.maybeOf(context);
    final result = await Navigator.of(context).push<Map<String, String>>(
      MaterialPageRoute(builder: (_) => const MeterScanScreen()),
    );

    if (!mounted || result == null || messenger == null) {
      return;
    }

    final meterNumber = result['meter_number'] ?? '';
    final meterReading = result['meter_reading'] ?? '';

    if (meterNumber.trim().isNotEmpty || meterReading.trim().isNotEmpty) {
      await _markCurrentCycleSubmitted();
    }

    messenger.showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        content: Text(
          _t(
            'Meter Number: $meterNumber | Meter Reading: $meterReading',
            'ሜትር ቁጥር: $meterNumber | ንባብ: $meterReading',
          ),
        ),
      ),
    );
  }

  Future<void> _requestCameraAndScan() async {
    final messenger = ScaffoldMessenger.maybeOf(context);
    final status = await Permission.camera.request();
    if (!mounted || messenger == null) {
      return;
    }

    if (status.isGranted || status.isLimited) {
      await _openOcrScanner();
      return;
    }

    if (status.isPermanentlyDenied || status.isRestricted) {
      messenger.showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          content: Text(
            _t(
              'Camera access is blocked. Enable permission in settings to scan your meter.',
              'የካሜራ ፍቃድ ተከልክሏል። ሜትር ለማንበብ በስልኩ ቅንብሮች ውስጥ ያንቁት።',
            ),
          ),
          action: SnackBarAction(
            label: _t('Settings', 'ቅንብሮች'),
            onPressed: openAppSettings,
          ),
        ),
      );
      return;
    }

    messenger.showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        content: Text(
          _t(
            'Camera permission is required to scan your meter.',
            'ሜትር ለማንበብ የካሜራ ፍቃድ ያስፈልጋል።',
          ),
        ),
      ),
    );
  }

  Future<void> _startOcrScanFlow() async {
    if (_isOcrActionBusy) {
      return;
    }

    setState(() {
      _isOcrActionBusy = true;
    });

    await Future<void>.delayed(const Duration(milliseconds: 700));
    if (!mounted) {
      return;
    }

    setState(() {
      _isOcrActionBusy = false;
    });

    await _requestCameraAndScan();
  }

  Future<void> _addFeature(DashboardFeature feature) async {
    if (_visibleFeatures.contains(feature) || _visibleFeatures.length >= 4) {
      return;
    }

    setState(() {
      _visibleFeatures = [..._visibleFeatures, feature];
      _selectedIndex = _visibleFeatures.indexOf(feature);
    });

    await _persistVisibleFeatures();
  }

  Future<void> _removeFeature(DashboardFeature feature) async {
    if (!_visibleFeatures.contains(feature) || _visibleFeatures.length <= 1) {
      return;
    }

    final nextVisible = [..._visibleFeatures]..remove(feature);
    if (nextVisible.isEmpty) {
      return;
    }

    setState(() {
      _visibleFeatures = nextVisible;
      if (_selectedIndex >= _visibleFeatures.length) {
        _selectedIndex = _visibleFeatures.length - 1;
      }
    });

    await _persistVisibleFeatures();
  }

  Future<void> _moveVisibleFeature(int fromIndex, int toIndex) async {
    if (fromIndex < 0 || fromIndex >= _visibleFeatures.length) {
      return;
    }
    if (toIndex < 0 || toIndex >= _visibleFeatures.length) {
      return;
    }
    if (fromIndex == toIndex) {
      return;
    }

    final nextVisible = [..._visibleFeatures];
    final movedFeature = nextVisible.removeAt(fromIndex);
    nextVisible.insert(toIndex, movedFeature);

    setState(() {
      _visibleFeatures = nextVisible;
      _selectedIndex = nextVisible.indexOf(movedFeature);
    });

    await _persistVisibleFeatures();
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('is_logged_in', false);

    if (!mounted) {
      return;
    }

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const aqua_home.AquaConnectHome()),
      (route) => false,
    );
  }

  Future<void> _applyForLatePayment() async {
    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        content: Text(
          _t(
            'Late payment request submitted. Our team will review it shortly.',
            'የዘገየ ክፍያ ጥያቄዎ ተልኳል። በቅርቡ ይመረመራል።',
          ),
        ),
      ),
    );
  }

  InputDecoration _ownershipFieldDecoration(String label) {
    return InputDecoration(
      labelText: label,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
          color: _isDarkMode ? _darkBorder : const Color(0xFFBFDBFE),
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF1E90FF), width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    );
  }

  Future<void> _openOwnershipChangeModal() async {
    Navigator.pop(context);

    OwnershipProfile profile;
    try {
      profile = await OwnershipChangeService.fetchOwnershipProfile();
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
      return;
    }

    final currentOwnerEmailController = TextEditingController(
      text: profile.email,
    );
    final meterNumberController = TextEditingController(
      text: profile.meterNumber,
    );
    final newOwnerEmailController = TextEditingController();
    final newOwnerNationalIdController = TextEditingController();
    final newOwnerPhoneController = TextEditingController();
    final newOwnerFullNameController = TextEditingController();
    final newOwnerPasswordController = TextEditingController();

    if (!mounted) {
      return;
    }

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _isDarkMode ? const Color(0xFF0B1B2F) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) {
        var isSubmitting = false;

        return StatefulBuilder(
          builder: (context, setModalState) {
            Future<void> submit() async {
              final currentOwnerEmail = currentOwnerEmailController.text.trim();
              final meterNumber = meterNumberController.text.trim();
              final newOwnerEmail = newOwnerEmailController.text.trim();
              final newOwnerNationalId = newOwnerNationalIdController.text
                  .trim();
              final newOwnerPhone = newOwnerPhoneController.text.trim();
              final newOwnerFullName = newOwnerFullNameController.text.trim();
              final newOwnerPassword = newOwnerPasswordController.text.trim();

              if (currentOwnerEmail.isEmpty ||
                  meterNumber.isEmpty ||
                  newOwnerEmail.isEmpty ||
                  newOwnerNationalId.isEmpty ||
                  newOwnerPhone.isEmpty ||
                  newOwnerFullName.isEmpty ||
                  newOwnerPassword.isEmpty) {
                ScaffoldMessenger.of(this.context).showSnackBar(
                  SnackBar(
                    content: Text(
                      _t(
                        'Please fill all required fields.',
                        'እባክዎ ሁሉንም አስፈላጊ መረጃዎች ያስገቡ።',
                      ),
                    ),
                  ),
                );
                return;
              }

              if (!newOwnerEmail.contains('@')) {
                ScaffoldMessenger.of(this.context).showSnackBar(
                  SnackBar(
                    content: Text(
                      _t('Enter a valid new owner email.', 'ትክክለኛ ኢሜይል ያስገቡ።'),
                    ),
                  ),
                );
                return;
              }

              setModalState(() {
                isSubmitting = true;
              });

              try {
                await OwnershipChangeService.transferOwnership(
                  currentOwnerEmail: currentOwnerEmail,
                  meterNumber: meterNumber,
                  newOwnerEmail: newOwnerEmail,
                  newOwnerNationalId: newOwnerNationalId,
                  newOwnerPhoneE164: newOwnerPhone,
                  newOwnerFullName: newOwnerFullName,
                  newOwnerPassword: newOwnerPassword,
                );

                if (!mounted) {
                  return;
                }

                if (!sheetContext.mounted) {
                  return;
                }

                Navigator.of(sheetContext).pop();
                ScaffoldMessenger.of(this.context).showSnackBar(
                  SnackBar(
                    content: Text(
                      _t(
                        'Ownership changed successfully. Email sent to new owner.',
                        'ባለቤትነት በተሳካ ሁኔታ ተቀይሯል። ለአዲሱ ባለቤት ኢሜይል ተልኳል።',
                      ),
                    ),
                  ),
                );
              } catch (error) {
                if (!mounted) {
                  return;
                }
                ScaffoldMessenger.of(this.context).showSnackBar(
                  SnackBar(
                    content: Text(
                      error.toString().replaceFirst('Exception: ', ''),
                    ),
                  ),
                );
              } finally {
                if (mounted) {
                  setModalState(() {
                    isSubmitting = false;
                  });
                }
              }
            }

            return SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  16,
                  14,
                  16,
                  MediaQuery.of(context).viewInsets.bottom + 18,
                ),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _t('Ownership Change', 'የባለቤትነት ለውጥ'),
                        textAlign: TextAlign.center,
                        style: GoogleFonts.syne(
                          fontSize: 19,
                          fontWeight: FontWeight.w800,
                          color: _isDarkMode
                              ? Colors.white
                              : const Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: currentOwnerEmailController,
                        readOnly: true,
                        decoration: _ownershipFieldDecoration(
                          _t('Current Owner Email', 'የአሁኑ ባለቤት ኢሜይል'),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: meterNumberController,
                        readOnly: true,
                        decoration: _ownershipFieldDecoration(
                          _t('Meter Number', 'የሜትር ቁጥር'),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: newOwnerEmailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: _ownershipFieldDecoration(
                          _t('New Owner Email', 'የአዲሱ ባለቤት ኢሜይል'),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: newOwnerNationalIdController,
                        decoration: _ownershipFieldDecoration(
                          _t('New Owner National ID', 'የአዲሱ ባለቤት መታወቂያ'),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: newOwnerPhoneController,
                        keyboardType: TextInputType.phone,
                        decoration: _ownershipFieldDecoration(
                          _t('New Owner Phone Number', 'የአዲሱ ባለቤት ስልክ ቁጥር'),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: newOwnerFullNameController,
                        decoration: _ownershipFieldDecoration(
                          _t('New Owner Full Name', 'የአዲሱ ባለቤት ሙሉ ስም'),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: newOwnerPasswordController,
                        obscureText: true,
                        decoration: _ownershipFieldDecoration(
                          _t('New Owner Password', 'የአዲሱ ባለቤት የይለፍ ቃል'),
                        ),
                      ),
                      const SizedBox(height: 14),
                      ElevatedButton.icon(
                        onPressed: isSubmitting ? null : submit,
                        icon: isSubmitting
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.swap_horiz),
                        label: Text(
                          _t('Transfer Ownership', 'ባለቤትነት ቀይር'),
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1E90FF),
                          foregroundColor: Colors.white,
                          minimumSize: const Size.fromHeight(46),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );

    currentOwnerEmailController.dispose();
    meterNumberController.dispose();
    newOwnerEmailController.dispose();
    newOwnerNationalIdController.dispose();
    newOwnerPhoneController.dispose();
    newOwnerFullNameController.dispose();
    newOwnerPasswordController.dispose();
  }

  void _selectFeature(DashboardFeature feature) {
    final index = _visibleFeatures.indexOf(feature);
    if (index < 0) {
      return;
    }
    setState(() {
      _selectedIndex = index;
    });
  }

  List<DashboardFeature> get _hiddenFeatures {
    return _allFeatures
        .where((feature) => !_visibleFeatures.contains(feature))
        .toList();
  }

  Widget _buildPlaceholderContent(DashboardFeature feature) {
    if (feature == DashboardFeature.notifications) {
      return _buildNotificationsPlaceholder();
    }

    if (feature == DashboardFeature.schedules) {
      return _buildSchedulesPlaceholder();
    }

    if (feature == DashboardFeature.ocr) {
      return _buildOcrPlaceholder();
    }

    if (feature == DashboardFeature.complaints) {
      return _buildComplaintsPlaceholder();
    }

    final title = _labelFor(feature);
    final cardBg = _isDarkMode ? _darkSurface : Colors.white;
    final textColor = _isDarkMode ? Colors.white : const Color(0xFF0F172A);
    final bodyColor = _isDarkMode ? _darkMuted : const Color(0xFF475569);

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 250),
      child: Container(
        key: ValueKey<String>(title),
        margin: const EdgeInsets.all(16),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: _isDarkMode ? _darkBorder : const Color(0xFFE2E8F0),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: _isDarkMode ? 0.26 : 0.08),
              blurRadius: 18,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(_iconFor(feature), color: _lightAccent, size: 28),
                const SizedBox(width: 12),
                Text(
                  title,
                  style: GoogleFonts.syne(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: textColor,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              _t(
                '$title page placeholder content. This area is ready for detailed implementation.',
                'የ$title ገጽ መያዣ ይዘት ነው። ይህ ክፍል ለዝርዝር ስራ ዝግጁ ነው።',
              ),
              style: TextStyle(fontSize: 15, color: bodyColor, height: 1.5),
            ),
            const SizedBox(height: 18),
            Container(
              width: double.infinity,
              height: 160,
              decoration: BoxDecoration(
                color: _isDarkMode
                    ? const Color(0xFF142238)
                    : const Color(0xFFE5F4FE),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: _isDarkMode ? _darkBorder : const Color(0xFFBFDBFE),
                ),
              ),
              child: Center(
                child: Text(
                  _t('Content area for $title', 'ለ$title የይዘት ቦታ'),
                  style: TextStyle(
                    color: _isDarkMode ? Colors.white : const Color(0xFF1E3A8A),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildComplaintsPlaceholder() {
    final cardBg = _isDarkMode ? _darkSurface : Colors.white;
    final textColor = _isDarkMode ? Colors.white : const Color(0xFF0F172A);
    final bodyColor = _isDarkMode ? _darkMuted : const Color(0xFF475569);

    const categories = [
      'BILLING',
      'NO_WATER',
      'LOW_PRESSURE',
      'LEAKAGE',
      'METER',
      'OTHER',
    ];

    final drafts = <_ComplaintDraft>[
      _ComplaintDraft(
        titleEn: 'No Water Supply',
        titleAm: 'የውሃ አቅርቦት የለም',
        english:
            'Subject: No Water Supply in My Area\n\nHello,\nI have not received water supply since yesterday in my area. Please check and restore service.\n\nThank you.',
        amharic:
            'ርዕስ: በአካባቢዬ የውሃ አቅርቦት የለም\n\nሰላም፣\nከትናንት ጀምሮ በአካባቢዬ የውሃ አቅርቦት ተቋርጧል። እባክዎ በፍጥነት ያረጋግጡ እና አገልግሎቱን ያስጀምሩ።\n\nአመሰግናለሁ።',
      ),
      _ComplaintDraft(
        titleEn: 'Billing Amount Dispute',
        titleAm: 'የቢል መጠን ክርክር',
        english:
            'Subject: Billing Amount Seems Incorrect\n\nHello,\nMy latest bill appears higher than usual and may be incorrect. Please review my meter reading and bill calculation.\n\nThank you.',
        amharic:
            'ርዕስ: የቢል መጠን ትክክል አይመስልም\n\nሰላም፣\nየቅርብ ጊዜ ቢሌ ከተለመደው በላይ ነው እና ስህተት ሊኖረው ይችላል። እባክዎ የሜትር ንባብን እና የቢል ስሌትን ይመርምሩ።\n\nአመሰግናለሁ።',
      ),
      _ComplaintDraft(
        titleEn: 'Pipe Leakage',
        titleAm: 'የቧንቧ ፍሳሽ',
        english:
            'Subject: Water Leakage Report\n\nHello,\nThere is a pipe leakage near my area causing water loss. Please send maintenance support as soon as possible.\n\nThank you.',
        amharic:
            'ርዕስ: የውሃ ፍሳሽ ሪፖርት\n\nሰላም፣\nበአካባቢዬ አቅራቢያ የቧንቧ ፍሳሽ አለ እና ውሃ እየባከነ ነው። እባክዎ በፍጥነት የጥገና ቡድን ይላኩ።\n\nአመሰግናለሁ።',
      ),
    ];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: _isDarkMode ? _darkBorder : const Color(0xFFE2E8F0),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.feedback_outlined,
                      color: _lightAccent,
                      size: 24,
                    ),
                    const SizedBox(width: 10),
                    Text(
                      _t('Fill a Complaint', 'ቅሬታ ያስገቡ'),
                      style: GoogleFonts.syne(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: textColor,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                _readonlyInfoRow(
                  _t('Registered Subcity', 'የተመዘገበ ክፍለ ከተማ'),
                  _isLoadingComplaintLocation
                      ? _t('Loading...', 'በመጫን ላይ...')
                      : (_registeredSubCityName.isEmpty
                            ? _t('Not available', 'አልተገኘም')
                            : _registeredSubCityName),
                ),
                const SizedBox(height: 8),
                _readonlyInfoRow(
                  _t('Registered Woreda', 'የተመዘገበ ወረዳ'),
                  _isLoadingComplaintLocation
                      ? _t('Loading...', 'በመጫን ላይ...')
                      : (_registeredWoredaName.isEmpty
                            ? _t('Not available', 'አልተገኘም')
                            : _registeredWoredaName),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _complaintTitleController,
                  decoration: InputDecoration(
                    labelText: _t('Complaint Title', 'የቅሬታ ርዕስ'),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _selectedComplaintCategory,
                  decoration: InputDecoration(
                    labelText: _t('Category', 'ምድብ'),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  items: categories
                      .map(
                        (key) => DropdownMenuItem<String>(
                          value: key,
                          child: Text(_categoryLabel(key)),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    if (value == null) {
                      return;
                    }
                    setState(() {
                      _selectedComplaintCategory = value;
                    });
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _complaintBodyController,
                  minLines: 4,
                  maxLines: 7,
                  decoration: InputDecoration(
                    hintText: _t(
                      'Describe your complaint in detail...',
                      'ችግኝዎን በዝርዝር ይግለጹ...',
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _isSubmittingComplaint ? null : _submitComplaint,
                    icon: _isSubmittingComplaint
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send_outlined),
                    label: Text(
                      _isSubmittingComplaint
                          ? _t('Submitting...', 'በማስገባት ላይ...')
                          : _t('Submit Complaint', 'ቅሬታ ላክ'),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1E90FF),
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(46),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: _isDarkMode ? _darkBorder : const Color(0xFFE2E8F0),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _t('Complaint Drafts', 'የቅሬታ ድራፍቶች'),
                  style: GoogleFonts.syne(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: textColor,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _t(
                    'Use these templates to compose and copy your complaint quickly (English and Amharic).',
                    'ቅሬታዎን በፍጥነት ለማዘጋጀት እነዚህን አብነቶች ይጠቀሙ (እንግሊዝኛ እና አማርኛ)።',
                  ),
                  style: TextStyle(color: bodyColor, fontSize: 12.5),
                ),
                const SizedBox(height: 10),
                ...drafts.map((draft) {
                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _isDarkMode
                          ? const Color(0xFF142238)
                          : const Color(0xFFE5F4FE),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _isDarkMode
                            ? _darkBorder
                            : const Color(0xFFBFDBFE),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${draft.titleEn} / ${draft.titleAm}',
                          style: TextStyle(
                            color: textColor,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () =>
                                    _copyComplaintDraft(draft, 'en'),
                                icon: const Icon(Icons.copy, size: 16),
                                label: Text(_t('Copy English', 'እንግሊዝኛ ቅዳ')),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () =>
                                    _copyComplaintDraft(draft, 'am'),
                                icon: const Icon(Icons.copy, size: 16),
                                label: Text(_t('Copy Amharic', 'አማርኛ ቅዳ')),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _readonlyInfoRow(String label, String value) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: _isDarkMode ? const Color(0xFF142238) : const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: _isDarkMode ? _darkBorder : const Color(0xFFBFDBFE),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: _isDarkMode ? Colors.white : const Color(0xFF1E3A8A),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 12,
                color: _isDarkMode ? _darkMuted : const Color(0xFF334155),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationsPlaceholder() {
    final bodyColor = _isDarkMode ? _darkMuted : const Color(0xFF475569);

    const titlePalette = [
      Color(0xFF0F766E),
      Color(0xFF1D4ED8),
      Color(0xFF9D174D),
      Color(0xFF7C3AED),
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                _t(
                  'New: $_unreadAnnouncementCount',
                  'አዲስ: $_unreadAnnouncementCount',
                ),
                style: const TextStyle(
                  color: Color(0xFF1E90FF),
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
              const Spacer(),
            ],
          ),
          const SizedBox(height: 6),
          Expanded(
            child: _isLoadingAnnouncements
                ? const Center(child: CircularProgressIndicator())
                : _announcements.isEmpty
                ? Center(
                    child: Text(
                      _t(
                        'No announcements available right now.',
                        'አሁን ማስታወቂያ የለም።',
                      ),
                      style: TextStyle(color: bodyColor),
                    ),
                  )
                : ListView.separated(
                    itemCount: _announcements.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final item = _announcements[index];
                      final isMarking = _markingAnnouncementIds.contains(
                        item.id,
                      );
                      final accent = titlePalette[index % titlePalette.length];
                      final isLong = _isLongAnnouncement(item);
                      final timeAgo = _timeAgoLabel(item.createdAt);

                      return InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () {
                          if (isLong) {
                            _openAnnouncementDetail(item);
                            return;
                          }
                          _markAnnouncementAsRead(item);
                        },
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: item.isRead
                                  ? Colors.transparent
                                  : const Color(
                                      0xFF1E90FF,
                                    ).withValues(alpha: 0.35),
                            ),
                            color: item.isRead
                                ? (_isDarkMode
                                      ? const Color(0xFF1E3A5F)
                                      : const Color(0xFFDCEBFF))
                                : const Color(
                                    0xFF1E90FF,
                                  ).withValues(alpha: 0.09),
                            boxShadow: item.isRead
                                ? const []
                                : [
                                    BoxShadow(
                                      color: const Color(
                                        0xFF1E90FF,
                                      ).withValues(alpha: 0.18),
                                      blurRadius: 12,
                                      offset: const Offset(0, 6),
                                    ),
                                  ],
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            item.title,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              fontWeight: FontWeight.w800,
                                              color: accent,
                                              fontSize: 14,
                                            ),
                                          ),
                                        ),
                                        if (!item.isRead)
                                          Container(
                                            width: 9,
                                            height: 9,
                                            margin: const EdgeInsets.only(
                                              left: 6,
                                            ),
                                            decoration: const BoxDecoration(
                                              color: Color(0xFF1E90FF),
                                              shape: BoxShape.circle,
                                            ),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      item.message,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        color: bodyColor,
                                        fontSize: 12.5,
                                        height: 1.35,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Row(
                                      children: [
                                        if (isMarking)
                                          const SizedBox(
                                            width: 12,
                                            height: 12,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                            ),
                                          )
                                        else
                                          Text(
                                            '$timeAgo  •  ${item.isRead ? _t('Read', 'ተነቧል') : _t('Unread', 'አልተነበበም')}',
                                            style: TextStyle(
                                              color: item.isRead
                                                  ? bodyColor
                                                  : const Color(0xFF1E90FF),
                                              fontSize: 10.5,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.bottomRight,
            child: _buildCornerRefreshButton(
              isLoading: _isLoadingAnnouncements,
              onPressed: _loadAnnouncements,
              tooltip: _t('Refresh notifications', 'ማሳወቂያዎችን አድስ'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSchedulesPlaceholder() {
    final bodyColor = _isDarkMode ? _darkMuted : const Color(0xFF475569);
    final monthGrid = _calendarMonthGrid(_scheduleCalendarMonth);
    final selectedDaySchedules = _schedulesForDate(_selectedScheduleDate);
    final viewportHeight = MediaQuery.of(context).size.height;
    final isCompactHeight = viewportHeight < 760;
    final calendarHeight = isCompactHeight ? 220.0 : 290.0;
    final weekdayGap = isCompactHeight ? 6.0 : 8.0;
    final monthControlGap = isCompactHeight ? 4.0 : 6.0;
    final sectionGap = isCompactHeight ? 4.0 : 6.0;
    final weekdayHeaders = [
      _t('Mon', 'ሰኞ'),
      _t('Tue', 'ማክ'),
      _t('Wed', 'ረቡ'),
      _t('Thu', 'ሐሙ'),
      _t('Fri', 'ዓር'),
      _t('Sat', 'ቅዳ'),
      _t('Sun', 'እሑ'),
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                onPressed: () {
                  setState(() {
                    _scheduleCalendarMonth = DateTime(
                      _scheduleCalendarMonth.year,
                      _scheduleCalendarMonth.month - 1,
                      1,
                    );
                  });
                },
                icon: const Icon(Icons.chevron_left),
                color: const Color(0xFF1E90FF),
                tooltip: _t('Previous month', 'ያለፈው ወር'),
              ),
              Expanded(
                child: Text(
                  _monthLabel(_scheduleCalendarMonth),
                  textAlign: TextAlign.center,
                  style: GoogleFonts.syne(
                    fontWeight: FontWeight.w700,
                    color: _isDarkMode ? Colors.white : const Color(0xFF0F172A),
                    fontSize: 15,
                  ),
                ),
              ),
              IconButton(
                onPressed: () {
                  setState(() {
                    _scheduleCalendarMonth = DateTime(
                      _scheduleCalendarMonth.year,
                      _scheduleCalendarMonth.month + 1,
                      1,
                    );
                  });
                },
                icon: const Icon(Icons.chevron_right),
                color: const Color(0xFF1E90FF),
                tooltip: _t('Next month', 'ቀጣይ ወር'),
              ),
            ],
          ),
          SizedBox(height: monthControlGap),
          SizedBox(
            height: calendarHeight,
            child: Column(
              children: [
                Row(
                  children: weekdayHeaders
                      .map(
                        (label) => Expanded(
                          child: Center(
                            child: Text(
                              label,
                              style: TextStyle(
                                color: bodyColor,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
                SizedBox(height: weekdayGap),
                Expanded(
                  child: GridView.builder(
                    itemCount: monthGrid.length,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 7,
                      mainAxisSpacing: isCompactHeight ? 6 : 8,
                      crossAxisSpacing: isCompactHeight ? 6 : 8,
                      childAspectRatio: isCompactHeight ? 1.0 : 0.92,
                    ),
                    itemBuilder: (context, index) {
                      final day = monthGrid[index];
                      if (day == null) {
                        return Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: const Color(
                                0xFF1E90FF,
                              ).withValues(alpha: 0.08),
                            ),
                          ),
                        );
                      }

                      final hasSchedule = _hasScheduleOnDate(day);
                      final isSelected =
                          day.year == _selectedScheduleDate.year &&
                          day.month == _selectedScheduleDate.month &&
                          day.day == _selectedScheduleDate.day;

                      return InkWell(
                        onTap: () {
                          setState(() {
                            _selectedScheduleDate = day;
                          });
                        },
                        borderRadius: BorderRadius.circular(10),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isSelected
                                  ? const Color(0xFF1E90FF)
                                  : const Color(
                                      0xFF1E90FF,
                                    ).withValues(alpha: 0.18),
                            ),
                            color: isSelected
                                ? const Color(
                                    0xFF1E90FF,
                                  ).withValues(alpha: 0.16)
                                : (_isDarkMode
                                      ? const Color(0xFF11263D)
                                      : const Color(0xFFDCEBFF)),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                '${day.day}',
                                style: TextStyle(
                                  color: _isDarkMode
                                      ? Colors.white
                                      : const Color(0xFF0F172A),
                                  fontWeight: FontWeight.w800,
                                  fontSize: 15,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: hasSchedule
                                      ? const Color(0xFF0F9D58)
                                      : const Color(0xFF94A3B8),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: sectionGap),
          Row(
            children: [
              Text(
                _t(
                  'Selected day: ${selectedDaySchedules.length}',
                  'የተመረጠ ቀን: ${selectedDaySchedules.length}',
                ),
                style: const TextStyle(
                  color: Color(0xFF1E90FF),
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
              const Spacer(),
              _buildCornerRefreshButton(
                isLoading: _isLoadingScheduleNotifications,
                onPressed: _loadScheduleNotifications,
                tooltip: _t('Refresh schedules', 'መርሃ ግብሮችን አድስ'),
              ),
            ],
          ),
          SizedBox(height: sectionGap),
          Expanded(
            child: _isLoadingScheduleNotifications
                ? const Center(child: CircularProgressIndicator())
                : selectedDaySchedules.isEmpty
                ? Center(
                    child: Text(
                      _t(
                        'No schedules for the selected day.',
                        'ለተመረጠው ቀን መርሃ ግብር የለም።',
                      ),
                      style: TextStyle(color: bodyColor),
                    ),
                  )
                : ListView.separated(
                    itemCount: selectedDaySchedules.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final item = selectedDaySchedules[index];
                      final createdLabel = _timeAgoLabel(item.createdAt);
                      final scheduleNote = item.note.trim().isEmpty
                          ? _t('No note provided', 'ማስታወሻ የለም')
                          : item.note.trim();
                      final scheduleDay = item.dayLabel.trim().isEmpty
                          ? _t('Scheduled day', 'የተያዘ ቀን')
                          : item.dayLabel.trim();

                      return InkWell(
                        onTap: () =>
                            _openScheduleDetail(item, _selectedScheduleDate),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: const Color(
                                0xFF1E90FF,
                              ).withValues(alpha: 0.24),
                            ),
                            color: _isDarkMode
                                ? const Color(0xFF11263D)
                                : const Color(0xFFDCEBFF),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x1A1E90FF),
                                blurRadius: 12,
                                offset: Offset(0, 6),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      scheduleDay,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                        color: Color(0xFF1D4ED8),
                                        fontSize: 14,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${item.startTime12} - ${item.endTime12}${item.woredaName.trim().isNotEmpty ? ' • ${item.woredaName}' : ''}',
                                style: TextStyle(
                                  color: bodyColor,
                                  fontSize: 12.5,
                                  height: 1.35,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                item.messageGregorian,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: bodyColor,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '$scheduleNote${createdLabel.isNotEmpty ? '  •  $createdLabel' : ''}',
                                style: TextStyle(
                                  color: bodyColor,
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
          SizedBox(height: isCompactHeight ? 2 : 4),
        ],
      ),
    );
  }

  Widget _buildOcrPlaceholder() {
    final hasSubmitted = _hasSubmittedCurrentCycle;
    final shouldShowOpen = _ocrWindowOpen && !hasSubmitted;

    final title = hasSubmitted
        ? _t('Bill submitted for this month', 'የዚህ ወር ቢል ተልኳል')
        : shouldShowOpen
        ? _t('Submit Meter Reading', 'የሜትር ንባብ ያስገቡ')
        : _t('OCR Window Closed', 'የOCR መስኮት ዝግ ነው');

    final titleColor = hasSubmitted
        ? const Color(0xFF0F766E)
        : shouldShowOpen
        ? (_isDarkMode ? Colors.white : const Color(0xFF111827))
        : const Color(0xFFDC2626);

    final bodyText = hasSubmitted
        ? _t(
            'You already submitted and paid for this billing cycle. The banner stays hidden until next month.',
            'ይህ የክፍያ ዑደት ተልኳል እና ተከፍሏል። ማሳያው እስከሚቀጥለው ወር ድረስ ይደበቃል።',
          )
        : shouldShowOpen
        ? _t(
            'Tap the button below to allow camera access and continue to OCR scanning.',
            'ከታች ያለውን ቁልፍ በመንካት የካሜራ ፍቃድ ይስጡ እና ወደ OCR ስካን ይቀጥሉ።',
          )
        : _t(
            'The OCR window is currently closed. You can still apply for late payment approval.',
            'የOCR መስኮት አሁን ዝግ ነው። ለዘገየ ክፍያ ፍቃድ ማመልከት ይችላሉ።',
          );

    final buttonLabel = hasSubmitted
        ? _t('Submitted for this month', 'ለዚህ ወር ተልኳል')
        : shouldShowOpen
        ? _t('Start OCR Scan', 'OCR ስካን ጀምር')
        : _t('Apply for Late Payment', 'ለዘገየ ክፍያ ያመልክቱ');

    final buttonIcon = hasSubmitted
        ? Icons.verified_outlined
        : shouldShowOpen
        ? Icons.camera_alt_outlined
        : Icons.request_page_outlined;

    return LayoutBuilder(
      builder: (context, constraints) {
        final intro = Curves.easeOutCubic.transform(_ocrIntroController.value);
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            gradient: _isDarkMode
                ? const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFF08121D),
                      Color(0xFF0B1B2F),
                      Color(0xFF111827),
                    ],
                  )
                : const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFFEFF6FF),
                      Color(0xFFEEF2FF),
                      Color(0xFFF5F3FF),
                    ],
                  ),
          ),
          child: Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: math.min(680, constraints.maxWidth),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: AnimatedBuilder(
                  animation: Listenable.merge([
                    _ocrAmbientController,
                    _ocrShimmerController,
                  ]),
                  builder: (context, _) {
                    return Stack(
                      children: [
                        _buildOcrAnimatedBackdrop(constraints),
                        Opacity(
                          opacity: intro,
                          child: Transform.translate(
                            offset: Offset(0, (1 - intro) * 24),
                            child: Container(
                              padding: const EdgeInsets.fromLTRB(
                                20,
                                20,
                                20,
                                22,
                              ),
                              decoration: BoxDecoration(
                                color:
                                    (_isDarkMode ? _darkSurface : Colors.white)
                                        .withValues(
                                          alpha: _isDarkMode ? 0.94 : 0.84,
                                        ),
                                borderRadius: BorderRadius.circular(28),
                                border: Border.all(
                                  color: _isDarkMode
                                      ? _darkBorder
                                      : Colors.white.withValues(alpha: 0.9),
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(
                                      alpha: _isDarkMode ? 0.28 : 0.12,
                                    ),
                                    blurRadius: 26,
                                    offset: const Offset(0, 12),
                                  ),
                                ],
                              ),
                              child: Stack(
                                children: [
                                  Positioned.fill(
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(28),
                                      child: _buildOcrCardHalfCircles(),
                                    ),
                                  ),
                                  SingleChildScrollView(
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        _buildOcrAnimatedRow(
                                          delay: 0.08,
                                          child: Row(
                                            children: [
                                              MouseRegion(
                                                onEnter: (_) => setState(
                                                  () => _ocrIconHovered = true,
                                                ),
                                                onExit: (_) => setState(
                                                  () => _ocrIconHovered = false,
                                                ),
                                                child: GestureDetector(
                                                  onTapDown: (_) => setState(
                                                    () =>
                                                        _ocrIconPressed = true,
                                                  ),
                                                  onTapUp: (_) => setState(
                                                    () =>
                                                        _ocrIconPressed = false,
                                                  ),
                                                  onTapCancel: () => setState(
                                                    () =>
                                                        _ocrIconPressed = false,
                                                  ),
                                                  child: Hero(
                                                    tag: 'ocr-scan-hero',
                                                    child: AnimatedScale(
                                                      duration: const Duration(
                                                        milliseconds: 180,
                                                      ),
                                                      scale: _ocrIconPressed
                                                          ? 0.96
                                                          : (_ocrIconHovered
                                                                ? 1.02
                                                                : 1.0),
                                                      child: Container(
                                                        width: 54,
                                                        height: 54,
                                                        decoration: const BoxDecoration(
                                                          borderRadius:
                                                              BorderRadius.all(
                                                                Radius.circular(
                                                                  16,
                                                                ),
                                                              ),
                                                          gradient:
                                                              LinearGradient(
                                                                colors: [
                                                                  Color(
                                                                    0xFF0B3B67,
                                                                  ),
                                                                  Color(
                                                                    0xFF1E90FF,
                                                                  ),
                                                                ],
                                                              ),
                                                        ),
                                                        child: const Icon(
                                                          Icons
                                                              .center_focus_strong,
                                                          color: Colors.white,
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 12),
                                              Expanded(
                                                child: Text(
                                                  _labelFor(
                                                    DashboardFeature.ocr,
                                                  ),
                                                  style: GoogleFonts.syne(
                                                    fontSize: 28,
                                                    fontWeight: FontWeight.w800,
                                                    color: _isDarkMode
                                                        ? Colors.white
                                                        : const Color(
                                                            0xFF111827,
                                                          ),
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        const SizedBox(height: 22),
                                        _buildOcrAnimatedRow(
                                          delay: 0.16,
                                          child: Center(
                                            child: AnimatedContainer(
                                              duration: const Duration(
                                                milliseconds: 450,
                                              ),
                                              width: 122,
                                              height: 122,
                                              decoration: BoxDecoration(
                                                shape: BoxShape.circle,
                                                gradient: shouldShowOpen
                                                    ? const LinearGradient(
                                                        begin:
                                                            Alignment.topLeft,
                                                        end: Alignment
                                                            .bottomRight,
                                                        colors: [
                                                          Color(0xFF0B3B67),
                                                          Color(0xFF1E90FF),
                                                        ],
                                                      )
                                                    : const LinearGradient(
                                                        begin:
                                                            Alignment.topLeft,
                                                        end: Alignment
                                                            .bottomRight,
                                                        colors: [
                                                          Color(0xFFDC2626),
                                                          Color(0xFFB91C1C),
                                                        ],
                                                      ),
                                                boxShadow: [
                                                  BoxShadow(
                                                    color:
                                                        (shouldShowOpen
                                                                ? const Color(
                                                                    0xFF1E90FF,
                                                                  )
                                                                : const Color(
                                                                    0xFFDC2626,
                                                                  ))
                                                            .withValues(
                                                              alpha: 0.28,
                                                            ),
                                                    blurRadius: 34,
                                                    spreadRadius: 6,
                                                  ),
                                                ],
                                              ),
                                              child: const Hero(
                                                tag: 'ocr-scan-card',
                                                child: Icon(
                                                  Icons
                                                      .document_scanner_outlined,
                                                  color: Colors.white,
                                                  size: 56,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 20),
                                        _buildOcrAnimatedRow(
                                          delay: 0.24,
                                          child: Center(
                                            child: Text(
                                              title,
                                              textAlign: TextAlign.center,
                                              style: GoogleFonts.syne(
                                                fontSize: 28,
                                                fontWeight: FontWeight.w800,
                                                color: titleColor,
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 10),
                                        _buildOcrAnimatedRow(
                                          delay: 0.3,
                                          child: Text(
                                            bodyText,
                                            textAlign: TextAlign.center,
                                            style: TextStyle(
                                              fontSize: 15,
                                              color: hasSubmitted
                                                  ? const Color(0xFF0F766E)
                                                  : (shouldShowOpen
                                                        ? (_isDarkMode
                                                              ? _darkMuted
                                                              : const Color(
                                                                  0xFF6B7280,
                                                                ))
                                                        : const Color(
                                                            0xFFDC2626,
                                                          )),
                                              height: 1.52,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 22),
                                        _buildOcrAnimatedRow(
                                          delay: 0.38,
                                          child: _buildOcrPrimaryButton(
                                            label: buttonLabel,
                                            icon: buttonIcon,
                                            enabled: !hasSubmitted,
                                            isOpen: shouldShowOpen,
                                          ),
                                        ),
                                        if (_isOcrActionBusy && shouldShowOpen)
                                          Padding(
                                            padding: const EdgeInsets.only(
                                              top: 12,
                                            ),
                                            child: _buildOcrAnimatedRow(
                                              delay: 0.46,
                                              child: Row(
                                                mainAxisAlignment:
                                                    MainAxisAlignment.center,
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  const SizedBox(
                                                    width: 16,
                                                    height: 16,
                                                    child:
                                                        CircularProgressIndicator(
                                                          strokeWidth: 2,
                                                          color: Color(
                                                            0xFF1E90FF,
                                                          ),
                                                        ),
                                                  ),
                                                  const SizedBox(width: 10),
                                                  const Icon(
                                                    Icons.check_circle_outline,
                                                    size: 18,
                                                    color: Color(0xFF0F766E),
                                                  ),
                                                  const SizedBox(width: 8),
                                                  Text(
                                                    _t(
                                                      'Initializing...',
                                                      'በማስጀመር ላይ...',
                                                    ),
                                                    style: const TextStyle(
                                                      color: Color(0xFF0F766E),
                                                      fontWeight:
                                                          FontWeight.w600,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildOcrPrimaryButton({
    required String label,
    required IconData icon,
    required bool enabled,
    required bool isOpen,
  }) {
    return MouseRegion(
      onEnter: enabled ? (_) => setState(() => _ocrButtonHovered = true) : null,
      onExit: enabled ? (_) => setState(() => _ocrButtonHovered = false) : null,
      child: GestureDetector(
        onTap: enabled
            ? () {
                if (isOpen) {
                  _startOcrScanFlow();
                } else {
                  _applyForLatePayment();
                }
              }
            : null,
        onTapDown: enabled
            ? (_) => setState(() => _ocrButtonPressed = true)
            : null,
        onTapUp: enabled
            ? (_) => setState(() => _ocrButtonPressed = false)
            : null,
        onTapCancel: enabled
            ? () => setState(() => _ocrButtonPressed = false)
            : null,
        child: AnimatedScale(
          duration: const Duration(milliseconds: 180),
          scale: _ocrButtonPressed ? 0.97 : (_ocrButtonHovered ? 1.02 : 1.0),
          child: AnimatedOpacity(
            duration: const Duration(milliseconds: 220),
            opacity: enabled ? 1 : 0.7,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: LinearGradient(
                  colors: enabled && isOpen
                      ? [const Color(0xFF0B3B67), const Color(0xFF1E90FF)]
                      : enabled
                      ? [const Color(0xFFB91C1C), const Color(0xFFEF4444)]
                      : [const Color(0xFF0F766E), const Color(0xFF14B8A6)],
                ),
                boxShadow: [
                  BoxShadow(
                    color:
                        (enabled && isOpen
                                ? const Color(0xFF124A86)
                                : enabled
                                ? const Color(0xFFB91C1C)
                                : const Color(0xFF0F766E))
                            .withValues(alpha: 0.34),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Stack(
                children: [
                  Positioned.fill(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: AnimatedBuilder(
                        animation: _ocrShimmerController,
                        builder: (context, _) {
                          final shimmer = _ocrShimmerController.value;
                          return IgnorePointer(
                            child: FractionallySizedBox(
                              alignment: Alignment(-1.2 + (shimmer * 2.4), 0),
                              widthFactor: 0.28,
                              child: Container(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [
                                      Colors.white.withValues(alpha: 0.0),
                                      Colors.white.withValues(alpha: 0.18),
                                      Colors.white.withValues(alpha: 0.0),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  Center(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(icon, color: Colors.white),
                        const SizedBox(width: 10),
                        Text(
                          label,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  int _unreadCountForFeature(DashboardFeature feature) {
    if (feature == DashboardFeature.notifications) {
      return _unreadAnnouncementCount;
    }
    if (feature == DashboardFeature.schedules) {
      return _scheduleUnreadCount;
    }
    return 0;
  }

  Widget _buildNavTabItem({
    required IconData icon,
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
    int unreadCount = 0,
    bool draggable = false,
    Widget? dragFeedback,
    int? dragData,
    ValueChanged<int>? onAccept,
  }) {
    final selectedColor = const Color(0xFF124A86);
    final unselectedColor = _isDarkMode
        ? const Color(0xFF94A3B8)
        : const Color(0xFF64748B);
    final itemColor = isSelected ? selectedColor : unselectedColor;
    final hasUnread = unreadCount > 0;

    Widget item = InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            hasUnread
                ? Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Icon(icon, color: itemColor),
                      Positioned(
                        right: -6,
                        top: -5,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 4,
                            vertical: 1,
                          ),
                          decoration: const BoxDecoration(
                            color: Color(0xFFDC2626),
                            borderRadius: BorderRadius.all(Radius.circular(10)),
                          ),
                          child: Text(
                            unreadCount > 99 ? '99+' : '$unreadCount',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ],
                  )
                : Icon(icon, color: itemColor),
            const SizedBox(height: 4),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: itemColor,
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );

    if (!draggable ||
        dragData == null ||
        dragFeedback == null ||
        onAccept == null) {
      return item;
    }

    return DragTarget<int>(
      onWillAcceptWithDetails: (details) => details.data != dragData,
      onAcceptWithDetails: (details) => onAccept(details.data),
      builder: (context, candidateData, rejectedData) {
        final isHoverTarget = candidateData.isNotEmpty;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: isHoverTarget
                ? const Color(0xFF1E90FF).withValues(alpha: 0.14)
                : Colors.transparent,
          ),
          child: LongPressDraggable<int>(
            data: dragData,
            feedback: dragFeedback,
            childWhenDragging: Opacity(opacity: 0.32, child: item),
            child: item,
          ),
        );
      },
    );
  }

  Widget _buildDraggableBottomNavBar() {
    final backgroundColor = _isDarkMode ? _darkSurface : Colors.white;
    final borderColor = _isDarkMode
        ? _darkBorder.withValues(alpha: 0.85)
        : const Color(0xFFD7E6FA);

    return SafeArea(
      top: false,
      child: Container(
        height: 68,
        padding: const EdgeInsets.symmetric(horizontal: 6),
        decoration: BoxDecoration(
          color: backgroundColor,
          border: Border(top: BorderSide(color: borderColor)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: _isDarkMode ? 0.24 : 0.08),
              blurRadius: 14,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: Row(
          children: [
            ..._visibleFeatures.asMap().entries.map((entry) {
              final index = entry.key;
              final feature = entry.value;
              final isSelected = index == _selectedIndex;
              final unreadCount = _unreadCountForFeature(feature);

              return Expanded(
                child: _buildNavTabItem(
                  icon: _iconFor(feature),
                  label: _labelFor(feature),
                  isSelected: isSelected,
                  unreadCount: unreadCount,
                  onTap: () => _selectFeature(feature),
                  draggable: true,
                  dragData: index,
                  onAccept: (fromIndex) =>
                      _moveVisibleFeature(fromIndex, index),
                  dragFeedback: Material(
                    color: Colors.transparent,
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 66),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFF124A86),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.22),
                            blurRadius: 12,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Icon(
                        _iconFor(feature),
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                  ),
                ),
              );
            }),
            Expanded(
              child: _buildNavTabItem(
                icon: Icons.add_circle_outline,
                label: _t('More', 'ተጨማሪ'),
                isSelected: false,
                onTap: _openMoreMenu,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openMoreMenu() {
    final hidden = _hiddenFeatures;
    final visible = _visibleFeatures;
    final titleColor = Colors.white;
    final bodyColor = _isDarkMode ? _darkMuted : const Color(0xFFD6E4F5);
    final drawerBackground = _isDarkMode
        ? _darkSurface
        : const Color(0xFF0B3B67);

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: drawerBackground,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: SizedBox(
            height: 500,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    _t('More Widgets', 'ተጨማሪ ዊጅቶች'),
                    textAlign: TextAlign.center,
                    style: GoogleFonts.syne(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: titleColor,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _t(
                      'Use + to add a widget to the bottom bar and - to remove it.',
                      '+ በመጠቀም ወደ ታችኛው ባር ያክሉ፣ - በመጠቀም ያስወግዱ።',
                    ),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      color: bodyColor,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Expanded(
                    child: SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            _t('Bottom bar widgets', 'የታችኛው ባር ዊጅቶች'),
                            style: TextStyle(
                              color: titleColor,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: visible
                                .map(
                                  (feature) => Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 8,
                                    ),
                                    decoration: BoxDecoration(
                                      color: _isDarkMode
                                          ? const Color(0xFF132033)
                                          : const Color(0xFF124A86),
                                      borderRadius: BorderRadius.circular(18),
                                      border: Border.all(
                                        color: _isDarkMode
                                            ? _darkBorder
                                            : const Color(0xFF2B6CB0),
                                      ),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          _iconFor(feature),
                                          size: 16,
                                          color: _lightAccent,
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          _labelFor(feature),
                                          style: TextStyle(
                                            color: titleColor,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        InkWell(
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                          onTap: _visibleFeatures.length <= 1
                                              ? null
                                              : () => _removeFeature(feature),
                                          child: Icon(
                                            Icons.remove_circle_outline,
                                            size: 18,
                                            color: _visibleFeatures.length <= 1
                                                ? Colors.white30
                                                : Colors.white,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            _t('Available widgets', 'ሊጨመሩ የሚችሉ ዊጅቶች'),
                            style: TextStyle(
                              color: titleColor,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: hidden
                                .map(
                                  (feature) => Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 8,
                                    ),
                                    decoration: BoxDecoration(
                                      color: _isDarkMode
                                          ? const Color(0xFF132033)
                                          : const Color(0xFF124A86),
                                      borderRadius: BorderRadius.circular(18),
                                      border: Border.all(
                                        color: _isDarkMode
                                            ? _darkBorder
                                            : const Color(0xFF2B6CB0),
                                      ),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          _iconFor(feature),
                                          size: 16,
                                          color: _lightAccent,
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          _labelFor(feature),
                                          style: TextStyle(
                                            color: titleColor,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        InkWell(
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                          onTap: () => _addFeature(feature),
                                          child: const Icon(
                                            Icons.add_circle_outline,
                                            size: 18,
                                            color: Colors.white,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildOcrPrimaryBanner() {
    if (_hasSubmittedCurrentCycle) {
      return const SizedBox.shrink();
    }

    if (!_ocrWindowOpen || !_showOcrWindowBanner) {
      return const SizedBox.shrink();
    }

    final label = (_ocrWindowStart != null && _ocrWindowClose != null)
        ? '${_ocrWindowStart!.toLocal().toString().split(' ').first} - ${_ocrWindowClose!.toLocal().toString().split(' ').first}'
        : '';

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Dismissible(
        key: const ValueKey<String>('ocr-window-open-banner'),
        direction: DismissDirection.horizontal,
        onDismissed: (_) {
          setState(() {
            _showOcrWindowBanner = false;
            _bannerDismissed = true;
          });
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFFE8F9F1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFA7E8C8)),
          ),
          child: Row(
            children: [
              const Icon(
                Icons.document_scanner_outlined,
                color: Color(0xFF0F8A57),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  _t('OCR window is open: $label', 'የOCR መስኮት ተከፍቷል: $label'),
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF115E59),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              IconButton(
                tooltip: _t('Dismiss', 'ዝጋ'),
                onPressed: () {
                  setState(() {
                    _showOcrWindowBanner = false;
                    _bannerDismissed = true;
                  });
                },
                icon: const Icon(
                  Icons.close,
                  color: Color(0xFF0F8A57),
                  size: 18,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentFeature = _visibleFeatures[_selectedIndex];
    final background = _isDarkMode ? _darkBg : _lightBg;
    const headerWidth = double.infinity;

    return Scaffold(
      backgroundColor: background,
      appBar: AppBar(
        backgroundColor: _lightTopBar,
        foregroundColor: Colors.white,
        elevation: 0,
        toolbarHeight: 102,
        flexibleSpace: const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF0B3B67), Color(0xFF124A86), Color(0xFF1E90FF)],
            ),
          ),
        ),
        titleSpacing: 0,
        title: SizedBox(
          width: double.infinity,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                height: 26,
                width: headerWidth,
                child: Align(
                  alignment: Alignment.center,
                  child: _MarqueeText(
                    text: '${_t('Welcome', 'እንኳን ደህና መጡ')} $_username',
                    style: GoogleFonts.syne(
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      fontSize: 16,
                    ),
                    gap: 32,
                    duration: const Duration(seconds: 18),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              SizedBox(
                width: headerWidth,
                child: Text(
                  _t(
                    'Track bills, consumption and complaints',
                    'ቢሎችን፣ ፍጆታን እና ቅሬታዎችን ይከታተሉ',
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  softWrap: true,
                  overflow: TextOverflow.visible,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.9),
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    height: 1.05,
                    letterSpacing: 0.1,
                  ),
                ),
              ),
            ],
          ),
        ),
        actions: [
          MouseRegion(
            onEnter: (_) => setState(() => _showLogoutLabel = true),
            onExit: (_) => setState(() => _showLogoutLabel = false),
            child: InkWell(
              onTap: _logout,
              borderRadius: BorderRadius.circular(20),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  children: [
                    AnimatedOpacity(
                      opacity: _showLogoutLabel ? 1 : 0,
                      duration: const Duration(milliseconds: 180),
                      child: Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: Text(
                          _t('Logout', 'ውጣ'),
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    const Icon(Icons.logout, color: Colors.white),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      drawer: Drawer(
        backgroundColor: _isDarkMode ? _darkSurface : const Color(0xFF0B3B67),
        child: SafeArea(
          child: IconTheme.merge(
            data: const IconThemeData(color: Colors.white),
            child: Theme(
              data: Theme.of(context).copyWith(
                textTheme: Theme.of(context).textTheme.apply(
                  bodyColor: Colors.white,
                  displayColor: Colors.white,
                ),
                dropdownMenuTheme: const DropdownMenuThemeData(
                  textStyle: TextStyle(color: Colors.white),
                ),
              ),
              child: ListView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                children: [
                  ListTile(
                    leading: const Icon(Icons.dark_mode_outlined),
                    title: Text(_t('Dark Mode', 'ጨለማ ገጽታ')),
                    trailing: Switch(
                      value: _isDarkMode,
                      activeThumbColor: const Color(0xFF1E90FF),
                      inactiveThumbColor: Colors.grey,
                      onChanged: (value) async {
                        final prefs = await SharedPreferences.getInstance();
                        await prefs.setBool(_darkModeKey, value);
                        if (!mounted) {
                          return;
                        }
                        setState(() {
                          _isDarkMode = value;
                        });
                        widget.onThemeChanged?.call(value);
                      },
                    ),
                  ),
                  ListTile(
                    leading: const Icon(Icons.language_outlined),
                    title: Text(_t('Language', 'ቋንቋ')),
                    subtitle: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _language,
                        isExpanded: true,
                        dropdownColor: _isDarkMode
                            ? _darkSurface
                            : const Color(0xFF124A86),
                        style: const TextStyle(color: Colors.white),
                        iconEnabledColor: Colors.white,
                        onChanged: (value) async {
                          if (value == null) {
                            return;
                          }
                          setState(() {
                            _language = value;
                          });
                          await _persistLanguage(value);
                        },
                        items: const [
                          DropdownMenuItem(value: 'en', child: Text('English')),
                          DropdownMenuItem(value: 'am', child: Text('Amharic')),
                        ],
                      ),
                    ),
                  ),
                  ListTile(
                    leading: const Icon(Icons.swap_horiz_outlined),
                    title: Text(_t('Ownership Change', 'የባለቤትነት ለውጥ')),
                    onTap: _openOwnershipChangeModal,
                  ),
                  ListTile(
                    leading: const Icon(Icons.person_outline),
                    title: Text(_t('Profile & Settings', 'ፕሮፋይል እና ቅንብሮች')),
                    onTap: () {
                      Navigator.pop(context);
                      showDialog<void>(
                        context: context,
                        builder: (ctx) {
                          return AlertDialog(
                            backgroundColor: _isDarkMode
                                ? _darkSurface
                                : const Color(0xFF124A86),
                            title: Text(_t('Profile', 'ፕሮፋይል')),
                            content: Text(
                              _t(
                                'Name: $_username\nLanguage: ${_language == 'en' ? 'English' : 'Amharic'}',
                                'ስም: $_username\nቋንቋ: ${_language == 'en' ? 'እንግሊዝኛ' : 'አማርኛ'}',
                              ),
                            ),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(ctx),
                                child: const Text('OK'),
                              ),
                            ],
                          );
                        },
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          if (_isLoadingOcrWindow)
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: LinearProgressIndicator(minHeight: 2),
            ),
          _buildOcrPrimaryBanner(),
          Expanded(child: _buildPlaceholderContent(currentFeature)),
        ],
      ),
      bottomNavigationBar: _buildDraggableBottomNavBar(),
    );
  }

  Widget _buildOcrAnimatedBackdrop(BoxConstraints constraints) {
    final size = constraints.biggest;
    final progress = _ocrAmbientController.value * math.pi * 2;

    return IgnorePointer(
      child: Positioned.fill(
        child: Stack(
          children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: _isDarkMode
                        ? [
                            const Color(0xFF08121D),
                            const Color(0xFF0B1B2F),
                            const Color(0xFF111827),
                          ]
                        : [
                            const Color(0xFFEFF6FF),
                            const Color(0xFFDBEAFE),
                            const Color(0xFFEDE9FE),
                          ],
                  ),
                ),
              ),
            ),
            ..._ocrOrbs.map((orb) {
              final dx =
                  math.sin(progress * orb.speed + orb.phase) * orb.driftX;
              final dy =
                  math.cos(progress * orb.speed * 0.9 + orb.phase) * orb.driftY;
              return Positioned(
                left: (size.width * orb.baseX) + dx - orb.size / 2,
                top: (size.height * orb.baseY) + dy - orb.size / 2,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  width: orb.size,
                  height: orb.size,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        const Color(0xFF1E90FF).withValues(alpha: orb.opacity),
                        const Color(
                          0xFF4F46E5,
                        ).withValues(alpha: orb.opacity * 0.55),
                        Colors.transparent,
                      ],
                      stops: const [0.0, 0.55, 1.0],
                    ),
                  ),
                ),
              );
            }),
            ..._ocrParticles.map((particle) {
              final dx =
                  math.sin(progress * particle.speed + particle.phase) *
                  particle.driftX;
              final dy =
                  math.cos(progress * particle.speed * 1.2 + particle.phase) *
                  particle.driftY;
              return Positioned(
                left: (size.width * particle.baseX) + dx,
                top: (size.height * particle.baseY) + dy,
                child: Container(
                  width: particle.size,
                  height: particle.size,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withValues(alpha: particle.opacity),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.white.withValues(
                          alpha: particle.opacity * 0.4,
                        ),
                        blurRadius: 8,
                        spreadRadius: 1,
                      ),
                    ],
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildOcrCardHalfCircles() {
    const circleColors = [
      Color(0xFFB7E8C8), // darker light green
      Color(0xFFF0BFC4), // darker light red
      Color(0xFFD1D5DB), // darker light gray
    ];

    return AnimatedBuilder(
      animation: _ocrAmbientController,
      builder: (context, _) {
        final progress = _ocrAmbientController.value * math.pi * 2;
        return LayoutBuilder(
          builder: (context, constraints) {
            final size = constraints.biggest;
            return Stack(
              children: [
                ..._ocrHalfCircles.asMap().entries.map((entry) {
                  final index = entry.key;
                  final halfCircle = entry.value;
                  final color = circleColors[index % circleColors.length];
                  final angle =
                      progress * (halfCircle.speed * 1.55) +
                      halfCircle.phase +
                      (index * 0.45);

                  // Layered orbital drift gives visibly continuous motion.
                  final dx =
                      (math.sin(angle) * halfCircle.driftX * 1.8) +
                      (math.cos(angle * 1.75) * halfCircle.driftX * 0.9);
                  final dy =
                      (math.cos(angle * 1.25) * halfCircle.driftY * 1.8) +
                      (math.sin(angle * 1.6) * halfCircle.driftY * 0.85);
                  final breathe = 0.9 + (math.sin(angle * 1.2) * 0.11);
                  final shimmer = 0.82 + (math.cos(angle * 1.4) * 0.18);
                  final diameter = halfCircle.radius * 2;

                  return Positioned(
                    left:
                        (size.width * halfCircle.baseX) +
                        dx -
                        halfCircle.radius,
                    top:
                        (size.height * halfCircle.baseY) +
                        dy -
                        halfCircle.radius,
                    child: IgnorePointer(
                      child: Transform.scale(
                        scale: breathe,
                        child: Container(
                          width: diameter,
                          height: diameter,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: color.withValues(
                              alpha: halfCircle.opacity * shimmer,
                            ),
                            border: Border.all(
                              color: color.withValues(
                                alpha: halfCircle.opacity * (1.2 + shimmer),
                              ),
                              width: 1,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: color.withValues(
                                  alpha: halfCircle.opacity * (0.65 + shimmer),
                                ),
                                blurRadius: 28,
                                spreadRadius: 3,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildOcrAnimatedRow({required double delay, required Widget child}) {
    final intro = Curves.easeOutCubic.transform(_ocrIntroController.value);
    final rowOpacity = (intro - delay).clamp(0.0, 1.0);
    final rowOffset = (1 - rowOpacity) * 18;

    return Opacity(
      opacity: rowOpacity,
      child: Transform.translate(offset: Offset(0, rowOffset), child: child),
    );
  }
}

class _FloatingRefreshButton extends StatefulWidget {
  const _FloatingRefreshButton({
    required this.isLoading,
    required this.onPressed,
    required this.tooltip,
    required this.label,
  });

  final bool isLoading;
  final VoidCallback onPressed;
  final String tooltip;
  final String label;

  @override
  State<_FloatingRefreshButton> createState() => _FloatingRefreshButtonState();
}

class _FloatingRefreshButtonState extends State<_FloatingRefreshButton> {
  bool _hovered = false;
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: widget.tooltip,
      child: MouseRegion(
        onEnter: (_) => setState(() => _hovered = true),
        onExit: (_) => setState(() {
          _hovered = false;
          _pressed = false;
        }),
        child: AnimatedScale(
          duration: const Duration(milliseconds: 120),
          scale: _pressed ? 0.95 : (_hovered ? 1.04 : 1.0),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(22),
              onTap: widget.isLoading ? null : widget.onPressed,
              onTapDown: (_) => setState(() => _pressed = true),
              onTapUp: (_) => setState(() => _pressed = false),
              onTapCancel: () => setState(() => _pressed = false),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                padding: EdgeInsets.symmetric(
                  horizontal: _hovered ? 12 : 0,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E90FF).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(
                        0xFF1E90FF,
                      ).withValues(alpha: _hovered ? 0.42 : 0.28),
                      blurRadius: _hovered ? 22 : 14,
                      spreadRadius: _hovered ? 1.2 : 0,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SizedBox(width: 10),
                    widget.isLoading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(
                            Icons.refresh,
                            size: 18,
                            color: Color(0xFF1E90FF),
                          ),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 150),
                      child: _hovered
                          ? Padding(
                              key: const ValueKey('refresh-label'),
                              padding: const EdgeInsets.only(left: 8, right: 6),
                              child: Text(
                                widget.label,
                                style: const TextStyle(
                                  color: Color(0xFF1E90FF),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            )
                          : const SizedBox(
                              key: ValueKey('refresh-spacer'),
                              width: 10,
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FloatingOrbSpec {
  const _FloatingOrbSpec({
    required this.baseX,
    required this.baseY,
    required this.size,
    required this.driftX,
    required this.driftY,
    required this.phase,
    required this.speed,
    required this.opacity,
  });

  final double baseX;
  final double baseY;
  final double size;
  final double driftX;
  final double driftY;
  final double phase;
  final double speed;
  final double opacity;
}

class _FloatingParticleSpec {
  const _FloatingParticleSpec({
    required this.baseX,
    required this.baseY,
    required this.size,
    required this.driftX,
    required this.driftY,
    required this.phase,
    required this.speed,
    required this.opacity,
  });

  final double baseX;
  final double baseY;
  final double size;
  final double driftX;
  final double driftY;
  final double phase;
  final double speed;
  final double opacity;
}

class _FloatingHalfCircleSpec {
  const _FloatingHalfCircleSpec({
    required this.baseX,
    required this.baseY,
    required this.radius,
    required this.driftX,
    required this.driftY,
    required this.phase,
    required this.speed,
    required this.opacity,
  });

  final double baseX;
  final double baseY;
  final double radius;
  final double driftX;
  final double driftY;
  final double phase;
  final double speed;
  final double opacity;
}

class _ComplaintDraft {
  const _ComplaintDraft({
    required this.titleEn,
    required this.titleAm,
    required this.english,
    required this.amharic,
  });

  final String titleEn;
  final String titleAm;
  final String english;
  final String amharic;
}

class _MarqueeText extends StatefulWidget {
  const _MarqueeText({
    required this.text,
    required this.style,
    required this.duration,
    required this.gap,
  });

  final String text;
  final TextStyle style;
  final Duration duration;
  final double gap;

  @override
  State<_MarqueeText> createState() => _MarqueeTextState();
}

class _AnnouncementDetailPage extends StatelessWidget {
  const _AnnouncementDetailPage({
    required this.announcement,
    required this.isDarkMode,
    required this.titleText,
    required this.postedText,
    required this.timeAgo,
  });

  final UserAnnouncement announcement;
  final bool isDarkMode;
  final String titleText;
  final String postedText;
  final String timeAgo;

  @override
  Widget build(BuildContext context) {
    final background = isDarkMode
        ? const Color(0xFF08121D)
        : const Color(0xFFF8FAFC);
    final card = isDarkMode ? const Color(0xFF0F172A) : Colors.white;
    final border = isDarkMode
        ? const Color(0xFF24364A)
        : const Color(0xFFE2E8F0);
    final titleColor = isDarkMode ? Colors.white : const Color(0xFF0F172A);
    final bodyColor = isDarkMode
        ? const Color(0xFFCBD5E1)
        : const Color(0xFF475569);

    return Scaffold(
      backgroundColor: background,
      appBar: AppBar(
        title: Text(titleText),
        backgroundColor: const Color(0xFF0B3B67),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: border),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDarkMode ? 0.24 : 0.08),
                blurRadius: 16,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                announcement.title,
                style: TextStyle(
                  color: titleColor,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '$postedText · $timeAgo',
                style: TextStyle(
                  color: bodyColor,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                announcement.message,
                style: TextStyle(color: bodyColor, fontSize: 15, height: 1.6),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MarqueeTextState extends State<_MarqueeText>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final painter = TextPainter(
          text: TextSpan(text: widget.text, style: widget.style),
          textDirection: TextDirection.ltr,
          maxLines: 1,
        )..layout();

        final travel = painter.width + widget.gap;
        final contentHeight = painter.height;
        final visibleWidth = constraints.maxWidth;

        return ClipRect(
          child: SizedBox(
            width: visibleWidth,
            height: contentHeight,
            child: AnimatedBuilder(
              animation: _controller,
              builder: (context, _) {
                final offset = -(_controller.value * travel);
                final loopWidth = travel * 3;
                return Transform.translate(
                  offset: Offset(offset + visibleWidth, 0),
                  child: SizedBox(
                    width: loopWidth,
                    height: contentHeight,
                    child: Stack(
                      children: [
                        Positioned(
                          left: 0,
                          top: 0,
                          child: Text(
                            widget.text,
                            style: widget.style,
                            maxLines: 1,
                            softWrap: false,
                          ),
                        ),
                        Positioned(
                          left: painter.width + widget.gap,
                          top: 0,
                          child: Text(
                            widget.text,
                            style: widget.style,
                            maxLines: 1,
                            softWrap: false,
                          ),
                        ),
                        Positioned(
                          left: (painter.width + widget.gap) * 2,
                          top: 0,
                          child: Text(
                            widget.text,
                            style: widget.style,
                            maxLines: 1,
                            softWrap: false,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }
}
