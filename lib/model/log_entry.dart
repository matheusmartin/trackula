import 'dart:math' as math;

import 'day.dart';
import 'metric.dart';

/// A non-empty value cell of the `Log` tab.
final class LogEntry {
  const LogEntry({required this.row, required this.date, required this.metricId, required this.value});

  /// 1-based row number in the `Log` tab. Row 1 is the header.
  final int row;
  final Day date;
  final String metricId;

  /// The value. For yesno metrics: 1 is `yes`, 0 is `no`.
  final num value;
}

/// The `Log` tab: one row per day, one column per metric. See docs/data-model.md.
final class LogTable {
  const LogTable({required this.entries, required this.rows, required this.columns});

  /// All valid, non-empty value cells.
  final List<LogEntry> entries;

  /// 1-based row number of each day. If a day has more than one row, the last row.
  final Map<Day, int> rows;

  /// 0-based column index of each metric. Column 0 is `date`.
  final Map<String, int> columns;

  num? valueAt(String metricId, Day date) {
    final row = rows[date];
    num? value;
    for (final e in entries) {
      if (e.row == row && e.metricId == metricId) value = e.value;
    }
    return value;
  }
}

/// Thrown when the `Log` tab has no column for a metric. This occurs when someone deletes the metric row in the sheet
/// while the app is open.
final class MissingColumnException implements Exception {
  const MissingColumnException(this.metricId);

  final String metricId;

  @override
  String toString() => 'The log tab has no column "$metricId".';
}

/// A change to the `Log` tab.
sealed class LogWrite {
  const LogWrite();
}

/// A new row for a day that has no row yet.
final class AppendRow extends LogWrite {
  const AppendRow(this.date, this.column, this.value);

  final Day date;
  final int column;

  /// The cell value: a number, or `yes` or `no`. See [cellValue].
  final Object value;

  /// The row cells, from column A to [column].
  List<Object> toCells() => [date.toString(), for (var c = 1; c < column; c++) '', value];
}

/// A new value for one cell. A null [value] clears the cell.
final class SetCell extends LogWrite {
  const SetCell(this.row, this.column, this.value);

  final int row;
  final int column;

  /// The cell value: a number, or `yes` or `no`. See [cellValue].
  final Object? value;
}

/// The `Log` cell for a [value]: `yes` (1) or `no` (0) for yesno metrics, the number for number metrics.
/// Null is an empty cell.
Object? cellValue(Metric metric, num? value) => value == null
    ? null
    : switch (metric) {
        YesNoMetric() => value == 1 ? 'yes' : 'no',
        NumberMetric() => value,
      };

/// Returns the change that sets [metric] to `yes` ([done]) or `no` on [date].
///
/// This function and the other `plan` functions throw a [MissingColumnException] if [log] has no column for [metric].
LogWrite? planYesNo(YesNoMetric metric, Day date, LogTable log, {required bool done}) =>
    _plan(metric, date, done ? 1 : 0, log);

/// Returns the change that sets the value of [metric] on [date]. For amounts, it is the day total.
LogWrite? planNumber(NumberMetric metric, Day date, num value, LogTable log) => _plan(metric, date, value, log);

/// Returns the change that clears the value of [metric] on [date].
LogWrite? planClear(Metric metric, Day date, LogTable log) => _plan(metric, date, null, log);

/// One input on a count cell: add [delta]. A negative [delta] subtracts.
final class CountStep {
  const CountStep.add(this.delta);

  final num delta;
}

/// Applies [steps] in order to the day value [current]. Null is an empty cell.
///
/// A count never goes below 0, also between steps, and 0 is an empty cell.
/// Example: an empty cell, then -1, then +1, gives 1.
num? applyCountSteps(num? current, Iterable<CountStep> steps) {
  var value = current ?? 0;
  for (final step in steps) {
    value = math.max(0, value + step.delta);
  }
  return value <= 0 ? null : withoutFloatNoise(value);
}

/// [value] without the float noise of decimal steps. Example: 0.30000000000000004 → 0.3.
num withoutFloatNoise(num value) => value is int ? value : double.parse(value.toStringAsFixed(6));

/// Returns the change that applies [steps] to the current value of [metric] on [date] in [log].
///
/// [log] must be the latest data, so taps made during an earlier write add to its result.
LogWrite? planCount(NumberMetric metric, Day date, List<CountStep> steps, LogTable log) =>
    _plan(metric, date, applyCountSteps(log.valueAt(metric.id, date), steps), log);

/// Returns the change that sets [metric] to [value] on [date]. Null if the cell already has [value]: the app compares
/// the value, not the text, so `yes` and 1 are equal.
LogWrite? _plan(Metric metric, Day date, num? value, LogTable log) {
  final column = log.columns[metric.id];
  if (column == null) throw MissingColumnException(metric.id);
  if (log.valueAt(metric.id, date) == value) return null;
  final row = log.rows[date];
  final cell = cellValue(metric, value);
  if (row != null) return SetCell(row, column, cell);
  return cell == null ? null : AppendRow(date, column, cell);
}
