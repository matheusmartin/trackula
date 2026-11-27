import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { Day } from '../../model/Day.js';
import { ScoreCalendar } from './ScoreCalendar.jsx';

/** @import { MonthKey } from '../../model/Day.js' */

afterEach(cleanup);

describe('ScoreCalendar', () => {
  test('the score calendar shows the scores of the month and stops at the month of today', () => {
    /** @type {MonthKey} */
    let month = { year: 2026, month: 9 };
    render(
      <ScoreCalendar
        scores={new Map([[Day.of(2026, 9, 29), 12]])}
        today={Day.of(2026, 10, 3)}
        month={{ year: 2026, month: 9 }}
        onMonth={(m) => {
          month = m;
        }}
      />,
    );
    expect(screen.getByText('September 2026')).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Sep 29: 12' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Sep 28: no score' })).toBeTruthy();
    expect(screen.getByTitle('Sep 29: 12')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(month).toEqual({ year: 2026, month: 10 });
  });

  test('the arrow to the next month is off in the month of today', () => {
    render(
      <ScoreCalendar
        scores={new Map()}
        today={Day.of(2026, 10, 3)}
        month={{ year: 2026, month: 10 }}
        onMonth={() => {}}
      />,
    );
    const next = /** @type {HTMLButtonElement} */ (screen.getByRole('button', { name: 'Next month' }));
    const previous = /** @type {HTMLButtonElement} */ (screen.getByRole('button', { name: 'Previous month' }));
    expect(next.disabled).toBe(true);
    expect(previous.disabled).toBe(false);
  });
});
