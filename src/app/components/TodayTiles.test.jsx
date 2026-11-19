import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { Day } from '../../model/Day.js';
import { LogTable } from '../../model/LogEntry.js';
import { NumberGoal, NumberMetric, YesNoMetric } from '../../model/Metric.js';
import { ActionBarHost, LocalActionBarHost } from './ActionBar.jsx';
import { TodayTiles } from './TodayTiles.jsx';

/** @import { Metric } from '../../model/Metric.js' */

/** The element of the App that shows the Save button. */
let hostElement = /** @type {HTMLElement | null} */ (null);

afterEach(() => {
  cleanup();
  hostElement?.remove();
  hostElement = null;
});

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
 * Shows the tiles of `metrics` on an empty log. With `hosted`, the App place of the Save button, below the tiles.
 * @param {Metric[]} metrics
 * @param {boolean} [hosted]
 */
function showTiles(metrics, hosted = false) {
  if (hosted) {
    hostElement = document.createElement('div');
    document.body.append(hostElement);
  }
  render(
    <LocalActionBarHost.Provider value={hosted ? new ActionBarHost(hostElement) : null}>
      <TodayTiles
        metrics={metrics}
        log={new LogTable([], new Map(), new Map())}
        today={today}
        busy={false}
        onWriteAll={(_, onDone) => onDone()}
        pending={new Map()}
      />
    </LocalActionBarHost.Provider>,
  );
}

describe('TodayTiles', () => {
  test('a count tile shows the target of its goal below the counter', () => {
    showTiles([water, coffee]);
    expect(screen.getByText('of 8 glasses')).toBeTruthy();
    expect(screen.getByText('max 2.5')).toBeTruthy();
  });

  test('without an action bar host the save button always shows in the page', () => {
    showTiles([meditate]);
    expect(/** @type {HTMLButtonElement} */ (screen.getByRole('button', { name: 'No changes' })).disabled).toBe(true);
  });

  test('with an action bar host the save button shows there only with values to save', () => {
    showTiles([meditate], true);
    expect(screen.queryByText('Save')).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Meditate' }));
    const save = /** @type {HTMLButtonElement} */ (screen.getByRole('button', { name: 'Save: Meditate' }));
    expect(save.disabled).toBe(false);
    expect(hostElement?.contains(save)).toBe(true);

    // The saved value again: nothing to save.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Meditate' }));
    expect(screen.queryByText('Save')).toBeNull();
  });
});
