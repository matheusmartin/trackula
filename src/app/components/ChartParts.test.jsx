import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ChartGrid, KeyNumbers } from './ChartParts.jsx';

/** @import { ChartItem } from './ChartParts.jsx' */

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

  test('the last small card of a row that is not full fills the row', () => {
    // 1000 px: 3 columns.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 400));
    /**
     * @param {string} key
     * @param {boolean} wide
     * @returns {ChartItem}
     */
    const item = (key, wide) => ({ key, wide, content: () => <p>{key}</p> });
    render(
      <ChartGrid items={[item('trend', true), item('donut', false), item('weekdays', false), item('streaks', true)]} />,
    );
    const card = (/** @type {string} */ key) => /** @type {HTMLElement} */ (screen.getByText(key).parentElement);
    expect(card('donut').className).toBe('chart-grid-item');
    expect(card('weekdays').className).toBe('chart-grid-item chart-grid-fill');
    expect(card('weekdays').style.getPropertyValue('--chart-span')).toBe('2');
    expect(card('streaks').className).toBe('chart-grid-item chart-grid-wide');
  });
});
