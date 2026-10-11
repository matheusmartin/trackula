import 'day.dart';
import 'log_entry.dart';
import 'metric.dart';

/// The tab titles. Exact case: the app finds the tabs by title. See docs/data-model.md.
const metricsTitle = 'Metrics';
const logTitle = 'Log';

/// Required column names of the `Metrics` tab, in the order the app creates them.
/// The app ignores other columns, for example `per_day` and `active` of older sheets.
const metricsHeader = ['id', 'name', 'kind', 'unit', 'step', 'group', 'icon'];

/// Valid items and a warning for each invalid row.
final class Parsed<T> {
  const Parsed(this.items, this.warnings);

  final List<T> items;
  final List<String> warnings;
}

/// Thrown when a header row does not contain a required column.
final class HeaderException implements Exception {
  HeaderException(this.tab, this.missing);

  final String tab;
  final List<String> missing;

  @override
  String toString() => 'Tab "$tab" has no column(s): ${missing.join(', ')}';
}

final _idPattern = RegExp(r'^[a-z0-9_-]+$');

/// Parses the `Metrics` tab. [rows] includes the header row.
Parsed<Metric> parseMetrics(List<List<Object?>> rows) {
  final columns = _columns(metricsTitle, rows, metricsHeader);
  final items = <Metric>[];
  final warnings = <String>[];
  final seen = <String>{};

  for (var i = 1; i < rows.length; i++) {
    final row = _MetricRow(rows[i], columns);
    if (row.isEmpty) continue;
    final at = '$metricsTitle row ${i + 1}';

    final id = row.text('id');
    if (id == null || !_idPattern.hasMatch(id)) {
      warnings.add('$at: invalid id "${id ?? ''}". Use only lowercase letters, digits, "_" and "-".');
    } else if (!seen.add(id)) {
      warnings.add('$at: duplicate id "$id"');
    } else {
      try {
        items.add(_metric(row, id));
      } on FormatException catch (e) {
        warnings.add('$at: ${e.message}');
      }
    }
  }
  return Parsed(items, warnings);
}

/// The metric of [row]. [id] is valid. Throws a [FormatException] with the problem if the row is not valid.
Metric _metric(_MetricRow row, String id) {
  final name = row.text('name') ?? id;
  final group = row.text('group');
  final icon = row.text('icon');
  if (icon == null) {
    throw const FormatException('no icon. Use a Material Symbols name, such as "water_drop", or an emoji.');
  }
  return switch (row.text('kind')) {
    'yesno' => YesNoMetric(id: id, name: name, group: group, icon: icon),
    final kind && ('number' || 'count') => NumberMetric(
      id: id,
      name: name,
      unit: row.text('unit'),
      step: switch (row.number('step')) {
        final step? when step > 0 => step,
        _ => 1,
      },
      group: group,
      isCount: kind == 'count',
      icon: icon,
    ),
    final kind => throw FormatException('invalid kind "${kind ?? ''}"'),
  };
}

/// Parses the `Log` tab: column A is `date`, the other headers are metric ids. [rows] includes the header row.
({LogTable table, List<String> warnings}) parseLog(List<List<Object?>> rows, Map<String, Metric> metrics) {
  final header = rows.isEmpty ? const <Object?>[] : rows.first;
  if (header.isEmpty || '${header.first}'.trim().toLowerCase() != 'date') throw HeaderException(logTitle, ['date']);

  final warnings = <String>[];
  final columns = _logColumns(header, metrics, warnings);
  final entries = <LogEntry>[];
  final days = <Day, int>{};
  for (var i = 1; i < rows.length; i++) {
    final cells = rows[i];
    if (cells.every(_isEmpty)) continue;
    final at = '$logTitle row ${i + 1}';
    final first = cells.firstOrNull;
    final date = _logDate(first);
    if (date == null) {
      warnings.add('$at: invalid date "${'${first ?? ''}'.trim()}"');
      continue;
    }
    if (days.containsKey(date)) warnings.add('$at: $date has more than one row. The app uses the last row.');
    days[date] = i + 1;

    for (final MapEntry(key: id, value: c) in columns.entries) {
      final cell = c < cells.length ? cells[c] : null;
      if (_isEmpty(cell)) continue;
      final metric = metrics[id]!;
      if (_logValue(metric, cell) case final value?) {
        entries.add(LogEntry(row: i + 1, date: date, metricId: id, value: value));
      } else {
        final problem = metric is YesNoMetric ? 'yesno value must be yes or no' : 'value is not a number';
        warnings.add('$at, column ${columnLetter(c)}: $problem');
      }
    }
  }
  return (table: LogTable(entries: entries, rows: days, columns: columns), warnings: warnings);
}

/// The 0-based column index of each metric in the `Log` [header]. Adds a warning to [warnings] for each duplicate
/// column.
Map<String, int> _logColumns(List<Object?> header, Map<String, Metric> metrics, List<String> warnings) {
  final columns = <String, int>{};
  for (var c = 1; c < header.length; c++) {
    final id = '${header[c] ?? ''}'.trim();
    // A column with no metric, for example of a deleted metric: the app ignores the column and its values.
    if (id.isEmpty || !metrics.containsKey(id)) continue;
    if (columns.containsKey(id)) {
      warnings.add('$logTitle column ${columnLetter(c)}: duplicate column "$id". The app uses the first one.');
    } else {
      columns[id] = c;
    }
  }
  return columns;
}

/// The date of a `date` cell. A real date is a serial number. Older app versions wrote the date as text: YYYY-MM-DD.
/// Null if the cell is not a valid date.
Day? _logDate(Object? cell) => switch (cell) {
  num serial => Day.fromSerial(serial),
  String text => Day.tryParse(text),
  _ => null,
};

/// The value of a non-empty `Log` [cell] of [metric]. Null if the value is not valid for the metric kind.
num? _logValue(Metric metric, Object? cell) => switch ((metric, cell)) {
  (YesNoMetric(), _) => _yesNoValue(cell),
  (NumberMetric(), num n) => n,
  (NumberMetric(), String s) => num.tryParse(s.trim()),
  _ => null,
};

/// The `Log` rows with a date stored as text (`YYYY-MM-DD`), as older app versions wrote it, and that date.
///
/// The app changes these cells to real dates. Real dates (serial numbers) and invalid text do not change.
/// [rows] includes the header row. The row is 1-based.
List<({int row, Day date})> textDateRows(List<List<Object?>> rows) => [
  for (var i = 1; i < rows.length; i++)
    if (rows[i].isNotEmpty && rows[i].first is String)
      if (Day.tryParse(rows[i].first as String) case final d?) (row: i + 1, date: d),
];

/// Reads a yesno cell: `yes` is 1, `no` is 0. Case and spaces do not matter.
///
/// Old app versions wrote `1` for yes, and a checked checkbox is `TRUE`: both are yes. `0` and `FALSE` are no.
/// Returns null for other values.
num? _yesNoValue(Object? cell) => switch (cell) {
  true || 1 => 1,
  0 => 0,
  String s => switch (s.trim().toLowerCase()) {
    'yes' || 'true' || '1' => 1,
    'no' || 'false' || '0' => 0,
    _ => null,
  },
  _ => null,
};

/// The `Log` cells of yesno metrics that have a value of an old app version, and the new value of each cell.
///
/// Old versions wrote `1` for yes. `1`, `TRUE` and `0`, also as text, become `yes` or `no`. Cells with `yes` or
/// `no`, empty cells and invalid values do not change. [rows] includes the header row. The row is 1-based,
/// the column 0-based.
List<({int row, int column, String value})> legacyYesNoCells(List<List<Object?>> rows, Map<String, Metric> metrics) {
  if (rows.isEmpty) return const [];
  final columns = <int>[];
  final seen = <String>{};
  for (var c = 1; c < rows.first.length; c++) {
    final id = '${rows.first[c] ?? ''}'.trim();
    if (metrics[id] is YesNoMetric && seen.add(id)) columns.add(c);
  }
  bool isNew(Object? cell) => cell is String && const {'yes', 'no'}.contains(cell.trim().toLowerCase());
  return [
    for (var i = 1; i < rows.length; i++)
      for (final c in columns)
        if (c < rows[i].length && !_isEmpty(rows[i][c]) && !isNew(rows[i][c]))
          if (_yesNoValue(rows[i][c]) case final v?) (row: i + 1, column: c, value: v == 1 ? 'yes' : 'no'),
  ];
}

/// Spreadsheet column letter for a 0-based [index]. Example: 0 → A, 26 → AA.
String columnLetter(int index) {
  var n = index + 1;
  var letters = '';
  while (n > 0) {
    letters = '${String.fromCharCode(65 + (n - 1) % 26)}$letters';
    n = (n - 1) ~/ 26;
  }
  return letters;
}

/// Empty checkbox cells return `false`, so `false` counts as empty.
bool _isEmpty(Object? c) => c == null || c == false || '$c'.trim().isEmpty;

/// The column index of each lowercase header name of [rows]. Throws a [HeaderException] if a [required] name is
/// missing.
Map<String, int> _columns(String tab, List<List<Object?>> rows, List<String> required) {
  final header = rows.isEmpty ? const <Object?>[] : rows.first;
  final columns = <String, int>{
    for (var i = 0; i < header.length; i++) '${header[i]}'.trim().toLowerCase(): i,
  };
  final missing = [
    for (final name in required)
      if (!columns.containsKey(name)) name,
  ];
  if (missing.isNotEmpty) throw HeaderException(tab, missing);
  return columns;
}

/// One row of the `Metrics` tab. The Sheets API omits empty cells at the end of a row.
final class _MetricRow {
  _MetricRow(this._cells, this._columns);

  final List<Object?> _cells;

  /// The column index of each lowercase header name.
  final Map<String, int> _columns;

  bool get isEmpty => _cells.every(_isEmpty);

  Object? _cell(String name) {
    final i = _columns[name]!;
    return i < _cells.length ? _cells[i] : null;
  }

  /// The trimmed text of the cell in column [name]. Null if the cell is empty.
  String? text(String name) {
    final s = _cell(name)?.toString().trim();
    return s == null || s.isEmpty ? null : s;
  }

  /// The number in the cell in column [name]. Null if the cell is empty or not a number.
  num? number(String name) => switch (_cell(name)) {
    num n => n,
    String s => num.tryParse(s.trim()),
    _ => null,
  };
}
