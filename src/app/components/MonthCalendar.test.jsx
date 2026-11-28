import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Day } from '../../model/Day.js';
import { LogTable } from '../../model/LogEntry.js';
import { YesNoMetric } from '../../model/Metric.js';
import { MonthCalendar, monthCount } from './MonthCalendar.jsx';

/** @import { MonthKey } from '../../model/Day.js' */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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
      onRecord={() => {}}
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
    expect(screen.getAllByRole('button', { name: /^Read, Oct \d+:/ })).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));

    expect(months).toEqual([{ year: 2026, month: 9 }]);
  });

  test('a swipe to the left shows the next month, and a swipe to the right the month before', () => {
    const months = showCalendar({ year: 2026, month: 8 });
    const cell = screen.getByRole('button', { name: /^Read, Aug 12:/ });
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

  test('a card shows as many months side by side as its width holds, up to 3', () => {
    expect(monthCount(0)).toBe(1);
    expect(monthCount(358)).toBe(1);
    expect(monthCount(672)).toBe(2);
    expect(monthCount(1200)).toBe(3);
    expect(monthCount(2000)).toBe(3);
  });

  test('a wide card shows the months before the month in view, each with its title and day numbers', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1200, 600));
    showCalendar({ year: 2026, month: 10 });
    expect(screen.getByText('August – October 2026')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Read, (Aug|Sep|Oct) \d+:/ })).toHaveLength(31 + 30 + 3);
    expect(screen.getByRole('button', { name: /^Read, Sep 12:/ }).textContent).toBe('12');
    expect(screen.getByRole('list', { name: 'Cell colors' })).toBeTruthy();
  });
});
