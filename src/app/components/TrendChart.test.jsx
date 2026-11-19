import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { Day, daysBetween } from '../../model/Day.js';
import { TrendChart } from './TrendChart.jsx';

afterEach(cleanup);

// The cases of the TrendChart in the Kotlin ChartsTest.
const days = daysBetween(Day.of(2026, 9, 29), Day.of(2026, 10, 3));

describe('TrendChart', () => {
  test('a trend chart gives its range and its days to screen readers', () => {
    render(
      <TrendChart
        days={days}
        values={
          new Map([
            [days[0], 82.5],
            [days[3], 81.25],
          ])
        }
        unit="kg"
      />,
    );
    const chart = screen.getByRole('img', { name: 'Values from 81.25 to 82.5 kg, Sep 29 to Oct 3' });
    // One text for the whole chart: the axis labels are parts of the image, and screen readers do not read them again.
    expect(screen.getByText('Sep 29').closest('[role="img"]')).toBe(chart);
  });

  test('a bar chart with only zeros goes from zero to zero', () => {
    render(<TrendChart days={days} values={new Map([[days[1], 0]])} showsBars />);
    expect(screen.getByRole('img', { name: 'Values from 0 to 0, Sep 29 to Oct 3' })).toBeTruthy();
  });

  test('a trend chart without values shows nothing', () => {
    render(<TrendChart days={days} values={new Map()} />);
    expect(screen.queryByRole('img', { name: /^Values from/ })).toBeNull();
  });

  test('each dot has a tooltip with its day and its value', () => {
    const { container } = render(<TrendChart days={days} values={new Map([[days[0], 82.5]])} unit="kg" />);
    expect([...container.querySelectorAll('title')].map((t) => t.textContent)).toEqual(['Sep 29: 82.5 kg']);
  });
});
