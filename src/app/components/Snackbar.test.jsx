import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { Snackbar } from './Snackbar.jsx';

afterEach(cleanup);

describe('Snackbar', () => {
  test('is a status with its text, and its button calls the action', () => {
    let undos = 0;
    render(<Snackbar text="Water: 3 glasses on Oct 3." action="Undo" onAction={() => undos++} />);
    expect(screen.getByRole('status').textContent).toContain('Water: 3 glasses on Oct 3.');

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(undos).toBe(1);
  });
});
