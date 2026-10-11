import 'package:test/test.dart';
import 'package:trackula/model/day.dart';
import 'package:trackula/model/log_entry.dart';
import 'package:trackula/model/metric.dart';
import 'package:trackula/model/parse.dart';
import 'package:trackula/model/summary.dart';

void main() {
  const weight = NumberMetric(id: 'weight', name: 'Weight', icon: 'monitor_weight', unit: 'kg', step: 0.1);
  const water = NumberMetric(id: 'water', name: 'Water', icon: 'water_drop', unit: 'glasses');
  const meditate = YesNoMetric(id: 'meditate', name: 'Meditate', icon: 'self_improvement');
  final metrics = {
    for (final m in <Metric>[weight, water, meditate]) m.id: m,
  };
  const d28 = Day(2026, 9, 28);
  const d29 = Day(2026, 9, 29);
  const d30 = Day(2026, 9, 30);

  test('dayValues: the values of the metric. A no day is left out, like a day without a value', () {
    final log = parseLog([
      ['date', 'meditate', 'water'],
      ['2026-09-28', 'yes', 8],
      ['2026-09-29', 'no', ''],
      ['2026-09-30', 'yes', 5],
    ], metrics).table;
    expect(dayValues(water, log.entries), {d28: 8, d30: 5});
    expect(dayValues(meditate, log.entries).keys, [d28, d30]);
  });

  test('dayValuesWithPending adds count taps that are not written yet', () {
    final p = parseLog([
      ['date', 'water'],
      ['2026-09-29', 8],
      ['2026-09-30', 1],
    ], metrics);
    final pending = {
      ('water', d29): [const CountStep.add(1), const CountStep.add(1)],
      ('water', d30): [const CountStep.add(-1)],
      ('weight', d29): [const CountStep.add(5)],
    };
    expect(dayValuesWithPending(water, p.table.entries, pending), {d29: 10});
  });

  test('nearestDay: the nearest day before, else the nearest day after', () {
    final days = [d29, const Day(2026, 9, 25), const Day(2026, 10, 3), const Day(2026, 10, 1)];
    expect(nearestDay(days, d30), d29);
    expect(nearestDay(days, const Day(2026, 9, 20)), const Day(2026, 9, 25));
    expect(nearestDay([d30], d30), isNull);
    expect(nearestDay(const <Day>[], d30), isNull);
  });
}
