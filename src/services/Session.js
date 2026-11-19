import { SheetsClient } from '../sheets/SheetsClient.js';
import { SheetsStore } from '../sheets/SheetsStore.js';
import { AccessToken } from './AccessToken.js';
import { Config } from './Config.js';
import { loadScript } from './Scripts.js';

/** @import { AuthorizedFetch } from '../sheets/SheetsClient.js' */

/** The scope of the token: only the files that the user picks or that the app makes. */
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** Thrown when the Google sign-in fails or the user closes it. */
export class SignInException extends Error {
  /** @param {string} message The text that the app shows. */
  constructor(message) {
    super(message);
    this.name = 'SignInException';
  }

  /** @returns {string} The message only, as in Dart. The app shows this text. */
  toString() {
    return this.message;
  }
}

/**
 * The answer of the Google Identity Services token client.
 * @typedef {object} TokenResponse
 * @property {string} [access_token]
 * @property {string | number} [expires_in] The lifetime of the token in seconds. Google gives a number or a text.
 * @property {string} [error]
 * @property {string} [error_description]
 */

/**
 * The error of the token client when the popup does not open or the user closes it.
 * @typedef {object} TokenError
 * @property {string} type
 */

/**
 * The settings of a token client of Google Identity Services.
 * @typedef {object} TokenClientConfig
 * @property {string} client_id
 * @property {string} scope
 * @property {string} prompt
 * @property {(response: TokenResponse) => void} callback
 * @property {(error: TokenError) => void} error_callback
 */

/**
 * The part of Google Identity Services that this file uses: `google.accounts.oauth2`.
 * @typedef {object} OAuth2Api
 * @property {(config: TokenClientConfig) => { requestAccessToken: () => void }} initTokenClient
 */

/** A signed-in Google user. The access token stays in memory only. */
export class Session {
  /**
   * Use {@link Session.signIn}.
   * @param {AccessToken} token
   */
  constructor(token) {
    this.token = token;
  }

  /** @returns {string} The access token. */
  get accessToken() {
    return this.token.value;
  }

  /** @returns {boolean} True if the access token expired. It lasts 1 hour, and there is no refresh token in the browser. */
  get expired() {
    return this.token.expired;
  }

  /**
   * Calls `fetch` with the access token of this session, in the header `Authorization: Bearer …`. The other headers of
   * `init` stay.
   * @type {AuthorizedFetch}
   */
  authorizedFetch = (url, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.token.value}`);
    return fetch(url, { ...init, headers });
  };

  /**
   * The store of the spreadsheet `spreadsheetId`. Its requests send the access token of this session.
   * @param {string} spreadsheetId
   * @returns {SheetsStore}
   */
  store(spreadsheetId) {
    return new SheetsStore(new SheetsClient(this.authorizedFetch, spreadsheetId));
  }

  /**
   * Opens the Google sign-in popup. Call it from a click handler, or the browser can block the popup. With
   * `selectAccount`, the user picks the account. Throws a {@link SignInException} if the sign-in fails, and a
   * `ScriptException` if the script of the sign-in cannot load.
   * @param {boolean} [selectAccount]
   * @param {Config} [config]
   * @returns {Promise<Session>}
   */
  static async signIn(selectAccount = true, config = Config.build) {
    await loadScript('https://accounts.google.com/gsi/client', 'Cannot load the Google sign-in.');
    return new Promise((resolve, reject) => {
      oauth2()
        .initTokenClient({
          client_id: config.clientId,
          scope: DRIVE_FILE_SCOPE,
          prompt: selectAccount ? 'select_account' : '',
          callback: (response) => {
            const token = response.access_token;
            if (token == null) {
              const message = response.error_description ?? response.error ?? 'No access token.';
              reject(new SignInException(`Google sign-in failed: ${message}`));
            } else {
              resolve(new Session(new AccessToken(token, expiresInSeconds(response) * 1000)));
            }
          },
          error_callback: (error) => reject(new SignInException(`Google sign-in failed: ${error.type}`)),
        })
        .requestAccessToken();
    });
  }
}

/** @returns {OAuth2Api} `google.accounts.oauth2`, from the script of Google Identity Services. */
function oauth2() {
  return /** @type {any} */ (globalThis).google.accounts.oauth2;
}

/**
 * The lifetime of the token in seconds. Google gives a number or a text. 1 hour if the value is missing or not valid.
 * @param {TokenResponse} response
 * @returns {number}
 */
function expiresInSeconds(response) {
  return Number(response.expires_in) || 3600;
}
