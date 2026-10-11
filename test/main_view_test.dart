import 'package:test/test.dart';
import 'package:trackula/model/day.dart';
import 'package:trackula/model/main_view.dart';

void main() {
  test('daysUntil: the days of the view, oldest first, ending on today', () {
    const today = Day(2026, 10, 2);
    expect(MainView.today.daysUntil(today), [today]);
    expect(MainView.short.daysUntil(today).map((d) => '$d'), [
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
    expect(MainView.month.daysUntil(today).length, 31);
  });

  test('labels', () {
    expect(MainView.values.map((v) => v.label), ['Today', '5 days', '31 days', 'Score']);
  });
}
