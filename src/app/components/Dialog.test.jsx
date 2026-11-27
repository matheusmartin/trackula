import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { ConfirmDialog } from './Dialog.jsx';

afterEach(cleanup);

/**
 * Shows a dialog and returns the list of the calls of its handlers.
 * @returns {string[]}
 */
function showDialog() {
  /** @type {string[]} */
  const calls = [];
  render(
    <ConfirmDialog
      title="Delete metric?"
      text="The app hides the metric. Its values stay in the sheet."
      confirm="Delete metric"
      dismiss="Cancel"
      onConfirm={() => calls.push('confirm')}
      onDismiss={() => calls.push('dismiss')}
    />,
  );
  return calls;
}

describe('ConfirmDialog', () => {
  test('the title is the name of the dialog, and the text describes it', () => {
    showDialog();
    const dialog = screen.getByRole('dialog', { name: 'Delete metric?' });

    expect(document.getElementById(dialog.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'The app hides the metric. Its values stay in the sheet.',
    );
  });

  test('the buttons confirm and dismiss', () => {
    const calls = showDialog();
    const dialog = within(screen.getByRole('dialog'));

    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Delete metric' }));

    expect(calls).toEqual(['dismiss', 'confirm']);
  });

  test('Escape and a click on the backdrop dismiss', () => {
    const calls = showDialog();
    const dialog = screen.getByRole('dialog');

    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    fireEvent.click(dialog);

    expect(calls).toEqual(['dismiss', 'dismiss']);
  });
});
