import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { Day } from '../../model/Day.js';
import { NumberGoal, NumberMetric, YesNoMetric } from '../../model/Metric.js';
import { DayCell, ScoreCell } from './DayCell.jsx';

/** @import { Metric } from '../../model/Metric.js' */

afterEach(cleanup);

const today = Day.of(2026, 10, 3);
const water = new NumberMetric({
  id: 'water',
  name: 'Water',
  icon: 'water_drop',
  goal: new NumberGoal({ target: 8 }),
  unit: 'glasses',
});
const coffee = new NumberMetric({
  id: 'coffee',
  name: 'Coffee',
  icon: 'coffee',
  goal: new NumberGoal({ target: 2, isMaximum: true }),
  unit: 'cups',
});
const read = new YesNoMetric({ id: 'read', name: 'Read', icon: 'menu_book' });

/**
 * Shows the cell of `metric` on `day` with `value`, and returns it.
 * @param {Metric} metric
 * @param {number | null} value
 * @param {Day} [day] Default: today.
 * @param {() => void} [onClick]
 * @returns {HTMLElement}
 */
function showCell(metric, value, day = today, onClick = () => {}) {
  const { container } = render(
    <DayCell
      metric={metric}
      day={day}
      today={today}
      value={value}
      points={null}
      selected={false}
      enabled
      countInput={null}
      onAdd={() => {}}
      onClick={onClick}
    />,
  );
  return /** @type {HTMLElement} */ (container.firstElementChild);
}

describe('DayCell', () => {
  test('a day without a value has only a border', () => {
    const cell = showCell(water, null);
    expect(cell.getAttribute('aria-label')).toBe('Water, Oct 3: no value');
    expect(cell.className).toBe('day-cell day-cell-none');
    expect(cell.textContent).toBe('');
  });

  test('some points give a part of the gradient, and the name tells the value and the points', () => {
    const cell = showCell(water, 5);
    expect(cell.getAttribute('aria-label')).toBe('Water, Oct 3: 5 glasses, 0.6 points');
    expect(cell.className).toBe('day-cell day-cell-value');
    expect(cell.style.getPropertyValue('--cell-fill')).toBe('0.475');
    expect(cell.textContent).toBe('5');
  });

  test('only a full point gives the full gradient', () => {
    const cell = showCell(water, 8);
    expect(cell.className).toBe('day-cell day-cell-value day-cell-full');
    expect(cell.style.getPropertyValue('--cell-fill')).toBe('1');
  });

  test('a value over a limit has 0 points and says so', () => {
    const cell = showCell(coffee, 3);
    expect(cell.getAttribute('aria-label')).toBe('Coffee, Oct 3: 3 cups, over the limit');
    expect(cell.style.getPropertyValue('--cell-fill')).toBe('0');
  });

  test('a yes/no cell has no text, and a no is a value with 0 points', () => {
    expect(showCell(read, 1).getAttribute('aria-label')).toBe('Read, Oct 3: yes, 1 point');
    cleanup();
    const no = showCell(read, 0);
    expect(no.getAttribute('aria-label')).toBe('Read, Oct 3: no, 0 points');
    expect(no.className).toBe('day-cell day-cell-value');
    expect(no.textContent).toBe('');
  });

  test('a click calls onClick, and a day after today has no cell', () => {
    let clicks = 0;
    fireEvent.click(showCell(read, null, today, () => clicks++));
    expect(clicks).toBe(1);
    cleanup();
    showCell(read, null, today.addDays(1));
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ScoreCell', () => {
  test('the score cell shows the score with the same fill, and a day without a score has only a border', () => {
    render(
      <>
        <ScoreCell day={today} today={today} score={62.5} />
        <ScoreCell day={today.addDays(-1)} today={today} score={null} />
      </>,
    );
    const cell = screen.getByRole('img', { name: 'Oct 3: score 62.5%' });
    expect(cell.textContent).toBe('62.5');
    expect(cell.style.getPropertyValue('--cell-fill')).toBe('0.475');
    expect(screen.getByRole('img', { name: 'Oct 2: no score' }).className).toBe('day-cell day-cell-none');
  });
});
