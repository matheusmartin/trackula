import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { meditate, water, weight } from '../../model/testing/Fixtures.js';
import { MetricList } from './MetricList.jsx';

/** @import { Metric } from '../../model/Metric.js' */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Shows the list of weight, water and meditate, and returns the list of the calls of its handlers.
 * @param {boolean} hasMouse
 * @returns {string[]}
 */
function showList(hasMouse) {
  /** @type {string[]} */
  const calls = [];
  render(
    <MetricList
      metrics={[weight, water, meditate]}
      busy={false}
      hasMouse={hasMouse}
      onEdit={(/** @type {Metric} */ m) => calls.push(`edit ${m.id}`)}
      onMove={(/** @type {Metric} */ m, /** @type {boolean} */ up) => calls.push(`move ${m.id} ${up ? 'up' : 'down'}`)}
      onDrop={(/** @type {Metric} */ m, /** @type {Metric} */ other) => calls.push(`drop ${m.id} at ${other.id}`)}
    />,
  );
  return calls;
}

/**
 * The button with the name `name`.
 * @param {string} name
 * @returns {HTMLButtonElement}
 */
function button(name) {
  return /** @type {HTMLButtonElement} */ (screen.getByRole('button', { name }));
}

describe('MetricList', () => {
  test('without a mouse, the arrows move a metric, and the first and the last metric cannot go out', () => {
    const calls = showList(false);

    expect(button('Move Weight up').disabled).toBe(true);
    expect(button('Move Meditate down').disabled).toBe(true);
    fireEvent.click(button('Move Water up'));
    fireEvent.click(button('Move Water down'));

    expect(calls).toEqual(['move water up', 'move water down']);
  });

  test('a click on a row opens the metric', () => {
    const calls = showList(false);

    fireEvent.click(screen.getByText('Water'));

    expect(calls).toEqual(['edit water']);
  });

  test('with a mouse, the arrow keys on the handle move a metric', () => {
    const calls = showList(true);

    expect(screen.queryByRole('button', { name: 'Move Water up' })).toBeNull();
    fireEvent.keyDown(button('Move Water'), { key: 'ArrowUp' });
    fireEvent.keyDown(button('Move Weight'), { key: 'ArrowUp' });

    expect(calls).toEqual(['move water up']);
  });

  test('with a mouse, a drag drops a metric at the place of another, and its click does not open it', () => {
    // Each row is 84 px high.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(84);
    const calls = showList(true);

    // Weight goes down past Water and past the middle of Meditate: it lands at the place of Meditate.
    const row = screen.getByText('Weight');
    const pointer = { pointerId: 1, pointerType: 'mouse', button: 0 };
    fireEvent.pointerDown(row, { ...pointer, clientY: 100 });
    for (let i = 1; i <= 20; i++) fireEvent.pointerMove(row, { ...pointer, clientY: 100 + (84 * 1.7 * i) / 20 });
    fireEvent.pointerUp(row, { ...pointer, clientY: 100 + 84 * 1.7 });
    fireEvent.click(row);

    expect(calls).toEqual(['drop weight at meditate']);
  });
});
