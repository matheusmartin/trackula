import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { Day } from '../../model/Day.js';
import { LogTable } from '../../model/LogEntry.js';
import { YesNoMetric } from '../../model/Metric.js';
import { MonthCalendar } from './MonthCalendar.jsx';

/** @import { MonthKey } from '../../model/Day.js' */

afterEach(cleanup);

const today = Day.of(2026, 10, 3);
const read = new YesNoMetric({ id: 'read', name: 'Read', icon: 'menu_book' });

/**
 * Shows the calendar of `month`. Returns the months that the arrows and the swipes ask for.
 * @param {MonthKey} month
 * @returns {MonthKey[]}
 */
function showCalendar(month) {
  /** @type {MonthKey[]} */
  const months = [];
  render(
    <MonthCalendar
      metric={read}
      log={new LogTable([], new Map(), new Map())}
      today={today}
      busy={false}
      onWrite={() => {}}
      pending={new Map()}
      onCount={() => {}}
      month={month}
      onMonth={(m) => months.push(m)}
    />,
  );
  return months;
}

describe('MonthCalendar', () => {
  test('the arrows change the month and stop at the month of today', () => {
    const months = showCalendar({ year: 2026, month: 10 });
    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Read, 2026-10-/ })).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));

    expect(months).toEqual([{ year: 2026, month: 9 }]);
  });

  test('a swipe to the left shows the next month, and a swipe to the right the month before', () => {
    const months = showCalendar({ year: 2026, month: 8 });
    const cell = screen.getByRole('button', { name: 'Read, 2026-08-12' });
    const swipe = (/** @type {number} */ dx) => {
      fireEvent.pointerDown(cell, { pointerId: 1, clientX: 200, clientY: 300 });
      fireEvent.pointerUp(cell, { pointerId: 1, clientX: 200 + dx, clientY: 310 });
    };
    swipe(-80);
    swipe(80);
    // A short move is a tap, not a swipe.
    swipe(20);
    expect(months).toEqual([
      { year: 2026, month: 9 },
      { year: 2026, month: 7 },
    ]);
  });
});
