import { describe, expect, test } from 'vitest';
import { Day } from '../model/Day.js';
import { planCount, planYesNo } from '../model/LogEntry.js';
import { NumberGoal, YesNoMetric } from '../model/Metric.js';
import { planDeleteMetric, planMoveMetric, planSaveMetric } from '../model/MetricsWrite.js';
import { LOG_TITLE, METRICS_TITLE, metricsHeader, parseMetrics } from '../model/Parse.js';
import { goalRulePattern } from './SheetsStore.js';
import { FakeSheets } from './testing/FakeSheets.js';

/** @import { Metric, NumberMetric } from '../model/Metric.js' */
/** @import { MetricsWrite } from '../model/MetricsWrite.js' */

describe('SheetsStore', () => {
  const d1 = Day.of(2026, 9, 29);
  const d2 = Day.of(2026, 9, 30);
  const d3 = Day.of(2026, 10, 1);

  /**
   * A sheet with goals and a `Log` tab without the `Score` column. The `Log` tab has no free column.
   * @returns {FakeSheets}
   */
  const sheetWithoutScore = () =>
    new FakeSheets({
      metrics: [
        [...metricsHeader],
        ['weight', 'Weight', 'number', 'kg', 0.1, 'body', 'monitor_weight', 'at most 80'],
        ['meditate', 'Meditate', 'yesno', '', '', 'habits', 'self_improvement', 'yes'],
        ['water', 'Water', 'count', 'glasses', 1, 'habits', 'water_drop', 4],
      ],
      log: [
        ['date', 'weight', 'meditate', 'water'],
        // Weight 1 (at most 80), meditate 1 (yes), water 0.5 (2 of 4): 2.5 / 3 = 83.3.
        [d1.serial, 79.5, 'yes', 2],
        // Weight 0, meditate 0, water 0 (no value after the first value): 0.
        [d2.serial, 82, 'no'],
        // Only a date: meditate 0 and water 0. Weight has no value, so it does not count: 0.
        [d3.serial],
      ],
      logColumns: 4,
    });

  /**
   * @param {FakeSheets} fake
   * @param {string} id
   * @returns {Promise<Metric>}
   */
  const metric = async (fake, id) => /** @type {Metric} */ ((await fake.store.load()).metrics.find((m) => m.id === id));

  /**
   * @param {FakeSheets} fake
   * @param {string} id
   * @returns {Promise<NumberMetric>}
   */
  const numberMetric = async (fake, id) => /** @type {NumberMetric} */ (await metric(fake, id));

  /**
   * @param {FakeSheets} fake
   * @param {string} id
   * @returns {Promise<YesNoMetric>}
   */
  const yesNoMetric = async (fake, id) => /** @type {YesNoMetric} */ (await metric(fake, id));

  /**
   * The write of `write` in a list, or an empty list if it is null.
   * @param {MetricsWrite | null} write
   * @returns {MetricsWrite[]}
   */
  const listOfNotNull = (write) => (write === null ? [] : [write]);

  test('adds a missing score column with its rule and writes the scores', async () => {
    const fake = sheetWithoutScore();
    const snapshot = await fake.store.load();

    expect(snapshot.warnings).toEqual([]);
    expect(fake.log[0]).toEqual(['date', 'weight', 'meditate', 'water', 'Score']);
    expect(fake.logColumn('Score')).toEqual([83.3, 0, 0]);
    expect(fake.columnCounts.get(LOG_TITLE)).toBe(5);
    // Only the new Score column gets a rule when the app adds it.
    expect(fake.numberRuleColumns).toEqual(['E']);
    // The Score column is not a metric.
    expect([...snapshot.log.columns.keys()]).toEqual(['weight', 'meditate', 'water']);
    expect(fake.scoreWrites.length).toBe(1);
  });

  test('the load gives the metric rows and the log columns of deleted metrics', async () => {
    const fake = sheetWithoutScore();
    fake.metrics.splice(2, 1);
    const snapshot = await fake.store.load();

    expect(snapshot.metricsTable.rows).toEqual(
      new Map([
        ['weight', 2],
        ['water', 3],
      ]),
    );
    expect(snapshot.deleted.length).toBe(1);
    const meditate = snapshot.deleted[0];
    expect(meditate.id).toBe('meditate');
    expect(meditate.values).toBe(2);
    expect(meditate.lastDay).toBe(d2);
    expect(meditate.isYesNo).toBe(true);
  });

  test('the goal rule accepts the same goals as the parser', () => {
    const rule = new RegExp(goalRulePattern);
    const goals = [
      'yes',
      'No',
      '8',
      '-5',
      'at least 8',
      'At  Most 2 from 4',
      '>= 7 from 5',
      '<=75.5',
      'at most 80 from 83.5 trend',
      'maybe',
      '< 75',
      'trend',
      'at least',
      '8 from',
      'at most 80 trend from 83',
      '8.',
      'at least 8 trends',
    ];
    for (const goal of goals) {
      const parsed = ['yesno', 'number'].some(
        (kind) => parseMetrics([metricsHeader, ['x', 'X', kind, '', '', '', 'check', goal]]).items.length > 0,
      );
      expect(rule.test(goal.toLowerCase()), goal).toBe(parsed);
    }
  });

  test('a second load writes nothing', async () => {
    const fake = sheetWithoutScore();
    await fake.store.load();
    fake.calls.length = 0;
    fake.scoreWrites.length = 0;

    await fake.store.load();
    expect(fake.scoreWrites).toEqual([]);
    expect(fake.calls).toEqual(['GET values:batchGet']);
  });

  test('writes only the stale score cells and clears the score of a row before the first value', async () => {
    const fake = sheetWithoutScore();
    fake.log[0].push('Score');
    fake.log[1].push(83.3);
    fake.log[2].push(null, 7);
    fake.log[3].push(null, null, null, 0);
    fake.log.push([Day.of(2026, 9, 28).serial, null, null, null, 4]);
    fake.columnCounts.set(LOG_TITLE, 5);

    await fake.store.load();
    expect(fake.scoreWrites).toEqual([['Log!E3', 'Log!E5']]);
    expect(fake.logColumn('Score')).toEqual([83.3, 0, 0, null]);
  });

  test('after a goal change in the Metrics tab the next load writes the new scores', async () => {
    const fake = sheetWithoutScore();
    await fake.store.load();
    fake.scoreWrites.length = 0;

    // Goal `no` for meditate: row 2 loses 1 point, rows 3 and 4 get 1 point. Row 4 has no value: a no day.
    fake.metrics[2][7] = 'no';
    await fake.store.load();
    expect(fake.logColumn('Score')).toEqual([50, 33.3, 50]);
    expect(fake.scoreWrites).toEqual([['Log!E2', 'Log!E3', 'Log!E4']]);

    // A maximum of 85 for weight: 82 kg reaches it.
    fake.metrics[1][7] = '<= 85';
    await fake.store.load();
    expect(fake.logColumn('Score')).toEqual([50, 66.7, 50]);

    // From 85 to 80: 82 kg is 0.6 of the way.
    fake.metrics[1][7] = 'at most 80 from 85';
    await fake.store.load();
    expect(fake.logColumn('Score')).toEqual([50, 53.3, 50]);

    // No goal for weight: the row is invalid, so weight does not count.
    fake.metrics[1][7] = '';
    const warnings = (await fake.store.load()).warnings;
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('no goal');
    expect(fake.logColumn('Score')).toEqual([25, 50, 50]);
  });

  test('after a change of a past value in the sheet the next load writes only that score', async () => {
    const fake = sheetWithoutScore();
    await fake.store.load();
    fake.scoreWrites.length = 0;

    fake.log[1][3] = 6;
    await fake.store.load();
    expect(fake.scoreWrites).toEqual([['Log!E2']]);
    expect(fake.logColumn('Score')).toEqual([100, 0, 0]);
  });

  test('a deleted metric row or an invalid goal removes the points of that metric', async () => {
    const fake = sheetWithoutScore();
    await fake.store.load();

    fake.metrics[3][7] = 'lots';
    const snapshot = await fake.store.load();
    expect(snapshot.warnings.length).toBe(1);
    expect(snapshot.warnings[0]).toContain('invalid goal');
    expect(fake.logColumn('Score')).toEqual([100, 0, 0]);
  });

  test('a write in the app also writes the score of its row', async () => {
    const fake = sheetWithoutScore();
    const water = await numberMetric(fake, 'water');

    // A new row for d3 + 1 day.
    const d4 = Day.of(2026, 10, 2);
    const snapshot = await fake.store.change((log) => planCount(water, d4, [{ delta: 1 }, { delta: 1 }], log));
    expect(snapshot.log.valueAt('water', d4)).toBe(2);
    // Meditate 0 and water 0.5: 25.
    expect(fake.logColumn('Score')).toEqual([83.3, 0, 0, 25]);

    // A change in a past row.
    await fake.store.change((log) => planCount(water, d2, [{ delta: 1 }], log));
    expect(fake.logColumn('Score')).toEqual([83.3, 8.3, 0, 25]);
  });

  test('a sheet without the goal column has no valid metric and no scores', async () => {
    const fake = sheetWithoutScore();
    for (const row of fake.metrics) row.pop();
    const snapshot = await fake.store.load();
    // Without the goal column, no row has a goal: each row is invalid, and no metric counts.
    expect(snapshot.metrics.map((m) => m.id)).toEqual([]);
    expect(snapshot.warnings.filter((w) => w.includes('no goal')).length).toBe(3);
    expect(fake.logColumn('Score')).toEqual([null, null, null]);
  });

  test('a Log tab with only the date header gets the metric columns and the score column in one change', async () => {
    const fake = sheetWithoutScore();
    fake.log.length = 0;
    fake.log.push(['date']);
    fake.columnCounts.set(LOG_TITLE, 26);
    await fake.store.load();
    expect(fake.log[0]).toEqual(['date', 'weight', 'meditate', 'water', 'Score']);
    // Weight (B), water (D) and Score (E). Meditate (C) gets the yes / no dropdown.
    expect(fake.numberRuleColumns).toEqual(['B', 'D', 'E']);
    expect(fake.calls.filter((c) => c === 'PUT Log!B1').length).toBe(1);
    expect(fake.scoreWrites).toEqual([]);
  });

  test('refreshRules gives the score column the number rule', async () => {
    const fake = sheetWithoutScore();
    await fake.store.load();
    fake.numberRuleColumns.length = 0;

    await fake.store.refreshRules();
    expect(fake.numberRuleColumns).toEqual(['B', 'D', 'E']);
  });

  test('changeAll writes the scores once after the last write', async () => {
    const fake = sheetWithoutScore();
    const water = await numberMetric(fake, 'water');
    const meditate = await yesNoMetric(fake, 'meditate');
    fake.scoreWrites.length = 0;

    await fake.store.changeAll([
      (log) => planCount(water, d3, [{ delta: 2 }], log),
      (log) => planYesNo(meditate, d3, log, true),
    ]);
    expect(fake.scoreWrites).toEqual([['Log!E4']]);
    // Meditate 1 and water 0.5: 75.
    expect(fake.logColumn('Score')).toEqual([83.3, 0, 75]);
  });

  test('changeAll writes the scores also if its last plan writes nothing', async () => {
    const fake = sheetWithoutScore();
    const water = await numberMetric(fake, 'water');
    const meditate = await yesNoMetric(fake, 'meditate');

    await fake.store.changeAll([
      (log) => planCount(water, d2, [{ delta: 4 }], log),
      // Row 3 has `no` already: no write.
      (log) => planYesNo(meditate, d2, log, false),
    ]);
    expect(fake.logColumn('Score')).toEqual([83.3, 33.3, 0]);
  });

  test('a failed score write gives a warning and does not stop the load or the change', async () => {
    const fake = sheetWithoutScore();
    const water = await numberMetric(fake, 'water');
    fake.failsScoreWrites = true;

    const snapshot = await fake.store.change((log) => planCount(water, d1, [{ delta: 1 }], log));
    expect(snapshot.log.valueAt('water', d1)).toBe(3);
    expect(snapshot.warnings.length).toBe(1);
    expect(snapshot.warnings[0]).toContain('could not write 1 scores');
    expect(snapshot.warnings[0]).toContain('The caller does not have permission');
    expect(fake.logColumn('Score')).toEqual([83.3, 0, 0]);

    // The next load tries again.
    fake.failsScoreWrites = false;
    const next = await fake.store.load();
    expect(next.warnings).toEqual([]);
    expect(fake.logColumn('Score')).toEqual([91.7, 0, 0]);
  });

  test('no endless loop if the score cells do not keep the written values', async () => {
    const fake = sheetWithoutScore();
    fake.keepsScores = false;
    await fake.store.load();
    expect(fake.scoreWrites.length).toBe(1);

    // Each load writes the scores again, but only once.
    fake.scoreWrites.length = 0;
    await fake.store.load();
    expect(fake.scoreWrites.length).toBe(1);
    expect(fake.logColumn('Score')).toEqual([null, null, null]);
  });

  test('changeMetrics adds a metric row and its Log column with its rule', async () => {
    const fake = sheetWithoutScore();
    await fake.store.load();
    fake.numberRuleColumns.length = 0;
    const read = new YesNoMetric({ id: 'read', name: '=Read', icon: 'menu_book', group: 'habits' });

    const snapshot = await fake.store.changeMetrics((table) => planSaveMetric(table, read));
    expect(fake.metrics[4]).toEqual(['read', '=Read', 'yesno', '', '', 'habits', 'menu_book', 'yes']);
    expect(snapshot.metrics.at(-1)).toEqual(read);
    expect(fake.log[0][5]).toBe('read');
    expect(snapshot.log.columns.get('read')).toBe(5);
    expect(snapshot.warnings).toEqual([]);
  });

  test('changeMetrics writes a new kind and goal and the new scores and rules', async () => {
    const fake = sheetWithoutScore();
    await fake.store.load();
    fake.numberRuleColumns.length = 0;
    const weight = await numberMetric(fake, 'weight');

    const goal = new NumberGoal({ target: 2, isMaximum: false });
    const snapshot = await fake.store.changeMetrics((table) =>
      planSaveMetric(table, weight.copy({ isCount: true, goal })),
    );
    expect(fake.metrics[1]).toEqual(['weight', 'Weight', 'count', 'kg', 0.1, 'body', 'monitor_weight', 'at least 2']);
    expect(snapshot.metrics[0]).toEqual(weight.copy({ isCount: true, goal }));
    // The rules are set again: the weight column of the Log tab keeps its number rule.
    expect(fake.numberRuleColumns).toContain('B');
    // At least 2: 79.5 and 82 give 1 point, and the day without weight is a count of 0. Before, 82 gave 0.
    expect(fake.logColumn('Score')).toEqual([83.3, 33.3, 0]);
  });

  test('changeMetrics deletes and moves rows but the Log keeps the values', async () => {
    const fake = sheetWithoutScore();
    await fake.store.load();

    const moved = await fake.store.changeMetrics((table) => listOfNotNull(planMoveMetric(table, 'water', true)));
    expect(moved.metrics.map((m) => m.id)).toEqual(['weight', 'water', 'meditate']);
    expect(fake.metrics[2][0]).toBe('water');

    const deleted = await fake.store.changeMetrics((table) => [planDeleteMetric(table, 'meditate')]);
    expect(deleted.metrics.map((m) => m.id)).toEqual(['weight', 'water']);
    expect(fake.metrics.length).toBe(3);
    expect(deleted.deleted.map((d) => d.id)).toEqual(['meditate']);
    expect(fake.log[0][2]).toBe('meditate');
  });

  test('changeMetrics adds rows to a full tab and the goal column to an older tab', async () => {
    const fake = sheetWithoutScore();
    for (const row of fake.metrics) row.pop();
    fake.rowCounts.set(METRICS_TITLE, 4);
    fake.columnCounts.set(METRICS_TITLE, 7);
    await fake.store.load();

    const read = new YesNoMetric({ id: 'read', name: 'Read', icon: 'menu_book', goalIsYes: false });
    const snapshot = await fake.store.changeMetrics((table) => planSaveMetric(table, read));
    expect(fake.rowCounts.get(METRICS_TITLE)).toBe(5);
    expect(fake.columnCounts.get(METRICS_TITLE)).toBe(8);
    expect(fake.metrics[0][7]).toBe('goal');
    expect(fake.metrics[4][7]).toBe('no');
    expect(snapshot.metrics.at(-1)).toEqual(read);
  });
});

/**
 * The JSON of the `:batchUpdate` requests, field by field. The code writes the JSON itself, so these tests find a
 * wrong field name before the real API does. The expected JSON is in the form of the Sheets API v4 reference.
 */
describe('SheetsRequests', () => {
  /**
   * @param {string} text
   * @returns {unknown}
   */
  const json = (text) => JSON.parse(text);

  /**
   * The rule of `column` of the tab `tabId` with `condition`.
   * @param {number} tabId
   * @param {number} column
   * @param {string} condition
   * @returns {string}
   */
  const rule = (tabId, column, condition) => `
    {"setDataValidation": {
        "range": {"sheetId": ${tabId}, "startRowIndex": 1, "startColumnIndex": ${column}, "endColumnIndex": ${column + 1}},
        "rule": {"condition": ${condition}, "strict": true, "showCustomUi": true}}}`;

  /**
   * @param {string} text
   * @returns {string}
   */
  const formula = (text) => `{"type": "CUSTOM_FORMULA", "values": [{"userEnteredValue": ${JSON.stringify(text)}}]}`;

  const metricsRules = [
    rule(
      1,
      2,
      `{"type": "ONE_OF_LIST", "values": [{"userEnteredValue": "yesno"}, {"userEnteredValue": "number"},
        {"userEnteredValue": "count"}]}`,
    ),
    rule(1, 6, formula('=OR(REGEXMATCH(G2, "^[a-z0-9_]+$"), LEN(G2) <= 16)')),
    rule(
      1,
      7,
      formula(
        '=OR(ISNUMBER(H2), REGEXMATCH(LOWER(TO_TEXT(H2)), "^ *(yes|no|(at +least|at +most|<=|>=)? *' +
          '-?[0-9]+([.][0-9]+)?( +from +-?[0-9]+([.][0-9]+)?)?( +trend)?) *$"))',
      ),
    ),
  ];

  const dateRules = [
    `{"repeatCell": {
        "range": {"sheetId": 2, "startRowIndex": 1, "startColumnIndex": 0, "endColumnIndex": 1},
        "cell": {"userEnteredFormat": {"numberFormat": {"type": "DATE", "pattern": "yyyy-mm-dd"}}},
        "fields": "userEnteredFormat.numberFormat"}}`,
    rule(2, 0, '{"type": "DATE_IS_VALID"}'),
  ];

  test('ensureTabs adds both tabs with their headers and rules', async () => {
    const fake = new FakeSheets({ metrics: [], log: [], logColumns: 26, tabs: new Set() });
    await fake.store.ensureTabs();

    /**
     * @param {string} title
     * @returns {string}
     */
    const addSheet = (title) =>
      `{"addSheet": {"properties": {"title": "${title}", "gridProperties": {"frozenRowCount": 1}}}}`;
    expect(fake.requests).toEqual(
      [addSheet(METRICS_TITLE), addSheet(LOG_TITLE), ...metricsRules, ...dateRules].map(json),
    );
    expect(fake.metrics[0]).toEqual(metricsHeader);
    expect(fake.metrics.length).toBe(4);
    expect(fake.log).toEqual([['date']]);

    // The new tabs load without warnings, and the load adds the metric columns and the Score column.
    expect((await fake.store.load()).warnings).toEqual([]);
    expect(fake.log[0]).toEqual(['date', 'weight', 'meditate', 'water', 'Score']);
  });

  test('ensureTabs changes nothing if both tabs are there', async () => {
    const fake = new FakeSheets({ metrics: [], log: [], logColumns: 26 });
    await fake.store.ensureTabs();
    expect(fake.requests).toEqual([]);
    expect(fake.calls).toEqual(['GET ']);
  });

  test('refreshRules sends the rules of both tabs', async () => {
    const fake = new FakeSheets({
      metrics: [
        [...metricsHeader],
        ['weight', 'Weight', 'number', 'kg', 0.1, 'body', 'monitor_weight', '<= 80'],
        ['meditate', 'Meditate', 'yesno', '', '', 'habits', 'self_improvement', 'yes'],
      ],
      log: [['date', 'meditate', 'weight', 'gone', 'Score']],
      logColumns: 5,
    });
    await fake.store.refreshRules();

    const clearRules = '{"setDataValidation": {"range": {"sheetId": 1, "startRowIndex": 1}}}';
    const yesNo = '{"type": "ONE_OF_LIST", "values": [{"userEnteredValue": "yes"}, {"userEnteredValue": "no"}]}';
    expect(fake.requests).toEqual(
      [
        clearRules,
        ...metricsRules,
        ...dateRules,
        rule(2, 1, yesNo),
        rule(2, 2, formula('=ISNUMBER(C2)')),
        // Column D has no metric: no rule.
        rule(2, 4, formula('=ISNUMBER(E2)')),
      ].map(json),
    );
  });

  test('a new column appends the dimension that the Log tab needs', async () => {
    const fake = new FakeSheets({
      metrics: [[...metricsHeader], ['water', 'Water', 'count', 'glasses', 1, 'habits', 'water_drop', 8]],
      log: [['date']],
      logColumns: 1,
    });
    await fake.store.load();

    expect(fake.requests).toEqual(
      [
        '{"appendDimension": {"sheetId": 2, "dimension": "COLUMNS", "length": 2}}',
        rule(2, 1, formula('=ISNUMBER(B2)')),
        rule(2, 2, formula('=ISNUMBER(C2)')),
      ].map(json),
    );
  });
});
