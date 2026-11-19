import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { NumberGoal, NumberMetric, YesNoMetric } from '../../model/Metric.js';
import { GoalDirection, MetricDraft, MetricKind } from '../../model/MetricDraft.js';
import { pickEmoji } from '../testing/PickEmoji.js';
import { FormSetup, MetricForm } from './MetricForm.jsx';

/** @import { Metric } from '../../model/Metric.js' */

afterEach(cleanup);

/** @type {Metric[]} */
let saved = [];
let deletes = 0;
let closes = 0;

beforeEach(() => {
  saved = [];
  deletes = 0;
  closes = 0;
});

const weight = new MetricDraft({
  name: 'Weight',
  icon: 'monitor_weight',
  kind: MetricKind.NUMBER,
  unit: 'kg',
  step: '0.1',
  direction: GoalDirection.AT_MOST,
  target: '80',
  start: '84',
});

/**
 * Shows the form of `setup`.
 * @param {FormSetup} setup
 * @param {Set<string>} [takenIds]
 */
function showForm(setup, takenIds = new Set()) {
  render(
    <MetricForm
      setup={setup}
      takenIds={takenIds}
      groups={['Health', 'Hygiene']}
      busy={false}
      error={null}
      onSave={(metric) => saved.push(metric)}
      onDelete={() => deletes++}
      onClose={() => closes++}
    />,
  );
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

describe('MetricForm', () => {
  test('a new metric gets an id from its name that is not taken, and the form does not show it', async () => {
    showForm(new FormSetup({ title: 'Add metric', initial: new MetricDraft() }), new Set(['read']));
    type('Name', 'Read');
    await pickEmoji('books');
    expect(screen.queryByText(/read_2/)).toBeNull();
    click('Save');
    expect(saved).toEqual([new YesNoMetric({ id: 'read_2', name: 'Read', icon: '📚' })]);
  });

  test('an emoji of the picker becomes the icon, and the form has no icon field', async () => {
    showForm(new FormSetup({ title: 'Edit metric', initial: weight, id: 'weight' }));
    expect(screen.queryByRole('textbox', { name: 'Icon' })).toBeNull();
    await pickEmoji('balance scale');
    click('Save');
    expect(saved.map((m) => m.icon)).toEqual(['⚖️']);
  });

  test('the form shows the points of the goal, and the trend only for a number metric', () => {
    showForm(new FormSetup({ title: 'Edit metric', initial: weight, id: 'weight' }));
    expect(screen.getByText('In the sheet: at most 80 from 84')).toBeTruthy();
    expect(screen.getByText('• 82 kg: 0.5 points')).toBeTruthy();
    fireEvent.click(screen.getByText('Use the trend'));
    expect(screen.getByText('In the sheet: at most 80 from 84 trend')).toBeTruthy();

    click('Count');
    expect(screen.getByText('Only for a number metric.')).toBeTruthy();
    expect(screen.getByText('In the sheet: at most 80 from 84')).toBeTruthy();
  });

  test('a number metric must have a goal', () => {
    showForm(
      new FormSetup({
        title: 'Add metric',
        initial: new MetricDraft({ name: 'Steps', icon: 'footprint', kind: MetricKind.COUNT }),
      }),
    );
    expect(screen.getByRole('button', { name: 'At least' })).toBeTruthy();
    expect(screen.queryByText('No goal')).toBeNull();
    click('Save');
    expect(screen.getByText('Enter a number.')).toBeTruthy();
    expect(saved).toEqual([]);
  });

  test('a text next to Save names the fields with errors', async () => {
    showForm(new FormSetup({ title: 'Add metric', initial: new MetricDraft({ kind: MetricKind.COUNT }) }));
    click('Save');
    expect(screen.getByText('Correct these fields: Name, Icon, Target.')).toBeTruthy();

    type('Name', 'Steps');
    await pickEmoji('footprints');
    expect(screen.getByText('Correct this field: Target.')).toBeTruthy();
  });

  test('close and cancel close a form without changes at once', () => {
    showForm(new FormSetup({ title: 'Edit metric', initial: weight, id: 'weight' }));
    click('Close without saving');
    click('Cancel');
    expect(screen.queryByText('Discard changes?')).toBeNull();
    expect(closes).toBe(2);
  });

  test('close and cancel ask before they discard changes', () => {
    showForm(new FormSetup({ title: 'Edit metric', initial: weight, id: 'weight' }));
    type('Name', 'Mass');

    click('Close without saving');
    expect(screen.getByRole('dialog', { name: 'Discard changes?' })).toBeTruthy();
    click('Keep editing');
    expect(closes).toBe(0);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(field('Name').value).toBe('Mass');

    click('Cancel');
    click('Discard');
    expect(closes).toBe(1);
  });

  test('a group chip sets the group, and Save gives the metric', () => {
    showForm(new FormSetup({ title: 'Edit metric', initial: weight, id: 'weight' }));
    click('Health');
    click('Save');
    expect(saved).toEqual([
      new NumberMetric({
        id: 'weight',
        name: 'Weight',
        icon: 'monitor_weight',
        unit: 'kg',
        step: 0.1,
        goal: new NumberGoal({ target: 80, isMaximum: true, from: 84 }),
        group: 'Health',
      }),
    ]);
  });

  test('a metric with yes/no values can only stay yes/no', () => {
    showForm(
      new FormSetup({
        title: 'Edit metric',
        initial: new MetricDraft({ name: 'Read', icon: 'menu_book' }),
        id: 'read',
        valueKind: MetricKind.YES_NO,
      }),
    );
    const kinds = within(screen.getByRole('group', { name: 'Kind' }));
    expect(/** @type {HTMLButtonElement} */ (kinds.getByRole('button', { name: 'Yes/no' })).disabled).toBe(false);
    expect(/** @type {HTMLButtonElement} */ (kinds.getByRole('button', { name: 'Number' })).disabled).toBe(true);
    expect(/** @type {HTMLButtonElement} */ (kinds.getByRole('button', { name: 'Count' })).disabled).toBe(true);
  });

  test('delete asks first', () => {
    showForm(
      new FormSetup({ title: 'Edit metric', initial: weight, id: 'weight', deleteQuestion: 'Delete "Weight"?' }),
    );
    click('Delete metric');
    const dialog = screen.getByRole('dialog', { name: 'Delete metric?' });
    expect(within(dialog).getByText('Delete "Weight"?')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete metric' }));
    expect(deletes).toBe(1);
    expect(screen.getByRole('button', { name: 'Close without saving' })).toBeTruthy();
  });

  test('the form starts at the top of the page', () => {
    window.scrollTo(0, 500);
    showForm(new FormSetup({ title: 'Edit metric', initial: weight, id: 'weight' }));
    expect(window.scrollY).toBe(0);
  });

  test('the number fields show the number keyboard, and Enter goes to the next field', () => {
    showForm(new FormSetup({ title: 'Edit metric', initial: weight, id: 'weight' }));
    expect(field('Name').inputMode).toBe('text');
    expect(field('Step').inputMode).toBe('decimal');
    expect(field('Target').inputMode).toBe('decimal');

    field('Target').focus();
    fireEvent.keyDown(field('Target'), { key: 'Enter' });

    expect(document.activeElement).toBe(field('Start (optional)'));
  });
});
