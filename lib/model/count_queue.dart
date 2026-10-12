import 'day.dart';
import 'log_entry.dart';
import 'metric.dart';

/// The count taps that are not in the sheet yet. Keys are metric id and day.
///
/// A tap goes to the queue first. [send] moves all queued taps to the write that runs now, and [sent] removes them
/// when that write ends. Taps that come during the write stay in the queue for the next write. So only one write runs
/// at a time, and two writes cannot overwrite each other.
final class CountQueue {
  /// Taps that wait for a write, per metric id and day, in tap order.
  final _queued = <(String, Day), List<CountStep>>{};

  /// Taps in the write that runs now. The app shows them until the new data arrives.
  final _sending = <(String, Day), List<CountStep>>{};

  /// True if taps wait for a write.
  bool get hasQueued => _queued.isNotEmpty;

  /// True while a write of taps runs: after [send] and before [sent].
  bool get isSending => _sending.isNotEmpty;

  /// All taps that are not in the sheet yet, per metric id and day. The taps of the write that runs now come first.
  Map<(String, Day), List<CountStep>> get pending => {
    for (final key in {..._sending.keys, ..._queued.keys}) key: [...?_sending[key], ...?_queued[key]],
  };

  /// Adds a tap of [step] on the cell of [metricId] on [day].
  void add(String metricId, Day day, CountStep step) => (_queued[(metricId, day)] ??= []).add(step);

  /// Moves the queued taps to the write that runs now. Returns one plan for each cell with all taps of that cell.
  ///
  /// Each plan adds the taps to the latest value in the sheet. A cell of a metric that is not a number metric of
  /// [metrics], for example a metric that is gone from the sheet, gets no plan: [sent] drops its taps.
  /// Throws a [StateError] if a write runs: call [sent] first.
  List<LogWrite? Function(LogTable log)> send(Map<String, Metric> metrics) {
    if (isSending) throw StateError('A write of count taps runs. Call sent() first.');
    _sending.addAll(_queued);
    _queued.clear();
    return [
      for (final MapEntry(key: (id, day), value: steps) in _sending.entries)
        if (metrics[id] case final NumberMetric metric) (LogTable log) => planCount(metric, day, steps, log),
    ];
  }

  /// Removes the taps of the write that ran. Call it when the write ends, also after an error: so the taps of a failed
  /// write are not written again.
  void sent() => _sending.clear();
}
