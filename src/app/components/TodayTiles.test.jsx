import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { Day } from '../../model/Day.js';
import { LogTable, metricDayKey } from '../../model/LogEntry.js';
import { NumberGoal, NumberMetric, YesNoMetric } from '../../model/Metric.js';
import { TodayTiles } from './TodayTiles.jsx';

/** @import { Day as DayType } from '../../model/Day.js' */
/** @import { CountStep, MetricDay } from '../../model/LogEntry.js' */
/** @import { Metric } from '../../model/Metric.js' */

afterEach(cleanup);

const today = Day.of(2026, 10, 3);
const meditate = new YesNoMetric({ id: 'meditate', name: 'Meditate', icon: 'self_improvement' });
const water = new NumberMetric({
  id: 'water',
  name: 'Water',
  icon: 'water_drop',
  goal: new NumberGoal({ target: 8 }),
  unit: 'glasses',
  isCount: true,
});
const coffee = water.copy({
  id: 'coffee',
  name: 'Coffee',
  goal: new NumberGoal({ target: 2.5, isMaximum: true }),
  unit: null,
});

/**
 * Shows the tiles of `metrics` on an empty log, and returns the values and the taps that they give.
 * @param {Metric[]} metrics
 * @param {boolean} [busy]
 * @param {Map<MetricDay, CountStep[]>} [pending] Default: no taps.
 * @param {Map<string, Map<DayType, number>>} [points] Default: no points.
 * @returns {string[]}
 */
function showTiles(metrics, busy = false, pending = new Map(), points = new Map()) {
  /** @type {string[]} */
  const calls = [];
  render(
    <TodayTiles
      metrics={metrics}
      log={new LogTable([], new Map(), new Map())}
      today={today}
      busy={busy}
      onRecord={(m, d, value) => calls.push(`${m.id} ${d} ${value}`)}
      onCount={(m, d, step) => calls.push(`${m.id} ${d} ${step.delta > 0 ? '+' : ''}${step.delta}`)}
      pending={pending}
      points={points}
    />,
  );
  return calls;
}

describe('TodayTiles', () => {
  test('the fill of a tile shows the points of today, as a day cell, and a tile without a value has none', () => {
    const pending = new Map([
      [metricDayKey('water', today), [{ delta: 6 }]],
      [metricDayKey('coffee', today), [{ delta: 1 }]],
    ]);
    const points = new Map([
      ['water', new Map([[today, 0.75]])],
      ['coffee', new Map([[today, 1]])],
    ]);
    showTiles([water, coffee, meditate], false, pending, points);
    const tile = (/** @type {string} */ name) =>
      screen.getByRole(name === 'Meditate' ? 'checkbox' : 'button', { name });
    expect(tile('Water').className).toBe('tile tile-button tile-count tile-value');
    expect(parseFloat(tile('Water').style.getPropertyValue('--cell-fill'))).toBeCloseTo(0.55);
    expect(tile('Water').title).toMatch(/^6, 0\.8 points\./);
    expect(tile('Coffee').className).toBe('tile tile-button tile-count tile-value tile-full');
    expect(tile('Meditate').className).toBe('tile tile-button');
  });

  test('a count tile shows the target of its goal below the counter', () => {
    showTiles([water, coffee]);
    expect(screen.getByText('of 8 glasses')).toBeTruthy();
    expect(screen.getByText('max 2.5')).toBeTruthy();
  });

  test('a tap on a yes/no tile records yes at once, and there is no Save button', () => {
    const calls = showTiles([meditate]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Meditate' }));
    expect(calls).toEqual(['meditate 2026-10-03 1']);
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();
  });

  test('a yes/no tile waits while a write runs', () => {
    const calls = showTiles([meditate], true);
    expect(/** @type {HTMLButtonElement} */ (screen.getByRole('checkbox', { name: 'Meditate' })).disabled).toBe(true);
    expect(calls).toEqual([]);
  });

  test('a keyboard click on a count tile adds a step', () => {
    const calls = showTiles([water]);
    fireEvent.click(screen.getByRole('button', { name: 'Water' }));
    expect(calls).toEqual(['water 2026-10-03 +1']);
  });
});
