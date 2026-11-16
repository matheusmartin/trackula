import { Config } from './Config.js';
import { ScriptException, loadScript } from './Scripts.js';

/**
 * The answer of the Google Picker: the action and the picked files.
 * @typedef {object} PickerResult
 * @property {string} action `picked`, `cancel` or `loaded`.
 * @property {{ id: string }[]} [docs]
 */

/**
 * A view of the Picker.
 * @typedef {object} DocsView
 * @property {(mode: string) => DocsView} setMode
 */

/**
 * The builder of the Picker. Each function gives the builder again, except `build`.
 * @typedef {object} PickerBuilder
 * @property {(view: DocsView) => PickerBuilder} addView
 * @property {(token: string) => PickerBuilder} setOAuthToken
 * @property {(key: string) => PickerBuilder} setDeveloperKey
 * @property {(appId: string) => PickerBuilder} setAppId
 * @property {(title: string) => PickerBuilder} setTitle
 * @property {(callback: (result: PickerResult) => void) => PickerBuilder} setCallback
 * @property {() => { setVisible: (visible: boolean) => void }} build
 */

/**
 * The part of the Picker module that this file uses: `google.picker`.
 * @typedef {object} PickerApi
 * @property {new () => PickerBuilder} PickerBuilder
 * @property {new (viewId: string) => DocsView} DocsView
 */

/**
 * The options of `gapi.load`.
 * @typedef {object} GapiLoadOptions
 * @property {() => void} callback
 * @property {() => void} onerror
 * @property {number} timeout In milliseconds.
 * @property {() => void} ontimeout
 */

/**
 * The part of `gapi` that this file uses.
 * @typedef {object} Gapi
 * @property {(name: string, options: GapiLoadOptions) => void} load Loads the module `name`, for example `picker`.
 */

/** The error text if the Picker cannot load. */
const LOAD_ERROR = 'Cannot load the Google Picker.';

/**
 * Opens the Google Picker with the user's spreadsheets. Gives the ID of the picked spreadsheet, or null if the user
 * cancels. Throws a {@link ScriptException} if the Picker cannot load, also after 10 seconds without the Picker module.
 *
 * Picking a file gives this app `drive.file` access to it. See
 * https://developers.google.com/workspace/drive/picker/guides/overview
 * @param {string} accessToken
 * @param {Config} [config]
 * @returns {Promise<string | null>}
 */
export async function pickSpreadsheet(accessToken, config = Config.build) {
  await loadScript('https://apis.google.com/js/api.js', LOAD_ERROR);
  await new Promise((resolve, reject) => {
    const onError = () => reject(new ScriptException(LOAD_ERROR));
    gapi().load('picker', { callback: () => resolve(undefined), onerror: onError, timeout: 10000, ontimeout: onError });
  });

  const picker = pickerApi();
  return new Promise((resolve) => {
    new picker.PickerBuilder()
      .addView(new picker.DocsView('spreadsheets').setMode('list'))
      .setOAuthToken(accessToken)
      .setDeveloperKey(config.apiKey)
      .setAppId(config.projectNumber)
      .setTitle('Choose the Trackula sheet')
      .setCallback((result) => {
        if (result.action === 'picked') resolve(result.docs?.[0]?.id ?? null);
        else if (result.action === 'cancel') resolve(null);
      })
      .build()
      .setVisible(true);
  });
}

/** @returns {Gapi} `gapi`, from the script api.js. */
function gapi() {
  return /** @type {any} */ (globalThis).gapi;
}

/** @returns {PickerApi} `google.picker`, from the Picker module of `gapi`. */
function pickerApi() {
  return /** @type {any} */ (globalThis).google.picker;
}
