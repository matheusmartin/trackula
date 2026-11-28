import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { Day, daysBetween } from '../../model/Day.js';
import { LogTable } from '../../model/LogEntry.js';
import { DayLayout } from '../../model/MainView.js';
import { YesNoMetric } from '../../model/Metric.js';
import { HabitTable } from './HabitTable.jsx';

/** @import { DayLayout as Layout } from '../../model/MainView.js' */

afterEach(cleanup);

const today = Day.of(2026, 10, 3);
const days = daysBetween(today.addDays(-4), today);
const read = new YesNoMetric({ id: 'read', name: 'Read', icon: 'menu_book' });
// Read: yes on Sep 30, no on Oct 1. No value today.
const log = new LogTable(
  [
    { row: 2, date: Day.of(2026, 9, 30), metricId: 'read', value: 1 },
    { row: 3, date: Day.of(2026, 10, 1), metricId: 'read', value: 0 },
  ],
  new Map([
    [Day.of(2026, 9, 30), 2],
    [Day.of(2026, 10, 1), 3],
  ]),
  new Map([['read', 1]]),
);
const scores = new Map([
  [Day.of(2026, 9, 30), 100],
  [Day.of(2026, 10, 1), 0],
  [today, 0],
]);

/**
 * Shows the table or the calendars of Read. Returns the list of the calls of the handlers.
 * @param {Layout} layout
 * @returns {string[]}
 */
function showTable(layout) {
  /** @type {string[]} */
  const calls = [];
  render(
    <HabitTable
      metrics={[read]}
      log={log}
      today={today}
      days={days}
      layout={layout}
      busy={false}
      onRecord={(m, d, value) => calls.push(`${m.id} ${d} ${value}`)}
      pending={new Map()}
      onCount={() => {}}
      scores={scores}
      onScore={() => calls.push('score')}
    />,
  );
  return calls;
}

describe('HabitTable', () => {
  test('the table card has a score bar in the column of each day with a score, and today without a value has none', () => {
    showTable(DayLayout.TABLE);
    expect(screen.getByRole('heading', { name: 'Last 5 days' })).toBeTruthy();
    const scoreRow = /** @type {HTMLElement} */ (screen.getByRole('row', { name: /^Score/ }));
    const bars = within(scoreRow).getAllByRole('img');
    expect(bars.map((b) => b.getAttribute('aria-label'))).toEqual(['Sep 30: score 100%', 'Oct 1: score 0%']);
    // The score row has one cell for each day, as the day rows.
    expect(scoreRow.querySelectorAll('td')).toHaveLength(days.length);
    expect(screen.getByRole('list', { name: 'Cell colors' })).toBeTruthy();
  });

  test('a click on a yes/no cell writes yes, and a click on a yes writes no', () => {
    const calls = showTable(DayLayout.TABLE);
    fireEvent.click(screen.getByRole('button', { name: 'Read, Oct 3: no value' }));
    fireEvent.click(screen.getByRole('button', { name: 'Read, Sep 30: yes, 1 point' }));
    fireEvent.click(screen.getByRole('button', { name: 'Read, Oct 1: no, 0 points' }));
    expect(calls).toEqual(['read 2026-10-03 1', 'read 2026-09-30 0', 'read 2026-10-01 1']);
  });

  test('the calendars start with the score bars, and the score name opens the Score screen', () => {
    const calls = showTable(DayLayout.CALENDARS);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('img', { name: 'Sep 30: score 100%' })).toBeTruthy();
    // Today is not over: without a value, it has no score bar yet.
    expect(screen.queryByRole('img', { name: /^Oct 3:/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Score: show the Score screen' }));
    expect(calls).toEqual(['score']);
  });

  test('the score bar of a Saturday or a Sunday is lighter', () => {
    // Today, Saturday Oct 3, has a value: it has its score bar.
    const withToday = new LogTable(
      [{ row: 2, date: today, metricId: 'read', value: 1 }],
      new Map([[today, 2]]),
      new Map([['read', 1]]),
    );
    render(
      <HabitTable
        metrics={[read]}
        log={withToday}
        today={today}
        days={days}
        layout={DayLayout.TABLE}
        busy={false}
        onRecord={() => {}}
        pending={new Map()}
        onCount={() => {}}
        scores={new Map([...scores, [today, 100]])}
      />,
    );
    const bar = (/** @type {string} */ name) =>
      /** @type {Element} */ (screen.getByRole('img', { name }).querySelector('.score-bar')).className;
    expect(bar('Oct 3: score 100%')).toBe('score-bar score-bar-weekend');
    expect(bar('Sep 30: score 100%')).toBe('score-bar');
  });
});
