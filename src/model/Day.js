// Calendar days without time or time zone, and month helpers.

/** Day 0 of the Google Sheets date count, 1899-12-30, as days since 1970-01-01. */
const SHEETS_EPOCH_DAY = -25569;

/** The serial number of 9999-12-31, the last day that Google Sheets shows. */
const MAX_SERIAL = 2958465;

/** The one `Day` object of each epoch day. See {@link Day}. */
const days = new Map();

/**
 * A calendar day without time or time zone. Its text is `YYYY-MM-DD`.
 *
 * There is only one `Day` object for each date: get days with {@link Day.of}, {@link Day.fromEpochDay},
 * {@link Day.fromSerial} or {@link Day.tryParse}, not with `new`. So `===` compares two days, and a day can be a key of
 * a `Map` or an item of a `Set`. Example: `Day.of(2026, 9, 30) === Day.tryParse('2026-09-30')` is true.
 */
export class Day {
  /**
   * Use {@link Day.of} or {@link Day.fromEpochDay}. They give the one object of the date.
   * @param {number} epochDay
   * @param {number} year
   * @param {number} month
   * @param {number} day
   */
  constructor(epochDay, year, month, day) {
    /** The number of days since 1970-01-01. Negative before that day. */
    this.epochDay = epochDay;
    this.year = year;
    /** 1 = January. */
    this.month = month;
    /** The day of the month, 1 to 31. */
    this.day = day;
    Object.freeze(this);
  }

  /** @returns {number} 1 = Monday, 7 = Sunday. */
  get weekday() {
    return mod(this.epochDay + 3, 7) + 1;
  }

  /** @returns {number} The Google Sheets date serial number of this day. Example: 2026-10-02 → 46297. */
  get serial() {
    return this.epochDay - SHEETS_EPOCH_DAY;
  }

  /**
   * The day `n` days after this day, or before it if `n` is negative.
   * @param {number} n
   * @returns {Day}
   */
  addDays(n) {
    return Day.fromEpochDay(this.epochDay + n);
  }

  /**
   * Negative if this day is before `other`, 0 if it is the same day, positive if it is after.
   * @param {Day} other
   * @returns {number}
   */
  compareTo(other) {
    return this.epochDay - other.epochDay;
  }

  /**
   * True if this day is before `other`.
   * @param {Day} other
   * @returns {boolean}
   */
  isBefore(other) {
    return this.epochDay < other.epochDay;
  }

  /**
   * True if this day is after `other`.
   * @param {Day} other
   * @returns {boolean}
   */
  isAfter(other) {
    return this.epochDay > other.epochDay;
  }

  /** @returns {string} The day as `YYYY-MM-DD`. */
  toString() {
    return `${pad(this.year, 4)}-${pad(this.month, 2)}-${pad(this.day, 2)}`;
  }

  /**
   * The day of the year, month and day. Values out of range go into the next or previous months and years.
   * Examples: (2026, 13, 1) → 2027-01-01, (2026, 3, 0) → 2026-02-28.
   * @param {number} year
   * @param {number} month
   * @param {number} day
   * @returns {Day}
   */
  static of(year, month, day) {
    return Day.fromEpochDay(epochDayOf(year, month, day));
  }

  /**
   * The day that is `epochDay` days after 1970-01-01.
   * @param {number} epochDay A whole number.
   * @returns {Day}
   */
  static fromEpochDay(epochDay) {
    const known = days.get(epochDay);
    if (known) return known;
    // The days_from_civil algorithm in reverse, by Howard Hinnant. The year starts on March 1.
    const z = epochDay + 719468;
    const era = Math.trunc((z >= 0 ? z : z - 146096) / 146097);
    const dayOfEra = z - era * 146097;
    const yearOfEra = Math.trunc(
      (dayOfEra - Math.trunc(dayOfEra / 1460) + Math.trunc(dayOfEra / 36524) - Math.trunc(dayOfEra / 146096)) / 365,
    );
    const dayOfYear = dayOfEra - (365 * yearOfEra + Math.trunc(yearOfEra / 4) - Math.trunc(yearOfEra / 100));
    const shiftedMonth = Math.trunc((5 * dayOfYear + 2) / 153);
    const day = dayOfYear - Math.trunc((153 * shiftedMonth + 2) / 5) + 1;
    const month = shiftedMonth < 10 ? shiftedMonth + 3 : shiftedMonth - 9;
    const result = new Day(epochDay, yearOfEra + era * 400 + (month <= 2 ? 1 : 0), month, day);
    days.set(epochDay, result);
    return result;
  }

  /**
   * The day of a Google Sheets date serial number. A fraction (the time of day) is ignored. Null for a serial number
   * below 1 or after 9999-12-31, and for NaN. Example: 46297 → 2026-10-02.
   * @param {number} serial
   * @returns {Day | null}
   */
  static fromSerial(serial) {
    return serial >= 1 && serial < MAX_SERIAL + 1 ? Day.fromEpochDay(Math.floor(serial) + SHEETS_EPOCH_DAY) : null;
  }

  /**
   * The day of a `YYYY-MM-DD` text. Null if the text is not a valid date, for example 2026-02-30.
   * @param {string} text
   * @returns {Day | null}
   */
  static tryParse(text) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const result = Day.of(year, month, day);
    return result.year === year && result.month === month && result.day === day ? result : null;
  }

  /**
   * For `Array.prototype.sort`: oldest first.
   * @param {Day} a
   * @param {Day} b
   * @returns {number}
   */
  static compare(a, b) {
    return a.epochDay - b.epochDay;
  }
}

/**
 * The remainder of `a / b` with the sign of `b`. Example: mod(-1, 7) → 6.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function mod(a, b) {
  return ((a % b) + b) % b;
}

/**
 * The number as text with zeros at the start, to `width` digits.
 * @param {number} n
 * @param {number} width
 * @returns {string}
 */
function pad(n, width) {
  return String(n).padStart(width, '0');
}

/**
 * The days_from_civil algorithm by Howard Hinnant. The year starts on March 1, so February is the last month. Values
 * out of range go into the next or previous months and years: the algorithm gets the first day of the month in range,
 * and then the function adds `day` - 1 days.
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @returns {number}
 */
function epochDayOf(year, month, day) {
  const m = mod(month - 1, 12) + 1;
  const y = year + Math.floor((month - 1) / 12) - (m <= 2 ? 1 : 0);
  const era = Math.trunc((y >= 0 ? y : y - 399) / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.trunc((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5);
  const dayOfEra = yearOfEra * 365 + Math.trunc(yearOfEra / 4) - Math.trunc(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468 + day - 1;
}

/**
 * All days from `first` to `last`, oldest first. Empty if `last` is before `first`.
 * @param {Day} first
 * @param {Day} last
 * @returns {Day[]}
 */
export function daysBetween(first, last) {
  const result = [];
  for (let n = first.epochDay; n <= last.epochDay; n++) result.push(Day.fromEpochDay(n));
  return result;
}

/**
 * The earliest day. Null if there are no days.
 * @param {Iterable<Day>} days
 * @returns {Day | null}
 */
export function earliestDay(days) {
  /** @type {Day | null} */
  let earliest = null;
  for (const day of days) if (earliest === null || day.isBefore(earliest)) earliest = day;
  return earliest;
}

/**
 * A month of the calendar.
 * @typedef {{ year: number, month: number }} MonthKey
 */

/**
 * The month of the day.
 * @param {Day} day
 * @returns {MonthKey}
 */
export function monthOf(day) {
  return { year: day.year, month: day.month };
}

/**
 * The month `delta` months after `month`, or before it if `delta` is negative.
 * @param {MonthKey} month
 * @param {number} delta
 * @returns {MonthKey}
 */
export function addMonths(month, delta) {
  return monthOf(Day.of(month.year, month.month + delta, 1));
}

/**
 * True if the two months are the same month.
 * @param {MonthKey} a
 * @param {MonthKey} b
 * @returns {boolean}
 */
export function sameMonth(a, b) {
  return a.year === b.year && a.month === b.month;
}

/**
 * All days of the month, oldest first.
 * @param {MonthKey} month
 * @returns {Day[]}
 */
export function daysOfMonth(month) {
  return daysBetween(Day.of(month.year, month.month, 1), Day.of(month.year, month.month + 1, 0));
}

/**
 * The days in week rows, Monday to Sunday. Null fills the days before the first day and after the last day.
 * @param {Day[]} days At least one day.
 * @returns {(Day | null)[][]}
 */
export function weekRows(days) {
  /** @type {(Day | null)[]} */
  const slots = Array(days[0].weekday - 1).fill(null);
  slots.push(...days);
  while (slots.length % 7 !== 0) slots.push(null);
  const rows = [];
  for (let i = 0; i < slots.length; i += 7) rows.push(slots.slice(i, i + 7));
  return rows;
}
