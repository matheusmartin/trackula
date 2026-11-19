import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { PrimaryButton } from './PrimaryButton.jsx';

afterEach(cleanup);

describe('PrimaryButton', () => {
  test('the description is the name of the button', () => {
    let clicks = 0;
    render(<PrimaryButton text="Save" description="Save: Water" onClick={() => clicks++} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save: Water' }));

    expect(clicks).toBe(1);
  });

  test('a disabled button does nothing', () => {
    let clicks = 0;
    render(<PrimaryButton text="Save" enabled={false} onClick={() => clicks++} />);
    const button = /** @type {HTMLButtonElement} */ (screen.getByRole('button', { name: 'Save' }));

    fireEvent.click(button);

    expect(button.disabled).toBe(true);
    expect(clicks).toBe(0);
  });
});
