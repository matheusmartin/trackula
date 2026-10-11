import 'package:googleapis/sheets/v4.dart';

import '../model/day.dart';
import '../model/log_entry.dart';
import '../model/metric.dart';
import '../model/parse.dart';
import '../model/score.dart';
import 'store.dart';

export 'store.dart';

/// Rows for a new `Metrics` tab. Edit or delete them in the sheet.
const _exampleMetrics = [
  ['weight', 'Weight', 'number', 'kg', 0.1, 'body', 'monitor_weight', '<= 80'],
  ['meditate', 'Meditate', 'yesno', '', '', 'habits', 'self_improvement', 'yes'],
  ['water', 'Water', 'count', 'glasses', 1, 'habits', 'water_drop', 8],
];

/// A tab of the spreadsheet: its ID in the Sheets API, and its number of columns.
typedef _Tab = ({int tabId, int columnCount});

/// The store of a Trackula spreadsheet in Google Sheets. See docs/data-model.md.
final class SheetsStore extends Store {
  SheetsStore(this._api, this.spreadsheetId);

  final SheetsApi _api;
  final String spreadsheetId;

  /// True until [load] tried once to change text dates to real dates. Once is enough: the parser reads both.
  bool _mayHaveTextDates = true;

  /// Adds the `Metrics` and `Log` tabs to the spreadsheet if they are missing.
  ///
  /// A new `Metrics` tab gets its header, the example metrics and data validation. A new `Log` tab gets the `date`
  /// column. [load] adds the metric columns. Existing tabs and other tabs do not change.
  Future<void> ensureTabs() async {
    final tabs = await _tabs();
    final missing = [
      for (final title in [metricsTitle, logTitle])
        if (!tabs.containsKey(title)) title,
    ];
    if (missing.isEmpty) return;
    final newTabIds = await _addTabs(missing);
    await _writeHeaders(newTabIds.keys);
    await _batchUpdate([
      if (newTabIds[metricsTitle] case final tabId?) ..._metricsRules(tabId, metricsHeader),
      if (newTabIds[logTitle] case final tabId?) ..._dateRules(tabId),
    ]);
  }

  /// Adds a tab with a frozen header row for each of [titles]. Returns the ID of each new tab, by title.
  Future<Map<String, int>> _addTabs(List<String> titles) async {
    final response = await _api.spreadsheets.batchUpdate(
      BatchUpdateSpreadsheetRequest(
        requests: [
          for (final title in titles)
            Request(
              addSheet: AddSheetRequest(
                properties: SheetProperties(title: title, gridProperties: GridProperties(frozenRowCount: 1)),
              ),
            ),
        ],
      ),
      spreadsheetId,
    );
    return {
      for (final reply in response.replies!) reply.addSheet!.properties!.title!: reply.addSheet!.properties!.sheetId!,
    };
  }

  /// Writes the first rows of the new tabs [titles]: the header and the example metrics of `Metrics`, and the
  /// `date` header of `Log`.
  Future<void> _writeHeaders(Iterable<String> titles) => _api.spreadsheets.values.batchUpdate(
    BatchUpdateValuesRequest(
      valueInputOption: 'RAW',
      data: [
        if (titles.contains(metricsTitle))
          ValueRange(
            range: '$metricsTitle!A1',
            values: [
              metricsHeader,
              ..._exampleMetrics,
            ],
          ),
        if (titles.contains(logTitle))
          ValueRange(
            range: '$logTitle!A1',
            values: [
              ['date'],
            ],
          ),
      ],
    ),
    spreadsheetId,
  );

  /// Sets the data validation rules of both tabs again, from the current headers and metric kinds. So sheets made
  /// by an older app version accept new values, for example kind `count` or `yes`, and new columns get their rule.
  ///
  /// - `Metrics`: the rules go to the columns with the matching header names, so moved columns keep their rules.
  ///   First it removes all validation rules below row 1, so a moved column leaves no old rule behind.
  /// - `Log`: the date column gets its date format and rule. Each metric column gets the rule of its metric kind,
  ///   so a kind change also changes the rule.
  ///
  /// It changes only validation rules, not data.
  @override
  Future<void> refreshRules() async {
    final tabs = await _tabs();
    final metricsTab = tabs[metricsTitle];
    if (metricsTab == null) return;
    final logTab = tabs[logTitle];
    final (:metricRows, :logHeader) = await _readHeaders(withLog: logTab != null);
    final header = [for (final c in metricRows.firstOrNull ?? const <Object?>[]) '$c'.trim().toLowerCase()];
    await _batchUpdate([
      _clearRules(metricsTab.tabId),
      ..._metricsRules(metricsTab.tabId, header),
      if (logTab != null) ..._dateRules(logTab.tabId),
      if (logTab != null) ..._logValueRules(logTab.tabId, logHeader, _metricsById(metricRows)),
    ]);
  }

  /// The rows of the `Metrics` tab, and the header row of the `Log` tab if [withLog].
  Future<({List<List<Object?>> metricRows, List<Object?> logHeader})> _readHeaders({required bool withLog}) async {
    final response = await _api.spreadsheets.values.batchGet(
      spreadsheetId,
      ranges: [metricsTitle, if (withLog) '$logTitle!1:1'],
      valueRenderOption: 'UNFORMATTED_VALUE',
    );
    return (
      metricRows: response.valueRanges![0].values ?? const <List<Object?>>[],
      logHeader: withLog ? response.valueRanges![1].values?.firstOrNull ?? const <Object?>[] : const <Object?>[],
    );
  }

  /// The valid metrics of [metricRows], by id. Empty if the `Metrics` tab has no complete header: then [load] shows
  /// the error, and the `Log` rules wait until the tab is valid.
  static Map<String, Metric> _metricsById(List<List<Object?>> metricRows) {
    try {
      return {for (final m in parseMetrics(metricRows).items) m.id: m};
    } on HeaderException {
      return const {};
    }
  }

  /// Reads both tabs and validates each row.
  ///
  /// Before it parses the `Log` tab, it brings the tab up to date (see [_migrate]). With [writesScores], it also
  /// writes the scores that changed (see [staleScoreCells]). So each load after a change in the app or in the sheet,
  /// for example a new goal, also updates the scores. [Store.changeAll] writes them after its last write.
  @override
  Future<Snapshot> load({bool writesScores = true}) => _load(writesScores: writesScores);

  /// [load]. It writes the scores at most once, so a score that does not stay in the sheet cannot cause a loop.
  Future<Snapshot> _load({required bool writesScores}) async {
    final (metricRows, logRows) = await _read();
    final metrics = parseMetrics(metricRows);
    final byId = {for (final m in metrics.items) m.id: m};
    if (await _migrate(logRows, byId)) return _load(writesScores: writesScores);
    final scoreWarnings = <String>[];
    if (writesScores && await _writeScores(logRows, metrics.items, scoreWarnings)) return _load(writesScores: false);
    final log = parseLog(logRows, byId);
    return Snapshot(metrics.items, log.table, [...metrics.warnings, ...log.warnings, ...scoreWarnings]);
  }

  /// Writes the score cells of [logRows] that do not show the score of their row. Returns true after a write: then
  /// read the data again. [_migrate] adds the score column before.
  ///
  /// The score comes from the other values, so a failed write does not stop the load. Examples: a view-only sheet, or
  /// the request limit of the Sheets API. Then it adds a warning to [warnings] and returns false. The next load tries
  /// again.
  Future<bool> _writeScores(List<List<Object?>> logRows, List<Metric> metrics, List<String> warnings) async {
    final column = scoreColumn(logRows.firstOrNull ?? const <Object?>[]);
    if (column == null) return false;
    final cells = staleScoreCells(logRows, metrics, column);
    if (cells.isEmpty) return false;
    try {
      await _writeScoreCells(cells, column);
      return true;
    } on ApiRequestError catch (e) {
      warnings.add('The app could not write ${cells.length} scores in the "$scoreHeader" column: ${e.message}');
      return false;
    }
  }

  /// Writes the new score of each of [cells] in the score [column].
  Future<void> _writeScoreCells(List<ScoreCell> cells, int column) async {
    await _api.spreadsheets.values.batchUpdate(
      BatchUpdateValuesRequest(
        valueInputOption: 'RAW',
        data: [
          for (final c in cells)
            ValueRange(
              range: _cell(c.row, column),
              values: [
                // An empty string clears the cell.
                [c.score ?? ''],
              ],
            ),
        ],
      ),
      spreadsheetId,
    );
  }

  /// Makes one change to bring the `Log` tab up to date, if it needs one. Returns true after a change: then read the
  /// data again.
  ///
  /// The changes, in this order: add a column for each metric without one and the score column, change text dates to
  /// real dates (see [textDateRows]), and change yesno values of old app versions to `yes` or `no` (see
  /// [legacyYesNoCells]).
  Future<bool> _migrate(List<List<Object?>> logRows, Map<String, Metric> metrics) async {
    final header = logRows.firstOrNull ?? const <Object?>[];
    final present = {for (final c in header) '${c ?? ''}'.trim()};
    final missing = [
      for (final id in [...metrics.keys, scoreHeader])
        if (!present.contains(id)) id,
    ];
    if (missing.isNotEmpty) {
      await _addColumns(missing, header.length, metrics);
      return true;
    }
    final textDates = _mayHaveTextDates ? textDateRows(logRows) : const <({int row, Day date})>[];
    if (textDates.isNotEmpty) {
      _mayHaveTextDates = false;
      await _writeRealDates(textDates);
      return true;
    }
    final legacy = legacyYesNoCells(logRows, metrics);
    if (legacy.isNotEmpty) {
      await _writeYesNo(legacy);
      return true;
    }
    return false;
  }

  /// Writes each date of [rows] again as a real date, with the date format.
  Future<void> _writeRealDates(List<({int row, Day date})> rows) async {
    final logTab = (await _tabs())[logTitle]!;
    await _batchUpdate([_dateFormat(logTab.tabId)]);
    // USER_ENTERED: Sheets reads the YYYY-MM-DD text as a real date, as when you type it.
    await _api.spreadsheets.values.batchUpdate(
      BatchUpdateValuesRequest(
        valueInputOption: 'USER_ENTERED',
        data: [
          for (final r in rows)
            ValueRange(
              range: '$logTitle!A${r.row}',
              values: [
                [r.date.toString()],
              ],
            ),
        ],
      ),
      spreadsheetId,
    );
  }

  /// Writes the new `yes` or `no` value of each of [cells].
  Future<void> _writeYesNo(List<({int row, int column, String value})> cells) => _api.spreadsheets.values.batchUpdate(
    BatchUpdateValuesRequest(
      valueInputOption: 'RAW',
      data: [
        for (final c in cells)
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

  /// The rows of the `Metrics` tab and of the `Log` tab, with their header rows.
  Future<(List<List<Object?>>, List<List<Object?>>)> _read() async {
    final response = await _api.spreadsheets.values.batchGet(
      spreadsheetId,
      ranges: [metricsTitle, logTitle],
      valueRenderOption: 'UNFORMATTED_VALUE',
    );
    return (
      response.valueRanges![0].values ?? const <List<Object?>>[],
      response.valueRanges![1].values ?? const <List<Object?>>[],
    );
  }

  @override
  Future<void> apply(LogWrite write) async {
    switch (write) {
      case AppendRow():
        await _api.spreadsheets.values.append(
          ValueRange(values: [write.toCells()]),
          spreadsheetId,
          '$logTitle!A1',
          // USER_ENTERED: Sheets reads the YYYY-MM-DD text as a real date, as when you type it.
          // The other cells are numbers, or `yes` and `no`, which stay as they are.
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
        );
      case SetCell(value: null):
        await _api.spreadsheets.values.clear(ClearValuesRequest(), spreadsheetId, _cell(write.row, write.column));
      case SetCell(:final value?):
        await _api.spreadsheets.values.update(
          ValueRange(
            values: [
              [value],
            ],
          ),
          spreadsheetId,
          _cell(write.row, write.column),
          valueInputOption: 'RAW',
        );
    }
  }

  /// Adds a column with each of [headers] and its validation rule, after [width] columns. A header is a metric id of
  /// [metrics], or [scoreHeader].
  Future<void> _addColumns(List<String> headers, int width, Map<String, Metric> metrics) async {
    final logTab = (await _tabs())[logTitle]!;
    // Column A is always `date`, even if the header row is empty.
    final start = width == 0 ? 1 : width;
    final needed = start + headers.length - logTab.columnCount;
    await _batchUpdate([
      if (needed > 0)
        Request(
          appendDimension: AppendDimensionRequest(sheetId: logTab.tabId, dimension: 'COLUMNS', length: needed),
        ),
      for (final (i, header) in headers.indexed) ?_logColumnRule(logTab.tabId, start + i, header, metrics),
    ]);
    await _api.spreadsheets.values.update(
      ValueRange(
        values: [
          [if (width == 0) 'date', ...headers],
        ],
      ),
      spreadsheetId,
      '$logTitle!${columnLetter(width == 0 ? 0 : start)}1',
      valueInputOption: 'RAW',
    );
  }

  /// Sends [requests] in one batch.
  Future<void> _batchUpdate(List<Request> requests) =>
      _api.spreadsheets.batchUpdate(BatchUpdateSpreadsheetRequest(requests: requests), spreadsheetId);

  /// The A1 notation of a `Log` cell. [row] is 1-based, [column] 0-based.
  static String _cell(int row, int column) => '$logTitle!${columnLetter(column)}$row';

  /// The tabs of the spreadsheet, by title.
  Future<Map<String, _Tab>> _tabs() async {
    final spreadsheet = await _api.spreadsheets.get(
      spreadsheetId,
      $fields: 'sheets.properties(sheetId,title,gridProperties.columnCount)',
    );
    return {
      for (final tab in spreadsheet.sheets ?? const <Sheet>[])
        tab.properties!.title!: (
          tabId: tab.properties!.sheetId!,
          columnCount: tab.properties!.gridProperties!.columnCount!,
        ),
    };
  }
}

// Data validation rules. See "Layer 2" in docs/data-model.md. The Sheets API calls a tab ID `sheetId`.

/// The cells of [column] of the tab [tabId], below the header row.
GridRange _columnRange(int tabId, int column) =>
    GridRange(sheetId: tabId, startRowIndex: 1, startColumnIndex: column, endColumnIndex: column + 1);

/// Removes all validation rules of the tab [tabId] below the header row.
Request _clearRules(int tabId) => Request(
  setDataValidation: SetDataValidationRequest(range: GridRange(sheetId: tabId, startRowIndex: 1)),
);

Request _rule(GridRange range, BooleanCondition condition) => Request(
  setDataValidation: SetDataValidationRequest(
    range: range,
    rule: DataValidationRule(condition: condition, strict: true, showCustomUi: true),
  ),
);

BooleanCondition _formula(String formula) => BooleanCondition(
  type: 'CUSTOM_FORMULA',
  values: [ConditionValue(userEnteredValue: formula)],
);

BooleanCondition _oneOf(List<String> items) => BooleanCondition(
  type: 'ONE_OF_LIST',
  values: [for (final item in items) ConditionValue(userEnteredValue: item)],
);

/// The rules of the `Metrics` tab [tabId]. [header] holds the lowercase header names. A missing column gets no rule.
List<Request> _metricsRules(int tabId, List<String> header) {
  Request? at(String name, BooleanCondition Function(String cell) condition) {
    final i = header.indexOf(name);
    return i < 0 ? null : _rule(_columnRange(tabId, i), condition('${columnLetter(i)}2'));
  }

  return [
    ?at('kind', (_) => _oneOf(['yesno', 'number', 'count'])),
    // A Material Symbols name, or a short text such as an emoji. Some emojis have up to 11 characters in Sheets.
    ?at('icon', (c) => _formula('=OR(REGEXMATCH($c, "^[a-z0-9_]+\$"), LEN($c) <= 16)')),
    // `yes` or `no` for yesno metrics. A number, or a number after `<=` or `>=`, for number and count metrics.
    ?at(
      'goal',
      (c) => _formula(
        '=OR(ISNUMBER($c), REGEXMATCH(LOWER(TO_TEXT($c)), "^ *(yes|no|(<=|>=)? *-?[0-9]+([.][0-9]+)?) *\$"))',
      ),
    ),
  ];
}

/// The `date` column of the `Log` tab [tabId]: a real date, shown as YYYY-MM-DD in every locale, and a valid-date
/// rule.
///
/// The rule also gives a date picker in Sheets. A cell has only one rule, so Sheets does not block a second row
/// for the same day: the app warns about it.
List<Request> _dateRules(int tabId) => [
  _dateFormat(tabId),
  _rule(_columnRange(tabId, 0), BooleanCondition(type: 'DATE_IS_VALID')),
];

/// Formats `Log!A2:A` of the tab [tabId] as a date with the pattern YYYY-MM-DD. The header row stays text.
Request _dateFormat(int tabId) => Request(
  repeatCell: RepeatCellRequest(
    range: GridRange(sheetId: tabId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1),
    cell: CellData(
      userEnteredFormat: CellFormat(
        numberFormat: NumberFormat(type: 'DATE', pattern: 'yyyy-mm-dd'),
      ),
    ),
    fields: 'userEnteredFormat.numberFormat',
  ),
);

/// The rules of the metric columns and of the score column of the `Log` tab [tabId], from its [header]. Other columns
/// get no rule.
List<Request> _logValueRules(int tabId, List<Object?> header, Map<String, Metric> metrics) => [
  for (var c = 1; c < header.length; c++) ?_logColumnRule(tabId, c, '${header[c] ?? ''}'.trim(), metrics),
];

/// The rule for the `Log` column [column] with [header]: a `yes` / `no` dropdown for yesno, a number for number
/// metrics and for the score. Null for other columns, for example of a deleted metric.
///
/// [SheetsStore.refreshRules] sets it again each time the app opens the sheet, so it follows kind changes.
Request? _logColumnRule(int tabId, int column, String header, Map<String, Metric> metrics) {
  final isNumber = _formula('=ISNUMBER(${columnLetter(column)}2)');
  final condition = switch (metrics[header]) {
    YesNoMetric() => _oneOf(['yes', 'no']),
    NumberMetric() => isNumber,
    null when header == scoreHeader => isNumber,
    null => null,
  };
  return condition == null ? null : _rule(_columnRange(tabId, column), condition);
}
