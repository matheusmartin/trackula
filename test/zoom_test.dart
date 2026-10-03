import 'package:test/test.dart';
import 'package:trackula/model/day.dart';
import 'package:trackula/model/stats.dart';
import 'package:trackula/model/zoom.dart';

void main() {
  // 2026-09-28 is a Monday.
  const mon = Day(2026, 9, 28);

  group('bars', () {
    test('barStart and nextBarStart', () {
      const d = Day(2026, 8, 13);
      expect(barStart(d, BarUnit.week), const Day(2026, 8, 10));
      expect(barStart(d, BarUnit.month), const Day(2026, 8, 1));
      expect(barStart(d, BarUnit.quarter), const Day(2026, 7, 1));
      expect(nextBarStart(const Day(2026, 12, 1), BarUnit.month), const Day(2027, 1, 1));
      expect(nextBarStart(const Day(2026, 10, 1), BarUnit.quarter), const Day(2027, 1, 1));
    });

    test('barStarts covers first to today', () {
      expect(barStarts(mon.addDays(-8), mon.addDays(2), BarUnit.week), [mon.addDays(-14), mon.addDays(-7), mon]);
      expect(barStarts(const Day(2026, 8, 20), mon, BarUnit.month), [const Day(2026, 8, 1), const Day(2026, 9, 1)]);
    });
  });

  group('zoomSteps', () {
    test('ends at the first step that shows all bars', () {
      expect(zoomSteps(mon.addDays(-20), mon), [ZoomStep.month1]);
      expect(zoomSteps(mon.addDays(-60), mon), [ZoomStep.month1, ZoomStep.month3]);
      expect(zoomSteps(const Day(2024, 10, 4), mon).last, ZoomStep.year2);
    });
  });

  group('zoomBars', () {
    final starts = [mon.addDays(-7), mon];

    test('rate counts days without entry as not yes, and only days from first to today', () {
      final values = <Day, num>{mon.addDays(-7): 1, mon.addDays(-6): 0, mon: 1, mon.addDays(1): 1};
      final bars = zoomBars(
        values,
        Aggregate.rate,
        starts,
        BarUnit.week,
        first: mon.addDays(-7),
        today: mon.addDays(2),
      );
      expect(bars.map((b) => b.value), [closeTo(1 / 7, 1e-9), closeTo(2 / 3, 1e-9)]);
    });

    test('sum, average, low and high', () {
      final values = <Day, num>{mon.addDays(-7): 2, mon.addDays(-5): 4, mon: 3};
      final sum = zoomBars(values, Aggregate.sum, starts, BarUnit.week, first: mon.addDays(-7), today: mon);
      expect(sum.map((b) => b.value), [6, 3]);
      final avg = zoomBars(values, Aggregate.average, starts, BarUnit.week, first: mon.addDays(-7), today: mon);
      expect(avg.map((b) => (b.value, b.low, b.high)), [(3, 2, 4), (3, 3, 3)]);
    });

    test('change: the first bar and bars without value have none', () {
      final values = <Day, num>{mon.addDays(-14): 80, mon.addDays(-7): 81, mon: 79.5};
      final bars = zoomBars(
        values,
        Aggregate.change,
        [mon.addDays(-14), ...starts],
        BarUnit.week,
        first: mon.addDays(-14),
        today: mon,
      );
      expect(bars.map((b) => b.value), [null, 1, -1.5]);
    });
  });

  test('streakLengths', () {
    expect(streakLengths([1, 2, 2, 5, 40]), [1, 2, 0, 1, 0, 0, 1]);
  });
}
