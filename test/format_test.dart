import 'package:test/test.dart';
import 'package:trackula/model/day.dart';
import 'package:trackula/model/format.dart';
import 'package:trackula/model/zoom.dart';

void main() {
  test('shortMonth and shortDay', () {
    expect([shortMonth(1), shortMonth(9), shortMonth(12)], ['Jan', 'Sep', 'Dec']);
    expect(shortDay(const Day(2026, 9, 28)), 'Sep 28');
  });

  test('formatTrimmed removes zeros at the end and float noise', () {
    expect([82.0, 2.5, 2500, 82.10000000000001, 82.00000000000001, -3.9999999999999996].map(formatTrimmed), [
      '82',
      '2.5',
      '2500',
      '82.1',
      '82',
      '-4',
    ]);
  });

  test('formatNumber rounds to the decimals', () {
    expect(
      [formatNumber(81.25), formatNumber(81.04), formatNumber(81.256, 2), formatNumber(2.9999, 3)],
      [
        '81.3',
        '81',
        '81.26',
        '3',
      ],
    );
  });

  test('formatCompact: 1 decimal at most, and k from 1000', () {
    expect(
      [formatCompact(82.25), formatCompact(7), formatCompact(12500), formatCompact(1000), formatCompact(-1500)],
      [
        '82.3',
        '7',
        '12.5k',
        '1k',
        '-1.5k',
      ],
    );
  });

  test('withUnit, formatSigned and formatPercent', () {
    expect([withUnit('82.1', 'kg'), withUnit('5', null)], ['82.1 kg', '5']);
    expect([formatSigned(-1.3, 'kg'), formatSigned(0.456, null), formatSigned(0, 'kg')], ['−1.3 kg', '+0.46', '0 kg']);
    expect([formatPercent(0.756), formatPercent(0), formatPercent(1)], ['76%', '0%', '100%']);
  });

  test('formatDateRange shows the year once, or twice across a year', () {
    expect(formatDateRange(const Day(2026, 7, 6), const Day(2026, 10, 3)), 'Jul 6 – Oct 3, 2026');
    expect(formatDateRange(const Day(2025, 11, 3), const Day(2026, 2, 1)), 'Nov 3, 2025 – Feb 1, 2026');
  });

  test('monthTitle and monthPairTitle', () {
    expect(monthTitle((year: 2026, month: 10)), 'October 2026');
    expect(monthPairTitle((year: 2026, month: 9), (year: 2026, month: 10)), 'September – October 2026');
    expect(monthPairTitle((year: 2025, month: 12), (year: 2026, month: 1)), 'December 2025 – January 2026');
  });

  test('weekLabels: the month on the first row and when it changes', () {
    final weeks = weekRows(daysBetween(const Day(2026, 9, 2), const Day(2026, 10, 6)));
    expect(weekLabels(weeks), ['Sep 2', '7', '14', '21', '28', 'Oct 5']);
  });

  test('barLabel and barTitle', () {
    const start = Day(2026, 9, 28);
    expect(barLabel(start, BarUnit.week), 'Sep 28');
    expect(
      [barLabel(const Day(2026, 9, 1), BarUnit.month), barLabel(const Day(2026, 1, 1), BarUnit.month)],
      [
        'Sep',
        'Jan ’26',
      ],
    );
    expect(barLabel(const Day(2026, 9, 1), BarUnit.month, first: true), 'Sep ’26');
    expect(barLabel(const Day(2026, 7, 1), BarUnit.quarter), 'Q3 ’26');
    expect(barTitle(start, BarUnit.week), 'Week of Sep 28, 2026');
    expect(barTitle(const Day(2026, 9, 1), BarUnit.month), 'Sep 2026');
    expect(barTitle(const Day(2026, 10, 1), BarUnit.quarter), 'Q4 2026');
  });
}
