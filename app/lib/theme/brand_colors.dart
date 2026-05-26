import 'package:flutter/material.dart';

/// Shyam's brand palette — red #E31E24, yellow #FFC72C.
abstract final class BrandColors {
  static const Color red = Color(0xFFE31E24);
  static const Color yellow = Color(0xFFFFC72C);
  static const Color redDark = Color(0xFF8B1216);
  static const Color redLight = Color(0xFFFDE8E9);
  static const Color yellowLight = Color(0xFFFFF8E1);

  static ColorScheme get lightScheme => ColorScheme(
        brightness: Brightness.light,
        primary: red,
        onPrimary: Colors.white,
        primaryContainer: redLight,
        onPrimaryContainer: redDark,
        secondary: yellow,
        onSecondary: redDark,
        secondaryContainer: yellowLight,
        onSecondaryContainer: redDark,
        surface: Colors.white,
        onSurface: const Color(0xFF2A1214),
        surfaceContainerHighest: yellowLight,
        onSurfaceVariant: const Color(0xFF6B5B5C),
        outline: const Color(0xFFF0E6D8),
        error: const Color(0xFFDC2626),
        onError: Colors.white,
      );
}
