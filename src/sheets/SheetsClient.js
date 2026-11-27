// The calls of the Google Sheets API v4, with `fetch`.

/** @import { Cell } from '../model/Parse.js' */

/**
 * A fetch function that sends the access token of the session: `Authorization: Bearer …`.
 * @typedef {(url: string, init?: RequestInit) => Promise<Response>} AuthorizedFetch
 */

/**
 * A JSON object of a request or of a response of the Sheets API.
 * @typedef {{ [key: string]: any }} JsonObject
 */

/**
 * The values of a range in A1 notation, for {@link SheetsClient#batchUpdateValues}. It is also the JSON of the
 * request: `JSON.stringify` writes a whole number without a fraction, so the sheet shows 5 and not 5.0.
 * @typedef {object} ValueRange
 * @property {string} range
 * @property {Cell[][]} values
 */

/** Thrown when the Sheets API answers with an error. Example: HTTP 403 on a view-only sheet. */
export class SheetsApiException extends Error {
  /**
   * @param {number} status The HTTP status.
   * @param {string} message The text that the app shows.
   */
  constructor(status, message) {
    super(message);
    this.name = 'SheetsApiException';
    this.status = status;
  }

  /** @returns {string} The message only, without the class name. The app shows this text. */
  toString() {
    return this.message;
  }
}

/**
 * The calls of the Google Sheets API v4 that the app uses, for one spreadsheet. See
 * https://developers.google.com/workspace/sheets/api/reference/rest.
 *
 * Each call throws a {@link SheetsApiException} if the API answers with an error.
 */
export class SheetsClient {
  /** @type {AuthorizedFetch} */
  #fetch;

  /** @type {string} */
  #base;

  /**
   * @param {AuthorizedFetch} fetch Sends each request with the access token.
   * @param {string} spreadsheetId
   */
  constructor(fetch, spreadsheetId) {
    this.#fetch = fetch;
    this.spreadsheetId = spreadsheetId;
    this.#base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURLPathPart(spreadsheetId)}`;
  }

  /**
   * `spreadsheets.get` with only the `fields`.
   * @param {string} fields
   * @returns {Promise<JsonObject>}
   */
  get(fields) {
    return this.#call('GET', this.#base, [['fields', fields]]);
  }

  /**
   * `spreadsheets.batchUpdate`: sends `requests` in one batch.
   * @param {JsonObject[]} requests
   * @returns {Promise<JsonObject>}
   */
  batchUpdate(requests) {
    return this.#call('POST', `${this.#base}:batchUpdate`, [], { requests });
  }

  /**
   * `values.batchGet` with unformatted values: the cells of each of `ranges`. Each row omits empty cells at its end.
   * @param {string[]} ranges
   * @returns {Promise<Cell[][][]>}
   */
  async batchGet(ranges) {
    /** @type {[string, string][]} */
    const query = [...ranges.map((range) => /** @type {[string, string]} */ (['ranges', range]))];
    query.push(['valueRenderOption', 'UNFORMATTED_VALUE']);
    const response = await this.#call('GET', `${this.#base}/values:batchGet`, query);
    return /** @type {JsonObject[]} */ (response.valueRanges).map((range) =>
      /** @type {unknown[][]} */ (range.values ?? []).map((row) => row.map(cellOf)),
    );
  }

  /**
   * `values.batchUpdate`: writes each {@link ValueRange} of `data`.
   * @param {string} inputOption `RAW` or `USER_ENTERED`.
   * @param {ValueRange[]} data
   * @returns {Promise<void>}
   */
  async batchUpdateValues(inputOption, data) {
    await this.#call('POST', `${this.#base}/values:batchUpdate`, [], { valueInputOption: inputOption, data });
  }

  /**
   * `values.update`: writes `values` from the top-left cell of `range`.
   * @param {string} range
   * @param {Cell[][]} values
   * @param {string} inputOption
   * @returns {Promise<void>}
   */
  async update(range, values, inputOption) {
    await this.#call('PUT', `${this.#base}/values/${encodeURLPathPart(range)}`, [['valueInputOption', inputOption]], {
      values,
    });
  }

  /**
   * `values.append`: adds `values` as new rows after the table of `range`.
   * @param {string} range
   * @param {Cell[][]} values
   * @param {string} inputOption
   * @returns {Promise<void>}
   */
  async append(range, values, inputOption) {
    await this.#call(
      'POST',
      `${this.#base}/values/${encodeURLPathPart(range)}:append`,
      [
        ['valueInputOption', inputOption],
        ['insertDataOption', 'INSERT_ROWS'],
      ],
      { values },
    );
  }

  /**
   * `values.clear`: removes the values of `range`. The format and the rules stay.
   * @param {string} range
   * @returns {Promise<void>}
   */
  async clear(range) {
    await this.#call('POST', `${this.#base}/values/${encodeURLPathPart(range)}:clear`, [], {});
  }

  /**
   * Sends one request and gives the JSON object of the answer. An empty answer gives an empty object.
   * @param {string} method
   * @param {string} url
   * @param {[string, string][]} parameters The query parameters, in order. A name can occur more than once.
   * @param {JsonObject | null} body
   * @returns {Promise<JsonObject>}
   */
  async #call(method, url, parameters = [], body = null) {
    const query = new URLSearchParams(parameters).toString();
    /** @type {RequestInit} */
    const init = { method };
    if (body !== null) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    const response = await this.#fetch(query === '' ? url : `${url}?${query}`, init);
    const text = await response.text();
    if (!response.ok) {
      const message = errorMessage(text) ?? `HTTP ${response.status} ${response.statusText}`.trimEnd();
      throw new SheetsApiException(response.status, message);
    }
    return text.trim() === '' ? {} : JSON.parse(text);
  }
}

/**
 * The message of an error answer of the Sheets API: `error.message` of its JSON. Null if the text is not JSON or has
 * no message.
 * @param {string} text
 * @returns {string | null}
 */
function errorMessage(text) {
  try {
    const message = JSON.parse(text)?.error?.message;
    return message == null || typeof message === 'object' ? null : String(message);
  } catch {
    return null;
  }
}

/**
 * A cell of a response, as the model reads it: a text, a number, a boolean or null.
 * @param {unknown} value A value of the JSON of the response.
 * @returns {Cell}
 */
export function cellOf(value) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : null;
}

/**
 * `text` for one part of a URL path, as Ktor `encodeURLPathPart` gives it. It encodes `/`, but not the characters
 * that a path part can have, for example `!` and `:`. Example: `Log!A1` stays `Log!A1`.
 * @param {string} text
 * @returns {string}
 */
function encodeURLPathPart(text) {
  // encodeURIComponent also encodes some characters that a path part can have: decode them again.
  return encodeURIComponent(text).replace(/%(3A|40|24|26|2B|2C|3B|3D)/g, (code) => decodeURIComponent(code));
}
