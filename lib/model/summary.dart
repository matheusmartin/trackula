import 'day.dart';
import 'log_entry.dart';
import 'metric.dart';

/// Returns the value of [metric] for each day that has an entry.
///
/// - [YesNoMetric]: 1 for `yes`. Days with `no` are left out, like days without a value: both show as not done.
/// - Number: the value of the cell.
Map<Day, num> dayValues(Metric metric, List<LogEntry> log) {
  final values = <Day, num>{};
  for (final e in log) {
    if (e.metricId != metric.id) continue;
    if (metric is YesNoMetric && e.value != 1) continue;
    values[e.date] = e.value;
  }
  return values;
}

/// The day of [days] that is nearest before [day], else the nearest after it. Null if [days] has no other day.
///
/// The number editor of an empty day starts at the value of this day.
Day? nearestDay(Iterable<Day> days, Day day) {
  Day? before, after;
  for (final d in days) {
    final c = d.compareTo(day);
    if (c < 0 && (before == null || d.compareTo(before) > 0)) before = d;
    if (c > 0 && (after == null || d.compareTo(after) < 0)) after = d;
  }
  return before ?? after;
}
