// An in-memory spreadsheet behind a fake `fetch`, for the tests of SheetsStore.
import { Day } from '../../model/Day.js';
import { LOG_TITLE, METRICS_TITLE, columnLetter } from '../../model/Parse.js';
import { SheetsClient, cellOf } from '../SheetsClient.js';
import { SheetsStore } from '../SheetsStore.js';

/** @import { Cell } from '../../model/Parse.js' */
/** @import { JsonObject } from '../SheetsClient.js' */

/**
 * The fields of a {@link FakeSheets}.
 * @typedef {object} FakeSheetsFields
 * @property {Cell[][]} metrics The rows of the `Metrics` tab.
 * @property {Cell[][]} log The rows of the `Log` tab.
 * @property {number} logColumns The number of columns of the `Log` tab.
 * @property {Set<string>} [tabs] The titles of the tabs that the spreadsheet has. Both tabs by default.
 */

/** The ID of each tab in the Sheets API, by title. */
const tabIds = new Map([
  [METRICS_TITLE, 1],
  [LOG_TITLE, 2],
]);

/** The path of the spreadsheet, before the path of each call. */
const SPREADSHEET_PATH = '/v4/spreadsheets/sheet-id';

/**
 * An in-memory spreadsheet behind a fake `fetch`, for the calls of {@link SheetsStore}.
 *
 * It keeps the `Metrics` and `Log` tabs as rows of cells. It returns the values as the Sheets API does with
 * `UNFORMATTED_VALUE`: empty cells at the end of a row and empty rows at the end are not in the response.
 */
export class FakeSheets {
  /** @param {FakeSheetsFields} fields */
  constructor({ metrics, log, logColumns, tabs = new Set([METRICS_TITLE, LOG_TITLE]) }) {
    this.metrics = metrics;
    this.log = log;
    /** The titles of the tabs that the spreadsheet has. `addSheet` adds a title. */
    this.tabs = tabs;
    /** The number of columns of each tab. `appendDimension` adds columns. */
    this.columnCounts = new Map([
      [METRICS_TITLE, 26],
      [LOG_TITLE, logColumns],
    ]);
    /** The number of rows of each tab. `appendDimension` adds rows. */
    this.rowCounts = new Map([
      [METRICS_TITLE, 1000],
      [LOG_TITLE, 1000],
    ]);
    /** False: the `Score` column does not keep a written value, as if something in the sheet changes it back. */
    this.keepsScores = true;
    /** True: a write to the `Score` column fails with HTTP 403, as on a view-only sheet. */
    this.failsScoreWrites = false;
    /**
     * The method and the last part of the path of each call. Example: `GET values:batchGet`.
     * @type {string[]}
     */
    this.calls = [];
    /**
     * The ranges of each `values:batchUpdate` call that writes to the `Score` column.
     * @type {string[][]}
     */
    this.scoreWrites = [];
    /**
     * Each request of each `:batchUpdate` call, as JSON, in order.
     * @type {JsonObject[]}
     */
    this.requests = [];
    /**
     * The letters of the `Log` columns that got the number rule `=ISNUMBER(…)`, in the order of the requests.
     * @type {string[]}
     */
    this.numberRuleColumns = [];
    this.store = new SheetsStore(new SheetsClient((url, init) => this.#handle(url, init), 'sheet-id'));
  }

  /**
   * The values of the `header` column of the `Log` tab, below the header row. Null for an empty cell.
   * @param {string} header
   * @returns {(number | null)[]}
   */
  logColumn(header) {
    const c = this.log[0].indexOf(header);
    return this.log.slice(1).map((row) => /** @type {number | null} */ (orNull(row[c] ?? null)));
  }

  /** @returns {number} The 0-based index of the `Score` column of the `Log` tab. -1 if there is none. */
  get #scoreColumn() {
    return this.log.length === 0 ? -1 : this.log[0].indexOf('Score');
  }

  /**
   * @param {string} title
   * @returns {Cell[][]} The rows of the tab `title`.
   */
  #tab(title) {
    if (title === METRICS_TITLE) return this.metrics;
    if (title === LOG_TITLE) return this.log;
    throw new Error(title);
  }

  /**
   * The fake `fetch`: it answers as the Sheets API.
   * @param {string} url
   * @param {RequestInit} [init]
   * @returns {Promise<Response>}
   */
  async #handle(url, init = {}) {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname).replace(SPREADSHEET_PATH, '');
    const method = init.method ?? 'GET';
    const text = typeof init.body === 'string' ? init.body : '';
    /** @type {JsonObject} */
    const body = text === '' ? {} : JSON.parse(text);
    this.calls.push(`${method} ${path.split('/').at(-1)}`);
    try {
      return json(this.#response(method, path, parsed.searchParams, body));
    } catch (e) {
      if (!(e instanceof Forbidden)) throw e;
      return json({ error: { code: 403, message: 'The caller does not have permission' } }, 403);
    }
  }

  /**
   * @param {string} method
   * @param {string} path
   * @param {URLSearchParams} parameters
   * @param {JsonObject} body
   * @returns {JsonObject}
   */
  #response(method, path, parameters, body) {
    const inputOption = parameters.get('valueInputOption');
    if (method === 'GET' && path === '') return this.#spreadsheet();
    if (method === 'POST' && path === ':batchUpdate') return this.#batchUpdate(body);
    if (method === 'GET' && path === '/values:batchGet') return this.#batchGet(parameters.getAll('ranges'));
    if (method === 'POST' && path === '/values:batchUpdate') return this.#valuesBatchUpdate(body);
    if (method === 'PUT' && path.startsWith('/values/')) {
      return this.#write(path.slice('/values/'.length), body.values, inputOption === 'USER_ENTERED');
    }
    if (method === 'POST' && path.endsWith(':append')) {
      if (body.values.length !== 1) throw new Error('An append has one row.');
      return this.#append(body.values[0]);
    }
    if (method === 'POST' && path.endsWith(':clear')) {
      return this.#clear(path.slice('/values/'.length, -':clear'.length));
    }
    throw new Error(`Unsupported: ${method} ${path}`);
  }

  /** @returns {JsonObject} */
  #spreadsheet() {
    return {
      sheets: [...tabIds]
        .filter(([title]) => this.tabs.has(title))
        .map(([title, id]) => ({
          properties: {
            sheetId: id,
            title,
            gridProperties: { columnCount: this.columnCounts.get(title), rowCount: this.rowCounts.get(title) },
          },
        })),
    };
  }

  /**
   * @param {JsonObject} body
   * @returns {JsonObject}
   */
  #batchUpdate(body) {
    /** @type {JsonObject[]} */
    const replies = [];
    for (const request of /** @type {JsonObject[]} */ (body.requests)) {
      this.requests.push(request);
      const addSheet = request.addSheet;
      if (addSheet !== undefined) {
        const title = addSheet.properties.title;
        this.tabs.add(title);
        replies.push({ addSheet: { properties: { sheetId: tabIds.get(title), title } } });
      } else {
        replies.push({});
      }
      const append = request.appendDimension;
      if (append !== undefined) {
        const title = titleOf(append.sheetId);
        const counts = append.dimension === 'ROWS' ? this.rowCounts : this.columnCounts;
        counts.set(title, /** @type {number} */ (counts.get(title)) + append.length);
      }
      const remove = request.deleteDimension;
      if (remove !== undefined) {
        const range = remove.range;
        const rows = this.#tab(titleOf(range.sheetId));
        const end = Math.min(range.endIndex, rows.length);
        if (end > range.startIndex) rows.splice(range.startIndex, end - range.startIndex);
      }
      const move = request.moveDimension;
      if (move !== undefined) {
        const source = move.source;
        const rows = this.#tab(titleOf(source.sheetId));
        const start = source.startIndex;
        const destination = move.destinationIndex;
        while (rows.length < Math.max(start + 1, destination)) rows.push([]);
        const [row] = rows.splice(start, 1);
        rows.splice(destination > start ? destination - 1 : destination, 0, row);
      }
      const validation = request.setDataValidation;
      if (validation !== undefined) {
        const range = validation.range;
        const condition = JSON.stringify(validation.rule?.condition ?? null);
        if (range.sheetId === tabIds.get(LOG_TITLE) && condition.includes('ISNUMBER')) {
          this.numberRuleColumns.push(columnLetter(range.startColumnIndex));
        }
      }
    }
    return { replies };
  }

  /**
   * @param {string[]} ranges
   * @returns {JsonObject}
   */
  #batchGet(ranges) {
    return {
      valueRanges: ranges.map((range) => {
        const values = this.#values(range);
        return values === null ? { range } : { range, values };
      }),
    };
  }

  /**
   * The values of `range`, a tab title or `Log!1:1`, without empty cells at the end. Null if there are no values.
   * @param {string} range
   * @returns {Cell[][] | null}
   */
  #values(range) {
    const parts = range.split('!');
    let rows = this.#tab(parts[0]);
    if (parts[1] === '1:1') rows = rows.slice(0, 1);
    const trimmed = rows.map((row) => {
      const last = row.findLastIndex((c) => orNull(c) !== null);
      return row.slice(0, last + 1).map((c) => orNull(c) ?? '');
    });
    while (trimmed.length > 0 && /** @type {Cell[]} */ (trimmed.at(-1)).length === 0) trimmed.pop();
    return trimmed.length === 0 ? null : trimmed;
  }

  /**
   * @param {JsonObject} body
   * @returns {JsonObject}
   */
  #valuesBatchUpdate(body) {
    const data = /** @type {JsonObject[]} */ (body.data);
    const ranges = data.map((d) => /** @type {string} */ (d.range));
    const scoreLetter = this.#scoreColumn < 0 ? null : columnLetter(this.#scoreColumn);
    if (scoreLetter !== null && ranges.some((r) => r.startsWith(`${LOG_TITLE}!${scoreLetter}`))) {
      if (this.failsScoreWrites) throw new Forbidden();
      this.scoreWrites.push(ranges);
    }
    const isUserEntered = body.valueInputOption === 'USER_ENTERED';
    for (const d of data) this.#write(d.range, d.values, isUserEntered);
    return {};
  }

  /**
   * Writes `values` from the top-left cell of `range`, for example `Log!E1`.
   * @param {string} range
   * @param {unknown[][]} values
   * @param {boolean} isUserEntered
   * @returns {JsonObject}
   */
  #write(range, values, isUserEntered) {
    const [title, row, column] = cell(range);
    const rows = this.#tab(title);
    values.forEach((cells, i) => {
      cells.forEach((element, j) => {
        const c = column + j;
        if (this.keepsScores || title !== LOG_TITLE || row + i === 0 || c !== this.#scoreColumn) {
          const value = cellOf(element);
          set(rows, row + i, c, isUserEntered ? userEntered(value) : value);
        }
      });
    });
    return {};
  }

  /**
   * Adds a row after the last row with values. Sheets reads `YYYY-MM-DD` as a date: USER_ENTERED.
   * @param {unknown[]} values
   * @returns {JsonObject}
   */
  #append(values) {
    const row = this.#values(LOG_TITLE)?.length ?? 0;
    values.forEach((element, j) => set(this.log, row, j, userEntered(cellOf(element))));
    return {};
  }

  /**
   * @param {string} range
   * @returns {JsonObject}
   */
  #clear(range) {
    const [title, row, column] = cell(range);
    set(this.#tab(title), row, column, null);
    return {};
  }
}

/** Thrown by a call that the sheet does not allow: the answer is HTTP 403. */
class Forbidden extends Error {}

/**
 * A JSON answer.
 * @param {JsonObject} body
 * @param {number} [status]
 * @returns {Response}
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/**
 * @param {number} tabId
 * @returns {string} The title of the tab `tabId`.
 */
function titleOf(tabId) {
  const entry = [...tabIds].find(([, id]) => id === tabId);
  if (entry === undefined) throw new Error(`No tab ${tabId}`);
  return entry[0];
}

/**
 * Sets the cell at the 0-based `row` and `column` of `rows`. Adds rows and cells before it if necessary.
 * @param {Cell[][]} rows
 * @param {number} row
 * @param {number} column
 * @param {Cell} value
 */
function set(rows, row, column, value) {
  while (rows.length <= row) rows.push([]);
  const cells = rows[row];
  while (cells.length <= column) cells.push(null);
  cells[column] = value;
}

/**
 * The tab, the 0-based row and the 0-based column of the top-left cell of `range`, for example `Log!E1`.
 * @param {string} range
 * @returns {[string, number, number]}
 */
function cell(range) {
  const match = /^(\w+)!([A-Z]+)(\d+)/.exec(range);
  if (match === null) throw new Error(`Not a cell: ${range}`);
  let column = 0;
  for (const letter of match[2]) column = column * 26 + (letter.charCodeAt(0) - 64);
  return [match[1], Number(match[3]) - 1, column - 1];
}

/**
 * A value as Sheets stores it with USER_ENTERED: a `YYYY-MM-DD` text is a date serial number.
 * @param {Cell} value
 * @returns {Cell}
 */
function userEntered(value) {
  return typeof value === 'string' ? (Day.tryParse(value)?.serial ?? value) : value;
}

/**
 * Null for an empty cell: null or an empty text.
 * @param {Cell} value
 * @returns {Cell}
 */
function orNull(value) {
  return value === '' ? null : value;
}
