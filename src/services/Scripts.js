/** Thrown when the browser cannot load a Google script, for example without a network connection. */
export class ScriptException extends Error {
  /** @param {string} message The text that the app shows. */
  constructor(message) {
    super(message);
    this.name = 'ScriptException';
  }

  /** @returns {string} The message only, without the class name. The app shows this text. */
  toString() {
    return this.message;
  }
}

/**
 * The load of each script, by URL. A failed load is not here, so the next call tries again.
 * @type {Map<string, Promise<void>>}
 */
const loads = new Map();

/**
 * Loads the script `src` once. Throws a {@link ScriptException} with `error` if the load fails.
 * @param {string} src
 * @param {string} error
 * @returns {Promise<void>}
 */
export async function loadScript(src, error) {
  let load = loads.get(src);
  if (!load) {
    load = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.addEventListener('load', () => resolve());
      script.addEventListener('error', () => reject(new ScriptException(error)));
      document.head.appendChild(script);
    });
    loads.set(src, load);
  }
  try {
    await load;
  } catch (e) {
    // Another caller can have started a new load after this failure: keep it.
    if (e instanceof ScriptException && loads.get(src) === load) loads.delete(src);
    throw e;
  }
}
