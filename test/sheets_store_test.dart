import 'dart:convert';

import 'package:googleapis/sheets/v4.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:test/test.dart';
import 'package:trackula/model/day.dart';
import 'package:trackula/model/log_entry.dart';
import 'package:trackula/model/metric.dart';
import 'package:trackula/model/parse.dart';
import 'package:trackula/sheets/sheets_store.dart';

void main() {
  const d1 = Day(2026, 9, 29);
  const d2 = Day(2026, 9, 30);
  const d3 = Day(2026, 10, 1);

  /// A sheet with goals and a `Log` tab without the `Score` column. The `Log` tab has no free column.
  _FakeSheets sheetWithoutScore() => _FakeSheets(
    metrics: [
      [...metricsHeader],
      ['weight', 'Weight', 'number', 'kg', 0.1, 'body', 'monitor_weight', '<= 80'],
      ['meditate', 'Meditate', 'yesno', '', '', 'habits', 'self_improvement', 'yes'],
      ['water', 'Water', 'count', 'glasses', 1, 'habits', 'water_drop', 8],
    ],
    log: [
      ['date', 'weight', 'meditate', 'water'],
      // 1 (weight <= 80) + 1 (yes) + 3 (3 glasses) = 5.
      [d1.serial, 79.5, 'yes', 3],
      // 0 + 0 = 0.
      [d2.serial, 82, 'no'],
      // No value: no score.
      [d3.serial],
    ],
    logColumns: 4,
  );

  group('SheetsStore.load and the Score column', () {
    test('adds a missing Score column with its rule, and writes the scores', () async {
      final fake = sheetWithoutScore();
      final snapshot = await fake.store.load();

      expect(snapshot.warnings, isEmpty);
      expect(fake.log[0], ['date', 'weight', 'meditate', 'water', 'Score']);
      expect(fake.logColumn('Score'), [5, 0, null]);
      expect(fake.columnCounts[logTitle], 5);
      // Only the new Score column gets a rule when the app adds it.
      expect(fake.numberRuleColumns, ['E']);
      // The Score column is not a metric.
      expect(snapshot.log.columns.keys, ['weight', 'meditate', 'water']);
      expect(fake.scoreWrites, hasLength(1));
    });

    test('a second load writes nothing', () async {
      final fake = sheetWithoutScore();
      await fake.store.load();
      fake.calls.clear();
      fake.scoreWrites.clear();

      await fake.store.load();
      expect(fake.scoreWrites, isEmpty);
      expect(fake.calls, ['GET values:batchGet']);
    });

    test('writes only the stale score cells, and clears the score of a row without values', () async {
      final fake = sheetWithoutScore()
        ..log[0].add('Score')
        ..log[1].add(5)
        ..log[2].addAll([null, 7])
        ..log[3].addAll([null, null, null, 4])
        ..columnCounts[logTitle] = 5;

      await fake.store.load();
      expect(fake.scoreWrites, [
        ['Log!E3', 'Log!E4'],
      ]);
      expect(fake.logColumn('Score'), [5, 0, null]);
    });

    test('after a goal change in the Metrics tab, the next load writes the new scores', () async {
      final fake = sheetWithoutScore();
      await fake.store.load();
      fake.scoreWrites.clear();

      // Goal `no` for meditate: row 2 loses 1 point, row 3 gets 1 point.
      fake.metrics[2][7] = 'no';
      await fake.store.load();
      expect(fake.logColumn('Score'), [4, 1, null]);
      expect(fake.scoreWrites, [
        ['Log!E2', 'Log!E3'],
      ]);

      // A maximum of 85 for weight: 82 kg reaches it.
      fake.metrics[1][7] = '<= 85';
      await fake.store.load();
      expect(fake.logColumn('Score'), [4, 2, null]);

      // No goal for weight: no points.
      fake.metrics[1][7] = '';
      await fake.store.load();
      expect(fake.logColumn('Score'), [3, 1, null]);
    });

    test('after a change of a past value in the sheet, the next load writes only that score', () async {
      final fake = sheetWithoutScore();
      await fake.store.load();
      fake.scoreWrites.clear();

      fake.log[1][3] = 6;
      await fake.store.load();
      expect(fake.scoreWrites, [
        ['Log!E2'],
      ]);
      expect(fake.logColumn('Score'), [8, 0, null]);
    });

    test('a deleted metric row or an invalid goal removes the points of that metric', () async {
      final fake = sheetWithoutScore();
      await fake.store.load();

      fake.metrics[3][7] = 'lots';
      final snapshot = await fake.store.load();
      expect(snapshot.warnings, [contains('invalid goal')]);
      expect(fake.logColumn('Score'), [2, 0, null]);
    });

    test('a write in the app also writes the score of its row', () async {
      final fake = sheetWithoutScore();
      final metrics = (await fake.store.load()).metrics;
      final water = metrics.firstWhere((m) => m.id == 'water') as NumberMetric;

      // A new row for d3 + 1 day.
      const d4 = Day(2026, 10, 2);
      final snapshot = await fake.store.change(
        (log) => planCount(water, d4, [const CountStep.add(1), const CountStep.add(1)], log),
      );
      expect(snapshot.log.valueAt('water', d4), 2);
      expect(fake.logColumn('Score'), [5, 0, null, 2]);

      // A change in a past row.
      await fake.store.change((log) => planCount(water, d2, [const CountStep.add(1)], log));
      expect(fake.logColumn('Score'), [5, 1, null, 2]);
    });

    test('a sheet without the goal column gets scores with the default goals', () async {
      final fake = sheetWithoutScore();
      for (final row in fake.metrics) {
        row.removeLast();
      }
      await fake.store.load();
      // Weight has no goal (0), meditate has the goal yes, water is a count.
      expect(fake.logColumn('Score'), [4, 0, null]);
    });

    test('a Log tab with only the date header gets the metric columns and the Score column in one change', () async {
      final fake = sheetWithoutScore();
      fake.log
        ..clear()
        ..add(['date']);
      fake.columnCounts[logTitle] = 26;
      await fake.store.load();
      expect(fake.log[0], ['date', 'weight', 'meditate', 'water', 'Score']);
      // Weight (B), water (D) and Score (E). Meditate (C) gets the yes / no dropdown.
      expect(fake.numberRuleColumns, ['B', 'D', 'E']);
      expect(fake.calls.where((c) => c == 'PUT Log!B1'), hasLength(1));
      expect(fake.scoreWrites, isEmpty);
    });

    test('refreshRules gives the Score column the number rule', () async {
      final fake = sheetWithoutScore();
      await fake.store.load();
      fake.numberRuleColumns.clear();

      await fake.store.refreshRules();
      expect(fake.numberRuleColumns, ['B', 'D', 'E']);
    });

    test('changeAll writes the scores once, after the last write', () async {
      final fake = sheetWithoutScore();
      final metrics = (await fake.store.load()).metrics;
      final water = metrics.firstWhere((m) => m.id == 'water') as NumberMetric;
      final meditate = metrics.firstWhere((m) => m.id == 'meditate') as YesNoMetric;
      fake.scoreWrites.clear();

      await fake.store.changeAll([
        (log) => planCount(water, d3, [const CountStep.add(2)], log),
        (log) => planYesNo(meditate, d3, log, done: true),
      ]);
      expect(fake.scoreWrites, [
        ['Log!E4'],
      ]);
      expect(fake.logColumn('Score'), [5, 0, 3]);
    });

    test('changeAll writes the scores also if its last plan writes nothing', () async {
      final fake = sheetWithoutScore();
      final metrics = (await fake.store.load()).metrics;
      final water = metrics.firstWhere((m) => m.id == 'water') as NumberMetric;
      final meditate = metrics.firstWhere((m) => m.id == 'meditate') as YesNoMetric;

      await fake.store.changeAll([
        (log) => planCount(water, d2, [const CountStep.add(4)], log),
        // Row 3 has `no` already: no write.
        (log) => planYesNo(meditate, d2, log, done: false),
      ]);
      expect(fake.logColumn('Score'), [5, 4, null]);
    });

    test('a failed score write gives a warning and does not stop the load or the change', () async {
      final fake = sheetWithoutScore();
      final metrics = (await fake.store.load()).metrics;
      final water = metrics.firstWhere((m) => m.id == 'water') as NumberMetric;
      fake.failsScoreWrites = true;

      final snapshot = await fake.store.change((log) => planCount(water, d1, [const CountStep.add(1)], log));
      expect(snapshot.log.valueAt('water', d1), 4);
      expect(snapshot.warnings.single, contains('could not write 1 scores'));
      expect(fake.logColumn('Score'), [5, 0, null]);

      // The next load tries again.
      fake.failsScoreWrites = false;
      final next = await fake.store.load();
      expect(next.warnings, isEmpty);
      expect(fake.logColumn('Score'), [6, 0, null]);
    });

    test('no endless loop if the Score cells do not keep the written values', () async {
      final fake = sheetWithoutScore()..keepsScores = false;
      await fake.store.load();
      expect(fake.scoreWrites, hasLength(1));

      // Each load writes the scores again, but only once.
      fake.scoreWrites.clear();
      await fake.store.load();
      expect(fake.scoreWrites, hasLength(1));
      expect(fake.logColumn('Score'), [null, null, null]);
    });
  });
}

/// An in-memory spreadsheet behind a fake HTTP client, for the calls of [SheetsStore].
///
/// It keeps the `Metrics` and `Log` tabs as rows of cells. It returns the values as the Sheets API does with
/// `UNFORMATTED_VALUE`: empty cells at the end of a row and empty rows at the end are not in the response.
final class _FakeSheets {
  _FakeSheets({required this.metrics, required this.log, required int logColumns})
    : columnCounts = {metricsTitle: 26, logTitle: logColumns};

  final List<List<Object?>> metrics;
  final List<List<Object?>> log;
  final Map<String, int> columnCounts;

  /// False: the `Score` column does not keep a written value, as if something in the sheet changes it back.
  bool keepsScores = true;

  /// True: a write to the `Score` column fails with HTTP 403, as on a view-only sheet.
  bool failsScoreWrites = false;

  /// The method and the last part of the path of each call. Example: `GET values:batchGet`.
  final calls = <String>[];

  /// The ranges of each `values:batchUpdate` call that writes to the `Score` column.
  final scoreWrites = <List<String>>[];

  /// The letters of the `Log` columns that got the number rule `=ISNUMBER(…)`, in the order of the requests.
  final numberRuleColumns = <String>[];

  late final store = SheetsStore(SheetsApi(MockClient(_handle)), 'sheet-id');

  static const _tabIds = {metricsTitle: 1, logTitle: 2};

  List<List<Object?>> _tab(String title) => switch (title) {
    metricsTitle => metrics,
    logTitle => log,
    _ => throw ArgumentError(title),
  };

  /// The values of the [header] column of the `Log` tab, below the header row. Null for an empty cell.
  List<Object?> logColumn(String header) {
    final c = log[0].indexOf(header);
    return [for (final row in log.skip(1)) c < row.length ? _orNull(row[c]) : null];
  }

  int get _scoreColumn => log.isEmpty ? -1 : log[0].indexOf('Score');

  Future<http.Response> _handle(http.Request request) async {
    final path = Uri.decodeComponent(request.url.path).replaceFirst('/v4/spreadsheets/sheet-id', '');
    final body = request.body.isEmpty ? const <String, Object?>{} : jsonDecode(request.body) as Map<String, Object?>;
    calls.add('${request.method} ${path.split('/').last}');
    try {
      return _json(_response(request, path, body));
    } on _Forbidden {
      return _json({
        'error': {'code': 403, 'message': 'The caller does not have permission'},
      }, status: 403);
    }
  }

  static http.Response _json(Object body, {int status = 200}) =>
      http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json; charset=utf-8'});

  Object _response(http.Request request, String path, Map<String, Object?> body) {
    final Object response = switch ((request.method, path)) {
      ('GET', '') => _spreadsheet(),
      ('POST', ':batchUpdate') => _batchUpdate(body),
      ('GET', '/values:batchGet') => _batchGet(request.url.queryParametersAll['ranges']!),
      ('POST', '/values:batchUpdate') => _valuesBatchUpdate(body),
      ('PUT', final p) when p.startsWith('/values/') => _write(
        p.substring('/values/'.length),
        body['values']! as List<Object?>,
        userEntered: request.url.queryParameters['valueInputOption'] == 'USER_ENTERED',
      ),
      ('POST', final p) when p.endsWith(':append') => _append(body['values']! as List<Object?>),
      ('POST', final p) when p.endsWith(':clear') => _clear(p.substring('/values/'.length, p.length - ':clear'.length)),
      _ => throw UnsupportedError('${request.method} $path'),
    };
    return response;
  }

  Map<String, Object?> _spreadsheet() => {
    'sheets': [
      for (final MapEntry(key: title, value: id) in _tabIds.entries)
        {
          'properties': {
            'sheetId': id,
            'title': title,
            'gridProperties': {'columnCount': columnCounts[title]},
          },
        },
    ],
  };

  Map<String, Object?> _batchUpdate(Map<String, Object?> body) {
    for (final request in (body['requests']! as List).cast<Map<String, Object?>>()) {
      if (request['appendDimension'] case final Map<String, Object?> append) {
        final title = _tabIds.entries.firstWhere((e) => e.value == append['sheetId']).key;
        columnCounts[title] = columnCounts[title]! + (append['length']! as int);
      }
      if (request['setDataValidation'] case final Map<String, Object?> validation) {
        final range = validation['range']! as Map<String, Object?>;
        final condition = '${(validation['rule'] as Map?)?['condition']}';
        if (range['sheetId'] == _tabIds[logTitle] && condition.contains('ISNUMBER')) {
          numberRuleColumns.add(columnLetter(range['startColumnIndex']! as int));
        }
      }
    }
    return {'replies': <Object?>[]};
  }

  Map<String, Object?> _batchGet(List<String> ranges) => {
    'valueRanges': [
      for (final range in ranges)
        {
          'range': range,
          'values': ?_values(range),
        },
    ],
  };

  /// The values of [range], a tab title or `Log!1:1`, without empty cells at the end. Null if there are no values.
  List<List<Object?>>? _values(String range) {
    final [title, ...rest] = range.split('!');
    var rows = _tab(title);
    if (rest case ['1:1']) rows = rows.take(1).toList();
    final trimmed = [
      for (final row in rows)
        [
          for (final cell in row.take(row.lastIndexWhere((c) => _orNull(c) != null) + 1)) _orNull(cell) ?? '',
        ],
    ];
    while (trimmed.isNotEmpty && trimmed.last.isEmpty) {
      trimmed.removeLast();
    }
    return trimmed.isEmpty ? null : trimmed;
  }

  Map<String, Object?> _valuesBatchUpdate(Map<String, Object?> body) {
    final data = (body['data']! as List).cast<Map<String, Object?>>();
    final ranges = [for (final d in data) d['range']! as String];
    final scoreLetter = _scoreColumn < 0 ? null : columnLetter(_scoreColumn);
    if (scoreLetter != null && ranges.any((r) => r.startsWith('$logTitle!$scoreLetter'))) {
      if (failsScoreWrites) throw const _Forbidden();
      scoreWrites.add(ranges);
    }
    for (final d in data) {
      _write(
        d['range']! as String,
        d['values']! as List<Object?>,
        userEntered: body['valueInputOption'] == 'USER_ENTERED',
      );
    }
    return const {};
  }

  /// Writes [values] from the top-left cell of [range], for example `Log!E1`.
  Map<String, Object?> _write(String range, List<Object?> values, {required bool userEntered}) {
    final (title, row, column) = _cell(range);
    final rows = _tab(title);
    for (final (i, cells) in values.cast<List<Object?>>().indexed) {
      for (final (j, value) in cells.indexed) {
        final c = column + j;
        if (!keepsScores && title == logTitle && row + i > 0 && c == _scoreColumn) continue;
        _set(rows, row + i, c, userEntered ? _userEntered(value) : value);
      }
    }
    return const {};
  }

  /// Adds a row after the last row with values. Sheets reads `YYYY-MM-DD` as a date: USER_ENTERED.
  Map<String, Object?> _append(List<Object?> values) {
    final row = (_values(logTitle) ?? const []).length;
    for (final (j, value) in (values.single! as List<Object?>).indexed) {
      _set(log, row, j, _userEntered(value));
    }
    return const {};
  }

  Map<String, Object?> _clear(String range) {
    final (title, row, column) = _cell(range);
    _set(_tab(title), row, column, null);
    return const {};
  }

  static void _set(List<List<Object?>> rows, int row, int column, Object? value) {
    while (rows.length <= row) {
      rows.add([]);
    }
    final cells = rows[row];
    while (cells.length <= column) {
      cells.add(null);
    }
    cells[column] = value;
  }

  /// The tab, the 0-based row and the 0-based column of the top-left cell of [range], for example `Log!E1`.
  static (String, int, int) _cell(String range) {
    final match = RegExp(r'^(\w+)!([A-Z]+)(\d+)').firstMatch(range)!;
    var column = 0;
    for (final unit in match[2]!.codeUnits) {
      column = column * 26 + unit - 64;
    }
    return (match[1]!, int.parse(match[3]!) - 1, column - 1);
  }

  /// A value as Sheets stores it with USER_ENTERED: a `YYYY-MM-DD` text is a date serial number.
  static Object? _userEntered(Object? value) => switch (value) {
    String s when Day.tryParse(s) != null => Day.tryParse(s)!.serial,
    _ => value,
  };

  /// Null for an empty cell: null or an empty text.
  static Object? _orNull(Object? cell) => cell == '' ? null : cell;
}

/// Thrown by the fake to answer with HTTP 403.
final class _Forbidden implements Exception {
  const _Forbidden();
}
