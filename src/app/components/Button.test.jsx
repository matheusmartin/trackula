import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { Button } from './Button.jsx';

afterEach(cleanup);

describe('Button', () => {
  test('the description is the name of the button', () => {
    let clicks = 0;
    render(<Button variant="main" text="Save" description="Save: Water" onClick={() => clicks++} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save: Water' }));

    expect(clicks).toBe(1);
  });

  test('a disabled button does nothing', () => {
    let clicks = 0;
    render(<Button text="Save" enabled={false} onClick={() => clicks++} />);
    const button = /** @type {HTMLButtonElement} */ (screen.getByRole('button', { name: 'Save' }));

    fireEvent.click(button);

    expect(button.disabled).toBe(true);
    expect(clicks).toBe(0);
  });

  test('the variant gives the size and the tone, unless they are given', () => {
    render(
      <>
        <Button text="Close" onClick={() => {}} />
        <Button variant="outlined" text="Fix" onClick={() => {}} />
        <Button variant="text" size="large" tone="error" text="Delete" onClick={() => {}} />
        <Button variant="main" text="Sign in" onClick={() => {}} />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Close' }).className).toBe(
      'button button-text button-medium button-tone-primary',
    );
    expect(screen.getByRole('button', { name: 'Fix' }).className).toBe(
      'button button-outlined button-large button-tone-neutral',
    );
    expect(screen.getByRole('button', { name: 'Delete' }).className).toBe(
      'button button-text button-large button-tone-error',
    );
    expect(screen.getByRole('button', { name: 'Sign in' }).className).toBe('button button-main');
  });

  test('a tooltip is the title of the button', () => {
    render(<Button text="Week" tooltip="Zoom: week" onClick={() => {}} />);

    expect(screen.getByRole('button', { name: 'Week' }).title).toBe('Zoom: week');
  });
});
