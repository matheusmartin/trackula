import { describe, expect, test } from 'vitest';
import { NumberGoal, NumberMetric, YesNoMetric } from './Metric.js';
import { goalText, metricCells } from './MetricCells.js';
import { parseMetricRow } from './Parse.js';

describe('MetricCells', () => {
  const samples = [
    new NumberMetric({
      id: 'weight',
      name: 'Weight',
      icon: 'monitor_weight',
      unit: 'kg',
      step: 0.1,
      goal: new NumberGoal({ target: 80, isMaximum: true, from: 84, usesTrend: true }),
      group: 'Health',
    }),
    new NumberMetric({
      id: 'waist',
      name: 'Waist',
      icon: 'straighten',
      goal: new NumberGoal({ target: 90, isMaximum: true }),
      unit: 'cm',
      step: 0.5,
    }),
    new NumberMetric({ id: 'water', name: 'Water', icon: '💧', isCount: true, goal: new NumberGoal({ target: 8 }) }),
    new NumberMetric({
      id: 'sugar',
      name: 'Sugar',
      icon: 'cake',
      isCount: true,
      goal: new NumberGoal({ target: -2.5, isMaximum: true, from: -1 }),
    }),
    new YesNoMetric({ id: 'teeth', name: 'Morning teeth', icon: 'dentistry', group: 'Hygiene' }),
    new YesNoMetric({ id: 'smoke', name: '=1+1', icon: 'smoking_rooms', goalIsYes: false }),
  ];

  test('goalText gives the words of the goal', () => {
    expect(goalText(new NumberGoal({ target: 8 }))).toBe('at least 8');
    expect(goalText(new NumberGoal({ target: 7, from: 5 }))).toBe('at least 7 from 5');
    expect(goalText(new NumberGoal({ target: 75.5, isMaximum: true }))).toBe('at most 75.5');
    expect(goalText(new NumberGoal({ target: 80, isMaximum: true, from: 83, usesTrend: true }))).toBe(
      'at most 80 from 83 trend',
    );
  });

  test('the parser reads the cells of each metric back as the same metric', () => {
    for (const m of samples) expect(parseMetricRow(m.id, metricCells(m)), m.id).toStrictEqual(m);
  });

  test('a yes/no metric has no unit and no step', () => {
    expect(metricCells(samples[4])).toEqual(
      new Map([
        ['id', 'teeth'],
        ['name', 'Morning teeth'],
        ['kind', 'yesno'],
        ['group', 'Hygiene'],
        ['icon', 'dentistry'],
        ['unit', ''],
        ['step', ''],
        ['goal', 'yes'],
      ]),
    );
    expect(metricCells(samples[1]).get('goal')).toBe('at most 90');
    expect(metricCells(samples[1]).get('kind')).toBe('number');
    expect(metricCells(samples[2]).get('kind')).toBe('count');
  });
});
