import { daysBetween } from './Day.js';

/** @import { Day } from './Day.js' */

/**
 * A view of the navigation bar: today as input tiles, a table of the last 5 days, one small calendar per metric for
 * the last 31 days, or the score only.
 */
export class MainView {
  /**
   * @param {string} name The name, as the Kotlin enum. Example: `SHORT`.
   * @param {number | null} days The number of past days that the view shows. Null for SCORE: it shows all days, with
   *   zoom buttons.
   * @param {string} label The label in the navigation bar.
   * @param {string} icon The Material Symbols icon in the navigation bar.
   */
  constructor(name, days, label, icon) {
    this.name = name;
    this.days = days;
    this.label = label;
    this.icon = icon;
    Object.freeze(this);
  }

  /**
   * The days of the view, oldest first, ending on `today`. Only for a view with days.
   * @param {Day} today
   * @returns {Day[]}
   */
  daysUntil(today) {
    if (this.days === null) throw new Error(`${this.name} has no days.`);
    return daysBetween(today.addDays(1 - this.days), today);
  }

  static TODAY = new MainView('TODAY', 1, 'Today', 'today');
  static SHORT = new MainView('SHORT', 5, '5 days', 'view_week');
  static MONTH = new MainView('MONTH', 31, '31 days', 'calendar_month');
  static SCORE = new MainView('SCORE', null, 'Score', 'show_chart');

  /** All views, in the order of the navigation bar. */
  static entries = [MainView.TODAY, MainView.SHORT, MainView.MONTH, MainView.SCORE];
}
