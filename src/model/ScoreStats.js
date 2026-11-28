// The numbers of the score view: the halves of the period, the weekdays, the weeks and the months.
import { addMonths, daysBetween, daysOfMonth, monthOf } from './Day.js';
import { withoutFloatNoise } from './LogEntry.js';
import { BarUnit, barStart } from './Zoom.js';

/** @import { Day, MonthKey } from './Day.js' */

/** The weekdays, Monday (1) first. */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/**
 * The first half and the second half of `days`. With an odd number of days, the second half has one day more.
 * Example: the 14 days from 2026-10-01 to 2026-10-14 give 2026-10-01 to 2026-10-07 and 2026-10-08 to 2026-10-14.
 *
 * The score view compares the 2 halves, not the period with the days before it: at All, no day comes before.
 * @param {Day[]} days
 * @returns {[Day[], Day[]]}
 */
export function halves(days) {
  const half = Math.trunc(days.length / 2);
  return [days.slice(0, half), days.slice(half)];
}

/**
 * The part of each group in the weekday averages of the score. `groups`: the part of each group in the score of each
 * day (see `groupParts`). For each group and each weekday, Monday first: the sum of the group part on the days of
 * `days` with a `total` score on that weekday, divided by the number of these days. A day without a group part counts
 * as 0. So the parts of a weekday add up to the weekday average of `total`. Null if no day of the weekday has a score.
 *
 * Example: 2 Mondays with the total 40 and 60. The group "habits" has 30 and 50, the group "body" 10 and 10. The parts
 * of Monday are 40 for "habits" and 10 for "body". Their sum is 50, the average of the total.
 * @param {Map<Day, number>} total
 * @param {Map<string, Map<Day, number>>} groups
 * @param {Day[]} days
 * @returns {Map<string, (number | null)[]>}
 */
export function groupWeekdayParts(total, groups, days) {
  const scored = days.filter((d) => total.has(d));
  return new Map(
    [...groups].map(([group, scores]) => [
      group,
      WEEKDAYS.map((weekday) => {
        const onWeekday = scored.filter((d) => d.weekday === weekday);
        if (onWeekday.length === 0) return null;
        let sum = 0;
        for (const d of onWeekday) sum += scores.get(d) ?? 0;
        return withoutFloatNoise(sum / onWeekday.length);
      }),
    ]),
  );
}

/** The number of weeks before the week of the window end that the week charts of the score view show. */
export const COMPARED_WEEKS = 4;

/** The number of months before the month of the window end that the month table of the score view shows. */
export const COMPARED_MONTHS = 3;

/**
 * The days from Monday to the weekday of `end`, in the week of `end` or `weeksBefore` weeks before it. Weeks start on
 * Monday. Example: Wednesday 2026-10-07 and 1 week before give 2026-09-28 to 2026-09-30.
 * @param {Day} end
 * @param {number} weeksBefore
 * @returns {Day[]}
 */
function sameWeekdays(end, weeksBefore) {
  const monday = barStart(end, BarUnit.WEEK).addDays(-7 * weeksBefore);
  return daysBetween(monday, monday.addDays(end.weekday - 1));
}

/**
 * The numbers from `n` down to 0. Example: 3 → 3, 2, 1, 0.
 * @param {number} n
 * @returns {number[]}
 */
function downToZero(n) {
  return Array.from({ length: n + 1 }, (_, i) => n - i);
}

/**
 * The Monday of the week of `end` and of each of the `weeks` weeks before it, oldest first.
 * @param {Day} end
 * @param {number} weeks
 * @returns {Day[]}
 */
export function weekMondays(end, weeks) {
  return downToZero(weeks).map((n) => barStart(end, BarUnit.WEEK).addDays(-7 * n));
}

/**
 * The average score of each part of the score in each period of `periods`, in their order, by part id. `parts`: the
 * score of each part by day, from 0 to 100, for example the score of each group or the points of each metric as a
 * percentage. Each average uses the days of the period with a score of that part. A period without such a day has
 * null. A part without a score on the days of `periods` is not in the result.
 * @param {Map<string, Map<Day, number>>} parts
 * @param {Day[][]} periods
 * @returns {Map<string, (number | null)[]>}
 */
function averagePerPeriod(parts, periods) {
  /** @type {Map<string, (number | null)[]>} */
  const result = new Map();
  for (const [id, byDay] of parts) {
    const averages = periods.map((days) => {
      /** @type {number[]} */
      const scores = [];
      for (const d of days) {
        const score = byDay.get(d);
        if (score !== undefined) scores.push(score);
      }
      return scores.length === 0 ? null : withoutFloatNoise(averageOf(scores));
    });
    if (averages.some((a) => a !== null)) result.set(id, averages);
  }
  return result;
}

/**
 * The average score of each part of the score in each of the `weeks` weeks before the week of `end` and in that week,
 * oldest first, by part id. Each week has the same weekdays as the week of `end`: from Monday to the weekday of `end`.
 * `parts` and the result: as in `averagePerPeriod`.
 *
 * Example: `end` is a Tuesday. Habits has 50 and 100 on the Monday and the Tuesday of a week: 75 for that week.
 * @param {Map<string, Map<Day, number>>} parts
 * @param {Day} end
 * @param {number} weeks
 * @returns {Map<string, (number | null)[]>}
 */
export function weeklyAverages(parts, end, weeks) {
  return averagePerPeriod(
    parts,
    downToZero(weeks).map((n) => sameWeekdays(end, n)),
  );
}

/**
 * The month of `end` and each of the `months` months before it, oldest first.
 * @param {Day} end
 * @param {number} months
 * @returns {MonthKey[]}
 */
export function monthsUntil(end, months) {
  return downToZero(months).map((n) => addMonths(monthOf(end), -n));
}

/**
 * The average score of each part of the score in each of the `months` months before the month of `end` and in that
 * month up to `end`, oldest first, by part id. `parts` and the result: as in `averagePerPeriod`.
 *
 * Example: `end` is 2026-11-10. Habits has 80 on 10 days of October and 50 on 20 days: 60 for October. The days of
 * November after the 10th do not count.
 * @param {Map<string, Map<Day, number>>} parts
 * @param {Day} end
 * @param {number} months
 * @returns {Map<string, (number | null)[]>}
 */
export function monthlyAverages(parts, end, months) {
  return averagePerPeriod(
    parts,
    monthsUntil(end, months).map((month) => daysOfMonth(month).filter((d) => !d.isAfter(end))),
  );
}

/**
 * The change of each of `values` from the value before it. Null for the first value, and if the value or the value
 * before it is null. Example: 5, 6.5, null, 4 give null, 1.5, null, null.
 * @param {(number | null)[]} values
 * @returns {(number | null)[]}
 */
export function stepChanges(values) {
  return values.map((v, i) => {
    const before = i > 0 ? values[i - 1] : null;
    return v === null || before === null ? null : withoutFloatNoise(v - before);
  });
}

/**
 * The average of `values`: the sum in order, divided by the number of values. NaN if `values` is empty.
 * @param {number[]} values
 * @returns {number}
 */
function averageOf(values) {
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}
