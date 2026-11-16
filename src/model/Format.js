// Text for the user: numbers, units, days, months and bar labels.
import { numberText, roundHalfAwayFromZero, toFixed } from './Numbers.js';
import { BarUnit } from './Zoom.js';

/** @import { Day, MonthKey } from './Day.js' */

/** The month names, January first. */
export const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** The short weekday names, Monday first. The first letter is the weekday letter of the charts. */
export const weekdayNames = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/**
 * The first 3 letters of the name of `month`. Example: 9 → "Sep".
 * @param {number} month 1 = January.
 * @returns {string}
 */
export function shortMonth(month) {
  return monthNames[month - 1].substring(0, 3);
}

/**
 * The short month and the day of `day`. Example: "Sep 28".
 * @param {Day} day
 * @returns {string}
 */
export function shortDay(day) {
  return `${shortMonth(day.month)} ${day.day}`;
}

/**
 * `value` without zeros at the end. Examples: 82 → "82", 2.5 → "2.5".
 *
 * This also removes float noise, for example 82.10000000000001 → "82.1" and 82.00000000000001 → "82". For values of
 * about 1e9 and more with decimals, the last decimals can be different from Dart, which gives the shortest text.
 * @param {number} value
 * @returns {string}
 */
export function formatTrimmed(value) {
  const text = toFixed(value, 6).replace(/0+$/, '').replace(/\.+$/, '');
  return text === '-0' ? '0' : text;
}

/**
 * `value` with at most `decimals` decimals and no zeros at the end. Example: 81.25 → "81.3".
 * @param {number} value
 * @param {number} [decimals] 1 by default.
 * @returns {string}
 */
export function formatNumber(value, decimals = 1) {
  return formatTrimmed(Number(toFixed(value, decimals)));
}

/**
 * Short text for a small cell: 1 decimal at most, and "k" from 1000. Examples: 82.25 → "82.3", 12500 → "12.5k".
 * @param {number} value
 * @returns {string}
 */
export function formatCompact(value) {
  return Math.abs(value) >= 1000 ? `${formatNumber(value / 1000)}k` : formatNumber(value);
}

/**
 * `text` and the `unit` after a space. The unit `%` has no space, as in {@link formatPercent}. Only `text` if `unit`
 * is null. Examples: ("82.1", "kg") → "82.1 kg", ("73", "%") → "73%".
 * @param {string} text
 * @param {string | null} unit
 * @returns {string}
 */
export function withUnit(text, unit) {
  if (unit == null) return text;
  return unit === '%' ? `${text}%` : `${text} ${unit}`;
}

/**
 * `value` with its sign, at most 2 decimals and the `unit`. Examples: −1.3 → "−1.3 kg", 0.5 → "+0.5 kg", 0 → "0 kg".
 * @param {number} value
 * @param {string | null} unit
 * @returns {string}
 */
export function formatSigned(value, unit) {
  let sign = '';
  if (value > 0) sign = '+';
  else if (value < 0) sign = '−';
  return `${sign}${withUnit(formatNumber(Math.abs(value), 2), unit)}`;
}

/**
 * A `rate` from 0 to 1 as a whole percentage. Example: 0.756 → "76%".
 * @param {number} rate
 * @returns {string}
 */
export function formatPercent(rate) {
  const percent = roundHalfAwayFromZero(rate * 100);
  // Kotlin `toLong()` gives 0 for NaN.
  return `${numberText(Number.isNaN(percent) ? 0 : percent)}%`;
}

/**
 * The days from `from` to `to`. Examples: "Jul 6 – Oct 3, 2026", or "Nov 3, 2025 – Feb 1, 2026" across a year.
 * @param {Day} from
 * @param {Day} to
 * @returns {string}
 */
export function formatDateRange(from, to) {
  return from.year === to.year
    ? `${shortDay(from)} – ${shortDay(to)}, ${to.year}`
    : `${shortDay(from)}, ${from.year} – ${shortDay(to)}, ${to.year}`;
}

/**
 * The name and the year of `month`. Example: "October 2026".
 * @param {MonthKey} month
 * @returns {string}
 */
export function monthTitle(month) {
  return `${monthNames[month.month - 1]} ${month.year}`;
}

/**
 * The names of `first` and the month after it, `second`. Examples: "September – October 2026", or
 * "December 2025 – January 2026" across a year.
 * @param {MonthKey} first
 * @param {MonthKey} second
 * @returns {string}
 */
export function monthPairTitle(first, second) {
  return first.year === second.year
    ? `${monthNames[first.month - 1]} – ${monthTitle(second)}`
    : `${monthTitle(first)} – ${monthTitle(second)}`;
}

/**
 * The labels of `weeks`, the rows of `weekRows`: the first day of each row, with the month on the first row and when
 * the month changes. Example: "Sep 2", "7", "14", "21", "28", "Oct 5".
 * @param {(Day | null)[][]} weeks Each row has at least one day.
 * @returns {string[]}
 */
export function weekLabels(weeks) {
  /** @type {number | null} */
  let month = null;
  return weeks.map((week) => {
    const d = /** @type {Day} */ (week.find((day) => day !== null));
    if (d.month !== month) {
      month = d.month;
      return `${shortMonth(d.month)} ${d.day}`;
    }
    return `${d.day}`;
  });
}

/**
 * The quarter of `month`, from 1 to 4.
 * @param {number} month 1 = January.
 * @returns {number}
 */
export function quarterOf(month) {
  return Math.trunc((month + 2) / 3);
}

/**
 * The label under a bar that starts on `start`. Examples: "Sep 28" (week), "Sep" or "Jan ’26" (month), "Q3 ’26"
 * (quarter). A month shows its year in January and on the `first` bar. The apostrophe tells a year from a day:
 * "Feb ’24" is not "Feb 24".
 * @param {Day} start
 * @param {BarUnit} unit
 * @param {boolean} [first] False by default.
 * @returns {string}
 */
export function barLabel(start, unit, first = false) {
  switch (unit) {
    case BarUnit.DAY:
    case BarUnit.WEEK:
      return shortDay(start);
    case BarUnit.MONTH:
      return start.month === 1 || first ? `${shortMonth(start.month)} ’${shortYear(start)}` : shortMonth(start.month);
    case BarUnit.QUARTER:
      return `Q${quarterOf(start.month)} ’${shortYear(start)}`;
  }
}

/**
 * The name of a bar that starts on `start`, for a tooltip. Examples: "Week of Sep 28, 2026", "Sep 2026", "Q3 2026".
 * @param {Day} start
 * @param {BarUnit} unit
 * @returns {string}
 */
export function barTitle(start, unit) {
  switch (unit) {
    case BarUnit.DAY:
      return `${shortDay(start)}, ${start.year}`;
    case BarUnit.WEEK:
      return `Week of ${shortDay(start)}, ${start.year}`;
    case BarUnit.MONTH:
      return `${shortMonth(start.month)} ${start.year}`;
    case BarUnit.QUARTER:
      return `Q${quarterOf(start.month)} ${start.year}`;
  }
}

/**
 * The last 2 digits of the year of `day`, without a zero at the start, as Kotlin `year.mod(100)`. Example: 2026 → 26,
 * 2005 → 5.
 * @param {Day} day
 * @returns {number}
 */
function shortYear(day) {
  return ((day.year % 100) + 100) % 100;
}
