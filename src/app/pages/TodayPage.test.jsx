import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { Day } from '../../model/Day.js';
import { MainView } from '../../model/MainView.js';
import { NumberGoal } from '../../model/Metric.js';
import { SetMetricCells, planEditMetric } from '../../model/MetricsWrite.js';
import { Route } from '../../model/Route.js';
import { DemoStore } from '../../sheets/DemoStore.js';
import { LocalNavigator, Navigator } from '../Navigation.js';
import { CountingStore, Gate } from '../testing/CountingStore.js';
import { FakeHistory } from '../testing/FakePlatform.js';
import { ReloadHandle, TodayPage } from './TodayPage.jsx';

/** @import { Metric } from '../../model/Metric.js' */

/** The longest wait for the UI in a test. */
const TIMEOUT = 5000;

const today = Day.of(2026, 10, 3);
/** @type {CountingStore} */
let store;
/** @type {Map<string, string>} */
let prefs;
/** @type {Navigator} */
let navigator;
/** The view of the navigation: the page changes it with the navigator, and a test with `changeView`. */
let view = /** @type {MainView | null} */ (MainView.TODAY);

beforeEach(() => {
  store = new CountingStore(new DemoStore(today, 0));
  prefs = new Map();
});

afterEach(cleanup);

/**
 * Shows the page on the view `start`, with the navigator of the App, and waits for the data.
 * @param {MainView} [start]
 */
async function showPage(start = MainView.TODAY) {
  navigator = new Navigator(new FakeHistory(Route.ofView(start).hash));
  view = start;
  navigator.subscribe((route) => {
    view = route.view;
  });
  render(
    <LocalNavigator.Provider value={navigator}>
      <TodayPage
        store={store}
        today={today}
        expired={() => false}
        onExpired={() => {}}
        reload={new ReloadHandle()}
        onBusy={() => {}}
        readPref={(key) => prefs.get(key) ?? null}
        writePref={(key, value) => {
          if (value == null) prefs.delete(key);
          else prefs.set(key, value);
        }}
      />
    </LocalNavigator.Provider>,
  );
  await screen.findAllByText('Weight', {}, { timeout: TIMEOUT });
}

/**
 * Changes the view, as the navigation of the App does.
 * @param {MainView} next
 */
async function changeView(next) {
  await act(() => navigator.show(Route.ofView(next)));
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
  test('a tap on a yes/no tile writes yes at once, the page stays, and Undo writes the value before', async () => {
    await showPage();
    fireEvent.click(screen.getByText('Meditate'));
    await waitUntil(() => valueToday('meditate') === 1);
    expect(view).toBe(MainView.TODAY);
    await screen.findByText('Meditate: yes on Oct 3.', {}, { timeout: TIMEOUT });

    fireEvent.click(button('Undo'));

    await waitUntil(() => valueToday('meditate') === null);
    expect(screen.queryByText('Meditate: yes on Oct 3.')).toBeNull();
    // Undo shows no message of its own.
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  test('a second tap on a yes/no tile writes no', async () => {
    await showPage();
    const tile = /** @type {HTMLButtonElement} */ (screen.getByRole('checkbox', { name: 'Meditate' }));
    fireEvent.click(tile);
    await waitUntil(() => valueToday('meditate') === 1);
    await waitFor(() => expect(tile.disabled).toBe(false));
    fireEvent.click(tile);
    await waitUntil(() => valueToday('meditate') === 0);
  });

  test('a yes tile of the goal no is over the limit', async () => {
    await changeMetric('vitamins', (m) => m.copy({ goalIsYes: false }));
    await showPage();
    const vitamins = /** @type {HTMLButtonElement} */ (screen.getByRole('checkbox', { name: 'Vitamins' }));
    fireEvent.click(vitamins);
    await waitFor(() => expect(vitamins.getAttribute('title')).toBe('Yes, over the limit of the goal no'), {
      timeout: TIMEOUT,
    });
    // A yes tile of the goal yes reaches the goal: it is checked, without a limit.
    const meditate = /** @type {HTMLButtonElement} */ (screen.getByRole('checkbox', { name: 'Meditate' }));
    await waitFor(() => expect(meditate.disabled).toBe(false));
    fireEvent.click(meditate);
    await waitFor(() => expect(meditate.getAttribute('aria-checked')).toBe('true'), { timeout: TIMEOUT });
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
    await waitUntil(() => valueToday('water') === 1);
    expect(view).toBe(MainView.TODAY);
  });

  test('a click on a yes/no cell writes yes and a second click writes no', async () => {
    await showPage(MainView.DAYS);
    fireEvent.click(cellToday('Meditate'));
    await waitUntil(() => valueToday('meditate') === 1);
    await waitFor(() => expect(/** @type {HTMLButtonElement} */ (cellToday('Meditate', ': yes')).disabled).toBe(false));
    fireEvent.click(cellToday('Meditate', ': yes'));
    await waitUntil(() => valueToday('meditate') === 0);
  });

  test('count clicks on a cell show at once and go to the sheet', async () => {
    await showPage(MainView.DAYS);
    const cell = cellToday('Water');
    mouseClick(cell);
    mouseClick(cell);
    await waitUntil(() => valueToday('water') === 2);
    await waitFor(() => expect(cellToday('Water', ': 2 glasses')).toBeTruthy());
  });

  test('a click on a number cell opens the editor, and Enter writes the typed value and closes it', async () => {
    await showPage(MainView.DAYS);
    fireEvent.click(cellToday('Weight'));
    expect(screen.getByRole('slider', { name: 'Weight ruler' })).toBeTruthy();
    const field = screen.getByRole('textbox', { name: 'Weight kg' });
    fireEvent.input(field, { target: { value: '81,9' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitUntil(() => valueToday('weight') === 81.9);
    expect(screen.queryByRole('slider', { name: 'Weight ruler' })).toBeNull();
    await screen.findByText('Weight: 81.9 kg on Oct 3.', {}, { timeout: TIMEOUT });
  });

  test('a group chip shows only its metrics and stays in local storage', async () => {
    await showPage(MainView.DAYS);
    fireEvent.click(button('Hygiene'));
    await waitFor(() => expect(screen.queryByText('Weight')).toBeNull());
    expect(screen.getByText('Morning teeth')).toBeTruthy();
    expect(prefs.get('group')).toBe('Hygiene');

    fireEvent.click(button('All'));
    await screen.findByText('Weight');
    expect(prefs.has('group')).toBe(false);
  });

  test('a failed write shows the error and no Undo, and the next input writes again', async () => {
    await showPage();
    store.failWrites = true;
    const tile = /** @type {HTMLButtonElement} */ (screen.getByRole('checkbox', { name: 'Meditate' }));
    fireEvent.click(tile);
    await screen.findByText('No network.', {}, { timeout: TIMEOUT });
    expect(valueToday('meditate')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    // The tile shows the value of the sheet again.
    expect(tile.getAttribute('aria-checked')).toBe('false');

    store.failWrites = false;
    await waitFor(() => expect(tile.disabled).toBe(false));
    fireEvent.click(tile);
    await waitUntil(() => valueToday('meditate') === 1);
  });

  test('taps during a write wait and go to the sheet in one write for the cell', async () => {
    await showPage(MainView.DAYS);
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
    await waitUntil(() => valueToday('water') === 1);
  });

  test('a touch tap adds after the wait, and a touch double tap subtracts', async () => {
    await showPage();
    const tile = button('Water');
    touchTap(tile);
    await waitUntil(() => valueToday('water') === 1);
    touchTap(tile);
    await new Promise((resolve) => setTimeout(resolve, 50));
    touchTap(tile);
    // 1 − 1 is 0: an empty cell.
    await waitUntil(() => valueToday('water') === null);
  });

  test('a screen reader click on a count cell adds a step', async () => {
    await showPage(MainView.DAYS);
    // A click without a press, as a screen reader or the keyboard gives it.
    fireEvent.click(cellToday('Water'));
    await waitUntil(() => valueToday('water') === 1);
  });

  test('an input during a write waits, and the next write has its value', async () => {
    await showPage(MainView.DAYS);
    const gate = new Gate();
    store.gate = gate;
    fireEvent.click(cellToday('Meditate'));
    // During the write of Meditate, a typed weight.
    fireEvent.click(cellToday('Weight'));
    const field = screen.getByRole('textbox', { name: 'Weight kg' });
    fireEvent.input(field, { target: { value: '80' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(store.writes).toHaveLength(0);

    gate.open();
    await waitUntil(() => valueToday('weight') === 80);
    expect(valueToday('meditate')).toBe(1);
  });

  test('both layouts of the days start with the score card, and its title opens the score view', async () => {
    await showPage(MainView.DAYS);
    expect(button('Show the score only')).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();

    fireEvent.click(button('Calendars'));
    expect(screen.queryByRole('table')).toBeNull();
    expect(button('Calendars').getAttribute('aria-pressed')).toBe('true');
    expect(prefs.get('days-layout')).toBe('CALENDARS');
    fireEvent.click(button('Show the score only'));
    expect(view).toBe(MainView.SCORE);
  });

  test('the days open in the layout of local storage', async () => {
    prefs.set('days-layout', 'CALENDARS');
    await showPage(MainView.DAYS);
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.click(button('Table'));
    expect(screen.getByRole('table')).toBeTruthy();
    expect(prefs.get('days-layout')).toBe('TABLE');
  });

  test('the score card shows the score of the selected group', async () => {
    await showPage(MainView.DAYS);
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
    await showPage(MainView.DAYS);
    await changeView(MainView.SCORE);
    // The first "Hygiene" is the chip. The legend of the weekday averages has the group name too.
    fireEvent.click(screen.getAllByRole('button', { name: 'Hygiene' })[0]);
    await screen.findByText('Score · Hygiene');
    expect(prefs.get('group')).toBe('Hygiene');
  });

  test('Undo after count taps during a write gives the value before all the taps', async () => {
    await showPage();
    const tile = button('Water');
    mouseClick(tile);
    mouseClick(tile);
    mouseClick(tile);
    await waitUntil(() => valueToday('water') === 3);
    await screen.findByText('Water: 3 glasses on Oct 3.', {}, { timeout: TIMEOUT });

    fireEvent.click(button('Undo'));

    await waitUntil(() => valueToday('water') === null);
  });

  test('the problems of the sheet show as one line, and Show opens the metrics screen', async () => {
    // A row without icon and without goal is invalid.
    await store.applyMetrics(
      new SetMetricCells(
        11,
        new Map([
          [0, 'stretch'],
          [1, 'Stretch'],
          [2, 'yesno'],
        ]),
      ),
    );
    await showPage();
    expect(screen.getByText('1 problem in the sheet.')).toBeTruthy();

    fireEvent.click(button('Show'));

    expect(navigator.route).toBe(Route.METRICS);
    await screen.findByRole('heading', { name: 'Rows with problems' }, { timeout: TIMEOUT });
  });
});
