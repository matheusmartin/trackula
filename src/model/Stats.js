// The numbers and charts of a metric in a period, for the detail screen.
import { Day, daysBetween, earliestDay } from './Day.js';
import { roundHalfAwayFromZero } from './Numbers.js';
import { metricValues } from './Summary.js';

/** @import { LogTable } from './LogEntry.js' */
/** @import { YesNoMetric } from './Metric.js' */

/**
 * A value on a day, for example the best day of a count.
 * @typedef {object} DayValue
 * @property {Day} day
 * @property {number} value
 */

/**
 * The yes/no states of `metric` in `log`: true for `yes`, false for `no`. Days without entry are left out. See
 * {@link metricValues}.
 * @param {YesNoMetric} metric
 * @param {LogTable} log
 * @returns {Map<Day, boolean>}
 */
export function yesNoStates(metric, log) {
  return new Map([...metricValues(metric, log)].map(([day, value]) => [day, value === 1]));
}

/**
 * The fields of a {@link YesNoStats}.
 * @typedef {object} YesNoStatsFields
 * @property {number} days
 * @property {number} yes
 * @property {number} no
 * @property {number} currentStreak
 * @property {number[]} streaks
 * @property {(number | null)[]} weekdayRates
 * @property {number[]} strength
 */

/** The numbers and charts of a yes/no metric in a period. */
export class YesNoStats {
  /** @param {YesNoStatsFields} fields */
  constructor({ days, yes, no, currentStreak, streaks, weekdayRates, strength }) {
    /** The number of days in the period. */
    this.days = days;
    /** The number of `yes` days in the period. */
    this.yes = yes;
    /** Missed days: `no`. */
    this.no = no;
    /** Consecutive `yes` days up to today. If today has no `yes` yet, up to yesterday. */
    this.currentStreak = currentStreak;
    /** The lengths of the runs of `yes` days in the period, oldest first. */
    this.streaks = streaks;
    /** The share of `yes` days for each weekday, Monday first. Null if the period has no such weekday. */
    this.weekdayRates = weekdayRates;
    /**
     * The habit strength of each day of the period, from 0 to 1: a `yes` day is 1, all other days from the first entry
     * are 0. See {@link strength}.
     */
    this.strength = strength;
    Object.freeze(this);
  }

  /** @returns {number} Days without entry. */
  get none() {
    return this.days - this.yes - this.no;
  }

  /** @returns {number} The share of `yes` days in the period, from 0 to 1. */
  get rate() {
    return this.days === 0 ? 0 : this.yes / this.days;
  }

  /** @returns {number} The longest run of `yes` days in the period. */
  get longestStreak() {
    return this.streaks.reduce((longest, streak) => Math.max(longest, streak), 0);
  }
}

/**
 * The habit strength grows with each good day and goes down slowly on other days, as in Loop Habit Tracker. It is an
 * exponential moving average with this weight for each new day. See {@link strength}.
 */
export const STRENGTH_WEIGHT = 0.05;

/**
 * The yes/no numbers of `states` for the period `days`. `today` is the last day of the period.
 * @param {Map<Day, boolean>} states
 * @param {Day[]} days
 * @param {Day} today
 * @returns {YesNoStats}
 */
export function yesNoStats(states, days, today) {
  return new YesNoStats({
    days: days.length,
    yes: days.filter((d) => states.get(d) === true).length,
    no: days.filter((d) => states.get(d) === false).length,
    currentStreak: currentStreak(states, today),
    streaks: streaks(states, days),
    weekdayRates: [1, 2, 3, 4, 5, 6, 7].map((weekday) => weekdayRate(states, days, weekday)),
    strength: strength(yesDays(states, days.at(-1) ?? null), days),
  });
}

/**
 * The lengths of the runs of `yes` days in `days`, oldest first.
 * @param {Map<Day, boolean>} states
 * @param {Day[]} days
 * @returns {number[]}
 */
function streaks(states, days) {
  const result = [];
  let run = 0;
  for (const d of days) {
    if (states.get(d) === true) {
      run++;
    } else if (run > 0) {
      result.push(run);
      run = 0;
    }
  }
  if (run > 0) result.push(run);
  return result;
}

/**
 * Consecutive `yes` days up to `today`. If `today` has no `yes` yet, up to the day before.
 * @param {Map<Day, boolean>} states
 * @param {Day} today
 * @returns {number}
 */
function currentStreak(states, today) {
  let streak = 0;
  let d = states.get(today) === true ? today : today.addDays(-1);
  while (states.get(d) === true) {
    streak++;
    d = d.addDays(-1);
  }
  return streak;
}

/**
 * The share of `yes` days among the days of `days` on `weekday`. Null if `days` has no such weekday.
 * @param {Map<Day, boolean>} states
 * @param {Day[]} days
 * @param {number} weekday
 * @returns {number | null}
 */
function weekdayRate(states, days, weekday) {
  const onWeekday = days.filter((d) => d.weekday === weekday);
  if (onWeekday.length === 0) return null;
  return onWeekday.filter((d) => states.get(d) === true).length / onWeekday.length;
}

/**
 * 1 for each `yes` day of `states` and 0 for each other day, from the first entry to `last`.
 * @param {Map<Day, boolean>} states
 * @param {Day | null} last
 * @returns {Map<Day, number>}
 */
function yesDays(states, last) {
  const first = earliestDay(states.keys());
  if (first === null || last === null) return new Map();
  return new Map(daysBetween(first, last).map((d) => [d, states.get(d) === true ? 1 : 0]));
}

/**
 * The strength of each day of `days`, from 0 to 1. `values`: the result of each day, from 0 (bad) to 1 (good), also
 * before `days`. Each day with a value moves the strength {@link STRENGTH_WEIGHT} of the way to the value. A day
 * without a value does not change it. Before the first value, the strength is 0.
 *
 * Example: 1 on 20 days gives 0.64 (1 − 0.95^20). Then 0 on one day gives 0.61.
 * @param {Map<Day, number>} values
 * @param {Day[]} days
 * @returns {number[]}
 */
export function strength(values, days) {
  const sorted = [...values].sort(([a], [b]) => Day.compare(a, b));
  let result = 0;
  let next = 0;
  return days.map((day) => {
    while (next < sorted.length && !sorted[next][0].isAfter(day)) {
      result += STRENGTH_WEIGHT * (sorted[next][1] - result);
      next++;
    }
    return result;
  });
}

/**
 * The number of `days` with a `value`, rounded to a whole number.
 * @typedef {object} ValueDays
 * @property {number} value
 * @property {number} days
 */

/**
 * The fields of a {@link CountStats}.
 * @typedef {object} CountStatsFields
 * @property {number} total
 * @property {number} logged
 * @property {DayValue | null} best
 * @property {(number | null)[]} weekdayAverages
 * @property {ValueDays[]} distribution
 * @property {number[]} running
 */

/** The numbers and charts of a count metric in a period. */
export class CountStats {
  /** @param {CountStatsFields} fields */
  constructor({ total, logged, best, weekdayAverages, distribution, running }) {
    /** The sum of the values in the period. */
    this.total = total;
    /** The number of days with a value. */
    this.logged = logged;
    /** The day with the highest value. Null if no day has a value. */
    this.best = best;
    /** The average of the days with a value for each weekday, Monday first. Null if no such day has a value. */
    this.weekdayAverages = weekdayAverages;
    /** For each value (rounded to a whole number), the number of days with it, from the lowest value. */
    this.distribution = distribution;
    /** The total up to each day of the period. */
    this.running = running;
    Object.freeze(this);
  }

  /** @returns {number | null} The average of the days with a value. Null if no day has a value. */
  get average() {
    return this.logged === 0 ? null : this.total / this.logged;
  }
}

/**
 * The count numbers of `values` for the period `days`.
 * @param {Map<Day, number>} values
 * @param {Day[]} days
 * @returns {CountStats}
 */
export function countStats(values, days) {
  const present = presentDays(values, days);
  let total = 0;
  const running = days.map((d) => {
    total += values.get(d) ?? 0;
    return total;
  });
  /** @type {Map<number, number>} */
  const counts = new Map();
  for (const p of present) {
    const key = roundHalfAwayFromZero(p.value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new CountStats({
    total,
    logged: present.length,
    best: highest(present),
    weekdayAverages: [1, 2, 3, 4, 5, 6, 7].map((weekday) => average(present.filter((p) => p.day.weekday === weekday))),
    distribution: [...counts].map(([value, n]) => ({ value, days: n })).sort((a, b) => a.value - b.value),
    running,
  });
}

/**
 * A range of values and the number of days in it.
 * @typedef {object} Bin
 * @property {number} from The lowest value of the range.
 * @property {number} to The end of the range. The last range of a histogram includes it.
 * @property {number} days The number of days with a value in the range.
 */

/**
 * The fields of a {@link NumberStats}.
 * @typedef {object} NumberStatsFields
 * @property {DayValue | null} latest
 * @property {number | null} change
 * @property {DayValue | null} low
 * @property {DayValue | null} high
 * @property {(number | null)[]} values
 * @property {(number | null)[]} trend
 * @property {Bin[]} histogram
 */

/** The numbers and charts of a number metric in a period. */
export class NumberStats {
  /** @param {NumberStatsFields} fields */
  constructor({ latest, change, low, high, values, trend, histogram }) {
    /** The last value of the period. Null if no day has a value. */
    this.latest = latest;
    /** The last value minus the first value of the period. Null with fewer than 2 values. */
    this.change = change;
    /** The first day with the lowest value. Null if no day has a value. */
    this.low = low;
    /** The first day with the highest value. Null if no day has a value. */
    this.high = high;
    /** The value of each day of the period. Null if the day has no value. */
    this.values = values;
    /**
     * The trend of each day, also from the values before the period. Null before the first value. See {@link trend}.
     */
    this.trend = trend;
    /** The values in {@link HISTOGRAM_BINS} ranges of the same width, from the lowest value. */
    this.histogram = histogram;
    Object.freeze(this);
  }

  /** @returns {number} The number of days with a value. */
  get logged() {
    return this.values.filter((v) => v !== null).length;
  }

  /** @returns {number | null} The average of the days with a value. Null if no day has a value. */
  get average() {
    const logged = this.logged;
    if (logged === 0) return null;
    let sum = 0;
    for (const v of this.values) if (v !== null) sum += v;
    return sum / logged;
  }
}

/** The weight of each new value in the trend: a 7-day smoothing, as in the Libra weight app (2 / (7 + 1)). */
export const TREND_WEIGHT = 0.25;

/**
 * The trend of `values` on each day of `values`, oldest first: an exponential moving average. The trend of the first
 * day is its value. Each later value moves the trend {@link TREND_WEIGHT} of the way to it. The number charts show it
 * as a line, and a goal with `trend` gives its points from it (see `NumberGoal.usesTrend`).
 *
 * Example: the trend 82.4 and the next value 82.0 give 82.3.
 * @param {Map<Day, number>} values
 * @returns {Map<Day, number>}
 */
export function trend(values) {
  /** @type {Map<Day, number>} */
  const result = new Map();
  /** @type {number | null} */
  let current = null;
  for (const day of [...values.keys()].sort(Day.compare)) {
    const value = /** @type {number} */ (values.get(day));
    current = current === null ? value : current + TREND_WEIGHT * (value - current);
    result.set(day, current);
  }
  return result;
}

/** The number of ranges in {@link NumberStats#histogram}. */
export const HISTOGRAM_BINS = 8;

/**
 * The numbers of a number metric: `values` in the period `days`.
 * @param {Map<Day, number>} values
 * @param {Day[]} days
 * @returns {NumberStats}
 */
export function numberStats(values, days) {
  const present = presentDays(values, days);
  return new NumberStats({
    latest: present.at(-1) ?? null,
    change: present.length < 2 ? null : present[present.length - 1].value - present[0].value,
    low: lowest(present),
    high: highest(present),
    values: days.map((d) => values.get(d) ?? null),
    trend: trendOfDays(values, days),
    histogram: histogram(present),
  });
}

/**
 * The trend of each day of `days`: the {@link trend} of the last day with a value. See {@link NumberStats#trend}.
 * @param {Map<Day, number>} values
 * @param {Day[]} days
 * @returns {(number | null)[]}
 */
function trendOfDays(values, days) {
  const trends = [...trend(values)];
  let next = 0;
  /** @type {number | null} */
  let current = null;
  return days.map((day) => {
    while (next < trends.length && !trends[next][0].isAfter(day)) current = trends[next++][1];
    return current;
  });
}

/**
 * The values of `present` in {@link HISTOGRAM_BINS} ranges. One range if all values are equal. Empty if `present` is
 * empty.
 * @param {DayValue[]} present
 * @returns {Bin[]}
 */
function histogram(present) {
  if (present.length === 0) return [];
  const low = present.reduce((min, p) => Math.min(min, p.value), Infinity);
  const high = present.reduce((max, p) => Math.max(max, p.value), -Infinity);
  const width = high === low ? 1 : (high - low) / HISTOGRAM_BINS;
  const counts = Array(high === low ? 1 : HISTOGRAM_BINS).fill(0);
  for (const p of present) counts[Math.min(counts.length - 1, Math.floor((p.value - low) / width))]++;
  return counts.map((n, i) => ({ from: low + i * width, to: low + (i + 1) * width, days: n }));
}

/**
 * The days of `days` that have a value in `values`, oldest first.
 * @param {Map<Day, number>} values
 * @param {Day[]} days
 * @returns {DayValue[]}
 */
function presentDays(values, days) {
  /** @type {DayValue[]} */
  const result = [];
  for (const day of days) {
    const value = values.get(day);
    if (value !== undefined) result.push({ day, value });
  }
  return result;
}

/**
 * The first day with the highest value of `values`. Null if `values` is empty.
 * @param {DayValue[]} values
 * @returns {DayValue | null}
 */
function highest(values) {
  /** @type {DayValue | null} */
  let high = null;
  for (const p of values) if (high === null || p.value > high.value) high = p;
  return high;
}

/**
 * The first day with the lowest value of `values`. Null if `values` is empty. It compares with `<`, so -0 and 0 are
 * equal.
 * @param {DayValue[]} values
 * @returns {DayValue | null}
 */
function lowest(values) {
  /** @type {DayValue | null} */
  let low = null;
  for (const p of values) if (low === null || p.value < low.value) low = p;
  return low;
}

/**
 * The average of `values`. Null if `values` is empty.
 * @param {DayValue[]} values
 * @returns {number | null}
 */
function average(values) {
  if (values.length === 0) return null;
  let sum = 0;
  for (const p of values) sum += p.value;
  return sum / values.length;
}

/**
 * A range of streak lengths in days.
 * @typedef {object} StreakRange
 * @property {number} from
 * @property {number | null} to Null: the range has no end.
 */

/**
 * The ranges of streak lengths in days, for {@link streakLengths}. The last range has no end.
 * @type {StreakRange[]}
 */
export const streakRanges = [
  { from: 1, to: 1 },
  { from: 2, to: 2 },
  { from: 3, to: 3 },
  { from: 4, to: 6 },
  { from: 7, to: 13 },
  { from: 14, to: 29 },
  { from: 30, to: null },
];

/**
 * The number of `streaks` in each range of {@link streakRanges}. Example: streaks 1, 2, 2, 5 → 1, 2, 0, 1, 0, 0, 0.
 * @param {number[]} streaks
 * @returns {number[]}
 */
export function streakLengths(streaks) {
  return streakRanges.map(({ from, to }) => streaks.filter((s) => s >= from && (to === null || s <= to)).length);
}

/**
 * The weekday with the highest of `averages`, Monday first: 1 is Monday, 7 is Sunday. Null if no weekday has a value.
 * If 2 weekdays have the same average, the first one. Example: {@link CountStats#weekdayAverages} of the score.
 * @param {(number | null)[]} averages
 * @returns {number | null}
 */
export function bestWeekday(averages) {
  const values = averages.filter((a) => a !== null);
  if (values.length === 0) return null;
  const high = Math.max(...values);
  return averages.findIndex((a) => a !== null && Object.is(a, high)) + 1;
}
