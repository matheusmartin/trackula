import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Day, monthOf } from '../../model/Day.js';
import { monthTitle, shortDay } from '../../model/Format.js';
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
    // The span chip of all data. The text "All" is also the chip of all groups.
    expect(button('All data').getAttribute('aria-pressed')).toBe('true');
    expect(button('Earlier').disabled).toBe(true);
    // The day strip shows all days, also at All.
    expect(screen.getByRole('img', { name: /^All data, / })).toBeTruthy();
    fireEvent.click(button('3 months'));
    expect(button('3 months').getAttribute('aria-pressed')).toBe('true');
    expect(button('Earlier').disabled).toBe(false);
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
    expect(button('All data').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('No values in this period.')).toBeNull();
    // The Days card shows the score of each day.
    expect(screen.getByRole('heading', { name: 'Days', level: 3 })).toBeTruthy();
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

  test('the score table has a week and a month switch, by group or by metric of one group', async () => {
    await showScore('Score by group');
    // All metrics with 2 or more groups: the table is by group. "This week and the 4 weeks before" is gone (P4).
    expect(screen.queryByText(/and the 4 weeks before$/)).toBeNull();
    expect(button('Week').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('More than the week before')).toBeTruthy();
    fireEvent.click(button('Month'));
    expect(button('Month').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('More than the month before')).toBeTruthy();
    // One group: the table is by metric.
    fireEvent.click(screen.getAllByText('Hygiene')[0]);
    await screen.findByText('Score by metric', {}, { timeout: TIMEOUT });
    expect(screen.queryByText('Score by group')).toBeNull();
  });

  test('the Days card shows the month of the window end and its arrows change the month', async () => {
    await showScore('Days');
    expect(screen.getByText(monthTitle(monthOf(today)))).toBeTruthy();
    expect(screen.getByRole('img', { name: /^Oct 1: score / })).toBeTruthy();
    // Today has no value in the demo data: no score yet.
    expect(screen.getByRole('img', { name: `${shortDay(today)}: no score` })).toBeTruthy();
    expect(button('Next month').disabled).toBe(true);
    fireEvent.click(button('Previous month'));
    expect(screen.getByText(monthTitle(monthOf(Day.of(2026, 9, 1))))).toBeTruthy();
    expect(screen.getByRole('img', { name: /^Sep 30: score / })).toBeTruthy();
  });

  test('a tap on a bar of the average per day shows its month in the Days card', async () => {
    await showScore('Average per day');
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    expect(button('Next month').disabled).toBe(true);
    // At All, the first bar is the oldest week of the data: not the month of today.
    const chart = /** @type {HTMLElement} */ (screen.getByRole('heading', { name: 'Average per day' }).parentElement);
    fireEvent.click(/** @type {Element} */ (chart.querySelector('.chart-column-target')));
    expect(button('Next month').disabled).toBe(false);
    expect(screen.queryByText(monthTitle(monthOf(today)))).toBeNull();
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  test('the weekday averages of all metrics stack the groups and of one group do not', async () => {
    await showScore('Weekday averages');
    const stacked = 'The average score on each weekday, from the days with a score. Each tone is a group.';
    expect(screen.getByText(stacked)).toBeTruthy();
    // The legends have each group name, and the group chips have it too.
    expect(screen.getAllByText('Hygiene').length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getAllByText('Hygiene')[0]);
    await screen.findByText('The average score on each weekday, from the days with a score.', {}, { timeout: TIMEOUT });
    expect(screen.queryByText(stacked)).toBeNull();
  });
});
