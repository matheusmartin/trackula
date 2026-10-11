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
      expect(barStart(d, BarUnit.day), d);
      expect(nextBarStart(d, BarUnit.day), const Day(2026, 8, 14));
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
      expect(zoomSteps(mon.addDays(-5), mon), [ZoomStep.week1]);
      expect(zoomSteps(mon.addDays(-20), mon), [ZoomStep.week1, ZoomStep.week2, ZoomStep.month1]);
      expect(zoomSteps(mon.addDays(-60), mon).last, ZoomStep.month3);
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
  });

  test('defaultStep: 3 months, or the last step if there are fewer', () {
    expect(defaultStep(zoomSteps(mon.addDays(-200), mon)), ZoomStep.values.indexOf(ZoomStep.month3));
    expect(defaultStep(zoomSteps(mon.addDays(-10), mon)), 1);
  });

  group('ZoomWindow', () {
    // Data from 2026-08-03 (a Monday) to 2026-09-30: 9 weeks.
    const first = Day(2026, 8, 3), today = Day(2026, 9, 30);

    test('shows the newest bars, from first to today', () {
      final w = ZoomWindow(ZoomStep.month1, first: first, today: today);
      expect(w.starts, [for (var i = 4; i >= 0; i--) mon.addDays(-7 * i)]);
      expect((w.from, w.to), (mon.addDays(-28), today));
      expect(w.days.length, 31);
      expect((w.atStart, w.atEnd), (false, true));
    });

    test('moves by bars and stops at the ends', () {
      final w = ZoomWindow(ZoomStep.month1, first: first, today: today);
      final back = ZoomWindow(ZoomStep.month1, first: first, today: today, end: w.moved(-2));
      expect(back.to, mon.addDays(-14 + 6));
      expect(w.moved(3), isNull);
      final oldest = ZoomWindow(ZoomStep.month1, first: first, today: today, end: w.moved(-100));
      expect((oldest.from, oldest.atStart), (first, true));
    });

    test('centeredOn puts the day in the middle bar', () {
      final w = ZoomWindow(ZoomStep.month1, first: first, today: today);
      final c = ZoomWindow(ZoomStep.month1, first: first, today: today, end: w.centeredOn(const Day(2026, 8, 26)));
      expect(c.starts[2], const Day(2026, 8, 24));
    });

    test('fewer bars than the step: all bars', () {
      final w = ZoomWindow(ZoomStep.year1, first: first, today: today);
      expect(w.starts, [const Day(2026, 8, 1), const Day(2026, 9, 1)]);
      expect((w.from, w.atStart, w.atEnd), (first, true, true));
    });
  });

  test('streakLengths', () {
    expect(streakLengths([1, 2, 2, 5, 40]), [1, 2, 0, 1, 0, 0, 1]);
  });
}
