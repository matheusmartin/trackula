import 'package:test/test.dart';
import 'package:trackula/model/day.dart';
import 'package:trackula/model/format.dart';

void main() {
  test('shortMonth and shortDay', () {
    expect([shortMonth(1), shortMonth(9), shortMonth(12)], ['Jan', 'Sep', 'Dec']);
    expect(shortDay(const Day(2026, 9, 28)), 'Sep 28');
  });

  test('formatShort removes zeros at the end and float noise', () {
    expect(
      [formatShort(82.0), formatShort(2.5), formatShort(2500), formatShort(82.10000000000001)],
      [
        '82',
        '2.5',
        '2500',
        '82.1',
      ],
    );
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
}
