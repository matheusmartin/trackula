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
 * Shows the editor and returns the values that it sends, and `close` for each close.
 * @param {object} options
 * @param {number | null} options.current
 * @param {number | null} [options.start]
 * @param {boolean} [options.closes] True for the editor of a table cell, with Close and Clear.
 * @returns {(number | null | 'close')[]}
 */
function showEditor({ current, start = 82, closes = false }) {
  /** @type {(number | null | 'close')[]} */
  const calls = [];
  render(
    <NumberEditor
      metric={weight}
      label="Weight · today"
      current={current}
      start={start}
      busy={false}
      onCommit={(value) => calls.push(value)}
      onClose={closes ? () => calls.push('close') : null}
      autofocus={false}
    />,
  );
  return calls;
}

/** @returns {HTMLElement} */
function ruler() {
  return screen.getByRole('slider', { name: 'Weight ruler' });
}

/** @returns {HTMLInputElement} */
function field() {
  return /** @type {HTMLInputElement} */ (screen.getByRole('textbox', { name: 'Weight kg' }));
}

const touch = { pointerId: 1, pointerType: 'touch', button: 0 };

describe('NumberEditor', () => {
  test('a drag moves one step for each tick without a jump at the start, and the release sends the value', () => {
    const calls = showEditor({ current: 82, start: null });
    fireEvent.pointerDown(ruler(), { ...touch, clientX: 200 });
    // The touch slop and 1 pixel: the drag starts, and the value does not change.
    fireEvent.pointerMove(ruler(), { ...touch, clientX: 200 - (TOUCH_SLOP + 1) });
    fireEvent.pointerMove(ruler(), { ...touch, clientX: 200 - (TOUCH_SLOP + 1) - 3 * TICK });
    expect(calls).toEqual([]);
    fireEvent.pointerUp(ruler(), { ...touch, clientX: 200 - (TOUCH_SLOP + 1) - 3 * TICK });

    // 3 ticks to the left give 82.3.
    expect(calls).toEqual([82.3]);
    expect(ruler().getAttribute('aria-valuetext')).toBe('82.3 kg');
  });

  test('a press without a move confirms the start value of an empty day, and does nothing on the value of the day', () => {
    const calls = showEditor({ current: null, start: 82 });
    fireEvent.pointerDown(ruler(), { ...touch, clientX: 200 });
    fireEvent.pointerUp(ruler(), { ...touch, clientX: 200 });
    expect(calls).toEqual([82]);
    cleanup();

    const same = showEditor({ current: 82 });
    fireEvent.pointerDown(ruler(), { ...touch, clientX: 200 });
    fireEvent.pointerUp(ruler(), { ...touch, clientX: 200 });
    expect(same).toEqual([]);
  });

  test('Enter sends a typed value, and an empty field clears the day', () => {
    const calls = showEditor({ current: 82 });
    fireEvent.input(field(), { target: { value: '81,9' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    fireEvent.input(field(), { target: { value: '' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(calls).toEqual([81.9, null]);
  });

  test('the focus that leaves the editor sends a typed value, and only a focus sends nothing', () => {
    const calls = showEditor({ current: 82 });
    fireEvent.focusOut(field(), { relatedTarget: document.body });
    expect(calls).toEqual([]);

    fireEvent.input(field(), { target: { value: '81.5' } });
    // From the field to the ruler: the focus stays in the editor.
    fireEvent.focusOut(field(), { relatedTarget: ruler() });
    expect(calls).toEqual([]);
    fireEvent.focusOut(ruler(), { relatedTarget: document.body });
    expect(calls).toEqual([81.5]);
  });

  test('a text that is not a number shows an error and sends nothing', () => {
    const calls = showEditor({ current: 82 });
    fireEvent.input(field(), { target: { value: 'heavy' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(calls).toEqual([]);
    expect(screen.getByRole('alert').textContent).toBe('Enter a number, for example 82.0.');
  });

  test('Escape gives the value of the day again', () => {
    const calls = showEditor({ current: 82 });
    fireEvent.input(field(), { target: { value: '90' } });
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(field().value).toBe('82.0');
    fireEvent.focusOut(field(), { relatedTarget: document.body });
    expect(calls).toEqual([]);
  });

  test('in a table, Enter and Close send the value and close, and Clear clears a day with a value', () => {
    const calls = showEditor({ current: 82, closes: true });
    fireEvent.input(field(), { target: { value: '81.7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(calls).toEqual([81.7, 'close', null]);
  });

  test('an empty day has no Clear button, and the tiles have no buttons', () => {
    showEditor({ current: null, closes: true });
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
    cleanup();

    showEditor({ current: 82 });
    expect(screen.queryByRole('button')).toBeNull();
  });
});
