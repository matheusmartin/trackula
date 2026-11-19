import { describe, expect, test } from 'vitest';
import { Day } from './Day.js';
import { NumberGoal, NumberMetric, YesNoMetric } from './Metric.js';
import {
  DraftField,
  GoalDirection,
  MetricDraft,
  MetricKind,
  canChangeKind,
  deletedSummary,
  draftOf,
  goalExamples,
  goalSummary,
  metricSummary,
} from './MetricDraft.js';
import { metricsHeader, parseMetrics } from './Parse.js';
import { rows } from './testing/Fixtures.js';

describe('MetricDraft', () => {
  const water = new MetricDraft({
    name: ' Water ',
    icon: 'water_drop',
    kind: MetricKind.COUNT,
    unit: 'glasses',
    step: '1',
    group: 'Nutrition',
    target: '8',
  });

  test('a valid draft gives the metric', () => {
    const check = water.check('water');
    expect(check.errors).toEqual(new Map());
    expect(check.metric).toStrictEqual(
      new NumberMetric({
        id: 'water',
        name: 'Water',
        icon: 'water_drop',
        unit: 'glasses',
        isCount: true,
        goal: new NumberGoal({ target: 8 }),
        group: 'Nutrition',
      }),
    );
  });

  test('a draft with empty and invalid fields gives an error for each field', () => {
    const check = new MetricDraft({ kind: MetricKind.NUMBER, step: '0', target: 'lots', start: 'x' }).check('w');
    expect(check.metric).toBeNull();
    expect(new Set(check.errors.keys())).toEqual(
      new Set([DraftField.NAME, DraftField.ICON, DraftField.STEP, DraftField.TARGET, DraftField.START]),
    );
    expect(check.errors.get(DraftField.TARGET)).toBe('Enter a number.');
  });

  test('the start must be on the other side of the target', () => {
    const check = water.copy({ direction: GoalDirection.AT_MOST, target: '80', start: '78' }).check('w');
    expect(check.errors.get(DraftField.START)).toBe('The start must be above the target.');
  });

  test('a long text is not an icon', () => {
    expect(water.copy({ icon: 'A long text icon!' }).check('w').errors.has(DraftField.ICON)).toBe(true);
    expect(water.copy({ icon: '💧' }).check('w').errors).toEqual(new Map());
  });

  test('the trend is only for a number metric, and a decimal can have a comma', () => {
    const count = water.copy({ usesTrend: true, target: '7,5' }).check('w').metric;
    expect(count).toBeInstanceOf(NumberMetric);
    expect(/** @type {NumberMetric} */ (count).goal).toStrictEqual(new NumberGoal({ target: 7.5 }));
    const number = water.copy({ kind: MetricKind.NUMBER, usesTrend: true }).check('w').metric;
    expect(number).toBeInstanceOf(NumberMetric);
    expect(/** @type {NumberMetric} */ (number).goal.usesTrend).toBe(true);
  });

  test('a yes/no draft has no unit, no step and no number goal', () => {
    const draft = water.copy({ kind: MetricKind.YES_NO, step: 'bad', target: 'bad', goalIsYes: false });
    expect(draft.check('smoke').metric).toStrictEqual(
      new YesNoMetric({ id: 'smoke', name: 'Water', icon: 'water_drop', group: 'Nutrition', goalIsYes: false }),
    );
  });

  test('the draft of a metric gives the same metric back', () => {
    const metrics = [
      new NumberMetric({
        id: 'weight',
        name: 'Weight',
        icon: 'monitor_weight',
        goal: new NumberGoal({ target: 80, isMaximum: true, from: 84, usesTrend: true }),
        unit: 'kg',
        step: 0.1,
      }),
      new NumberMetric({
        id: 'waist',
        name: 'Waist',
        icon: 'straighten',
        goal: new NumberGoal({ target: 90, isMaximum: true }),
        unit: 'cm',
        step: 0.5,
      }),
      new YesNoMetric({ id: 'teeth', name: 'Teeth', icon: 'dentistry', group: 'Hygiene', goalIsYes: false }),
    ];
    for (const m of metrics) expect(draftOf(m).check(m.id).metric, m.id).toStrictEqual(m);
  });

  test('the draft of an invalid row keeps the values that the app can read', () => {
    const table = parseMetrics(
      rows(
        metricsHeader,
        ['walk', 'Walk', 'count', 'min', 10, 'Activities', '', 'at least 30'],
        ['run', 'Run', 'count', 'km', '', '', 'directions_run', 'lots'],
      ),
    );
    const walk = draftOf(table.invalid[0]);
    expect(walk).toStrictEqual(
      new MetricDraft({
        name: 'Walk',
        kind: MetricKind.COUNT,
        unit: 'min',
        step: '10',
        group: 'Activities',
        target: '30',
      }),
    );
    const run = draftOf(table.invalid[1]);
    expect(run.target).toBe('lots');
    expect(run.icon).toBe('directions_run');
  });

  test('the draft of a row without goal asks for the goal', () => {
    const table = parseMetrics(
      rows(
        metricsHeader,
        ['waist', 'Waist', 'number', 'cm', 0.5, '', 'straighten'],
        ['read', 'Read', 'yesno', '', '', '', 'menu_book', ''],
      ),
    );
    const waist = draftOf(table.invalid[0]);
    expect(waist.direction).toBe(GoalDirection.AT_LEAST);
    expect(waist.check('waist').errors.get(DraftField.TARGET)).toBe('Enter a number.');
    const read = draftOf(table.invalid[1]);
    expect(read.check('read').metric).toStrictEqual(
      new YesNoMetric({ id: 'read', name: 'Read', icon: 'menu_book', goalIsYes: true }),
    );
  });

  test('the draft of a deleted metric has a name from the id', () => {
    const draft = draftOf({ id: 'morning_teeth', values: 3, lastDay: null, isYesNo: true });
    expect(draft.name).toBe('Morning teeth');
    expect(draft.kind).toBe(MetricKind.YES_NO);
    const steps = draftOf({ id: 'steps', values: 3, lastDay: null, isYesNo: false });
    expect(steps.kind).toBe(MetricKind.NUMBER);
    expect(steps.check('steps').errors.get(DraftField.TARGET)).toBe('Enter a number.');
  });

  test('a new number draft without target gives an error', () => {
    const check = water.copy({ target: ' ' }).check('water');
    expect(check.metric).toBeNull();
    expect(check.errors).toEqual(new Map([[DraftField.TARGET, 'Enter a number.']]));
  });

  test('a metric with values cannot change between yes/no and the other kinds', () => {
    expect(canChangeKind(MetricKind.NUMBER, MetricKind.COUNT, true)).toBe(true);
    expect(canChangeKind(MetricKind.YES_NO, MetricKind.COUNT, true)).toBe(false);
    expect(canChangeKind(MetricKind.YES_NO, MetricKind.COUNT, false)).toBe(true);
  });

  test('the summaries show the kind, the unit, the group and the goal', () => {
    const goal = new NumberGoal({ target: 80, isMaximum: true, from: 83 });
    const weight = new NumberMetric({
      id: 'weight',
      name: 'Weight',
      icon: 'monitor_weight',
      goal,
      unit: 'kg',
      group: 'Health',
    });
    expect(metricSummary(weight)).toBe('Number · kg · Health');
    expect(goalSummary(weight)).toBe('at most 80 from 83');
    expect(metricSummary(new YesNoMetric({ id: 'read', name: 'Read', icon: 'menu_book' }))).toBe('Yes/no');
    expect(goalSummary(new YesNoMetric({ id: 'smoke', name: 'Smoke', icon: 'smoking_rooms', goalIsYes: false }))).toBe(
      'no',
    );
  });

  test('the goal examples give the points of three values', () => {
    expect(goalExamples(new NumberGoal({ target: 8 }), 'glasses')).toEqual([
      '8 glasses or more: 1 point',
      '4 glasses: 0.5 points',
      '0 glasses: 0 points',
    ]);
    expect(goalExamples(new NumberGoal({ target: 80, isMaximum: true, from: 83 }), 'kg')).toEqual([
      '80 kg or less: 1 point',
      '81.5 kg: 0.5 points',
      '83 kg: 0 points',
    ]);
    expect(goalExamples(new NumberGoal({ target: 2, isMaximum: true }), null)).toEqual([
      '2 or less: 1 point',
      'Other values: 0 points',
    ]);
  });

  test('the preview goal is the goal of a valid target and start', () => {
    expect(water.previewGoal()).toStrictEqual(new NumberGoal({ target: 8 }));
    expect(water.copy({ start: '2' }).previewGoal()).toStrictEqual(new NumberGoal({ target: 8, from: 2 }));
    expect(water.copy({ start: '9' }).previewGoal()).toBeNull();
    expect(water.copy({ target: '' }).previewGoal()).toBeNull();
    expect(water.copy({ kind: MetricKind.YES_NO }).previewGoal()).toBeNull();
  });

  test('equals compares the values, not the objects', () => {
    expect(water.copy({ name: 'Tea' }).copy({ name: ' Water ' }).equals(water)).toBe(true);
    expect(new MetricDraft().equals(new MetricDraft())).toBe(true);
    expect(water.copy({ kind: MetricKind.NUMBER }).equals(water)).toBe(false);
    expect(water.copy({ usesTrend: true }).equals(water)).toBe(false);
  });

  test('the deleted summary gives the number of values and the last day', () => {
    expect(deletedSummary({ id: 's', values: 142, lastDay: Day.of(2026, 10, 30), isYesNo: false })).toBe(
      '142 values · last on Oct 30',
    );
    expect(deletedSummary({ id: 's', values: 1, lastDay: Day.of(2026, 10, 3), isYesNo: false })).toBe(
      '1 value · last on Oct 3',
    );
    expect(deletedSummary({ id: 's', values: 0, lastDay: null, isYesNo: false })).toBe('No values');
  });
});
