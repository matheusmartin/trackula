/**
 * The Google values of the app: the OAuth client ID and the Picker API key. They are build values, not values in the
 * code. See README.md, "Configuration".
 */
export class Config {
  /**
   * @param {string} clientId The OAuth client ID from Google Auth Platform → Clients → Trackula web. The client ID is
   *   public. Do not put the client secret in a build value.
   * @param {string} apiKey The API key for the Google Picker, from APIs & Services → Credentials. The key is visible in
   *   the browser. Restrict it to the websites of the app and to the Google Picker API.
   */
  constructor(clientId, apiKey) {
    this.clientId = clientId;
    this.apiKey = apiKey;
    Object.freeze(this);
  }

  /**
   * @returns {string} The Cloud project number: the first part of the client ID. The Picker uses it to give this app
   *   access to the picked file.
   */
  get projectNumber() {
    return this.clientId.split('-')[0];
  }

  /** @returns {boolean} True if the build has a client ID, not the example value of config.example.env. */
  get hasClientId() {
    return this.clientId !== '' && !this.clientId.startsWith('REPLACE_WITH');
  }

  /** @returns {boolean} True if the build has an API key, not the example value of config.example.env. */
  get hasApiKey() {
    return this.apiKey !== '' && !this.apiKey.startsWith('REPLACE_WITH');
  }

  /** The values of this build: environment variables or config.env. See `buildValue` in vite.config.js. */
  static build = new Config(__GOOGLE_CLIENT_ID__, __GOOGLE_API_KEY__);
}
