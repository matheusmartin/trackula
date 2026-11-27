// The store of a Trackula spreadsheet in Google Sheets. See docs/data-model.md.
import { deletedMetrics } from '../model/DeletedMetric.js';
import { AppendRow, SetCell } from '../model/LogEntry.js';
import { NumberMetric, YesNoMetric } from '../model/Metric.js';
import { AddMetricsColumns, DeleteMetricRow, MoveMetricRow, SetMetricCells } from '../model/MetricsWrite.js';
import {
  HeaderException,
  LOG_TITLE,
  METRICS_TITLE,
  cellText,
  columnLetter,
  legacyYesNoCells,
  metricsHeader,
  parseLog,
  parseMetrics,
  textDateRows,
} from '../model/Parse.js';
import { SCORE_HEADER, scoreColumn, staleScoreCells } from '../model/Score.js';
import { SheetsApiException } from './SheetsClient.js';
import { Snapshot, Store } from './Store.js';

/** @import { LogWrite } from '../model/LogEntry.js' */
/** @import { Metric } from '../model/Metric.js' */
/** @import { MetricsWrite } from '../model/MetricsWrite.js' */
/** @import { Cell, LegacyCell, TextDateRow } from '../model/Parse.js' */
/** @import { ScoreCell } from '../model/Score.js' */
/** @import { JsonObject, SheetsClient } from './SheetsClient.js' */

/**
 * Rows for a new `Metrics` tab. Edit or delete them in the sheet.
 * @type {Cell[][]}
 */
const exampleMetrics = [
  ['weight', 'Weight', 'number', 'kg', 0.1, 'body', 'monitor_weight', 'at most 80 from 85 trend'],
  ['meditate', 'Meditate', 'yesno', '', '', 'habits', 'self_improvement', 'yes'],
  ['water', 'Water', 'count', 'glasses', 1, 'habits', 'water_drop', 'at least 8'],
];

/** A number in {@link goalRulePattern}: an optional minus sign, digits, and optional decimals after a period. */
const GOAL_RULE_NUMBER = '-?[0-9]+([.][0-9]+)?';

/**
 * The text of a valid goal in the Sheets rule of the `goal` column, in lowercase: `yes` or `no` for yesno metrics. For
 * number and count metrics: an optional direction, the target, an optional start after `from`, and an optional
 * `trend`. Example: `at most 80 from 83 trend`. It accepts the same goals as the parser, but it does not compare the
 * goal with the kind, or the start with the target.
 */
export const goalRulePattern =
  `^ *(yes|no|(at +least|at +most|<=|>=)? *${GOAL_RULE_NUMBER}` + `( +from +${GOAL_RULE_NUMBER})?( +trend)?) *$`;

/**
 * A tab of the spreadsheet: its ID in the Sheets API, and its number of columns and rows.
 * @typedef {object} Tab
 * @property {number} tabId
 * @property {number} columnCount
 * @property {number} rowCount
 */

/** The store of a Trackula spreadsheet in Google Sheets. See docs/data-model.md. */
export class SheetsStore extends Store {
  /** @type {SheetsClient} */
  #api;

  /**
   * True until {@link SheetsStore#load} tried once to change text dates to real dates. Once is enough: the parser reads
   * both.
   */
  #mayHaveTextDates = true;

  /** @param {SheetsClient} api */
  constructor(api) {
    super();
    this.#api = api;
  }

  /** @returns {string} The ID of the spreadsheet. */
  get spreadsheetId() {
    return this.#api.spreadsheetId;
  }

  /**
   * Adds the `Metrics` and `Log` tabs to the spreadsheet if they are missing.
   *
   * A new `Metrics` tab gets its header, the example metrics and data validation. A new `Log` tab gets the `date`
   * column. {@link SheetsStore#load} adds the metric columns. Existing tabs and other tabs do not change.
   * @returns {Promise<void>}
   */
  async ensureTabs() {
    const tabs = await this.#tabs();
    const missing = [METRICS_TITLE, LOG_TITLE].filter((title) => !tabs.has(title));
    if (missing.length === 0) return;
    const newTabIds = await this.#addTabs(missing);
    await this.#writeHeaders(new Set(newTabIds.keys()));
    const metricsTabId = newTabIds.get(METRICS_TITLE);
    const logTabId = newTabIds.get(LOG_TITLE);
    await this.#api.batchUpdate([
      ...(metricsTabId === undefined ? [] : metricsRules(metricsTabId, metricsHeader)),
      ...(logTabId === undefined ? [] : dateRules(logTabId)),
    ]);
  }

  /**
   * Adds a tab with a frozen header row for each of `titles`.
   * @param {string[]} titles
   * @returns {Promise<Map<string, number>>} The ID of each new tab, by title.
   */
  async #addTabs(titles) {
    const response = await this.#api.batchUpdate(
      titles.map((title) => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } })),
    );
    return new Map(
      /** @type {JsonObject[]} */ (response.replies).map((reply) => {
        const properties = reply.addSheet.properties;
        return [String(properties.title), Number(properties.sheetId)];
      }),
    );
  }

  /**
   * Writes the first rows of the new tabs `titles`: the header and the example metrics of `Metrics`, and the `date`
   * header of `Log`.
   * @param {Set<string>} titles
   * @returns {Promise<void>}
   */
  #writeHeaders(titles) {
    return this.#api.batchUpdateValues('RAW', [
      ...(titles.has(METRICS_TITLE)
        ? [{ range: `${METRICS_TITLE}!A1`, values: [metricsHeader, ...exampleMetrics] }]
        : []),
      ...(titles.has(LOG_TITLE) ? [{ range: `${LOG_TITLE}!A1`, values: [['date']] }] : []),
    ]);
  }

  /**
   * Sets the data validation rules of both tabs again, from the current headers and metric kinds. So sheets made by an
   * older app version accept new values, for example kind `count` or `yes`, and new columns get their rule.
   *
   * - `Metrics`: the rules go to the columns with the matching header names, so moved columns keep their rules. First
   *   it removes all validation rules below row 1, so a moved column leaves no old rule behind.
   * - `Log`: the date column gets its date format and rule. Each metric column gets the rule of its metric kind, so a
   *   kind change also changes the rule.
   *
   * It changes only validation rules, not data.
   * @returns {Promise<void>}
   */
  async refreshRules() {
    const tabs = await this.#tabs();
    const metricsTab = tabs.get(METRICS_TITLE);
    if (metricsTab === undefined) return;
    const logTab = tabs.get(LOG_TITLE);
    const ranges = await this.#api.batchGet(
      logTab === undefined ? [METRICS_TITLE] : [METRICS_TITLE, `${LOG_TITLE}!1:1`],
    );
    const metricRows = ranges[0];
    const logHeader = logTab === undefined ? [] : (ranges[1][0] ?? []);
    const header = (metricRows[0] ?? []).map((cell) => cellText(cell).trim().toLowerCase());
    await this.#api.batchUpdate([
      clearRules(metricsTab.tabId),
      ...metricsRules(metricsTab.tabId, header),
      ...(logTab === undefined
        ? []
        : [...dateRules(logTab.tabId), ...logValueRules(logTab.tabId, logHeader, metricsById(metricRows))]),
    ]);
  }

  /**
   * Reads both tabs and validates each row.
   *
   * Before it parses the `Log` tab, it brings the tab up to date (see `#migrate`). With
   * `writesScores`, it also writes the scores that changed (see `staleScoreCells` in `Score.js`). So each load after a
   * change in the app or in the sheet, for example a new goal, also updates the scores. {@link Store#changeAll} writes
   * them after its last write.
   *
   * It writes the scores at most once, so a score that does not stay in the sheet cannot cause a loop.
   * @param {boolean} [writesScores] True by default.
   * @returns {Promise<Snapshot>}
   */
  async load(writesScores = true) {
    const [metricRows, logRows] = await this.#api.batchGet([METRICS_TITLE, LOG_TITLE]);
    const metrics = parseMetrics(metricRows);
    const byId = new Map(metrics.items.map((m) => [m.id, m]));
    if (await this.#migrate(logRows, byId)) return this.load(writesScores);
    /** @type {string[]} */
    const scoreWarnings = [];
    if (writesScores && (await this.#writeScores(logRows, metrics.items, scoreWarnings))) return this.load(false);
    const log = parseLog(logRows, byId);
    const warnings = [...metrics.warnings, ...log.warnings, ...scoreWarnings];
    const ids = new Set([...byId.keys(), ...metrics.invalid.map((row) => row.id)]);
    return new Snapshot({ metricsTable: metrics, log: log.table, warnings, deleted: deletedMetrics(logRows, ids) });
  }

  /**
   * Writes the score cells of `logRows` that do not show the score of their row. Returns true after a write: then
   * read the data again. `#migrate` adds the score column before.
   *
   * The score comes from the other values, so a failed write does not stop the load. Examples: a view-only sheet, or
   * the request limit of the Sheets API. Then it adds a warning to `warnings` and returns false. The next load tries
   * again.
   * @param {Cell[][]} logRows
   * @param {Metric[]} metrics
   * @param {string[]} warnings
   * @returns {Promise<boolean>}
   */
  async #writeScores(logRows, metrics, warnings) {
    const column = scoreColumn(logRows[0] ?? []);
    if (column === null) return false;
    const cells = staleScoreCells(logRows, metrics, column);
    if (cells.length === 0) return false;
    try {
      await this.#writeScoreCells(cells, column);
      return true;
    } catch (e) {
      if (!(e instanceof SheetsApiException)) throw e;
      warnings.push(`The app could not write ${cells.length} scores in the "${SCORE_HEADER}" column: ${e.message}`);
      return false;
    }
  }

  /**
   * Writes the new score of each of `cells` in the score `column`. An empty string clears a cell.
   * @param {ScoreCell[]} cells
   * @param {number} column
   * @returns {Promise<void>}
   */
  #writeScoreCells(cells, column) {
    return this.#api.batchUpdateValues(
      'RAW',
      cells.map((c) => ({ range: cell(c.row, column), values: [[c.score ?? '']] })),
    );
  }

  /**
   * Makes one change to bring the `Log` tab up to date, if it needs one. Returns true after a change: then read the
   * data again.
   *
   * The changes, in this order: add a column for each metric without one and the score column, change text dates to
   * real dates (see `textDateRows` in `Parse.js`), and change yesno values of old app versions to `yes` or `no` (see
   * `legacyYesNoCells` in `Parse.js`).
   * @param {Cell[][]} logRows
   * @param {Map<string, Metric>} metrics
   * @returns {Promise<boolean>}
   */
  async #migrate(logRows, metrics) {
    const header = logRows[0] ?? [];
    const present = new Set(header.map((c) => cellText(c).trim()));
    const missing = [...metrics.keys(), SCORE_HEADER].filter((name) => !present.has(name));
    if (missing.length > 0) {
      await this.#addColumns(missing, header.length, metrics);
      return true;
    }
    const textDates = this.#mayHaveTextDates ? textDateRows(logRows) : [];
    if (textDates.length > 0) {
      this.#mayHaveTextDates = false;
      await this.#writeRealDates(textDates);
      return true;
    }
    const legacy = legacyYesNoCells(logRows, metrics);
    if (legacy.length > 0) {
      await this.#writeYesNo(legacy);
      return true;
    }
    return false;
  }

  /**
   * Writes each date of `rows` again as a real date, with the date format.
   * @param {TextDateRow[]} rows
   * @returns {Promise<void>}
   */
  async #writeRealDates(rows) {
    const logTab = getValue(await this.#tabs(), LOG_TITLE);
    await this.#api.batchUpdate([dateFormat(logTab.tabId)]);
    // USER_ENTERED: Sheets reads the YYYY-MM-DD text as a real date, as when you type it.
    await this.#api.batchUpdateValues(
      'USER_ENTERED',
      rows.map((r) => ({ range: `${LOG_TITLE}!A${r.row}`, values: [[r.date.toString()]] })),
    );
  }

  /**
   * Writes the new `yes` or `no` value of each of `cells`.
   * @param {LegacyCell[]} cells
   * @returns {Promise<void>}
   */
  #writeYesNo(cells) {
    return this.#api.batchUpdateValues(
      'RAW',
      cells.map((c) => ({ range: cell(c.row, c.column), values: [[c.value]] })),
    );
  }

  /**
   * Writes `write` to the `Log` tab.
   * @param {LogWrite} write
   * @returns {Promise<void>}
   */
  async apply(write) {
    if (write instanceof AppendRow) {
      // USER_ENTERED: Sheets reads the YYYY-MM-DD text as a real date, as when you type it.
      // The other cells are numbers, or `yes` and `no`, which stay as they are.
      await this.#api.append(`${LOG_TITLE}!A1`, [write.toCells()], 'USER_ENTERED');
    } else if (write instanceof SetCell) {
      if (write.value === null) {
        await this.#api.clear(cell(write.row, write.column));
      } else {
        await this.#api.update(cell(write.row, write.column), [[write.value]], 'RAW');
      }
    }
  }

  /**
   * Writes `write` to the `Metrics` tab. A cell write uses `RAW`, so that a text such as `=1+1` or `08` stays as it
   * is. A write after the last row or column of the tab first adds rows or columns to it.
   * @param {MetricsWrite} write
   * @returns {Promise<void>}
   */
  async applyMetrics(write) {
    const tab = getValue(await this.#tabs(), METRICS_TITLE);
    if (write instanceof SetMetricCells) {
      const needed = write.row - tab.rowCount;
      if (needed > 0) await this.#api.batchUpdate([appendDimension(tab, 'ROWS', needed)]);
      await this.#api.batchUpdateValues(
        'RAW',
        [...write.cells].map(([c, value]) => ({ range: metricsCell(write.row, c), values: [[value]] })),
      );
    } else if (write instanceof AddMetricsColumns) {
      const needed = write.start + write.names.length - tab.columnCount;
      if (needed > 0) await this.#api.batchUpdate([appendDimension(tab, 'COLUMNS', needed)]);
      await this.#api.update(metricsCell(1, write.start), [write.names], 'RAW');
    } else if (write instanceof DeleteMetricRow) {
      await this.#api.batchUpdate([{ deleteDimension: { range: rowRange(tab, write.row) } }]);
    } else if (write instanceof MoveMetricRow) {
      await this.#api.batchUpdate([
        { moveDimension: { source: rowRange(tab, write.row), destinationIndex: write.before - 1 } },
      ]);
    }
  }

  /**
   * Adds a column with each of `headers` and its validation rule, after `width` columns. A header is a metric id of
   * `metrics`, or `SCORE_HEADER`.
   * @param {string[]} headers
   * @param {number} width
   * @param {Map<string, Metric>} metrics
   * @returns {Promise<void>}
   */
  async #addColumns(headers, width, metrics) {
    const logTab = getValue(await this.#tabs(), LOG_TITLE);
    // Column A is always `date`, even if the header row is empty.
    const start = width === 0 ? 1 : width;
    const needed = start + headers.length - logTab.columnCount;
    /** @type {JsonObject[]} */
    const requests = [];
    if (needed > 0) {
      requests.push({ appendDimension: { sheetId: logTab.tabId, dimension: 'COLUMNS', length: needed } });
    }
    headers.forEach((header, i) => {
      const rule = logColumnRule(logTab.tabId, start + i, header, metrics);
      if (rule !== null) requests.push(rule);
    });
    await this.#api.batchUpdate(requests);
    await this.#api.update(
      `${LOG_TITLE}!${columnLetter(width === 0 ? 0 : start)}1`,
      [[...(width === 0 ? ['date'] : []), ...headers]],
      'RAW',
    );
  }

  /**
   * The tabs of the spreadsheet, by title.
   * @returns {Promise<Map<string, Tab>>}
   */
  async #tabs() {
    const spreadsheet = await this.#api.get('sheets.properties(sheetId,title,gridProperties(columnCount,rowCount))');
    return new Map(
      /** @type {JsonObject[]} */ (spreadsheet.sheets ?? []).map((tab) => {
        const properties = tab.properties;
        const grid = properties.gridProperties;
        return [
          String(properties.title),
          {
            tabId: Number(properties.sheetId),
            columnCount: Number(grid.columnCount),
            rowCount: Number(grid.rowCount),
          },
        ];
      }),
    );
  }
}

/**
 * The value of `key` in `map`. Throws an error if `map` has no such key.
 * @template V
 * @param {Map<string, V>} map
 * @param {string} key
 * @returns {V}
 */
function getValue(map, key) {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Key ${key} is missing in the map.`);
  return value;
}

/**
 * The valid metrics of `metricRows`, by id. Empty if the `Metrics` tab has no complete header: then
 * {@link SheetsStore#load} shows the error, and the `Log` rules wait until the tab is valid.
 * @param {Cell[][]} metricRows
 * @returns {Map<string, Metric>}
 */
function metricsById(metricRows) {
  try {
    return new Map(parseMetrics(metricRows).items.map((m) => [m.id, m]));
  } catch (e) {
    if (!(e instanceof HeaderException)) throw e;
    return new Map();
  }
}

/**
 * The A1 notation of a `Log` cell.
 * @param {number} row 1-based.
 * @param {number} column 0-based.
 * @returns {string}
 */
function cell(row, column) {
  return `${LOG_TITLE}!${columnLetter(column)}${row}`;
}

/**
 * The A1 notation of a `Metrics` cell.
 * @param {number} row 1-based.
 * @param {number} column 0-based.
 * @returns {string}
 */
function metricsCell(row, column) {
  return `${METRICS_TITLE}!${columnLetter(column)}${row}`;
}

/**
 * Adds `length` rows or columns (`dimension`) at the end of `tab`.
 * @param {Tab} tab
 * @param {string} dimension `ROWS` or `COLUMNS`.
 * @param {number} length
 * @returns {JsonObject}
 */
function appendDimension(tab, dimension, length) {
  return { appendDimension: { sheetId: tab.tabId, dimension, length } };
}

/**
 * The 1-based `row` of `tab`, as a range of the Sheets API.
 * @param {Tab} tab
 * @param {number} row
 * @returns {JsonObject}
 */
function rowRange(tab, row) {
  return { sheetId: tab.tabId, dimension: 'ROWS', startIndex: row - 1, endIndex: row };
}

// Data validation rules. See "Layer 2" in docs/data-model.md. The Sheets API calls a tab ID `sheetId`.

/**
 * The cells of `column` of the tab `tabId`, below the header row.
 * @param {number} tabId
 * @param {number} column
 * @returns {JsonObject}
 */
function columnRange(tabId, column) {
  return { sheetId: tabId, startRowIndex: 1, startColumnIndex: column, endColumnIndex: column + 1 };
}

/**
 * Removes all validation rules of the tab `tabId` below the header row.
 * @param {number} tabId
 * @returns {JsonObject}
 */
function clearRules(tabId) {
  return { setDataValidation: { range: { sheetId: tabId, startRowIndex: 1 } } };
}

/**
 * @param {JsonObject} range
 * @param {JsonObject} condition
 * @returns {JsonObject}
 */
function rule(range, condition) {
  return { setDataValidation: { range, rule: { condition, strict: true, showCustomUi: true } } };
}

/**
 * @param {string} type
 * @param {string[]} values
 * @returns {JsonObject}
 */
function condition(type, values) {
  return { type, values: values.map((value) => ({ userEnteredValue: value })) };
}

/**
 * @param {string} text
 * @returns {JsonObject}
 */
function formula(text) {
  return condition('CUSTOM_FORMULA', [text]);
}

/**
 * @param {string[]} items
 * @returns {JsonObject}
 */
function oneOf(items) {
  return condition('ONE_OF_LIST', items);
}

/**
 * The rules of the `Metrics` tab `tabId`. A missing column gets no rule.
 * @param {number} tabId
 * @param {string[]} header The lowercase header names.
 * @returns {JsonObject[]}
 */
function metricsRules(tabId, header) {
  /**
   * The rule of the column `name`, with the condition for its first cell below the header. Null if the column is
   * missing.
   * @param {string} name
   * @param {(cell: string) => JsonObject} conditionOf
   * @returns {JsonObject | null}
   */
  const at = (name, conditionOf) => {
    const i = header.indexOf(name);
    return i < 0 ? null : rule(columnRange(tabId, i), conditionOf(`${columnLetter(i)}2`));
  };

  return [
    at('kind', () => oneOf(['yesno', 'number', 'count'])),
    // A Material Symbols name, or a short text such as an emoji. Some emojis have up to 11 characters in Sheets.
    at('icon', (c) => formula(`=OR(REGEXMATCH(${c}, "^[a-z0-9_]+$"), LEN(${c}) <= 16)`)),
    at('goal', (c) => formula(`=OR(ISNUMBER(${c}), REGEXMATCH(LOWER(TO_TEXT(${c})), "${goalRulePattern}"))`)),
  ].filter((r) => r !== null);
}

/**
 * The `date` column of the `Log` tab `tabId`: a real date, shown as YYYY-MM-DD in every locale, and a valid-date
 * rule.
 *
 * The rule also gives a date picker in Sheets. A cell has only one rule, so Sheets does not block a second row for the
 * same day: the app warns about it.
 * @param {number} tabId
 * @returns {JsonObject[]}
 */
function dateRules(tabId) {
  return [dateFormat(tabId), rule(columnRange(tabId, 0), { type: 'DATE_IS_VALID' })];
}

/**
 * Formats `Log!A2:A` of the tab `tabId` as a date with the pattern YYYY-MM-DD. The header row stays text.
 * @param {number} tabId
 * @returns {JsonObject}
 */
function dateFormat(tabId) {
  return {
    repeatCell: {
      range: columnRange(tabId, 0),
      cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' } } },
      fields: 'userEnteredFormat.numberFormat',
    },
  };
}

/**
 * The rules of the metric columns and of the score column of the `Log` tab `tabId`, from its `header`. Other columns
 * get no rule.
 * @param {number} tabId
 * @param {Cell[]} header
 * @param {Map<string, Metric>} metrics
 * @returns {JsonObject[]}
 */
function logValueRules(tabId, header, metrics) {
  /** @type {JsonObject[]} */
  const rules = [];
  for (let c = 1; c < header.length; c++) {
    const r = logColumnRule(tabId, c, cellText(header[c]).trim(), metrics);
    if (r !== null) rules.push(r);
  }
  return rules;
}

/**
 * The rule for the `Log` column `column` with `header`: a `yes` / `no` dropdown for yesno, a number for number metrics
 * and for the score. Null for other columns, for example of a deleted metric.
 *
 * {@link SheetsStore#refreshRules} sets it again each time the app opens the sheet, so it follows kind changes.
 * @param {number} tabId
 * @param {number} column
 * @param {string} header
 * @param {Map<string, Metric>} metrics
 * @returns {JsonObject | null}
 */
function logColumnRule(tabId, column, header, metrics) {
  const isNumber = formula(`=ISNUMBER(${columnLetter(column)}2)`);
  const metric = metrics.get(header);
  let ruleCondition = null;
  if (metric instanceof YesNoMetric) ruleCondition = oneOf(['yes', 'no']);
  else if (metric instanceof NumberMetric) ruleCondition = isNumber;
  else if (header === SCORE_HEADER) ruleCondition = isNumber;
  return ruleCondition === null ? null : rule(columnRange(tabId, column), ruleCondition);
}
