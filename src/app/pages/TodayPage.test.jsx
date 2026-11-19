import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { Day } from '../../model/Day.js';
import { MainView } from '../../model/MainView.js';
import { NumberGoal } from '../../model/Metric.js';
import { planEditMetric } from '../../model/MetricsWrite.js';
import { DemoStore } from '../../sheets/DemoStore.js';
import { CountingStore, Gate } from '../testing/CountingStore.js';
import { ReloadHandle, TodayPage } from './TodayPage.jsx';

/** @import { Metric } from '../../model/Metric.js' */

/** The longest wait for the UI in a test. */
const TIMEOUT = 5000;

const today = Day.of(2026, 10, 3);
/** @type {CountingStore} */
let store;
/** @type {Map<string, string>} */
let prefs;
/** The view of the navigation: the page changes it with `onView`, and a test with `setView`. */
let view = MainView.TODAY;
/** @type {(view: MainView) => void} */
let setView = () => {};

beforeEach(() => {
  store = new CountingStore(new DemoStore(today, 0));
  prefs = new Map();
});

afterEach(cleanup);

/**
 * The page with the view state of the App.
 * @param {{ start: MainView }} props
 * @returns {import('preact').JSX.Element}
 */
function Page({ start }) {
  const [shown, setShown] = useState(start);
  view = shown;
  setView = setShown;
  return (
    <TodayPage
      store={store}
      today={today}
      expired={() => false}
      onExpired={() => {}}
      view={shown}
      onView={setShown}
      reload={new ReloadHandle()}
      onBusy={() => {}}
      onDetail={() => {}}
      readPref={(key) => prefs.get(key) ?? null}
      writePref={(key, value) => {
        if (value == null) prefs.delete(key);
        else prefs.set(key, value);
      }}
    />
  );
}

/**
 * Shows the page on the view `start` and waits for the data.
 * @param {MainView} [start]
 */
async function showPage(start = MainView.TODAY) {
  render(<Page start={start} />);
  await screen.findAllByText('Weight', {}, { timeout: TIMEOUT });
}

/**
 * Changes the view, as the navigation of the App does.
 * @param {MainView} next
 */
async function changeView(next) {
  await act(() => setView(next));
}

/**
 * The value of `metricId` today in the last data that the page loaded.
 * @param {string} metricId
 * @returns {number | null}
 */
function valueToday(metricId) {
  return store.last?.log.valueAt(metricId, today) ?? null;
}

/**
 * Waits until `condition` is true.
 * @param {() => boolean} condition
 */
async function waitUntil(condition) {
  await waitFor(() => expect(condition()).toBe(true), { timeout: TIMEOUT });
}

/**
 * Changes the metric `id` of the store with `change`, before the page shows.
 * @param {string} id
 * @param {(metric: any) => Metric} change
 */
async function changeMetric(id, change) {
  const metric = (await store.load()).metrics.find((m) => m.id === id);
  await store.changeMetrics((table) => planEditMetric(table, change(metric)));
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
 * The first day cell of `metric` today. Its name starts with the metric and the day.
 * @param {string} metric
 * @param {string} [value] The value part of the name, for example ": yes".
 * @returns {HTMLElement}
 */
function cellToday(metric, value = '') {
  return screen.getAllByRole('button', { name: new RegExp(`^${metric}, ${today}${value}`) })[0];
}

/**
 * A click of the mouse: a press of the primary button, then the click.
 * @param {HTMLElement} element
 */
function mouseClick(element) {
  fireEvent.pointerDown(element, { pointerType: 'mouse', button: 0 });
  fireEvent.pointerUp(element, { pointerType: 'mouse', button: 0 });
  fireEvent.click(element, { detail: 1 });
}

/**
 * A click of the right mouse button: a press, then the context menu event.
 * @param {HTMLElement} element
 */
function rightClick(element) {
  fireEvent.pointerDown(element, { pointerType: 'mouse', button: 2 });
  fireEvent.contextMenu(element, { button: 2 });
  fireEvent.pointerUp(element, { pointerType: 'mouse', button: 2 });
}

/**
 * A tap of a finger.
 * @param {HTMLElement} element
 */
function touchTap(element) {
  fireEvent.pointerDown(element, { pointerType: 'touch', button: 0 });
  fireEvent.pointerUp(element, { pointerType: 'touch', button: 0 });
  fireEvent.click(element, { detail: 1 });
}

/** @returns {string} The screen reader text of the score chart: its range and its days. */
function scoreChartLabel() {
  return /** @type {string} */ (screen.getAllByRole('img', { name: /^Values from/ })[0].getAttribute('aria-label'));
}

describe('TodayPage', () => {
  test('a yes/no tile is unsaved until save, and save shows the table', async () => {
    await showPage();
    expect(button('No changes').disabled).toBe(true);

    fireEvent.click(screen.getByText('Meditate'));
    expect(button('Save: Meditate').disabled).toBe(false);
    expect(valueToday('meditate')).toBeNull();

    fireEvent.click(button('Save: Meditate'));
    await waitUntil(() => view === MainView.SHORT);
    expect(valueToday('meditate')).toBe(1);
  });

  test('a second tap on a yes/no tile goes back, and the saved value again is not unsaved', async () => {
    await showPage();
    fireEvent.click(screen.getByText('Meditate'));
    fireEvent.click(screen.getByText('Meditate'));
    expect(button('No changes')).toBeTruthy();
  });

  test('a yes tile of the goal no is over the limit', async () => {
    await changeMetric('vitamins', (m) => m.copy({ goalIsYes: false }));
    await showPage();
    fireEvent.click(screen.getByText('Vitamins'));
    const vitamins = screen.getByRole('checkbox', { name: 'Vitamins' });
    expect(vitamins.getAttribute('title')).toBe('Yes, over the limit of the goal no');
    // A yes tile of the goal yes reaches the goal: it is checked, without a limit.
    fireEvent.click(screen.getByText('Meditate'));
    const meditate = screen.getByRole('checkbox', { name: 'Meditate' });
    expect(meditate.getAttribute('aria-checked')).toBe('true');
    expect(meditate.getAttribute('title')).toBe('Yes, goal reached');
  });

  test('a count tile reaches the target of at least', async () => {
    await changeMetric('water', (m) => m.copy({ goal: new NumberGoal({ target: 2 }) }));
    await showPage();
    const tile = button('Water');
    mouseClick(tile);
    await waitFor(() => expect(tile.title).toBe('1. Tap or click: +1. Double-tap or right-click: −1.'));
    mouseClick(tile);
    await waitFor(() => expect(tile.title).toBe('2, goal reached. Tap or click: +1. Double-tap or right-click: −1.'));
  });

  test('a count tile above the target of at most is over the limit', async () => {
    await changeMetric('water', (m) => m.copy({ goal: new NumberGoal({ target: 2, isMaximum: true }) }));
    await showPage();
    const tile = button('Water');
    mouseClick(tile);
    mouseClick(tile);
    // Within the limit: no mark.
    await waitFor(() => expect(tile.title).toBe('2. Tap or click: +1. Double-tap or right-click: −1.'));
    mouseClick(tile);
    await waitFor(() =>
      expect(tile.title).toBe(
        '3, over the limit of the goal at most 2. Tap or click: +1. Double-tap or right-click: −1.',
      ),
    );
  });

  test('a mouse click on a count tile adds a step and a right-click subtracts', async () => {
    await showPage();
    mouseClick(button('Water'));
    mouseClick(button('Water'));
    rightClick(button('Water'));
    fireEvent.click(await screen.findByRole('button', { name: 'Save: Water' }));
    await waitUntil(() => view === MainView.SHORT);
    expect(valueToday('water')).toBe(1);
  });

  test('a click on a yes/no cell writes yes and a second click writes no', async () => {
    await showPage(MainView.SHORT);
    fireEvent.click(cellToday('Meditate'));
    await waitUntil(() => valueToday('meditate') === 1);
    await waitFor(() => expect(/** @type {HTMLButtonElement} */ (cellToday('Meditate', ': yes')).disabled).toBe(false));
    fireEvent.click(cellToday('Meditate', ': yes'));
    await waitUntil(() => valueToday('meditate') === 0);
  });

  test('count clicks on a cell show at once and go to the sheet', async () => {
    await showPage(MainView.SHORT);
    const cell = cellToday('Water');
    mouseClick(cell);
    mouseClick(cell);
    await waitUntil(() => valueToday('water') === 2);
    await waitFor(() => expect(cellToday('Water', ': 2 glasses')).toBeTruthy());
  });

  test('a click on a number cell opens the editor, and save writes the typed value', async () => {
    await showPage(MainView.SHORT);
    fireEvent.click(cellToday('Weight'));
    expect(screen.getByRole('slider', { name: 'Weight ruler' })).toBeTruthy();
    fireEvent.input(screen.getByRole('textbox', { name: 'Weight kg' }), { target: { value: '81,9' } });
    fireEvent.click(button('Save'));
    await waitUntil(() => valueToday('weight') === 81.9);
    expect(screen.queryByRole('slider', { name: 'Weight ruler' })).toBeNull();
  });

  test('a group chip shows only its metrics and stays in local storage', async () => {
    await showPage(MainView.SHORT);
    fireEvent.click(button('Hygiene'));
    await waitFor(() => expect(screen.queryByText('Weight')).toBeNull());
    expect(screen.getByText('Morning teeth')).toBeTruthy();
    expect(prefs.get('group')).toBe('Hygiene');

    fireEvent.click(button('All'));
    await screen.findByText('Weight');
    expect(prefs.has('group')).toBe(false);
  });

  test('a failed save shows the error, keeps the tiles, and the save button works again', async () => {
    await showPage();
    store.failWrites = true;
    fireEvent.click(screen.getByText('Meditate'));
    fireEvent.click(button('Save: Meditate'));
    await screen.findByText('No network.', {}, { timeout: TIMEOUT });
    expect(view).toBe(MainView.TODAY);
    // The failed value is not saved: the tile goes back, and the button is not "Saving…".
    await screen.findByText('Save');
    expect(button('No changes')).toBeTruthy();

    store.failWrites = false;
    fireEvent.click(screen.getByText('Meditate'));
    fireEvent.click(button('Save: Meditate'));
    await waitUntil(() => view === MainView.SHORT);
    expect(valueToday('meditate')).toBe(1);
  });

  test('taps during a write wait and go to the sheet in one write for the cell', async () => {
    await showPage(MainView.SHORT);
    const gate = new Gate();
    store.gate = gate;
    const cell = cellToday('Water');
    mouseClick(cell);
    mouseClick(cell);
    mouseClick(cell);
    // All taps show at once, before the writes end.
    await waitFor(() => expect(cellToday('Water', ': 3 glasses')).toBeTruthy());
    expect(store.writes).toHaveLength(0);

    gate.open();
    await waitUntil(() => valueToday('water') === 3);
    // The first write has the first tap. The second write has the two taps that came during the first write.
    expect(store.writes).toHaveLength(2);
  });

  test('the keys add and subtract on a focused count tile', async () => {
    await showPage();
    const tile = button('Water');
    tile.focus();
    fireEvent.keyDown(tile, { key: '=' });
    fireEvent.keyDown(tile, { key: '=' });
    fireEvent.keyDown(tile, { key: '-' });
    fireEvent.click(await screen.findByRole('button', { name: 'Save: Water' }));
    await waitUntil(() => view === MainView.SHORT);
    expect(valueToday('water')).toBe(1);
  });

  test('a touch tap adds after the wait, and a touch double tap subtracts', async () => {
    await showPage();
    const tile = button('Water');
    touchTap(tile);
    await screen.findByRole('button', { name: 'Save: Water' }, { timeout: TIMEOUT });
    touchTap(tile);
    await new Promise((resolve) => setTimeout(resolve, 50));
    touchTap(tile);
    // 1 − 1 is the saved value again (empty): no change.
    await screen.findByRole('button', { name: 'No changes' }, { timeout: TIMEOUT });
  });

  test('a screen reader click on a count cell adds a step', async () => {
    await showPage(MainView.SHORT);
    // A click without a press, as a screen reader or the keyboard gives it.
    fireEvent.click(cellToday('Water'));
    await waitUntil(() => valueToday('water') === 1);
  });

  test('a failed save stays on the today tiles, also when queued taps get written after it', async () => {
    await showPage();
    const gate = new Gate();
    store.gate = gate;
    // The Save fails. The write of the queued tap after it works and clears the error.
    store.failOnce = true;
    fireEvent.click(screen.getByText('Meditate'));
    fireEvent.click(button('Save: Meditate'));
    // During the Save, the user goes to the table and taps a count cell: the tap waits in the queue.
    await changeView(MainView.SHORT);
    mouseClick(cellToday('Water'));
    await changeView(MainView.TODAY);

    gate.open();
    await waitUntil(() => valueToday('water') === 1);
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(view).toBe(MainView.TODAY);
    expect(valueToday('meditate')).toBeNull();
  });

  test('the table and the calendars start with the score card, and its title opens the score view', async () => {
    await showPage(MainView.SHORT);
    expect(button('Show the score only')).toBeTruthy();
    await changeView(MainView.MONTH);
    fireEvent.click(button('Show the score only'));
    expect(view).toBe(MainView.SCORE);
  });

  test('the score card shows the score of the selected group', async () => {
    await showPage(MainView.SHORT);
    expect(screen.getByText('Score')).toBeTruthy();
    const all = scoreChartLabel();
    fireEvent.click(button('Hygiene'));
    await screen.findByText('Score · Hygiene');
    // The demo data has other scores in all groups than in the 2 Hygiene habits.
    expect(scoreChartLabel()).not.toBe(all);
    fireEvent.click(button('All'));
    await screen.findByText('Score');
    expect(scoreChartLabel()).toBe(all);
  });

  test('the score view has the group filter', async () => {
    await showPage(MainView.SHORT);
    await changeView(MainView.SCORE);
    // The first "Hygiene" is the chip. The legend of the weekday averages has the group name too.
    fireEvent.click(screen.getAllByRole('button', { name: 'Hygiene' })[0]);
    await screen.findByText('Score · Hygiene');
    expect(prefs.get('group')).toBe('Hygiene');
  });

  test('save after a group change saves the tiles of the new group', async () => {
    // The page opens on another group: the first tiles do not have "Morning teeth".
    prefs.set('group', 'Health');
    await showPage();
    expect(screen.queryByText('Morning teeth')).toBeNull();
    fireEvent.click(button('Hygiene'));
    fireEvent.click(await screen.findByText('Morning teeth'));
    fireEvent.click(button('Save: Morning teeth'));
    await waitUntil(() => valueToday('teeth') === 1);
  });
});
