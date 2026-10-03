import 'package:googleapis/sheets/v4.dart';

import '../model/day.dart';
import '../model/log_entry.dart';
import '../model/metric.dart';
import '../model/parse.dart';

/// Rows for a new `metrics` tab. Edit or delete them in the sheet.
const exampleMetrics = [
  ['weight', 'Weight', 'number', 'kg', 0.1, 'body', 'monitor_weight'],
  ['meditate', 'Meditate', 'yesno', '', '', 'habits', 'self_improvement'],
  ['water', 'Water', 'number', 'glasses', 1, 'habits', 'water_drop'],
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

  /// True until [load] tried once to change text dates to real dates. Once is enough: the parser reads both.
  bool _convertDates = true;

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
            ValueRange(
              range: 'metrics!A1',
              values: [
                metricsHeader,
                ...exampleMetrics,
              ],
            ),
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
          if (newIds['metrics'] case final id?) ..._metricsRules(id, metricsHeader),
          if (newIds['log'] case final id?) ..._dateRules(id),
        ],
      ),
      spreadsheetId,
    );
  }

  /// Sets the data validation rules of both tabs again, from the current headers and metric kinds. So sheets made
  /// by an older app version accept new values, for example kind `count` or `yes`, and new columns get their rule.
  ///
  /// - `metrics`: the rules go to the columns with the matching header names, so moved columns keep their rules.
  ///   First it removes all validation rules below row 1, so a moved column leaves no old rule behind.
  /// - `log`: the date column gets its date format and rule. Each metric column gets the rule of its metric kind,
  ///   so a kind change also changes the rule.
  ///
  /// It changes only validation rules, not data.
  Future<void> refreshRules() async {
    final tabs = await _tabs(_api, spreadsheetId);
    final metricsTab = tabs['metrics'];
    if (metricsTab == null) return;
    final logTab = tabs['log'];
    final res = await _api.spreadsheets.values.batchGet(
      spreadsheetId,
      ranges: ['metrics', if (logTab != null) 'log!1:1'],
      valueRenderOption: 'UNFORMATTED_VALUE',
    );
    final metricRows = res.valueRanges![0].values ?? const <List<Object?>>[];
    final header = [for (final c in metricRows.firstOrNull ?? const <Object?>[]) '$c'.trim().toLowerCase()];
    final logHeader = logTab == null ? const <Object?>[] : res.valueRanges![1].values?.firstOrNull ?? const <Object?>[];
    final byId = <String, Metric>{};
    try {
      for (final m in parseMetrics(metricRows).items) {
        byId[m.id] = m;
      }
    } on HeaderException {
      // The metrics tab misses a column: load() shows the error. The log rules wait until the tab is valid.
    }
    final clear = Request(
      setDataValidation: SetDataValidationRequest(range: GridRange(sheetId: metricsTab.id, startRowIndex: 1)),
    );
    await _api.spreadsheets.batchUpdate(
      BatchUpdateSpreadsheetRequest(
        requests: [
          clear,
          ..._metricsRules(metricsTab.id, header),
          if (logTab != null) ..._dateRules(logTab.id),
          if (logTab != null)
            for (var c = 1; c < logHeader.length; c++)
              if (byId['${logHeader[c] ?? ''}'.trim()] case final m?) _valueRule(logTab.id, c, m),
        ],
      ),
      spreadsheetId,
    );
  }

  /// Reads both tabs and validates each row.
  ///
  /// Before it parses the `log` tab, it adds a column for each metric without one, and changes values of old app
  /// versions: text dates to real dates (see [textDateRows]), and yesno `1` to `yes` (see [legacyYesNoCells]).
  Future<Snapshot> load() async {
    final (metricRows, logRows) = await _read();
    final metrics = parseMetrics(metricRows);
    final byId = {for (final m in metrics.items) m.id: m};

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

    final textDates = _convertDates ? textDateRows(logRows) : const <({int row, Day date})>[];
    if (textDates.isNotEmpty) {
      _convertDates = false;
      final tab = (await _tabs(_api, spreadsheetId))['log']!;
      await _api.spreadsheets.batchUpdate(
        BatchUpdateSpreadsheetRequest(requests: [_dateFormat(tab.id)]),
        spreadsheetId,
      );
      // USER_ENTERED: Sheets reads the YYYY-MM-DD text as a real date, as when you type it.
      await _api.spreadsheets.values.batchUpdate(
        BatchUpdateValuesRequest(
          valueInputOption: 'USER_ENTERED',
          data: [
            for (final r in textDates)
              ValueRange(
                range: 'log!A${r.row}',
                values: [
                  [r.date.toString()],
                ],
              ),
          ],
        ),
        spreadsheetId,
      );
      return load();
    }

    final legacy = legacyYesNoCells(logRows, byId);
    if (legacy.isNotEmpty) {
      await _api.spreadsheets.values.batchUpdate(
        BatchUpdateValuesRequest(
          valueInputOption: 'RAW',
          data: [
            for (final c in legacy)
              ValueRange(
                range: _cell(c.row, c.column),
                values: [
                  [c.value],
                ],
              ),
          ],
        ),
        spreadsheetId,
      );
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
          // USER_ENTERED: Sheets reads the YYYY-MM-DD text as a real date, as when you type it.
          // The other cells are numbers, or `yes` and `no`, which stay as they are.
          valueInputOption: 'USER_ENTERED',
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
    // A Material Symbols name, or a short text such as an emoji. Some emojis have up to 11 characters in Sheets.
    ?at('icon', (c) => _formula('=OR(REGEXMATCH($c, "^[a-z0-9_]+\$"), LEN($c) <= 16)')),
  ];
}

/// The `date` column: a real date, shown as YYYY-MM-DD in every locale, and a valid-date rule.
///
/// The rule also gives a date picker in Sheets. A cell has only one rule, so Sheets does not block a second row
/// for the same day: the app warns about it.
List<Request> _dateRules(int id) => [
  _dateFormat(id),
  _rule(_col(id, 0), BooleanCondition(type: 'DATE_IS_VALID')),
];

/// Formats `log!A2:A` as a date with the pattern YYYY-MM-DD. The header row stays text.
Request _dateFormat(int id) => Request(
  repeatCell: RepeatCellRequest(
    range: GridRange(sheetId: id, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1),
    cell: CellData(
      userEnteredFormat: CellFormat(
        numberFormat: NumberFormat(type: 'DATE', pattern: 'yyyy-mm-dd'),
      ),
    ),
    fields: 'userEnteredFormat.numberFormat',
  ),
);

/// The rule for a metric column: a `yes` / `no` dropdown for yesno, a number for number metrics.
///
/// [SheetsStore.refreshRules] sets it again each time the app opens the sheet, so it follows kind changes.
Request _valueRule(int id, int column, Metric metric) => _rule(
  _col(id, column),
  switch (metric) {
    YesNoMetric() => _oneOf(['yes', 'no']),
    NumberMetric() => _formula('=ISNUMBER(${columnLetter(column)}2)'),
  },
);
