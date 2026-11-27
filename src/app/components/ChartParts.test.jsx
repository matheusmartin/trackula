import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { KeyNumbers } from './ChartParts.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ChartParts', () => {
  test('the key numbers show each value with its label and a tooltip', () => {
    render(
      <KeyNumbers
        items={[
          ['total', '12 l'],
          ['days recorded', '3'],
        ]}
      />,
    );
    expect(screen.getByText('12 l')).toBeTruthy();
    expect(screen.getByTitle('days recorded: 3')).toBeTruthy();
  });
});
