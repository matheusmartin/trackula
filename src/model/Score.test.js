import { describe, expect, test } from 'vitest';
import { Day } from './Day.js';
import { metricDayKey, withoutFloatNoise } from './LogEntry.js';
import { NumberGoal, NumberMetric, YesNoMetric } from './Metric.js';
import { metricsHeader, parseLog, parseMetrics } from './Parse.js';
import {
  SCORE_HEADER,
  dayScores,
  groupParts,
  groupScoreMetric,
  groupScores,
  isScore,
  metricPoints,
  pointsByMetric,
  pointsOf,
  scoreColumn,
  scoreMetric,
  staleScoreCells,
} from './Score.js';
import { numberStats } from './Stats.js';
import { metricValues } from './Summary.js';
import { byId, meditate, rows } from './testing/Fixtures.js';

/** @import { Cell } from './Parse.js' */

/**
 * The values without float noise.
 * @param {Map<Day, number> | undefined} values
 * @returns {Map<Day, number> | undefined}
 */
function rounded(values) {
  return values && new Map([...values].map(([day, value]) => [day, withoutFloatNoise(value)]));
}

describe('Score', () => {
  const weight = new NumberMetric({
    id: 'weight',
    name: 'Weight',
    icon: 'monitor_weight',
    unit: 'kg',
    step: 0.1,
    goal: new NumberGoal({ target: 80, isMaximum: true, from: 83 }),
  });
  const weightTrend = weight.copy({ goal: new NumberGoal({ target: 80, isMaximum: true, from: 83, usesTrend: true }) });
  const water = new NumberMetric({
    id: 'water',
    name: 'Water',
    icon: 'water_drop',
    isCount: true,
    goal: new NumberGoal({ target: 8 }),
  });
  const smoke = new YesNoMetric({ id: 'smoke', name: 'Smoke', icon: 'smoking_rooms', goalIsYes: false });
  const meditateNo = meditate.copy({ goalIsYes: false });
  const d28 = Day.of(2026, 9, 28);
  const d29 = Day.of(2026, 9, 29);
  const d30 = Day.of(2026, 9, 30);
  const oct1 = Day.of(2026, 10, 1);
  const oct2 = Day.of(2026, 10, 2);

  test('metricPoints of a yes/no metric gives 1 if the value is the goal', () => {
    expect(metricPoints(meditate, 1)).toBe(1);
    expect(metricPoints(meditate, 0)).toBe(0);
    expect(metricPoints(smoke, 0)).toBe(1);
    expect(metricPoints(smoke, 1)).toBe(0);
  });

  test('metricPoints of a number and a count give the points of the goal', () => {
    expect([6, 12, -3].map((v) => metricPoints(water, v))).toEqual([0.75, 1, 0]);
    expect([82.1, 79.5].map((v) => withoutFloatNoise(metricPoints(weight, v)))).toEqual([0.3, 1]);
  });

  /** Sep 29: weight 82.1, water 6, meditate yes, smoke no. Sep 30: weight 81, meditate no. */
  const dayMetrics = [weight, water, meditate, smoke];
  const dayLog = parseLog(
    rows(
      ['date', 'weight', 'water', 'meditate', 'smoke'],
      ['2026-09-29', 82.1, 6, 'yes', 'no'],
      ['2026-09-30', 81, '', 'no'],
    ),
    byId(...dayMetrics),
  ).table;

  test('pointsByMetric gives the points of the yes/no and count metrics from their first value to today', () => {
    const points = pointsByMetric(dayMetrics, dayLog, oct2);
    expect(points.get('water')).toEqual(
      new Map([
        [d29, 0.75],
        [d30, 0],
        [oct1, 0],
        [oct2, 0],
      ]),
    );
    expect(points.get('meditate')).toEqual(
      new Map([
        [d29, 1],
        [d30, 0],
        [oct1, 0],
        [oct2, 0],
      ]),
    );
    // Without today, only the days with a row. Smoke has the goal no: the day without a value is a no day.
    expect(pointsByMetric(dayMetrics, dayLog).get('smoke')).toEqual(
      new Map([
        [d29, 1],
        [d30, 1],
      ]),
    );
  });

  test('a day without a value has the value 0: no for yes/no, and 0 for a count', () => {
    const coffee = new NumberMetric({
      id: 'coffee',
      name: 'Coffee',
      icon: 'coffee',
      isCount: true,
      goal: new NumberGoal({ target: 2, isMaximum: true }),
    });
    const log = parseLog(
      rows(['date', 'coffee', 'smoke'], ['2026-09-28', 1, 'no'], ['2026-09-29'], ['2026-09-30', 3, 'yes']),
      byId(coffee, smoke),
    ).table;
    // 0 coffees on Sep 29 reach the goal at most 2. 3 coffees do not.
    const points = pointsByMetric([coffee, smoke], log, d30);
    const expected = new Map([
      [d28, 1],
      [d29, 1],
      [d30, 0],
    ]);
    expect(points.get('coffee')).toEqual(expected);
    expect(points.get('smoke')).toEqual(expected);
    const from4 = coffee.copy({ goal: new NumberGoal({ target: 2, isMaximum: true, from: 4 }) });
    expect(pointsByMetric([from4], log).get('coffee')).toEqual(
      new Map([
        [d28, 1],
        [d29, 1],
        [d30, 0.5],
      ]),
    );
  });

  test('a row after today counts, but the days before it do not', () => {
    const log = parseLog(rows(['date', 'meditate'], ['2026-09-29', 'yes'], ['2026-10-10']), byId(meditate)).table;
    expect(pointsByMetric([meditate], log, oct1).get('meditate')).toEqual(
      new Map([
        [d29, 1],
        [d30, 0],
        [oct1, 0],
        [Day.of(2026, 10, 10), 0],
      ]),
    );
  });

  test('pointsByMetric leaves out a metric with a goal but without values', () => {
    const log = parseLog(rows(['date', 'meditate'], ['2026-09-29', 'yes']), byId(meditate, water)).table;
    expect([...pointsByMetric([water, meditate], log, oct1).keys()]).toEqual(['meditate']);
  });

  test('pointsByMetric counts a number metric only on the days with a value', () => {
    const points = /** @type {Map<Day, number>} */ (pointsByMetric(dayMetrics, dayLog, oct2).get('weight'));
    expect([...points.keys()]).toEqual([d29, d30]);
    expect([...points.values()].map(withoutFloatNoise)).toEqual([0.3, 0.666667]);
  });

  test('pointsByMetric uses the trend for a goal with trend', () => {
    const log = parseLog(rows(['date', 'weight'], ['2026-09-28', 83], ['2026-09-29', 81]), byId(weightTrend)).table;
    // The trend of Sep 29 is 82.5, not 81.
    expect(rounded(pointsByMetric([weightTrend], log).get('weight'))).toEqual(
      new Map([
        [d28, 0],
        [d29, 0.166667],
      ]),
    );
  });

  test('a trend goal uses the same trend as the number charts', () => {
    const log = parseLog(
      rows(
        ['date', 'weight'],
        ['2026-09-28', 83],
        ['2026-09-29', 81],
        // The last row of Sep 29 has no value: Sep 29 has no value.
        ['2026-09-29', ''],
        ['2026-09-30', 81],
      ),
      byId(weightTrend),
    ).table;
    const chartTrend = numberStats(metricValues(weightTrend, log), [d28, d29, d30]).trend;
    const points = /** @type {Map<Day, number>} */ (pointsByMetric([weightTrend], log).get('weight'));
    expect([...points.keys()]).toEqual([d28, d30]);
    expect(points.get(d30)).toBe(weightTrend.goal.points(/** @type {number} */ (chartTrend.at(-1))));
  });

  test('dayScores is the average of the points as a percentage with 1 decimal', () => {
    const points = new Map([
      [
        'a',
        new Map([
          [d29, 1],
          [d30, 0],
        ]),
      ],
      ['b', new Map([[d29, 0.75]])],
      ['c', new Map([[d29, 0]])],
    ]);
    expect(dayScores(points)).toEqual(
      new Map([
        [d29, 58.3],
        [d30, 0],
      ]),
    );
    // Weight 0.3, water 0.75, meditate 1 and smoke 1. Then weight 0.67, smoke 1 (no value is no) and 0 for the
    // others.
    expect(dayScores(pointsByMetric(dayMetrics, dayLog))).toEqual(
      new Map([
        [d29, 76.3],
        [d30, 41.7],
      ]),
    );
  });

  test('a day without a row has the score 0 after the first value', () => {
    const log = parseLog(rows(['date', 'meditate'], ['2026-09-29', 'yes']), byId(meditate)).table;
    const scores = dayScores(pointsByMetric([meditate], log, oct1));
    expect(scores).toEqual(
      new Map([
        [d29, 100],
        [d30, 0],
        [oct1, 0],
      ]),
    );
    expect(scores.has(d28)).toBe(false);
  });

  test('dayScores includes the count taps that are not written yet', () => {
    const pending = new Map([
      [metricDayKey('water', d30), [{ delta: 1 }, { delta: 1 }]],
      [metricDayKey('water', d29), [{ delta: -1 }]],
    ]);
    // Water 5 (0.625) on Sep 29 and 2 (0.25) on Sep 30.
    expect(dayScores(pointsByMetric(dayMetrics, dayLog, null, pending))).toEqual(
      new Map([
        [d29, 73.1],
        [d30, 47.9],
      ]),
    );
  });

  test('dayScores ignores taps on a yes/no metric and removes a day that the taps empty', () => {
    const pending = new Map([
      [metricDayKey('meditate', d30), [{ delta: 1 }]],
      [metricDayKey('water', d29), [{ delta: -3 }]],
    ]);
    const log = parseLog(rows(['date', 'water'], ['2026-09-29', 3]), byId(water, meditate)).table;
    expect(dayScores(pointsByMetric([water, meditate], log, null, pending))).toEqual(new Map());
  });

  test('a goal change changes the score', () => {
    expect(dayScores(pointsByMetric([meditateNo], dayLog))).toEqual(
      new Map([
        [d29, 0],
        [d30, 100],
      ]),
    );
  });

  test('a day with more than one row counts only the last row', () => {
    const duplicate = parseLog(
      rows(['date', 'weight', 'meditate'], ['2026-09-29', 79, 'yes'], ['2026-09-29', '', 'yes']),
      byId(...dayMetrics),
    ).table;
    expect(dayScores(pointsByMetric(dayMetrics, duplicate))).toEqual(new Map([[d29, 100]]));
  });

  const grouped = [
    weight.copy({ group: 'body' }),
    water.copy({ group: 'habits' }),
    meditate.copy({ group: 'habits' }),
    smoke.copy({ group: 'habits' }),
  ];

  test('pointsOf gives the points of the metrics of a group', () => {
    const points = pointsByMetric(grouped, dayLog);
    expect([...pointsOf(grouped, 'body', points).keys()]).toEqual(['weight']);
    expect(pointsOf(grouped, null, points)).toEqual(points);
  });

  test('groupScores are the scores of the metrics of each group', () => {
    const groups = groupScores(grouped, ['body', 'habits'], pointsByMetric(grouped, dayLog));
    expect(groups.get('body')).toEqual(
      new Map([
        [d29, 30],
        [d30, 66.7],
      ]),
    );
    expect(groups.get('habits')).toEqual(
      new Map([
        [d29, 91.7],
        [d30, 33.3],
      ]),
    );
  });

  test('groupParts add up to the score of the day', () => {
    const parts = groupParts(grouped, ['body', 'habits'], pointsByMetric(grouped, dayLog));
    expect(parts.get('body')).toEqual(
      new Map([
        [d29, 7.5],
        [d30, 16.666667],
      ]),
    );
    expect(parts.get('habits')).toEqual(
      new Map([
        [d29, 68.75],
        [d30, 25],
      ]),
    );
    expect([...parts.values()].reduce((sum, days) => sum + /** @type {number} */ (days.get(d29)), 0)).toBe(76.25);
  });

  test('staleScoreCells finds the score cells that do not show the score of their day', () => {
    const cells = staleScoreCells(
      rows(
        ['date', 'water', 'meditate', 'Score'],
        ['2026-09-26', '', '', ''],
        ['2026-09-27', 4, 'yes', 75],
        ['2026-09-28', 8, 'yes', 3],
        ['2026-09-29', 2, 'no'],
        ['2026-09-30', '', '', 5],
        ['2026-10-01', '', 'no', ''],
        ['2026-10-02', 4, '', 'x'],
        ['bad date', 1, 'yes', 2],
        ['2026-10-03'],
      ),
      [water, meditate],
      3,
    );
    // Sep 26 is before the first value: no score. Sep 30 and Oct 3 have only a date: 0.
    expect(cells).toEqual([
      { row: 4, score: 100 },
      { row: 5, score: 12.5 },
      { row: 6, score: 0 },
      { row: 7, score: 0 },
      { row: 8, score: 25 },
      { row: 9, score: null },
      { row: 10, score: 0 },
    ]);
  });

  test('a past value or a goal change in the sheet makes the score stale', () => {
    const metrics = [water, meditate];
    const header = ['date', 'water', 'meditate', 'Score'];
    const sheet = rows(header, ['2026-09-29', 4, 'yes', 75]);
    expect(staleScoreCells(sheet, metrics, 3)).toEqual([]);

    const edited = rows(header, ['2026-09-29', 8, 'yes', 75]);
    expect(staleScoreCells(edited, metrics, 3)).toEqual([{ row: 2, score: 100 }]);

    expect(staleScoreCells(sheet, [water, meditateNo], 3)).toEqual([{ row: 2, score: 25 }]);
  });

  test('a changed value also changes the score of the later days of a trend', () => {
    /** @type {Cell[][]} */
    const sheet = [
      ['date', 'weight', 'Score'],
      ['2026-09-28', 83, 0],
      ['2026-09-29', 81, 16.7],
    ];
    expect(staleScoreCells(sheet, [weightTrend], 2)).toEqual([]);
    sheet[1] = ['2026-09-28', 84, 0];
    expect(staleScoreCells(sheet, [weightTrend], 2)).toEqual([{ row: 3, score: 0 }]);
  });

  test('each row of a day with more than one row gets the score of the day', () => {
    expect(
      staleScoreCells(rows(['date', 'water', 'Score'], ['2026-09-29', 8, ''], ['2026-09-29', 4, '']), [water], 2),
    ).toEqual([
      { row: 2, score: 50 },
      { row: 3, score: 50 },
    ]);
  });

  test('staleScoreCells replaces a score stored as text with the number', () => {
    expect(
      staleScoreCells(
        rows(['date', 'water', 'Score'], ['2026-09-29', 4, '50'], ['2026-09-30', '', ' ']),
        [water, meditate],
        2,
      ),
    ).toEqual([
      { row: 2, score: 50 },
      { row: 3, score: 0 },
    ]);
  });

  test('staleScoreCells replaces a checkbox value with the score', () => {
    expect(
      staleScoreCells(rows(['date', 'water', 'Score'], ['2026-09-29', '', false], ['2026-09-30', 4, true]), [water], 2),
    ).toEqual([
      { row: 2, score: null },
      { row: 3, score: 50 },
    ]);
  });

  test('scoreColumn finds the score header, not a metric id', () => {
    expect(scoreColumn(['date', 'score', ' Score '])).toBe(2);
    expect(scoreColumn(['date', 'water'])).toBeNull();
  });

  test('the score metric is not a valid metric id, so no metric can be the score', () => {
    const p = parseMetrics(rows(metricsHeader, [SCORE_HEADER, 'Score', 'count', '', '', '', 'star']));
    expect(p.items).toEqual([]);
    expect(isScore(scoreMetric)).toBe(true);
    expect(isScore(water)).toBe(false);
  });

  test('a group score metric is a score with the group in its id and its name', () => {
    const habits = groupScoreMetric('habits', 'Habits');
    expect([habits.id, habits.name]).toEqual(['Score:habits', 'Score · Habits']);
    expect(isScore(habits)).toBe(true);
    expect([habits.unit, habits.isCount]).toEqual(['%', true]);
  });

  test('the score metric has no icon', () => {
    expect(scoreMetric.icon).toBe('');
  });
});
