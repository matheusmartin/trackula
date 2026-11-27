import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Day } from '../../model/Day.js';
import { DayHeatmap } from './DayHeatmap.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DayHeatmap', () => {
  test('a tap on a heatmap day gives the day, and each day has a tooltip', () => {
    /** @type {Day[]} */
    const tapped = [];
    const from = Day.of(2026, 9, 29);
    render(
      <DayHeatmap
        title="Yes days"
        from={from}
        to={Day.of(2026, 10, 3)}
        filled={(d) => d === from}
        today={Day.of(2026, 10, 3)}
        onDay={(d) => tapped.push(d)}
        dayTitle={(d) => `Day ${d}`}
      />,
    );
    const heatmap = screen.getByRole('img', { name: 'Days from 2026-09-29 to 2026-10-03' });
    const cells = heatmap.querySelectorAll('rect');
    expect(cells).toHaveLength(5);
    expect(cells[0].textContent).toBe('Day 2026-09-29');
    fireEvent.click(cells[0]);
    expect(tapped).toEqual([from]);
    expect(screen.getByText('Tap a day to show its month in the calendar.')).toBeTruthy();
  });

  test('a heatmap of more than a year asks for a zoom', () => {
    render(
      <DayHeatmap
        title="Yes days"
        from={Day.of(2025, 1, 1)}
        to={Day.of(2026, 10, 3)}
        filled={() => true}
        today={Day.of(2026, 10, 3)}
      />,
    );
    expect(screen.getByText('Zoom in to 1 year or less to see single days.')).toBeTruthy();
    expect(screen.getByText('One cell for each day of the window.')).toBeTruthy();
  });
});
