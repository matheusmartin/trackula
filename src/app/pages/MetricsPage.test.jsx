import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { useEffect, useState } from 'preact/hooks';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Day } from '../../model/Day.js';
import { NumberGoal, NumberMetric } from '../../model/Metric.js';
import { SetMetricCells } from '../../model/MetricsWrite.js';
import { DemoStore } from '../../sheets/DemoStore.js';
import { errorText } from '../Errors.js';
import { CountingStore } from '../testing/CountingStore.js';
import { pickEmoji } from '../testing/PickEmoji.js';
import { MetricsPage } from './MetricsPage.jsx';

/** @import { JSX } from 'preact' */
/** @import { MetricsWrite } from '../../model/MetricsWrite.js' */
/** @import { Snapshot } from '../../sheets/Store.js' */

/** The longest wait for the UI in a test. */
const TIMEOUT = 5000;

/** The text of the screen after its Back button. */
const CLOSED = 'The metrics screen is closed.';

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
 * The metrics screen with the data of `store`, as the Today page shows it: the page loads the data, and each write
 * changes the `Metrics` tab and loads the data again. See `writeMetrics` in TodayPage.kt.
 * @param {object} props
 * @param {CountingStore} props.store
 * @param {boolean} props.hasMouse
 * @returns {JSX.Element}
 */
function Host({ store, hasMouse }) {
  const [data, setData] = useState(/** @type {Snapshot | null} */ (null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [open, setOpen] = useState(true);
  useEffect(() => {
    void store.load().then(setData);
  }, [store]);

  /**
   * @param {(table: import('../../model/MetricsTable.js').MetricsTable) => MetricsWrite[]} plan
   * @param {() => void} onDone
   */
  async function onWrite(plan, onDone) {
    setBusy(true);
    setError(null);
    try {
      setData(await store.changeMetrics(plan));
      setBusy(false);
      onDone();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  if (!open) return <p>{CLOSED}</p>;
  if (data == null) return <p>Loading</p>;
  return (
    <MetricsPage
      data={data}
      busy={busy}
      error={error}
      onWrite={(plan, onDone) => void onWrite(plan, onDone)}
      onClose={() => setOpen(false)}
      hasMouse={hasMouse}
    />
  );
}

/**
 * Shows the metrics screen. `before` writes to the store before the first load. `hasMouse` as on a desktop computer.
 * @param {object} [options]
 * @param {MetricsWrite | null} [options.before]
 * @param {boolean} [options.hasMouse]
 * @returns {Promise<void>}
 */
async function showPage({ before = null, hasMouse = false } = {}) {
  if (before != null) await store.applyMetrics(before);
  render(<Host store={store} hasMouse={hasMouse} />);
  await screen.findByText('Weight', {}, { timeout: TIMEOUT });
}

/**
 * The text field with the label `label`.
 * @param {string} label
 * @returns {HTMLInputElement}
 */
function field(label) {
  return /** @type {HTMLInputElement} */ (screen.getByRole('textbox', { name: label }));
}

/**
 * Types `value` in the text field with the label `label`, in place of its text.
 * @param {string} label
 * @param {string} value
 */
function type(label, value) {
  fireEvent.input(field(label), { target: { value } });
}

/**
 * Clicks the button with the name `name`.
 * @param {string} name
 */
function click(name) {
  fireEvent.click(screen.getByRole('button', { name }));
}

/**
 * Waits until the list of the metrics shows: the form closed.
 * @returns {Promise<void>}
 */
async function waitForList() {
  await screen.findByRole('heading', { name: 'Metrics' }, { timeout: TIMEOUT });
}

/**
 * Waits until `check` passes.
 * @param {() => void} check
 * @returns {Promise<void>}
 */
async function waitUntil(check) {
  await waitFor(check, { timeout: TIMEOUT });
}

/**
 * The button with the name `name`, as a button element.
 * @param {string} name
 * @returns {HTMLButtonElement}
 */
function button(name) {
  return /** @type {HTMLButtonElement} */ (screen.getByRole('button', { name }));
}

describe('MetricsPage', () => {
  test('add a metric, then the list shows it', async () => {
    await showPage();
    click('Add metric');
    type('Name', 'Pages');
    await pickEmoji('books');
    click('Count');
    click('At least');
    type('Target', '20');
    expect(screen.getByText('In the sheet: at least 20')).toBeTruthy();

    click('Save');
    await waitForList();
    expect(store.last?.metrics.at(-1)).toEqual(
      new NumberMetric({ id: 'pages', name: 'Pages', icon: '📚', goal: new NumberGoal({ target: 20 }), isCount: true }),
    );
    expect(screen.getByText('Pages')).toBeTruthy();
  });

  test('Save with empty fields shows the errors and writes nothing', async () => {
    await showPage();
    click('Add metric');
    click('Save');
    expect(screen.getByText('Enter a name.')).toBeTruthy();
    expect(screen.getByText('Pick an icon.')).toBeTruthy();
    expect(store.metricsWrites).toEqual([]);

    // The errors follow the changes.
    type('Name', 'Read');
    expect(screen.queryByText('Enter a name.')).toBeNull();
  });

  test('edit a metric with values: it keeps its kind and group, and gets the new name', async () => {
    await showPage();
    fireEvent.click(screen.getByText('Water'));
    expect(screen.getByRole('heading', { name: 'Edit metric' })).toBeTruthy();
    expect(button('Yes/no').disabled).toBe(true);

    type('Name', 'Drinks');
    click('Save');
    await waitForList();
    await screen.findByText('Drinks');
    const water = store.last?.metrics.find((m) => m.id === 'water');
    expect(water?.name).toBe('Drinks');
    expect(water?.group).toBe('Nutrition');
  });

  test('a move changes the order of the sheet', async () => {
    await showPage();
    expect(button('Move Weight up').disabled).toBe(true);
    click('Move Waist up');
    await waitUntil(() => expect(store.last?.metrics[0].id).toBe('waist'));
    expect(store.last?.metrics.slice(0, 2).map((m) => m.id)).toEqual(['waist', 'weight']);
  });

  test('with a mouse, a drag moves a metric and the rows have no arrows', async () => {
    // Each row is 84 px high.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(84);
    await showPage({ hasMouse: true });
    expect(screen.queryByRole('button', { name: 'Move Weight down' })).toBeNull();
    expect(screen.getByText(/Drag a metric to move it\./)).toBeTruthy();

    // Weight goes down past Waist and past the middle of Morning teeth: it lands at the place of Morning teeth.
    const row = screen.getByText('Weight');
    const pointer = { pointerId: 1, pointerType: 'mouse', button: 0 };
    fireEvent.pointerDown(row, { ...pointer, clientY: 100 });
    for (let i = 1; i <= 20; i++) fireEvent.pointerMove(row, { ...pointer, clientY: 100 + (84 * 1.7 * i) / 20 });
    fireEvent.pointerUp(row, { ...pointer, clientY: 100 + 84 * 1.7 });
    fireEvent.click(row);

    await waitUntil(() => expect(store.last?.metrics[2].id).toBe('weight'));
    expect(store.last?.metrics.slice(0, 3).map((m) => m.id)).toEqual(['waist', 'teeth', 'weight']);
    // The click of the drop does not open the form.
    expect(screen.queryByRole('heading', { name: 'Edit metric' })).toBeNull();
  });

  test('with a mouse, a click still opens the form', async () => {
    await showPage({ hasMouse: true });
    fireEvent.click(screen.getByText('Water'));
    expect(screen.getByRole('heading', { name: 'Edit metric' })).toBeTruthy();
  });

  test('with a mouse, the arrow keys on the handle move a metric', async () => {
    await showPage({ hasMouse: true });
    fireEvent.keyDown(button('Move Waist'), { key: 'ArrowUp' });
    await waitUntil(() => expect(store.last?.metrics[0].id).toBe('waist'));
    expect(store.last?.metrics.slice(0, 2).map((m) => m.id)).toEqual(['waist', 'weight']);
  });

  test('delete a metric, then restore it with its values', async () => {
    await showPage();
    fireEvent.click(screen.getByText('Water'));
    click('Delete metric');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete metric' }));
    await screen.findByRole('heading', { name: 'Deleted metrics' }, { timeout: TIMEOUT });
    expect(store.last?.metrics.some((m) => m.id === 'water')).toBe(false);

    click('Restore');
    expect(screen.getByRole('heading', { name: 'Restore metric' })).toBeTruthy();
    await pickEmoji('droplet');
    click('Count');
    // A restored metric needs a goal.
    click('Save');
    expect(screen.getByText('Enter a number.')).toBeTruthy();
    type('Target', '8');
    click('Save');
    await waitForList();
    const water = store.last?.metrics.at(-1);
    expect(water?.id).toBe('water');
    expect(water?.name).toBe('Water');
    expect(store.last?.log.entries.some((e) => e.metricId === 'water')).toBe(true);
  });

  test('fix a row without icon', async () => {
    await showPage({
      before: new SetMetricCells(
        11,
        new Map([
          [0, 'stretch'],
          [1, 'Stretch'],
          [2, 'yesno'],
        ]),
      ),
    });
    expect(screen.getByText('Row 11 · stretch')).toBeTruthy();
    click('Fix');
    expect(screen.getByRole('heading', { name: 'Fix row 11' })).toBeTruthy();

    await pickEmoji('person in lotus position');
    click('Save');
    await waitForList();
    expect(store.last?.metrics.at(-1)?.id).toBe('stretch');
    expect(store.last?.metricsTable.invalid).toEqual([]);
  });

  test('fix a row without goal', async () => {
    await showPage({
      before: new SetMetricCells(
        11,
        new Map([
          [0, 'steps'],
          [1, 'Steps'],
          [2, 'count'],
          [6, 'footprint'],
        ]),
      ),
    });
    click('Fix');
    expect(screen.getByRole('heading', { name: 'Fix row 11' })).toBeTruthy();
    expect(
      screen.getByText('No goal. Use for example at least 8, at most 80, or at most 80 from 83 trend.'),
    ).toBeTruthy();

    click('Save');
    expect(screen.getByText('Enter a number.')).toBeTruthy();
    type('Target', '8000');
    click('Save');
    await waitForList();
    const steps = store.last?.metrics.at(-1);
    expect(steps instanceof NumberMetric ? steps.goal : null).toEqual(new NumberGoal({ target: 8000 }));
    expect(store.last?.metricsTable.invalid).toEqual([]);
  });

  test('Cancel of a changed form asks, and Discard goes back to the list', async () => {
    await showPage();
    fireEvent.click(screen.getByText('Water'));
    type('Name', 'Drinks');
    click('Cancel');
    click('Discard');
    await waitForList();
    expect(screen.queryByText('Drinks')).toBeNull();
    expect(store.metricsWrites).toEqual([]);
  });

  test('Back closes the screen', async () => {
    await showPage();
    click('Back');
    expect(screen.getByText(CLOSED)).toBeTruthy();
  });
});
