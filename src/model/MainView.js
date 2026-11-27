/**
 * A view of the navigation bar: today as input tiles, the recent days of all metrics, or the score only.
 */
export class MainView {
  /**
   * @param {string} name The name of the view. Example: `DAYS`.
   * @param {string} label The label in the navigation bar.
   * @param {string} icon The Material Symbols icon in the navigation bar.
   */
  constructor(name, label, icon) {
    this.name = name;
    this.label = label;
    this.icon = icon;
    Object.freeze(this);
  }

  static TODAY = new MainView('TODAY', 'Today', 'today');
  static DAYS = new MainView('DAYS', 'Days', 'view_week');
  static SCORE = new MainView('SCORE', 'Score', 'show_chart');

  /** All views, in the order of the navigation bar. */
  static entries = [MainView.TODAY, MainView.DAYS, MainView.SCORE];
}

/**
 * How the Days view shows the days. `TABLE`: one row for each metric and one column for each day, as many days as the
 * width holds. `CALENDARS`: one small calendar for each metric, for the last {@link CALENDAR_DAYS} days.
 * @typedef {'TABLE' | 'CALENDARS'} DayLayout
 */

/** The values of {@link DayLayout}. */
export const DayLayout = Object.freeze({ TABLE: 'TABLE', CALENDARS: 'CALENDARS' });

/** The number of days of the Calendars layout of the Days view. */
export const CALENDAR_DAYS = 31;

/** The fewest and the most days of the Table layout of the Days view. */
export const MIN_TABLE_DAYS = 5;
export const MAX_TABLE_DAYS = 14;

/**
 * The layout of the Days view from its saved text. Example: `CALENDARS` gives {@link DayLayout.CALENDARS}. Other text,
 * or null, gives the table.
 * @param {string | null} text
 * @returns {DayLayout}
 */
export function dayLayoutOf(text) {
  return text === DayLayout.CALENDARS ? DayLayout.CALENDARS : DayLayout.TABLE;
}

/**
 * The number of days that a table holds: as many columns as fit next to the names, from {@link MIN_TABLE_DAYS} to
 * {@link MAX_TABLE_DAYS}. Example: a width of 358 with names of 136 and columns of 40 gives 5.
 * @param {number} width The width of the table, in CSS pixels. 0 before the first layout.
 * @param {number} nameWidth The width of the name column.
 * @param {number} columnWidth The width of one day column, with the space after it.
 * @returns {number}
 */
export function tableDayCount(width, nameWidth, columnWidth) {
  const fits = Math.floor((width - nameWidth) / columnWidth);
  return Math.min(MAX_TABLE_DAYS, Math.max(MIN_TABLE_DAYS, fits));
}
