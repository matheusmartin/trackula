import { describe, expect, test } from 'vitest';
import { withoutFloatNoise } from './LogEntry.js';
import {
  GoalMark,
  NumberGoal,
  NumberMetric,
  OTHER_GROUP,
  YesNoMetric,
  goalMark,
  groupOf,
  metricsOf,
} from './Metric.js';

describe('Metric', () => {
  const goal8 = new NumberGoal({ target: 8 });
  const water = new NumberMetric({
    id: 'water',
    name: 'Water',
    icon: 'water_drop',
    goal: goal8,
    isCount: true,
    group: 'habits',
  });
  const weight = new NumberMetric({ id: 'weight', name: 'Weight', icon: 'monitor_weight', goal: goal8, group: 'body' });
  const read = new YesNoMetric({ id: 'read', name: 'Read', icon: 'menu_book' });

  test('a number goal gives 1 if the value reaches the target', () => {
    const atLeast = new NumberGoal({ target: 8 });
    expect([8, 12].map((v) => atLeast.points(v))).toEqual([1, 1]);
    const atMost = new NumberGoal({ target: 80, isMaximum: true });
    expect([80, 79.5].map((v) => atMost.points(v))).toEqual([1, 1]);
  });

  test('a number goal gives the part of the way from the start to the target', () => {
    const goal = new NumberGoal({ target: 80, isMaximum: true, from: 83 });
    expect([82.1, 83, 84].map((v) => withoutFloatNoise(goal.points(v)))).toEqual([0.3, 0, 0]);
    const sleep = new NumberGoal({ target: 7, from: 5 });
    expect([6, 4].map((v) => sleep.points(v))).toEqual([0.5, 0]);
  });

  test('a minimum above 0 without from starts at 0, and the other goals give 1 or 0', () => {
    expect(new NumberGoal({ target: 8 }).start).toBe(0);
    expect([6, -1].map((v) => new NumberGoal({ target: 8 }).points(v))).toEqual([0.75, 0]);
    expect(new NumberGoal({ target: 80, isMaximum: true }).start).toBeNull();
    expect(new NumberGoal({ target: 80, isMaximum: true }).points(80.1)).toBe(0);
    expect(new NumberGoal({ target: -5 }).start).toBeNull();
    expect(new NumberGoal({ target: -5 }).points(-6)).toBe(0);
  });

  test('a yes day reaches the goal yes and is over the limit no', () => {
    const coffee = new YesNoMetric({ id: 'coffee', name: 'Coffee', icon: 'coffee', goalIsYes: false });
    expect([1, 0, null].map((v) => goalMark(read, v))).toEqual([GoalMark.REACHED, GoalMark.NONE, GoalMark.NONE]);
    expect([1, 0, null].map((v) => goalMark(coffee, v))).toEqual([GoalMark.OVER_LIMIT, GoalMark.NONE, GoalMark.NONE]);
  });

  test('a count reaches the target of at least and is over the target of at most', () => {
    expect([5, 8, 12].map((v) => goalMark(water, v))).toEqual([GoalMark.NONE, GoalMark.REACHED, GoalMark.REACHED]);
    // A value within a limit has no mark: the day is not over.
    const coffee = water.copy({ goal: new NumberGoal({ target: 2, isMaximum: true, from: 4 }) });
    expect([0, 2, 3, 5].map((v) => goalMark(coffee, v))).toEqual([
      GoalMark.NONE,
      GoalMark.NONE,
      GoalMark.OVER_LIMIT,
      GoalMark.OVER_LIMIT,
    ]);
  });

  test('groupOf is other for a metric without group', () => {
    expect([water, weight, read].map(groupOf)).toEqual(['habits', 'body', OTHER_GROUP]);
  });

  test('metricsOf gives the metrics of the group, or all metrics for null', () => {
    const all = [water, weight, read];
    expect(metricsOf(all, 'body')).toEqual([weight]);
    expect(metricsOf(all, OTHER_GROUP)).toEqual([read]);
    expect(metricsOf(all, 'sleep')).toEqual([]);
    expect(metricsOf(all, null)).toEqual(all);
  });

  test('copy changes only the given fields', () => {
    expect(water.copy({ name: 'Drinks' })).toStrictEqual(new NumberMetric({ ...water, name: 'Drinks' }));
    expect(read.copy({ goalIsYes: false }).goalIsYes).toBe(false);
    expect(goal8.copy({ usesTrend: true })).toStrictEqual(new NumberGoal({ target: 8, usesTrend: true }));
  });
});
