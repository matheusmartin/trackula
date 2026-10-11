import 'dart:math' as math;

import 'day.dart';
import 'log_entry.dart';
import 'metric.dart';
import 'parse.dart';

/// The header of the score column of the `Log` tab. It starts with a capital letter, so it cannot be a metric id.
const scoreHeader = 'Score';

/// The score as a count metric, for the table, the calendars and the detail screen. It is not a row of the `Metrics`
/// tab, and its cells are read-only: [dayScores] calculates its values.
const scoreMetric = NumberMetric(id: scoreHeader, name: 'Score', unit: 'points', isCount: true, icon: 'star');

/// True if [metric] is [scoreMetric].
bool isScore(Metric metric) => metric.id == scoreHeader;

/// The points of [metric] for a day with [value]. See docs/data-model.md.
///
/// - Yes/no: 1 if [value] is the goal: `yes` (1), or `no` (0) for the goal `no`.
/// - Count: 1 for each step, also above the goal. Example: 3 glasses with step 1 give 3 points. 30 minutes with
///   step 10 give 3 points. A value below 0, typed in the sheet, gives 0 points.
/// - Number: 1 if [value] reaches the goal. 0 if the metric has no goal.
num metricPoints(Metric metric, num value) => switch (metric) {
  YesNoMetric(:final goalIsYes) => (value == 1) == goalIsYes ? 1 : 0,
  NumberMetric(isCount: true, :final step) => math.max(0, value) / step,
  NumberMetric(:final goal) => goal != null && goal.isReachedBy(value) ? 1 : 0,
};

/// The score of each day of [log]: the sum of the points of the [metrics] on that day. It includes the count taps in
/// [pending] that are not written yet. Keys of [pending] are metric id and day. A day without a value has no score.
///
/// If a day has more than one row, only the last row counts, as in [LogTable.rows]. So the score is the same as the
/// `Score` cell of that row.
Map<Day, num> dayScores(
  List<Metric> metrics,
  LogTable log, [
  Map<(String, Day), List<CountStep>> pending = const {},
]) {
  final byId = {for (final m in metrics) m.id: m};
  final values = <(String, Day), num>{
    for (final e in log.entries)
      if (byId.containsKey(e.metricId) && log.rows[e.date] == e.row) (e.metricId, e.date): e.value,
  };
  for (final MapEntry(:key, value: steps) in pending.entries) {
    if (byId[key.$1] is! NumberMetric) continue;
    if (applyCountSteps(values[key], steps) case final value?) {
      values[key] = value;
    } else {
      values.remove(key);
    }
  }
  final points = <Day, List<num>>{};
  for (final MapEntry(key: (id, day), :value) in values.entries) {
    (points[day] ??= []).add(metricPoints(byId[id]!, value));
  }
  return {for (final MapEntry(key: day, value: p) in points.entries) day: _total(p)};
}

/// The 0-based index of the score column in the `Log` [header]. Null if the tab has no score column.
int? scoreColumn(List<Object?> header) {
  for (var c = 1; c < header.length; c++) {
    if ('${header[c] ?? ''}'.trim() == scoreHeader) return c;
  }
  return null;
}

/// A cell of the score column that must change: its 1-based row and the new score. A null score clears the cell.
typedef ScoreCell = ({int row, num? score});

/// The cells of the score [column] of the `Log` tab that do not show the score of their row. [rows] includes the
/// header row.
///
/// The score of a row is the sum of the points of its values. See [metricPoints]. A row without a value, or without a
/// valid date, has no score.
List<ScoreCell> staleScoreCells(List<List<Object?>> rows, List<Metric> metrics, int column) {
  final byId = {for (final m in metrics) m.id: m};
  final points = <int, List<num>>{};
  for (final e in parseLog(rows, byId).table.entries) {
    (points[e.row] ??= []).add(metricPoints(byId[e.metricId]!, e.value));
  }
  final cells = <ScoreCell>[];
  for (var i = 1; i < rows.length; i++) {
    final row = i + 1;
    final score = switch (points[row]) {
      final p? => _total(p),
      null => null,
    };
    final cell = column < rows[i].length ? rows[i][column] : null;
    if (!_shows(cell, score)) cells.add((row: row, score: score));
  }
  return cells;
}

/// The sum of [points] without float noise. A whole sum is an integer: 3, not 3.0.
num _total(Iterable<num> points) {
  final total = withoutFloatNoise(points.fold<num>(0, (sum, p) => sum + p));
  return total == total.round() ? total.round() : total;
}

/// True if the score [cell] shows [score]. An empty cell shows no score. Other text never shows a score, also a
/// number as text, so the app replaces it with a number. The `Score` rule accepts only numbers.
bool _shows(Object? cell, num? score) => switch (cell) {
  String s => s.trim().isEmpty && score == null,
  _ => cell == score,
};
