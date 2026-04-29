import 'package:flutter/material.dart';

/// Logo + soft pulse + rotating ring — shared by launch gate and forced-update screen.
class UpdateCheckLoadingHero extends StatefulWidget {
  const UpdateCheckLoadingHero({
    super.key,
    this.logoSize = 108,
  });

  final double logoSize;

  @override
  State<UpdateCheckLoadingHero> createState() => _UpdateCheckLoadingHeroState();
}

class _UpdateCheckLoadingHeroState extends State<UpdateCheckLoadingHero>
    with TickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  )..repeat(reverse: true);

  late final AnimationController _spin = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  )..repeat();

  @override
  void dispose() {
    _pulse.dispose();
    _spin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final s = widget.logoSize;

    return ScaleTransition(
      scale: Tween<double>(begin: 0.92, end: 1.0).animate(
        CurvedAnimation(parent: _pulse, curve: Curves.easeInOut),
      ),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(28),
          color: scheme.surface.withValues(alpha: 0.82),
          boxShadow: [
            BoxShadow(
              color: scheme.primary.withValues(alpha: 0.2),
              blurRadius: 32,
              spreadRadius: 1,
            ),
          ],
        ),
        child: SizedBox(
          width: s,
          height: s,
          child: Stack(
            fit: StackFit.expand,
            children: [
              RotationTransition(
                turns: _spin,
                child: CircularProgressIndicator(
                  strokeWidth: 3.2,
                  valueColor: AlwaysStoppedAnimation<Color>(scheme.primary),
                  backgroundColor: scheme.primary.withValues(alpha: 0.18),
                ),
              ),
              Padding(
                padding: EdgeInsets.all(s * 0.102),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: Image.asset(
                    'assets/logo.png',
                    fit: BoxFit.cover,
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
