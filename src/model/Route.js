import { MainView } from './MainView.js';

/**
 * The screens of the app. The value is the first part of the address. Example: `metric` in `#/metric/weight`.
 * @typedef {'today' | 'days' | 'score' | 'metric' | 'metrics' | 'new' | 'edit' | 'fix' | 'restore'} Screen
 */

/** The values of {@link Screen}. */
export const Screen = Object.freeze({
  TODAY: 'today',
  DAYS: 'days',
  SCORE: 'score',
  METRIC: 'metric',
  METRICS: 'metrics',
  NEW_METRIC: 'new',
  EDIT_METRIC: 'edit',
  FIX_ROW: 'fix',
  RESTORE_METRIC: 'restore',
});

/**
 * The screens of the forms of the metrics screen. Their address starts with `#/metrics/`.
 * @type {Set<string>}
 */
const FORMS = new Set([Screen.NEW_METRIC, Screen.EDIT_METRIC, Screen.FIX_ROW, Screen.RESTORE_METRIC]);

/**
 * The views of the navigation, by their screen.
 * @type {Map<string, MainView>}
 */
const VIEWS = new Map([
  [Screen.TODAY, MainView.TODAY],
  [Screen.DAYS, MainView.DAYS],
  [Screen.SCORE, MainView.SCORE],
]);

/**
 * A screen of the app and its address: the part of the URL after `#`. A reload shows the same screen, and the Back
 * button of the browser goes to the screen before. Examples:
 *
 * - `#/today`, `#/days`, `#/score`: the views of the navigation.
 * - `#/metric/weight`: the detail screen of the metric `weight`.
 * - `#/metrics`: the metrics screen. `#/metrics/new`, `#/metrics/edit/weight`, `#/metrics/fix/7` and
 *   `#/metrics/restore/old_id`: its forms. The form of an invalid row has the row number of the `Metrics` tab.
 *
 * The address of an edit has `edit/`, so that a metric with the id `new` has its own address.
 */
export class Route {
  /**
   * @param {Screen} screen
   * @param {string | null} [param] The metric id, the deleted column or the row number. Null for the other screens.
   */
  constructor(screen, param = null) {
    this.screen = screen;
    this.param = param;
    Object.freeze(this);
  }

  /**
   * The address of the screen, with `#`. Example: `#/metric/weight`.
   * @returns {string}
   */
  get hash() {
    const param = this.param == null ? '' : `/${encodeURIComponent(this.param)}`;
    if (FORMS.has(this.screen)) return `#/metrics/${this.screen}${param}`;
    return `#/${this.screen}${param}`;
  }

  /**
   * The view of the navigation of this screen. Null for the other screens.
   * @returns {MainView | null}
   */
  get view() {
    return VIEWS.get(this.screen) ?? null;
  }

  /**
   * True if the screen is the metrics screen or one of its forms.
   * @returns {boolean}
   */
  get isMetrics() {
    return this.screen === Screen.METRICS || FORMS.has(this.screen);
  }

  /**
   * True if the screen is a form of the metrics screen.
   * @returns {boolean}
   */
  get isForm() {
    return FORMS.has(this.screen);
  }

  /**
   * The screen that the back button shows when the browser history has no screen before, for example after a link to
   * a metric. Null for a view of the navigation.
   * @returns {Route | null}
   */
  get parent() {
    if (this.view != null) return null;
    if (this.screen === Screen.METRIC) return Route.DAYS;
    if (this.screen === Screen.METRICS) return Route.TODAY;
    return Route.METRICS;
  }

  /**
   * True if `other` is the same screen with the same parameter.
   * @param {Route} other
   * @returns {boolean}
   */
  equals(other) {
    return this.screen === other.screen && this.param === other.param;
  }

  static TODAY = new Route(Screen.TODAY);
  static DAYS = new Route(Screen.DAYS);
  static SCORE = new Route(Screen.SCORE);
  static METRICS = new Route(Screen.METRICS);
  static NEW_METRIC = new Route(Screen.NEW_METRIC);

  /**
   * The screen of the navigation view `view`.
   * @param {MainView} view
   * @returns {Route}
   */
  static ofView(view) {
    for (const [screen, v] of VIEWS) if (v === view) return new Route(/** @type {Screen} */ (screen));
    return Route.TODAY;
  }

  /**
   * The detail screen of the metric `id`.
   * @param {string} id
   * @returns {Route}
   */
  static metric(id) {
    return new Route(Screen.METRIC, id);
  }

  /**
   * The form that edits the metric `id`.
   * @param {string} id
   * @returns {Route}
   */
  static editMetric(id) {
    return new Route(Screen.EDIT_METRIC, id);
  }

  /**
   * The form that fixes the invalid row `row` of the `Metrics` tab.
   * @param {number} row
   * @returns {Route}
   */
  static fixRow(row) {
    return new Route(Screen.FIX_ROW, String(row));
  }

  /**
   * The form that restores the deleted metric of the `Log` column `id`.
   * @param {string} id
   * @returns {Route}
   */
  static restoreMetric(id) {
    return new Route(Screen.RESTORE_METRIC, id);
  }

  /**
   * The screen of the address `hash`, with or without `#`. An empty or unknown address gives the Today view.
   * Examples: `#/days` gives the Days view. `#/metric/weight` gives the detail screen of `weight`.
   * @param {string} hash
   * @returns {Route}
   */
  static parse(hash) {
    const parts = hash.replace(/^#?\/?/, '').split('/');
    const [first, second = null, third = null] = parts.map((part) => safeDecode(part));
    if (first === Screen.METRICS && second != null && FORMS.has(/** @type {Screen} */ (second))) {
      return formOf(/** @type {Screen} */ (second), third, parts.length);
    }
    if (first === Screen.METRIC && second != null && second !== '' && parts.length === 2) return Route.metric(second);
    if (parts.length !== 1) return Route.TODAY;
    if (first === Screen.METRICS) return Route.METRICS;
    const view = VIEWS.get(/** @type {Screen} */ (first));
    return view == null ? Route.TODAY : Route.ofView(view);
  }
}

/**
 * The form of the address `#/metrics/<screen>/<param>`. An address with a missing or extra part gives the Today view.
 * @param {Screen} screen
 * @param {string | null} param
 * @param {number} parts The number of parts of the address.
 * @returns {Route}
 */
function formOf(screen, param, parts) {
  if (screen === Screen.NEW_METRIC) return parts === 2 ? Route.NEW_METRIC : Route.TODAY;
  if (parts !== 3 || param == null || param === '') return Route.TODAY;
  if (screen === Screen.FIX_ROW) return /^[1-9][0-9]*$/.test(param) ? Route.fixRow(Number(param)) : Route.TODAY;
  return new Route(screen, param);
}

/**
 * `part` without its URL escapes. A part with a broken escape stays as it is.
 * @param {string} part
 * @returns {string}
 */
function safeDecode(part) {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}
