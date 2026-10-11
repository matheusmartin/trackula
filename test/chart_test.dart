import 'package:test/test.dart';
import 'package:trackula/model/chart.dart';
import 'package:trackula/model/day.dart';

void main() {
  group('chartPoints', () {
    final days = [for (var i = 0; i < 5; i++) const Day(2026, 9, 26).addDays(i)];

    test('places values between padding and height, skipping empty days', () {
      final p = chartPoints(days, {days[0]: 80, days[2]: 90, days[4]: 85}, width: 100, height: 40, padding: 4);
      expect(p.map((p) => (p.x, p.y)), [(0.0, 36.0), (50.0, 4.0), (100.0, 20.0)]);
    });

    test('puts equal values in the middle', () {
      final p = chartPoints(days, {days[1]: 5, days[3]: 5}, height: 40);
      expect(p.map((p) => p.y), [20.0, 20.0]);
    });

    test('fromZero: the scale starts at 0, at the bottom', () {
      final p = chartPoints(days, {days[0]: 10, days[4]: 5}, height: 40, padding: 4, fromZero: true);
      expect(p.map((p) => p.y), [4.0, 20.0]);
      final equal = chartPoints(days, {days[1]: 5, days[3]: 5}, height: 40, padding: 4, fromZero: true);
      expect(equal.map((p) => p.y), [4.0, 4.0]);
      final zeros = chartPoints(days, {days[1]: 0, days[3]: 0}, height: 40, padding: 4, fromZero: true);
      expect(zeros.map((p) => p.y), [36.0, 36.0]);
    });

    test('returns no points without values', () {
      expect(chartPoints(days, {}), isEmpty);
    });
  });

  group('chartBars', () {
    final days = [for (var i = 0; i < 4; i++) const Day(2026, 9, 27).addDays(i)];

    test('gives each day an equal slot and starts bars at 0', () {
      final b = chartBars(days, {days[0]: 8, days[3]: 4}, width: 100, height: 40, padding: 4, fill: 0.5);
      expect(b.map((b) => (b.x, b.w, b.y)), [(6.25, 12.5, 4.0), (81.25, 12.5, 22.0)]);
    });

    test('draws zero values with no height', () {
      expect(chartBars(days, {days[1]: 0}, height: 40).single.y, 40.0);
    });
  });
}
