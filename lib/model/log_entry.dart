import 'dart:math' as math;

import 'day.dart';
import 'metric.dart';

/// A non-empty value cell of the `log` tab.
final class LogEntry {
  const LogEntry({required this.row, required this.date, required this.metricId, required this.value});

  /// 1-based row number in the `log` tab. Row 1 is the header.
  final int row;
  final Day date;
  final String metricId;
  final num value;
}

/// The `log` tab: one row per day, one column per metric. See docs/data-model.md.
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

/// A change to the `log` tab.
sealed class LogWrite {
  const LogWrite();
}

/// Adds a row for a day that has no row yet.
final class AppendRow extends LogWrite {
  const AppendRow(this.date, this.column, this.value);

  final Day date;
  final int column;
  final num value;

  /// The row cells, from column A to [column].
  List<Object> toCells() => [date.toString(), for (var c = 1; c < column; c++) '', value];
}

/// Sets one cell. A null [value] clears the cell.
final class SetCell extends LogWrite {
  const SetCell(this.row, this.column, this.value);

  final int row;
  final int column;
  final num? value;
}

/// Returns the change that sets [metric] to done or not done on [date].
LogWrite? planYesNo(YesNoMetric metric, Day date, bool done, LogTable log) => _plan(metric, date, done ? 1 : null, log);

/// Returns the change that sets the day value (the day total for [PerDay.many]) of [metric] on [date].
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
  num v = current ?? 0;
  for (final s in steps) {
    v = math.max(0, v + s.delta);
  }
  // Removes float noise from decimal steps, for example 0.30000000000000004.
  return v > 0 ? (v is int ? v : double.parse(v.toStringAsFixed(6))) : null;
}

/// Returns the change that applies [steps] to the current value of [metric] on [date] in [log].
///
/// [log] must be the latest data, so taps made during an earlier write add to its result.
LogWrite? planCount(NumberMetric metric, Day date, List<CountStep> steps, LogTable log) =>
    _plan(metric, date, applyCountSteps(log.valueAt(metric.id, date), steps), log);

/// Returns null if the cell already has [value].
LogWrite? _plan(Metric metric, Day date, num? value, LogTable log) {
  final column = log.columns[metric.id];
  if (column == null) throw StateError('The log tab has no column "${metric.id}".');
  if (log.valueAt(metric.id, date) == value) return null;
  final row = log.rows[date];
  if (row != null) return SetCell(row, column, value);
  return value == null ? null : AppendRow(date, column, value);
}
