import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:shyamsweets/shyam_sweets_app.dart';

void main() {
  testWidgets('App builds MaterialApp', (WidgetTester tester) async {
    await tester.pumpWidget(const ShyamSweetsApp());
    await tester.pump();

    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
