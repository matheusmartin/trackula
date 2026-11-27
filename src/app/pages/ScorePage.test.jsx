import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Day, monthOf } from '../../model/Day.js';
import { monthTitle } from '../../model/Format.js';
import { MainView } from '../../model/MainView.js';
import { Route } from '../../model/Route.js';
import { DemoStore } from '../../sheets/DemoStore.js';
import { NavigatorContext, Navigator } from '../Navigation.js';
import { CountingStore } from '../testing/CountingStore.js';
import { FakeHistory } from '../testing/FakePlatform.js';
import { ReloadHandle, TodayPage } from './TodayPage.jsx';

/** The longest wait for the UI in a test. */
const TIMEOUT = 5000;

const today = Day.of(2026, 10, 3);
/** @type {CountingStore} */
let store;

beforeEach(() => {
  store = new CountingStore(new DemoStore(today, 0));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Shows the Today page on the view `start` and waits for the data.
 * @param {MainView} [start]
 */
async function showPage(start = MainView.DAYS) {
  const navigator = new Navigator(new FakeHistory(Route.ofView(start).hash));
  render(
    <NavigatorContext.Provider value={navigator}>
      <TodayPage
        store={store}
        today={today}
        expired={() => false}
        onExpired={() => {}}
        reload={new ReloadHandle()}
        onBusy={() => {}}
        readPref={() => null}
        writePref={() => {}}
      />
    </NavigatorContext.Provider>,
  );
  await waitFor(() => expect(store.last).not.toBeNull(), { timeout: TIMEOUT });
}

/**
 * Shows the Score view and waits until it shows `text`.
 * @param {string} text
 */
async function showScore(text) {
  await showPage(MainView.SCORE);
  await screen.findAllByText(text, {}, { timeout: TIMEOUT });
}

/**
 * The button with the name `name`.
 * @param {string | RegExp} name
 * @returns {HTMLButtonElement}
 */
function button(name) {
  return /** @type {HTMLButtonElement} */ (screen.getByRole('button', { name }));
}

describe('ScorePage', () => {
  test('the score view opens at all data', async () => {
    await showScore('Average per day');
    // At All, the zoom label goes back to 3 months. The text "All" is also the chip of all groups.
    expect(button('Back to 3 months')).toBeTruthy();
    expect(button('Zoom out').disabled).toBe(true);
    expect(button('Earlier').disabled).toBe(true);
    // At All, the overview would show the same bars as "Average per day".
    expect(screen.queryByRole('img', { name: 'All data' })).toBeNull();
    fireEvent.click(button('Back to 3 months'));
    expect(screen.getByRole('img', { name: 'All data' })).toBeTruthy();
  });

  test('the score view has averages per day and per weekday and no calendar', async () => {
    await showScore('Average per day');
    expect(screen.getByRole('heading', { name: 'Score' })).toBeTruthy();
    expect(screen.getByText('Weekday averages')).toBeTruthy();
    expect(screen.getByText('Strength (%)')).toBeTruthy();
    expect(screen.getByText('best weekday')).toBeTruthy();
    // The score does not add up over time: no total.
    expect(screen.queryByText('Running total')).toBeNull();
    expect(screen.queryByText('Totals')).toBeNull();
    expect(screen.queryByText('total')).toBeNull();
    expect(screen.queryByText('Edit days')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  test('the score view compares the halves of the period and shows the score of each day in the calendar', async () => {
    await showScore('change');
    // At All, no day comes before the window. The change compares the halves of the window, so it has values.
    expect(button('Back to 3 months')).toBeTruthy();
    expect(screen.queryByText('No values in this period.')).toBeNull();
    // The calendar shows the score of each day, so there is no heatmap of the same days.
    expect(screen.getByText('Score by month')).toBeTruthy();
    expect(screen.queryByText('Score by day')).toBeNull();
  });

  test('the score view has only the charts that show different data', async () => {
    await showScore('Weekday averages');
    expect(screen.getByText('Average per day')).toBeTruthy();
    // These charts showed again the days, the weekdays or the change that the other charts show, or were not useful:
    // points by metric and habit links.
    for (const title of [
      'This week and last week',
      'Above and below your average',
      'Days by group',
      'Weekday range',
      'Weekday change',
      'Metrics by weekday',
      'Distribution (days)',
      'days with a score',
      'Points by metric',
      'Habits that go with good days',
    ]) {
      expect(screen.queryByText(title)).toBeNull();
    }
  });

  test('the score view compares the week of the window end with the 4 weeks before', async () => {
    await showScore('This week and the 4 weeks before');
    // All metrics with 2 or more groups: the week and month tables are by group.
    expect(screen.getByText('Score by group and week')).toBeTruthy();
    expect(screen.getByText('Score by group and month')).toBeTruthy();
    expect(screen.queryByText('Score by metric and month')).toBeNull();
    // An older window, 3 months that end on Sunday 2026-08-30: the week of its end.
    fireEvent.click(button('Back to 3 months'));
    fireEvent.click(button('Earlier'));
    expect(screen.queryByText('This week and the 4 weeks before')).toBeNull();
    expect(screen.getByText('The week of Aug 24 and the 4 weeks before')).toBeTruthy();
    // One group: the week and month tables are by metric.
    fireEvent.click(screen.getAllByText('Hygiene')[0]);
    await screen.findByText('Score by metric and week', {}, { timeout: TIMEOUT });
    expect(screen.getByText('Score by metric and month')).toBeTruthy();
    expect(screen.queryByText('Score by group and month')).toBeNull();
  });

  test('the score calendar shows the month of the window end and its arrows change the month', async () => {
    await showScore('Score by month');
    expect(screen.queryByText('Edit days')).toBeNull();
    expect(screen.getByText(monthTitle(monthOf(today)))).toBeTruthy();
    expect(screen.getByRole('cell', { name: /^Oct 1:/ })).toBeTruthy();
    expect(button('Next month').disabled).toBe(true);
    fireEvent.click(button('Previous month'));
    expect(screen.getByText(monthTitle(monthOf(Day.of(2026, 9, 1))))).toBeTruthy();
    expect(screen.getByRole('cell', { name: /^Sep 30:/ })).toBeTruthy();
  });

  test('the weekday averages of all metrics stack the groups and of one group do not', async () => {
    await showScore('Weekday averages');
    const stacked = 'The average score on each weekday, from the days with a score. Each color is a group.';
    expect(screen.getByText(stacked)).toBeTruthy();
    // The legends have each group name, and the group chips have it too.
    expect(screen.getAllByText('Hygiene').length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getAllByText('Hygiene')[0]);
    await screen.findByText('The average score on each weekday, from the days with a score.', {}, { timeout: TIMEOUT });
    expect(screen.queryByText(stacked)).toBeNull();
  });
});
