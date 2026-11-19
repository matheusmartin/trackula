import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { NumberGoal, NumberMetric } from '../../model/Metric.js';
import { NumberEditor, TICK, TOUCH_SLOP } from './NumberEditor.jsx';

afterEach(cleanup);

const weight = new NumberMetric({
  id: 'weight',
  name: 'Weight',
  icon: 'monitor_weight',
  goal: new NumberGoal({ target: 80, isMaximum: true }),
  unit: 'kg',
  step: 0.1,
});

/**
 * Shows the editor of a table cell: with its own buttons. Returns the names of the calls of the buttons.
 * @param {number | null} current
 * @returns {string[]}
 */
function showCellEditor(current) {
  /** @type {string[]} */
  const calls = [];
  render(
    <NumberEditor
      metric={weight}
      label="Weight · today"
      current={current}
      start={82}
      busy={false}
      onSave={() => calls.push('save')}
      onClear={() => calls.push('clear')}
      onClose={() => calls.push('close')}
      autofocus={false}
    />,
  );
  return calls;
}

describe('NumberEditor', () => {
  test('a drag moves one step for each tick without a jump at the start', () => {
    /** @type {(number | null)[]} */
    const values = [];
    render(
      <NumberEditor
        metric={weight}
        label="Weight · today"
        current={82}
        start={null}
        busy={false}
        onSave={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        autofocus={false}
        onChange={(value) => values.push(value)}
      />,
    );
    const ruler = screen.getByRole('slider', { name: 'Weight ruler' });
    const touch = { pointerId: 1, pointerType: 'touch', button: 0 };
    fireEvent.pointerDown(ruler, { ...touch, clientX: 200 });
    // The touch slop and 1 pixel: the drag starts, and the value does not change.
    fireEvent.pointerMove(ruler, { ...touch, clientX: 200 - (TOUCH_SLOP + 1) });
    fireEvent.pointerMove(ruler, { ...touch, clientX: 200 - (TOUCH_SLOP + 1) - 3 * TICK });
    fireEvent.pointerUp(ruler, { ...touch, clientX: 200 - (TOUCH_SLOP + 1) - 3 * TICK });

    // The press confirms 82.0. Then 3 ticks to the left give 82.3.
    expect([...new Set(values)]).toEqual([82, 82.3]);
    expect(ruler.getAttribute('aria-valuetext')).toBe('82.3 kg');
  });

  test('cancel closes the editor and clear clears a day with a value', () => {
    const calls = showCellEditor(82);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(calls).toEqual(['close', 'clear']);
  });

  test('an empty day has no clear button', () => {
    showCellEditor(null);
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });
});
