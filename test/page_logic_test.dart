import 'package:test/test.dart';
import 'package:trackula/model/day.dart';
import 'package:trackula/model/day_range.dart';
import 'package:trackula/model/log_edits.dart';
import 'package:trackula/model/log.dart';
import 'package:trackula/model/metric.dart';
import 'package:trackula/model/zoom.dart';

void main() {
  const weight = NumberMetric(id: 'weight', name: 'Weight', icon: 'monitor_weight', group: 'body', step: 0.1);
  const water = NumberMetric(id: 'water', name: 'Water', icon: 'water_drop', group: 'habits', isCount: true);
  const read = YesNoMetric(id: 'read', name: 'Read', icon: 'menu_book');

  group('days and months', () {
    test('earliestDay', () {
      expect(
        earliestDay([const Day(2026, 3, 2), const Day(2025, 12, 31), const Day(2026, 1, 1)]),
        const Day(2025, 12, 31),
      );
      expect(earliestDay(const []), isNull);
    });

    test('monthOf and addMonths across a year', () {
      expect(monthOf(const Day(2026, 9, 28)), (year: 2026, month: 9));
      expect(addMonths((year: 2026, month: 1), -1), (year: 2025, month: 12));
      expect(addMonths((year: 2025, month: 12), 1), (year: 2026, month: 1));
      expect(addMonths((year: 2026, month: 5), 0), (year: 2026, month: 5));
    });

    test('daysOfMonth', () {
      expect(daysOfMonth((year: 2026, month: 2)), hasLength(28));
      expect(daysOfMonth((year: 2024, month: 2)).last, const Day(2024, 2, 29));
      expect(daysOfMonth((year: 2026, month: 12)).first, const Day(2026, 12, 1));
    });
  });

  test('DayRange.daysUntil ends on today, oldest first', () {
    const today = Day(2026, 3, 1);
    expect(DayRange.today.daysUntil(today), [today]);
    expect(DayRange.short.daysUntil(today), [
      const Day(2026, 2, 25),
      const Day(2026, 2, 26),
      const Day(2026, 2, 27),
      const Day(2026, 2, 28),
      today,
    ]);
    expect(DayRange.month.daysUntil(today), hasLength(31));
  });

  test('aggregateOf each kind', () {
    expect(
      [aggregateOf(read), aggregateOf(water), aggregateOf(weight)],
      [
        Aggregate.rate,
        Aggregate.sum,
        Aggregate.average,
      ],
    );
  });

  test('groups: metrics without a group are in "other"', () {
    final metrics = <Metric>[weight, read, water];
    expect(groupOf(read), 'other');
    expect(groupsOf(metrics), ['body', 'other', 'habits']);
    expect(metricsIn(metrics, null), metrics);
    expect(metricsIn(metrics, 'other'), [read]);
    expect(metricsIn(metrics, 'none'), isEmpty);
  });

  test('LogEdits.valuesOf adds the pending count taps, and withOnWrite keeps the rest', () {
    const today = Day(2026, 9, 28);
    final writes = <List<LogPlan>>[];
    var counts = 0;
    final edits = LogEdits(
      log: LogTable(
        entries: const [LogEntry(row: 2, date: today, metricId: 'water', value: 2)],
        rows: {today: 2},
        columns: const {'water': 1},
      ),
      today: today,
      busy: true,
      pending: {
        ('water', today): [CountStep.add(1)],
      },
      onWrite: writes.add,
      onCount: (_, _, _) => counts++,
    );
    expect(edits.valuesOf(water), {today: 3});
    expect(identical(edits.valuesOf(water), edits.valuesOf(water)), isTrue);
    expect(() => edits.valuesOf(water)[today] = 1, throwsUnsupportedError);
    final other = edits.withOnWrite((_) {});
    expect((other.log, other.today, other.busy, other.pending), (edits.log, edits.today, edits.busy, edits.pending));
    other.onWrite([(_) => null]);
    expect(writes, isEmpty);
    other.onCount(water, today, const CountStep.add(1));
    expect(counts, 1);
  });
}
