import 'day.dart';
import 'log_entry.dart';
import 'metric.dart';

/// Returns the value of [metric] for each day that has an entry.
///
/// - [YesNoMetric]: 1 if done.
/// - Number: the value of the cell. For [PerDay.many] it is the day total.
Map<Day, num> dayValues(Metric metric, List<LogEntry> log) {
  final values = <Day, num>{};
  for (final e in log) {
    if (e.metricId != metric.id) continue;
    values[e.date] = e.value;
  }
  return values;
}
