import 'package:test/test.dart';
import 'package:trackula/model/date_format.dart';
import 'package:trackula/model/day.dart';
import 'package:trackula/model/format.dart';
import 'package:trackula/model/zoom.dart';

void main() {
  group('numbers', () {
    test('formatShort removes zeros at the end and float noise', () {
      expect(formatShort(82.0), '82');
      expect(formatShort(2.5), '2.5');
      expect(formatShort(2500), '2500');
      expect(formatShort(82.10000000000001), '82.1');
    });

    test('formatNumber rounds to the decimals', () {
      expect(formatNumber(81.25), '81.3');
      expect(formatNumber(81.04), '81');
      expect(formatNumber(-2.25), '-2.3');
      expect(formatNumber(0.125, 2), '0.13');
      expect(formatNumber(82.1004, 3), '82.1');
      expect(formatNumber(0.9996, 3), '1');
      expect(formatNumber(-0.0004, 3), '0');
    });

    test('formatCompact uses k from 1000', () {
      expect(formatCompact(8.25), '8.3');
      expect(formatCompact(999), '999');
      expect(formatCompact(-999), '-999');
      expect(formatCompact(999.96), '1000');
      expect(formatCompact(1000), '1k');
      expect(formatCompact(12500), '12.5k');
      expect(formatCompact(-1500), '-1.5k');
    });

    test('withUnit adds the unit only if there is one', () {
      expect(withUnit(82.1, 'kg'), '82.1 kg');
      expect(withUnit(-2.5, 'kg'), '-2.5 kg');
      expect(withUnit(3, null), '3');
      expect(withUnit(3, ''), '3');
      expect(withUnit(0.125, 'km', 2), '0.13 km');
      expect(unitSuffix('kg'), ' kg');
      expect(unitSuffix(null), '');
    });

    test('formatSigned adds a sign, and none for a value that rounds to 0', () {
      expect(formatSigned(0.4, 'kg'), '+0.4 kg');
      expect(formatSigned(-1, 'kg'), '−1 kg');
      expect(formatSigned(-0.125, null, 2), '−0.13');
      expect(formatSigned(0, null), '0');
      expect(formatSigned(0.004, null, 2), '0');
      expect(formatSigned(-0.004, 'kg', 2), '0 kg');
    });

    test('formatPercent rounds to a whole percentage', () {
      expect(formatPercent(0), '0%');
      expect(formatPercent(0.005), '1%');
      expect(formatPercent(0.456), '46%');
      expect(formatPercent(1), '100%');
    });
  });

  group('dates', () {
    test('names', () {
      expect([shortMonth(1), shortMonth(9), shortMonth(12)], ['Jan', 'Sep', 'Dec']);
      expect([weekdayShort.first, weekdayLetters.last], ['Mo', 'S']);
      expect(shortDay(const Day(2026, 9, 28)), 'Sep 28');
    });

    test('dayRange shows the year once in the same year', () {
      expect(dayRange(const Day(2026, 7, 6), const Day(2026, 10, 3)), 'Jul 6 – Oct 3, 2026');
      expect(dayRange(const Day(2026, 1, 1), const Day(2026, 12, 31)), 'Jan 1 – Dec 31, 2026');
      expect(dayRange(const Day(2025, 11, 3), const Day(2026, 2, 1)), 'Nov 3, 2025 – Feb 1, 2026');
      expect(dayRange(const Day(2025, 12, 31), const Day(2026, 1, 1)), 'Dec 31, 2025 – Jan 1, 2026');
    });

    test('monthYear and monthRange', () {
      expect(monthYear((year: 2026, month: 9)), 'September 2026');
      expect(monthRange((year: 2026, month: 9), (year: 2026, month: 10)), 'September – October 2026');
      expect(monthRange((year: 2025, month: 12), (year: 2026, month: 1)), 'December 2025 – January 2026');
    });

    test('barLabel', () {
      const sep28 = Day(2026, 9, 28);
      expect(barLabel(sep28, BarUnit.day), 'Sep 28');
      expect(barLabel(sep28, BarUnit.week), 'Sep 28');
      expect(barLabel(const Day(2026, 9, 1), BarUnit.month), 'Sep');
      expect(barLabel(const Day(2026, 9, 1), BarUnit.month, first: true), 'Sep ’26');
      expect(barLabel(const Day(2025, 12, 1), BarUnit.month, first: true), 'Dec ’25');
      expect(barLabel(const Day(2026, 1, 1), BarUnit.month), 'Jan ’26');
      expect(barLabel(const Day(2026, 1, 1), BarUnit.quarter), 'Q1 ’26');
      expect(barLabel(const Day(2026, 7, 1), BarUnit.quarter), 'Q3 ’26');
      expect(barLabel(const Day(2026, 10, 1), BarUnit.quarter), 'Q4 ’26');
    });

    test('barTitle', () {
      expect(barTitle(const Day(2026, 9, 28), BarUnit.day), 'Sep 28, 2026');
      expect(barTitle(const Day(2026, 9, 28), BarUnit.week), 'Week of Sep 28, 2026');
      expect(barTitle(const Day(2026, 9, 1), BarUnit.month), 'Sep 2026');
      expect(barTitle(const Day(2026, 1, 1), BarUnit.quarter), 'Q1 2026');
      expect(barTitle(const Day(2026, 10, 1), BarUnit.quarter), 'Q4 2026');
    });
  });
}
