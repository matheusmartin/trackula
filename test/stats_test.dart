import 'package:test/test.dart';
import 'package:trackula/model/day.dart';
import 'package:trackula/model/log_entry.dart';
import 'package:trackula/model/stats.dart';

void main() {
  // 2026-09-28 is a Monday.
  const mon = Day(2026, 9, 28);
  Day day(int i) => mon.addDays(i);
  List<Day> range(int n) => [for (var i = 0; i < n; i++) day(i)];

  group('yesNoStats', () {
    // Mo yes, Tu yes, We no, Th (none), Fr yes, Sa yes, Su yes.
    final states = {day(0): true, day(1): true, day(2): false, day(4): true, day(5): true, day(6): true};

    test('counts yes, no and days without entry', () {
      final s = yesNoStats(states, range(7), day(6));
      expect((s.yes, s.no, s.none, s.days), (5, 1, 1, 7));
      expect(s.rate, closeTo(5 / 7, 1e-9));
    });

    test('streaks: current, longest and all runs', () {
      final s = yesNoStats(states, range(7), day(6));
      expect((s.currentStreak, s.longestStreak), (3, 3));
      expect(s.streaks, [2, 3]);
      // Today without entry yet: the current streak counts up to yesterday.
      expect(yesNoStats(states, range(8), day(7)).currentStreak, 3);
    });

    test('weekday rates', () {
      final s = yesNoStats(states, range(7), day(6));
      expect(s.weekdayRates, [1.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0]);
    });

    test('strength grows with yes and goes down without', () {
      final s = yesNoStats(states, range(7), day(6));
      expect(s.strength.first, closeTo(strengthWeight, 1e-9));
      expect(s.strength[2], lessThan(s.strength[1]));
      expect(s.strength.last, greaterThan(s.strength[3]));
    });

    test('yesNoStates reads yes as true and no as false', () {
      final entries = [
        LogEntry(row: 2, date: day(0), metricId: 'm', value: 1),
        LogEntry(row: 3, date: day(1), metricId: 'm', value: 0),
        LogEntry(row: 3, date: day(1), metricId: 'other', value: 1),
      ];
      expect(yesNoStates('m', entries), {day(0): true, day(1): false});
    });
  });

  group('countStats', () {
    final values = <Day, num>{day(0): 3, day(1): 5, day(3): 5, day(7): 2};

    test('total, average, best day and days logged', () {
      final s = countStats(values, range(8));
      expect((s.total, s.logged, s.average), (15, 4, 3.75));
      expect(s.best, (day: day(1), value: 5));
    });

    test('weekday averages, distribution, running total', () {
      final s = countStats(values, range(8));
      expect(s.weekdayAverages, [2.5, 5, null, 5, null, null, null]);
      expect(s.distribution, [(2, 1), (3, 1), (5, 2)]);
      expect(s.running, [3, 8, 8, 13, 13, 13, 13, 15]);
    });

    test('no values', () {
      final s = countStats({}, range(3));
      expect((s.total, s.average, s.best), (0, null, null));
      expect(s.distribution, isEmpty);
    });
  });

  group('numberStats', () {
    final values = <Day, num>{day(0): 82, day(2): 81, day(3): 80.5, day(8): 80};

    test('latest, change, lowest, highest, average', () {
      final s = numberStats(values, range(9));
      expect(s.latest, (day: day(8), value: 80));
      expect(s.change, -2);
      expect((s.low?.value, s.high?.value), (80, 82));
      expect(s.average, closeTo(80.875, 1e-9));
    });

    test('trend: a moving average that keeps its value on empty days', () {
      final s = numberStats(values, range(9));
      expect(s.trend[0], 82);
      expect(s.trend[1], 82);
      expect(s.trend[2], 82 + trendWeight * (81 - 82));
    });

    test('histogram', () {
      final s = numberStats(values, range(9));
      expect(s.histogram, hasLength(histogramBins));
      expect(s.histogram.fold<int>(0, (n, b) => n + b.days), 4);
    });

    test('one value: no change, one histogram range', () {
      final s = numberStats({day(0): 70}, range(3));
      expect((s.change, s.histogram.length), (null, 1));
    });
  });
}
