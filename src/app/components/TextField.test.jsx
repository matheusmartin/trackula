import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { TextField } from './TextField.jsx';

afterEach(cleanup);

describe('TextField', () => {
  test('the label is the name of the field, and each input gives the new text', () => {
    /** @type {string[]} */
    const texts = [];
    render(<TextField label="Name" value="" onChange={(text) => texts.push(text)} />);

    fireEvent.input(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Water' } });

    expect(texts).toEqual(['Water']);
  });

  test('an error shows below the field and describes it', () => {
    render(<TextField label="Step" value="0" error="Enter a step above 0." onChange={() => {}} />);
    const field = screen.getByRole('textbox', { name: 'Step' });

    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(field.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Enter a step above 0.',
    );
  });

  test('Enter goes to the next field of the group, and on the last field it leaves the field', () => {
    render(
      <div data-text-fields>
        <TextField label="Unit" value="" onChange={() => {}} />
        <TextField label="Step" value="" isNumber isLast onChange={() => {}} />
      </div>,
    );
    const unit = screen.getByRole('textbox', { name: 'Unit' });
    const step = screen.getByRole('textbox', { name: 'Step' });

    unit.focus();
    fireEvent.keyDown(unit, { key: 'Enter' });
    expect(document.activeElement).toBe(step);

    fireEvent.keyDown(step, { key: 'Enter' });
    expect(document.activeElement).not.toBe(step);
    expect(step.getAttribute('inputmode')).toBe('decimal');
  });
});
