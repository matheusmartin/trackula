import 'day.dart';
import 'log_entry.dart';
import 'metric.dart';
import 'summary.dart';

/// The log and the ways to change it, as the Today page gives them to its views.
final class LogEdits {
  const LogEdits({
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

  /// The day values of [metric], with the [pending] count taps.
  Map<Day, num> valuesOf(Metric metric) => dayValuesWithPending(metric, log.entries, pending);

  /// The same edits, with another [onWrite].
  LogEdits withOnWrite(void Function(List<LogPlan> plans) onWrite) =>
      LogEdits(log: log, today: today, busy: busy, pending: pending, onWrite: onWrite, onCount: onCount);
}
