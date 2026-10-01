import 'package:googleapis/sheets/v4.dart';

import '../model/log_entry.dart';
import '../model/metric.dart';
import '../model/parse.dart';

/// Rows for a new `metrics` tab. Edit or delete them in the sheet.
const exampleMetrics = [
  ['weight', 'Weight', 'number', 'kg', 'one', 0.1, 'body', true, 'monitor_weight'],
  ['meditate', 'Meditate', 'yesno', '', 'one', '', 'habits', true, 'self_improvement'],
  ['water', 'Water', 'number', 'glasses', 'many', 1, 'habits', true, 'water_drop'],
];

/// The data of the spreadsheet at one point in time.
final class Snapshot {
  const Snapshot(this.metrics, this.log, this.warnings);

  /// All metrics, in sheet order. Includes inactive metrics.
  final List<Metric> metrics;
  final LogTable log;
  final List<String> warnings;
}

/// Reads and writes the trackula spreadsheet. See docs/data-model.md.
final class SheetsStore {
  SheetsStore(this._api, this.spreadsheetId);

  final SheetsApi _api;
  final String spreadsheetId;

  /// Adds the `metrics` and `log` tabs to the spreadsheet if they are missing.
  ///
  /// A new `metrics` tab gets its header, [exampleMetrics] and data validation. A new `log` tab gets the `date`
  /// column. [load] adds the metric columns. Existing tabs and other tabs do not change.
  static Future<void> ensureTabs(SheetsApi api, String spreadsheetId) async {
    final tabs = await _tabs(api, spreadsheetId);
    final missing = [
      for (final title in ['metrics', 'log'])
        if (!tabs.containsKey(title)) title,
    ];
    if (missing.isEmpty) return;

    final added = await api.spreadsheets.batchUpdate(
      BatchUpdateSpreadsheetRequest(
        requests: [
          for (final title in missing)
            Request(
              addSheet: AddSheetRequest(
                properties: SheetProperties(title: title, gridProperties: GridProperties(frozenRowCount: 1)),
              ),
            ),
        ],
      ),
      spreadsheetId,
    );
    final newIds = {
      for (final r in added.replies!) r.addSheet!.properties!.title!: r.addSheet!.properties!.sheetId!,
    };

    await api.spreadsheets.values.batchUpdate(
      BatchUpdateValuesRequest(
        valueInputOption: 'RAW',
        data: [
          if (newIds.containsKey('metrics'))
            ValueRange(range: 'metrics!A1', values: [[...metricsHeader, ...metricsOptionalHeader], ...exampleMetrics]),
          if (newIds.containsKey('log'))
            ValueRange(
              range: 'log!A1',
              values: [
                ['date'],
              ],
            ),
        ],
      ),
      spreadsheetId,
    );
    await api.spreadsheets.batchUpdate(
      BatchUpdateSpreadsheetRequest(
        requests: [
          if (newIds['metrics'] case final id?) ..._metricsRules(id, [...metricsHeader, ...metricsOptionalHeader]),
          if (newIds['log'] case final id?) ..._dateRules(id),
        ],
      ),
      spreadsheetId,
    );
  }

  /// Sets the data validation rules of the `metrics` tab again, so sheets made by an older app version
  /// accept new values, for example kind `count`, and get rules for new columns, for example `icon`.
  ///
  /// The rules go to the columns with the matching header names, so moved columns keep their rules.
  /// First it removes all validation rules below row 1, so a moved column leaves no old rule behind.
  /// It changes only validation rules, not data.
  Future<void> refreshRules() async {
    final tab = (await _tabs(_api, spreadsheetId))['metrics'];
    if (tab == null) return;
    final res = await _api.spreadsheets.values.get(spreadsheetId, 'metrics!1:1');
    final header = [for (final c in res.values?.firstOrNull ?? const <Object?>[]) '$c'.trim().toLowerCase()];
    final clear = Request(setDataValidation: SetDataValidationRequest(range: GridRange(sheetId: tab.id, startRowIndex: 1)));
    await _api.spreadsheets.batchUpdate(
      BatchUpdateSpreadsheetRequest(requests: [clear, ..._metricsRules(tab.id, header)]),
      spreadsheetId,
    );
  }

  /// Reads both tabs and validates each row.
  ///
  /// Before it parses the `log` tab, it converts the old format and adds a column for each metric without one.
  Future<Snapshot> load() async {
    final (metricRows, logRows) = await _read();
    final metrics = parseMetrics(metricRows);
    final byId = {for (final m in metrics.items) m.id: m};

    if (isOldLog(logRows)) {
      await _convertOldLog(logRows, metrics.items, byId);
      return load();
    }

    final header = logRows.isEmpty ? const <Object?>[] : logRows.first;
    final present = {for (final c in header) '${c ?? ''}'.trim()};
    final missing = [
      for (final m in metrics.items)
        if (!present.contains(m.id)) m,
    ];
    if (missing.isNotEmpty) {
      await _addColumns(missing, header.length);
      return load();
    }

    final log = parseLog(logRows, byId);
    return Snapshot(metrics.items, log.table, [...metrics.warnings, ...log.warnings]);
  }

  /// Reads the latest data, asks [plan] for a change, applies it, and returns the new data.
  ///
  /// The read before the write keeps row numbers correct after manual edits in the sheet.
  Future<Snapshot> change(LogWrite? Function(LogTable log) plan) async {
    final w = plan((await load()).log);
    if (w == null) return load();
    await _apply(w);
    return load();
  }

  Future<(List<List<Object?>>, List<List<Object?>>)> _read() async {
    final res = await _api.spreadsheets.values.batchGet(
      spreadsheetId,
      ranges: ['metrics', 'log'],
      valueRenderOption: 'UNFORMATTED_VALUE',
    );
    return (
      res.valueRanges![0].values ?? const <List<Object?>>[],
      res.valueRanges![1].values ?? const <List<Object?>>[],
    );
  }

  Future<void> _apply(LogWrite w) async {
    switch (w) {
      case AppendRow():
        await _api.spreadsheets.values.append(
          ValueRange(values: [w.toCells()]),
          spreadsheetId,
          'log!A1',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
        );
      case SetCell(value: null):
        await _api.spreadsheets.values.clear(ClearValuesRequest(), spreadsheetId, _cell(w.row, w.column));
      case SetCell(:final value?):
        await _api.spreadsheets.values.update(
          ValueRange(
            values: [
              [value],
            ],
          ),
          spreadsheetId,
          _cell(w.row, w.column),
          valueInputOption: 'RAW',
        );
    }
  }

  /// Adds a header cell and a validation rule for each metric in [metrics], after [width] columns.
  Future<void> _addColumns(List<Metric> metrics, int width) async {
    final tab = (await _tabs(_api, spreadsheetId))['log']!;
    // Column A is always `date`, even if the header row is empty.
    final start = width == 0 ? 1 : width;
    final needed = start + metrics.length - tab.columnCount;
    await _api.spreadsheets.batchUpdate(
      BatchUpdateSpreadsheetRequest(
        requests: [
          if (needed > 0)
            Request(
              appendDimension: AppendDimensionRequest(sheetId: tab.id, dimension: 'COLUMNS', length: needed),
            ),
          for (final (i, m) in metrics.indexed) _valueRule(tab.id, start + i, m),
        ],
      ),
      spreadsheetId,
    );
    await _api.spreadsheets.values.update(
      ValueRange(
        values: [
          [if (width == 0) 'date', for (final m in metrics) m.id],
        ],
      ),
      spreadsheetId,
      'log!${columnLetter(width == 0 ? 0 : start)}1',
      valueInputOption: 'RAW',
    );
  }

  /// Copies the old `log` tab to `log_old`, then rewrites `log` in the new format.
  Future<void> _convertOldLog(List<List<Object?>> rows, List<Metric> metrics, Map<String, Metric> byId) async {
    final tabs = await _tabs(_api, spreadsheetId);
    final log = tabs['log']!;
    var backup = 'log_old';
    for (var n = 2; tabs.containsKey(backup); n++) {
      backup = 'log_old_$n';
    }
    final wide = toWideRows(parseOldLog(rows, byId).items, metrics);
    final needed = wide.first.length - log.columnCount;

    await _api.spreadsheets.batchUpdate(
      BatchUpdateSpreadsheetRequest(
        requests: [
          Request(
            duplicateSheet: DuplicateSheetRequest(
              sourceSheetId: log.id,
              newSheetName: backup,
              insertSheetIndex: tabs.length,
            ),
          ),
          // Remove the old validation rules from the whole tab.
          Request(
            setDataValidation: SetDataValidationRequest(range: GridRange(sheetId: log.id)),
          ),
          if (needed > 0)
            Request(
              appendDimension: AppendDimensionRequest(sheetId: log.id, dimension: 'COLUMNS', length: needed),
            ),
          ..._dateRules(log.id),
          for (final (i, m) in metrics.indexed) _valueRule(log.id, i + 1, m),
        ],
      ),
      spreadsheetId,
    );
    await _api.spreadsheets.values.clear(ClearValuesRequest(), spreadsheetId, 'log');
    await _api.spreadsheets.values.update(ValueRange(values: wide), spreadsheetId, 'log!A1', valueInputOption: 'RAW');
  }

  static String _cell(int row, int column) => 'log!${columnLetter(column)}$row';

  static Future<Map<String, ({int id, int columnCount})>> _tabs(SheetsApi api, String spreadsheetId) async {
    final s = await api.spreadsheets.get(
      spreadsheetId,
      $fields: 'sheets.properties(sheetId,title,gridProperties.columnCount)',
    );
    return {
      for (final t in s.sheets ?? const <Sheet>[])
        t.properties!.title!: (id: t.properties!.sheetId!, columnCount: t.properties!.gridProperties!.columnCount!),
    };
  }
}

/// Data validation rules. See "Layer 2" in docs/data-model.md.
GridRange _col(int sheetId, int column) =>
    GridRange(sheetId: sheetId, startRowIndex: 1, startColumnIndex: column, endColumnIndex: column + 1);

Request _rule(GridRange range, BooleanCondition condition) => Request(
  setDataValidation: SetDataValidationRequest(
    range: range,
    rule: DataValidationRule(condition: condition, strict: true, showCustomUi: true),
  ),
);

BooleanCondition _formula(String f) => BooleanCondition(
  type: 'CUSTOM_FORMULA',
  values: [ConditionValue(userEnteredValue: f)],
);

BooleanCondition _oneOf(List<String> items) => BooleanCondition(
  type: 'ONE_OF_LIST',
  values: [for (final i in items) ConditionValue(userEnteredValue: i)],
);

/// The rules of the `metrics` tab. [header] holds the lowercase header names. A missing column gets no rule.
List<Request> _metricsRules(int id, List<String> header) {
  Request? at(String name, BooleanCondition Function(String cell) condition) {
    final i = header.indexOf(name);
    return i < 0 ? null : _rule(_col(id, i), condition('${columnLetter(i)}2'));
  }

  return [
    ?at('kind', (_) => _oneOf(['yesno', 'number', 'count'])),
    ?at('per_day', (_) => _oneOf(['one', 'many'])),
    ?at('active', (_) => BooleanCondition(type: 'BOOLEAN')),
    // A Material Symbols name, or a short text such as an emoji. Some emojis have up to 11 characters in Sheets.
    ?at('icon', (c) => _formula('=OR(REGEXMATCH($c, "^[a-z0-9_]+\$"), LEN($c) <= 16)')),
  ];
}

List<Request> _dateRules(int id) => [
  // log.date: plain text, so Sheets does not convert it to a date.
  Request(
    repeatCell: RepeatCellRequest(
      range: GridRange(sheetId: id, startColumnIndex: 0, endColumnIndex: 1),
      cell: CellData(
        userEnteredFormat: CellFormat(numberFormat: NumberFormat(type: 'TEXT')),
      ),
      fields: 'userEnteredFormat.numberFormat',
    ),
  ),
  // log.date: YYYY-MM-DD, one row per day.
  _rule(_col(id, 0), _formula(r'=AND(REGEXMATCH(A2, "^\d{4}-\d{2}-\d{2}$"), COUNTIF($A$2:$A, A2) = 1)')),
];

/// The rule for a metric column: 1 for yesno, a number for number metrics.
///
/// The rule uses the metric kind at the time the app adds the column. If you change the kind later,
/// change the rule by hand.
Request _valueRule(int id, int column, Metric metric) {
  final cell = '${columnLetter(column)}2';
  return _rule(
    _col(id, column),
    _formula(switch (metric) {
      YesNoMetric() => '=$cell = 1',
      NumberMetric() => '=ISNUMBER($cell)',
    }),
  );
}
