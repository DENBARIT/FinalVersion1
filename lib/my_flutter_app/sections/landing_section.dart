part of '../main.dart';

class _LandingSection extends StatelessWidget {
  const _LandingSection({
    required this.isCompact,
    required this.appBarHeight,
    required this.showTopBar,
    required this.onMenuSelected,
  });

  final bool isCompact;
  final double appBarHeight;
  final bool showTopBar;
  final ValueChanged<String> onMenuSelected;

  @override
  Widget build(BuildContext context) {
    final Size viewport = MediaQuery.sizeOf(context);
    final double screenHeight = viewport.height;
    final bool isLandscape = viewport.width > viewport.height;
    final bool isShortLandscape = isLandscape && screenHeight < 560;
    final bool isCompactPortrait = isCompact && !isLandscape;
    final double textScale = MediaQuery.textScalerOf(context).scale(1);
    final double sectionHeight = isCompactPortrait
        ? (screenHeight - appBarHeight - MediaQuery.paddingOf(context).bottom)
              .clamp(460.0, double.infinity)
        : screenHeight * textScale.clamp(1.0, 2.2);
    final double effectiveSectionHeight = isShortLandscape
        ? sectionHeight * 0.9
        : sectionHeight;

    return SizedBox(
      height: effectiveSectionHeight,
      child: SafeArea(
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: isCompact ? 20 : 34,
            vertical: isShortLandscape ? 12 : 18,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              if (showTopBar) _TopBar(onSelected: onMenuSelected),
              Expanded(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 920),
                  child: Column(
                    mainAxisSize: MainAxisSize.max,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: const <Widget>[
                            Text(
                              'Digital water services for modern utilities',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Color(0xFFE8F9FF),
                                fontSize: 24,
                                fontWeight: FontWeight.w600,
                                fontStyle: FontStyle.italic,
                                letterSpacing: 0.8,
                                fontFamily: 'Georgia',
                                shadows: <Shadow>[
                                  Shadow(
                                    color: Color(0xFF72E9FF),
                                    blurRadius: 20,
                                    offset: Offset(0, 4),
                                  ),
                                  Shadow(
                                    color: Color(0xAA0A4A72),
                                    blurRadius: 16,
                                    offset: Offset(0, 8),
                                  ),
                                ],
                              ),
                            ),
                            _PulseHeroTitle(),
                            _RotatingServiceText(),
                          ],
                        ),
                      ),
                      SizedBox(height: isCompact ? 14 : 20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: <Widget>[
                          Expanded(
                            child: _LandingActionButton(
                              label: 'Get Started!',
                              onTap: () {
                                Navigator.of(context).pushNamed(_signUpRoute);
                              },
                            ),
                          ),
                          SizedBox(width: isCompact ? 18 : 28),
                          Expanded(
                            child: _LandingActionButton(
                              label: 'Sign In',
                              onTap: () {
                                Navigator.of(context).pushNamed(_signInRoute);
                              },
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: isCompact ? 4 : 10),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.onSelected});

  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        const _PulseBrandMark(),
        PopupMenuButton<String>(
          tooltip: 'Open menu',
          onSelected: onSelected,
          color: const Color(0xFFF3FBFF),
          position: PopupMenuPosition.under,
          itemBuilder: (BuildContext context) => const <PopupMenuEntry<String>>[
            PopupMenuItem<String>(value: 'about', child: Text('About Us')),
            PopupMenuItem<String>(value: 'contact', child: Text('Contact Us')),
            PopupMenuDivider(),
            PopupMenuItem<String>(value: 'signup', child: Text('Sign Up')),
            PopupMenuItem<String>(value: 'signin', child: Text('Sign In')),
          ],
          child: const Icon(Icons.menu_rounded, color: Colors.white, size: 30),
        ),
      ],
    );
  }
}

class _PulseBrandMark extends StatefulWidget {
  const _PulseBrandMark();

  @override
  State<_PulseBrandMark> createState() => _PulseBrandMarkState();
}

class _PulseBrandMarkState extends State<_PulseBrandMark>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (BuildContext context, Widget? child) {
        final double t = Curves.easeInOut.transform(_controller.value);
        final Color color = Color.lerp(
          const Color(0xFFA8EEFF),
          const Color(0xFF5EE6FF),
          t,
        )!;

        return Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              Icons.water_drop_rounded,
              color: color,
              size: 28,
              shadows: <Shadow>[
                Shadow(
                  color: const Color(
                    0xFF12BFE3,
                  ).withValues(alpha: 0.45 + (t * 0.35)),
                  blurRadius: 8 + (10 * t),
                ),
              ],
            ),
            const SizedBox(width: 6),
            Text(
              'Aqua',
              style: TextStyle(
                color: Color.lerp(const Color(0xFFD5F7FF), Colors.white, t),
                fontSize: 22,
                fontWeight: FontWeight.w700,
                fontFamily: 'Georgia',
                shadows: <Shadow>[
                  Shadow(
                    color: const Color(
                      0xFF12BFE3,
                    ).withValues(alpha: 0.22 + (t * 0.26)),
                    blurRadius: 10 + (8 * t),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _PulseHeroTitle extends StatefulWidget {
  const _PulseHeroTitle();

  @override
  State<_PulseHeroTitle> createState() => _PulseHeroTitleState();
}

class _PulseHeroTitleState extends State<_PulseHeroTitle>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (BuildContext context, Widget? child) {
        final double t = Curves.easeInOut.transform(_controller.value);
        final Color main = Color.lerp(
          const Color(0xFFE2F8FF),
          const Color(0xFFECFBFF),
          t,
        )!;

        return Text(
          'Aqua\nConnect',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: main,
            fontSize: 62,
            height: 1.0,
            fontWeight: FontWeight.w900,
            letterSpacing: 3.0,
            fontFamily: 'Georgia',
            shadows: <Shadow>[
              Shadow(
                color: const Color(
                  0xFF00E6FF,
                ).withValues(alpha: 0.72 + (0.18 * t)),
                blurRadius: 36 + (28 * t),
                offset: const Offset(0, 0),
              ),
              Shadow(
                color: const Color(
                  0xFF0A5B8A,
                ).withValues(alpha: 0.52 + (0.22 * t)),
                blurRadius: 20 + (18 * t),
                offset: const Offset(0, 0),
              ),
              Shadow(
                color: _primaryBlue.withValues(alpha: 0.35 + (0.22 * t)),
                blurRadius: 14 + (14 * t),
                offset: const Offset(0, 8),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _LandingActionButton extends StatefulWidget {
  const _LandingActionButton({required this.label, this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  State<_LandingActionButton> createState() => _LandingActionButtonState();
}

class _LandingActionButtonState extends State<_LandingActionButton> {
  bool _isHovered = false;
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final bool isActive = _isHovered || _isPressed;

    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() {
        _isHovered = false;
        _isPressed = false;
      }),
      child: GestureDetector(
        onTap: widget.onTap,
        onTapDown: (_) => setState(() => _isPressed = true),
        onTapUp: (_) => setState(() => _isPressed = false),
        onTapCancel: () => setState(() => _isPressed = false),
        child: AnimatedScale(
          duration: const Duration(milliseconds: 180),
          scale: _isPressed ? 0.95 : (isActive ? 1.03 : 1),
          child: SizedBox(
            width: double.infinity,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: isActive ? _cardBorderHover : _cardBorder,
                  width: 0.9,
                ),
                gradient: LinearGradient(
                  colors: isActive
                      ? <Color>[_buttonBlueStartHover, _buttonBlueHover]
                      : <Color>[_primaryBlue, _buttonBlue],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: <BoxShadow>[
                  BoxShadow(
                    color: _primaryBlue.withValues(
                      alpha: isActive ? 0.24 : 0.14,
                    ),
                    blurRadius: isActive ? 12 : 4,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Center(
                child: Text(
                  widget.label,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    fontFamily: 'Georgia',
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RotatingServiceText extends StatefulWidget {
  const _RotatingServiceText();

  @override
  State<_RotatingServiceText> createState() => _RotatingServiceTextState();
}

class _RotatingServiceTextState extends State<_RotatingServiceText> {
  static const List<String> _items = <String>[
    'Scheduling',
    'Billing',
    'Complaint',
    'Announcement',
    'Reporting',
  ];

  int _index = 0;
  Timer? _advanceTimer;

  @override
  void initState() {
    super.initState();
    _scheduleAdvance(const Duration(milliseconds: 1200));
  }

  void _scheduleAdvance(Duration delay) {
    _advanceTimer?.cancel();
    _advanceTimer = Timer(delay, _advance);
  }

  void _advance() {
    if (!mounted) {
      return;
    }

    setState(() {
      _index = (_index + 1) % _items.length;
    });

    _scheduleAdvance(const Duration(milliseconds: 1450));
  }

  @override
  void dispose() {
    _advanceTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 36,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 520),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        transitionBuilder: (Widget child, Animation<double> animation) {
          final Animation<Offset> slide = Tween<Offset>(
            begin: const Offset(0, 0.45),
            end: Offset.zero,
          ).animate(animation);
          return FadeTransition(
            opacity: animation,
            child: SlideTransition(position: slide, child: child),
          );
        },
        child: Text(
          _items[_index],
          key: ValueKey<String>(_items[_index]),
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Color(0xFFE8F9FF),
            fontSize: 24,
            fontWeight: FontWeight.w600,
            fontStyle: FontStyle.italic,
            letterSpacing: 0.8,
            fontFamily: 'Georgia',
            shadows: <Shadow>[
              Shadow(
                color: Color(0xFF72E9FF),
                blurRadius: 9,
                offset: Offset(0, 2),
              ),
              Shadow(
                color: Color(0xAA0A4A72),
                blurRadius: 6,
                offset: Offset(0, 4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
