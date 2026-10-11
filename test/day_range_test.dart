import 'package:test/test.dart';
import 'package:trackula/model/day.dart';
import 'package:trackula/model/day_range.dart';

void main() {
  test('daysUntil: the days of the range, oldest first, ending on today', () {
    const today = Day(2026, 10, 2);
    expect(DayRange.today.daysUntil(today), [today]);
    expect(DayRange.short.daysUntil(today).map((d) => '$d'), [
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
    expect(DayRange.month.daysUntil(today).length, 31);
  });

  test('labels', () {
    expect(DayRange.values.map((r) => r.label), ['Today', '5 days', '31 days']);
  });
}
