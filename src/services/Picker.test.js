import { afterEach, describe, expect, test, vi } from 'vitest';
import { Config } from './Config.js';
import { pickSpreadsheet } from './Picker.js';
import { ScriptException, loadScript } from './Scripts.js';

/** @import { DocsView, Gapi, GapiLoadOptions, PickerBuilder, PickerResult } from './Picker.js' */

// Node.js cannot load the scripts of the Picker: the test puts a fake `gapi` and a fake Picker in their place.
vi.mock('./Scripts.js', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  loadScript: vi.fn(async () => {}),
}));

const config = new Config('123456-abc.apps.googleusercontent.com', 'key-1');

/**
 * Puts a fake `gapi` and a fake `google.picker` in place. The Picker gives each result of `results` when it shows.
 * @param {PickerResult[]} results
 * @param {(options: GapiLoadOptions) => void} [load] Does the load of the Picker module. The default load works.
 * @returns {Record<string, unknown>} The settings that the code gave to `gapi` and to the Picker.
 */
function fakePicker(results, load = (options) => options.callback()) {
  /** @type {Record<string, unknown>} */
  const settings = {};
  /** @type {(result: PickerResult) => void} */
  let callback = () => {};
  /** @type {DocsView} */
  const view = {
    setMode: (mode) => {
      settings.mode = mode;
      return view;
    },
  };
  /** @type {PickerBuilder} */
  const builder = {
    addView: () => builder,
    setOAuthToken: (token) => ((settings.token = token), builder),
    setDeveloperKey: (key) => ((settings.key = key), builder),
    setAppId: (appId) => ((settings.appId = appId), builder),
    setTitle: (title) => ((settings.title = title), builder),
    setCallback: (onResult) => ((callback = onResult), builder),
    build: () => ({
      setVisible: (visible) => {
        settings.visible = visible;
        for (const result of results) callback(result);
      },
    }),
  };
  /** @type {Gapi} */
  const gapi = {
    load: (name, options) => {
      settings.module = name;
      settings.timeout = options.timeout;
      load(options);
    },
  };
  // A function that gives an object is a constructor: `new PickerBuilder()` gives `builder`.
  vi.stubGlobal('gapi', gapi);
  vi.stubGlobal('google', {
    picker: {
      PickerBuilder: function () {
        return builder;
      },
      /**
       * @param {string} viewId
       * @returns {DocsView}
       */
      DocsView: function (viewId) {
        settings.viewId = viewId;
        return view;
      },
    },
  });
  return settings;
}

describe('pickSpreadsheet', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('gives the ID of the picked spreadsheet', async () => {
    const settings = fakePicker([{ action: 'picked', docs: [{ id: 'sheet-1' }] }]);
    expect(await pickSpreadsheet('token-1', config)).toBe('sheet-1');
    expect(loadScript).toHaveBeenCalledWith('https://apis.google.com/js/api.js', 'Cannot load the Google Picker.');
    expect(settings).toEqual({
      module: 'picker',
      timeout: 10000,
      viewId: 'spreadsheets',
      mode: 'list',
      token: 'token-1',
      key: 'key-1',
      appId: '123456',
      title: 'Choose the Trackula sheet',
      visible: true,
    });
  });

  test('gives null if the user cancels', async () => {
    fakePicker([{ action: 'cancel' }]);
    expect(await pickSpreadsheet('token-1', config)).toBeNull();
  });

  test('waits after other actions', async () => {
    fakePicker([{ action: 'loaded' }, { action: 'picked', docs: [{ id: 'sheet-1' }] }]);
    expect(await pickSpreadsheet('token-1', config)).toBe('sheet-1');
  });

  test('gives null for a pick without files', async () => {
    fakePicker([{ action: 'picked', docs: [] }]);
    expect(await pickSpreadsheet('token-1', config)).toBeNull();
  });

  test('throws a ScriptException if the Picker module does not load in time or fails', async () => {
    fakePicker([], (options) => options.ontimeout());
    await expect(pickSpreadsheet('token-1', config)).rejects.toThrow(
      new ScriptException('Cannot load the Google Picker.'),
    );
    fakePicker([], (options) => options.onerror());
    await expect(pickSpreadsheet('token-1', config)).rejects.toBeInstanceOf(ScriptException);
  });
});
