import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Day, monthOf } from '../../model/Day.js';
import { formatDateRange, monthTitle } from '../../model/Format.js';
import { MainView } from '../../model/MainView.js';
import { Route, Screen } from '../../model/Route.js';
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
/** True while the page shows a detail screen: the address of the navigator tells it. */
let detail = false;

beforeEach(() => {
  store = new CountingStore(new DemoStore(today, 0));
  detail = false;
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
  navigator.subscribe((route) => {
    detail = route.screen === Screen.METRIC;
  });
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
 * Opens the detail screen of the metric `name` with its name in the table.
 * @param {string} name
 */
async function openDetail(name) {
  fireEvent.click(await screen.findByRole('button', { name: `Show all data of ${name}` }, { timeout: TIMEOUT }));
  await screen.findByText('Edit days', {}, { timeout: TIMEOUT });
}

/**
 * The button with the name `name`.
 * @param {string | RegExp} name
 * @returns {HTMLButtonElement}
 */
function button(name) {
  return /** @type {HTMLButtonElement} */ (screen.getByRole('button', { name }));
}

/**
 * True if a text of the page has `text` in it.
 * @param {string} text
 * @returns {boolean}
 */
function hasText(text) {
  return screen.queryAllByText(new RegExp(text)).length > 0;
}

/**
 * Zooms the detail screen of Weight from All to 1 month: 5 weeks, from Monday 2026-08-31 to today, Saturday
 * 2026-10-03.
 */
async function weightAtOneMonth() {
  await showPage();
  await openDetail('Weight');
  // All, then 3 months, then 1 month.
  fireEvent.click(button('Zoom in'));
  fireEvent.click(button('Zoom in'));
  expect(screen.getByText('1 month')).toBeTruthy();
  expect(screen.getByText(formatDateRange(Day.of(2026, 8, 31), today))).toBeTruthy();
}

describe('MetricDetail', () => {
  test('a metric name opens its detail screen and back closes', async () => {
    await showPage();
    await openDetail('Meditate');
    expect(detail).toBe(true);
    expect(screen.getByText('Yes rate')).toBeTruthy();
    expect(screen.getByText('Habit strength (%)')).toBeTruthy();
    expect(screen.getByText('Yes days')).toBeTruthy();

    fireEvent.click(button('Back'));
    await waitFor(() => expect(detail).toBe(false));
    expect(screen.queryByText('Edit days')).toBeNull();
  });

  test('the detail screen of a number and of a count has their charts', async () => {
    await showPage();
    await openDetail('Weight');
    expect(screen.getByText('Averages and range')).toBeTruthy();
    expect(screen.getByText('Values and 7-day trend')).toBeTruthy();
    fireEvent.click(button('Back'));
    await openDetail('Water');
    expect(screen.getByText('Totals')).toBeTruthy();
    expect(screen.getByText('Running total')).toBeTruthy();
    expect(screen.getByText('total')).toBeTruthy();
  });

  test('the zoom buttons change the window and the label goes to All and back', async () => {
    await showPage();
    await openDetail('Water');
    // The demo data has 120 days: the window of a count opens at 3 months, and All is 6 months.
    expect(screen.getByText('3 months')).toBeTruthy();
    fireEvent.click(button('Show all'));
    expect(screen.getByText('All')).toBeTruthy();
    expect(button('Zoom out').disabled).toBe(true);
    fireEvent.click(button('Back to 3 months'));
    expect(screen.getByText('3 months')).toBeTruthy();
    fireEvent.click(button('Zoom in'));
    expect(screen.getByText('1 month')).toBeTruthy();
  });

  test('the window of a number opens at All and the label goes to 3 months and back', async () => {
    await showPage();
    await openDetail('Weight');
    // All: the 120 days of the demo data, from the first value to today.
    expect(screen.getByText('All')).toBeTruthy();
    expect(button('Zoom out').disabled).toBe(true);
    expect(button('Later').disabled).toBe(true);
    expect(button('Earlier').disabled).toBe(true);
    fireEvent.click(button('Back to 3 months'));
    expect(screen.getByText('3 months')).toBeTruthy();
    fireEvent.click(button('Show all'));
    expect(screen.getByText('All')).toBeTruthy();
    fireEvent.click(button('Zoom in'));
    expect(screen.getByText('3 months')).toBeTruthy();
  });

  test('the arrows move the window by its span and the calendar follows it', async () => {
    await weightAtOneMonth();
    expect(button('Later').disabled).toBe(true);
    expect(hasText(monthTitle(monthOf(today)))).toBe(true);

    fireEvent.click(button('Earlier'));
    expect(screen.getByText(formatDateRange(Day.of(2026, 7, 27), Day.of(2026, 8, 30)))).toBeTruthy();
    expect(hasText(monthTitle(monthOf(Day.of(2026, 8, 30))))).toBe(true);
  });

  test('the calendar arrows change the month but not after this month', async () => {
    await showPage();
    await openDetail('Meditate');
    expect(button('Next month').disabled).toBe(true);
    fireEvent.click(button('Previous month'));
    // A narrow window shows "September 2026", a wide one "August – September 2026".
    expect(hasText('September 2026')).toBe(true);
    expect(hasText('October 2026')).toBe(false);
  });

  test('a cell in the calendar of the detail screen writes', async () => {
    await showPage();
    await openDetail('Meditate');
    const cell = screen.getAllByRole('button', { name: new RegExp(`^Meditate, ${today}`) })[0];
    fireEvent.click(cell, { detail: 1 });
    await waitFor(() => expect(store.last?.log.valueAt('meditate', today)).toBe(1), { timeout: TIMEOUT });
  });

  test('a tap on the overview moves the window there', async () => {
    await weightAtOneMonth();
    // The overview starts at the first week of the data, 2026-06-01: a tap at the left end shows the oldest weeks.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 400, 40));
    const overview = screen.getByRole('img', { name: 'All data' });
    fireEvent.pointerDown(overview, { clientX: 0, button: 0, pointerId: 1 });
    fireEvent.pointerUp(overview, { clientX: 0, button: 0, pointerId: 1 });
    expect(button('Earlier').disabled).toBe(true);
    expect(button('Later').disabled).toBe(false);
  });

  test('a side drag on the charts moves the window by bars from the press', async () => {
    await weightAtOneMonth();
    // 5 bars on the width of the charts: a drag to the right of 0.55 bar moves the window 1 week back. From the end of
    // the touch slop (18 px), the drag is less than half a bar: then it does not move the window.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 500, 100));
    const bar = 500 / 5;
    const chart = screen.getByText('Averages and range');
    fireEvent.pointerDown(chart, { clientX: 250, button: 0, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerMove(chart, { clientX: 250 + bar * 0.275, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerMove(chart, { clientX: 250 + bar * 0.55, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerUp(chart, { clientX: 250 + bar * 0.55, pointerId: 1, pointerType: 'touch' });
    expect(screen.getByText(formatDateRange(Day.of(2026, 8, 24), Day.of(2026, 9, 27)))).toBeTruthy();
  });

  test('a heatmap tap shows its month and a move of the window goes back to the window end', async () => {
    await weightAtOneMonth();
    // The heatmap of 1 month starts on Monday 2026-08-31, in the top left corner.
    const heatmap = screen.getByRole('img', { name: `Days from 2026-08-31 to ${today}` });
    fireEvent.click(/** @type {Element} */ (heatmap.querySelector('rect')));
    expect(hasText('August 2026')).toBe(true);
    expect(hasText('October 2026')).toBe(false);

    fireEvent.click(button('Earlier'));
    // The window now ends on 2026-08-30: the calendar shows its month.
    expect(hasText('August 2026')).toBe(true);
    expect(button('Next month').disabled).toBe(false);
  });

  test('a swipe on the calendar shows the month before but not a month after this month', async () => {
    await showPage();
    await openDetail('Meditate');
    const calendar = screen.getAllByRole('button', { name: new RegExp(`^Meditate, ${today}`) })[0];
    // To the left: the next month. This month is the newest: nothing changes.
    fireEvent.pointerDown(calendar, { clientX: 300, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(calendar, { clientX: 100, clientY: 100, pointerId: 1 });
    expect(button('Next month').disabled).toBe(true);
    // To the right: the month before.
    fireEvent.pointerDown(calendar, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(calendar, { clientX: 300, clientY: 100, pointerId: 1 });
    expect(button('Next month').disabled).toBe(false);
  });

  test('a zoom away from the newest bar keeps the same end', async () => {
    await weightAtOneMonth();
    fireEvent.click(button('Earlier'));
    expect(screen.getByText(formatDateRange(Day.of(2026, 7, 27), Day.of(2026, 8, 30)))).toBeTruthy();
    // 2 weeks: the 14 days that end on 2026-08-30.
    fireEvent.click(button('Zoom in'));
    expect(screen.getByText(formatDateRange(Day.of(2026, 8, 17), Day.of(2026, 8, 30)))).toBeTruthy();
  });

  test('a side wheel on the charts moves the window by bars', async () => {
    await weightAtOneMonth();
    fireEvent.click(button('Earlier'));
    const chart = screen.getByText('Averages and range');
    // Less than one bar: the window stays.
    fireEvent.wheel(chart, { deltaX: 30, deltaY: 0 });
    expect(screen.getByText(formatDateRange(Day.of(2026, 7, 27), Day.of(2026, 8, 30)))).toBeTruthy();
    // With the move before, more than one bar: one week later.
    fireEvent.wheel(chart, { deltaX: 30, deltaY: 0 });
    expect(screen.getByText(formatDateRange(Day.of(2026, 8, 3), Day.of(2026, 9, 6)))).toBeTruthy();
    // A vertical wheel scrolls the page.
    fireEvent.wheel(chart, { deltaX: 10, deltaY: 100 });
    expect(screen.getByText(formatDateRange(Day.of(2026, 8, 3), Day.of(2026, 9, 6)))).toBeTruthy();
  });
});
