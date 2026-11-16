// STUB until the sheets port (docs/js-port.md, phase 3). Only the constructor is final.

/**
 * A fetch function that sends the access token of the session: `Authorization: Bearer …`.
 * @typedef {(url: string, init?: RequestInit) => Promise<Response>} AuthorizedFetch
 */

/** Calls the Google Sheets REST API for one spreadsheet. */
export class SheetsClient {
  /**
   * @param {AuthorizedFetch} fetch Sends each request with the access token.
   * @param {string} spreadsheetId
   */
  constructor(fetch, spreadsheetId) {
    this.fetch = fetch;
    this.spreadsheetId = spreadsheetId;
  }
}
