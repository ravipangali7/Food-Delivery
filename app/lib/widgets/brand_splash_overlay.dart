import 'package:flutter/material.dart';

import '../theme/brand_colors.dart';

/// Full-screen branded loading overlay (WebView boot, etc.).
class BrandSplashOverlay extends StatelessWidget {
  const BrandSplashOverlay({
    super.key,
    this.statusLine,
    this.tagline = 'Fresh Mithai, Delivered Fast',
  });

  final String? statusLine;
  final String tagline;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            BrandColors.redDark,
            BrandColors.red,
            Color(0xFFB91C1C),
          ],
        ),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned(
            top: -72,
            right: -48,
            child: _GlowOrb(
              size: 220,
              color: BrandColors.yellow.withValues(alpha: 0.14),
            ),
          ),
          Positioned(
            bottom: -96,
            left: -64,
            child: _GlowOrb(
              size: 260,
              color: Colors.white.withValues(alpha: 0.1),
            ),
          ),
          SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _LogoCard(),
                    const SizedBox(height: 28),
                    Text(
                      tagline,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        height: 1.4,
                        letterSpacing: 0.3,
                        color: Colors.white.withValues(alpha: 0.88),
                      ),
                    ),
                    const SizedBox(height: 40),
                    const _SplashProgressBar(),
                    if (statusLine != null) ...[
                      const SizedBox(height: 20),
                      Text(
                        statusLine!,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.6,
                          color: Colors.white.withValues(alpha: 0.5),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LogoCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.28),
            blurRadius: 32,
            offset: const Offset(0, 16),
          ),
        ],
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.45),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.asset(
            'assets/logo.png',
            width: 112,
            height: 112,
            fit: BoxFit.contain,
          ),
        ),
      ),
    );
  }
}

class _GlowOrb extends StatelessWidget {
  const _GlowOrb({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
      ),
    );
  }
}

class _SplashProgressBar extends StatefulWidget {
  const _SplashProgressBar();

  @override
  State<_SplashProgressBar> createState() => _SplashProgressBarState();
}

class _SplashProgressBarState extends State<_SplashProgressBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 176,
      height: 4,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: ColoredBox(
          color: Colors.white.withValues(alpha: 0.25),
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              return LayoutBuilder(
                builder: (context, constraints) {
                  final trackW = constraints.maxWidth;
                  final barW = trackW * 0.4;
                  final travel = trackW + barW;
                  final left = -barW + travel * _controller.value;
                  return Stack(
                    children: [
                      Positioned(
                        left: left,
                        width: barW,
                        top: 0,
                        bottom: 0,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: BrandColors.yellow,
                            borderRadius: BorderRadius.circular(999),
                            boxShadow: [
                              BoxShadow(
                                color: BrandColors.yellow.withValues(alpha: 0.55),
                                blurRadius: 10,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  );
                },
              );
            },
          ),
        ),
      ),
    );
  }
}
