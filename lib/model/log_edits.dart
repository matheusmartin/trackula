import 'dart:collection';

import 'day.dart';
import 'day_values.dart';
import 'log.dart';
import 'metric.dart';

/// The log and the ways to change it, as the Today page gives them to its views.
final class LogEdits {
  LogEdits({
    required this.log,
    required this.today,
    required this.busy,
    required this.pending,
    required this.onWrite,
    required this.onCount,
  });

  final LogTable log;
  final Day today;

  /// True while a write runs.
  final bool busy;

  /// Count taps that are not written yet. The views show them at once.
  final PendingCounts pending;

  /// Writes [plans] in one task, in order. See `Store.change`.
  final void Function(List<LogPlan> plans) onWrite;

  /// Adds a count tap. It shows at once, and the write starts when no other write runs.
  final void Function(NumberMetric metric, Day day, CountStep step) onCount;

  /// The day values of [metric], with the [pending] count taps. Read-only. Computed once per metric for these edits:
  /// a drag on the detail screen builds the day tables again many times.
  Map<Day, num> valuesOf(Metric metric) =>
      _values[metric.id] ??= UnmodifiableMapView(dayValuesWithPending(metric, log.entries, pending));

  final _values = <String, Map<Day, num>>{};

  /// The same edits, with another [onWrite].
  LogEdits withOnWrite(void Function(List<LogPlan> plans) onWrite) =>
      LogEdits(log: log, today: today, busy: busy, pending: pending, onWrite: onWrite, onCount: onCount);
}
