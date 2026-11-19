import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Day, daysBetween } from '../../model/Day.js';
import { BarUnit } from '../../model/Zoom.js';
import { BarChart, DayHeatmap, KeyNumbers, LineChart, Overview, StackedBarChart, TimeBars } from './Charts.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * The texts of the tooltips in `container`.
 * @param {Element} container
 * @returns {(string | null)[]}
 */
function tooltips(container) {
  return [...container.querySelectorAll('title')].map((t) => t.textContent);
}

// The cases of the bar charts in the Kotlin ChartsTest, and the tooltips of the JavaScript app.
describe('Charts', () => {
  test('a stacked bar chart shows the sum of each bar and a legend', () => {
    render(
      <StackedBarChart
        title="Stack"
        description="Parts."
        labels={['A', 'B', 'C']}
        parts={[
          { label: 'Habits', color: 'green', values: [3, null, null] },
          { label: 'Body', color: 'blue', values: [1.5, 2, null] },
        ]}
      />,
    );
    expect(screen.getByText('4.5')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Habits')).toBeTruthy();
    expect(screen.getByText('Body')).toBeTruthy();
  });

  test('a stacked bar chart without values says so', () => {
    render(
      <StackedBarChart
        title="Stack"
        description="Parts."
        labels={['A']}
        parts={[{ label: 'Habits', color: 'green', values: [null] }]}
      />,
    );
    expect(screen.getByText('No values in this period.')).toBeTruthy();
  });

  test('a bar chart without values says so', () => {
    render(
      <BarChart
        title="Change"
        description="Changes."
        bars={[
          { label: 'A', value: null },
          { label: 'B', value: null },
        ]}
      />,
    );
    expect(screen.getByText('No values in this period.')).toBeTruthy();
  });

  test('a bar chart shows negative values with a minus sign', () => {
    render(
      <BarChart
        title="Change"
        description="Changes."
        bars={[
          { label: 'A', value: 1.5 },
          { label: 'B', value: -2 },
        ]}
      />,
    );
    expect(screen.getByText('1.5')).toBeTruthy();
    expect(screen.getByText('−2')).toBeTruthy();
  });

  test('a bar chart gives its values to screen readers', () => {
    render(
      <BarChart
        title="Change"
        description="Changes."
        bars={[
          { label: 'A', value: 1.5 },
          { label: 'B', value: null },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Change: A 1.5' })).toBeTruthy();
  });

  test('a narrow bar chart shows only the values and labels that fit', () => {
    // A card of 240 px: 208 px for the chart.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 208, 100));
    const bars = Array.from({ length: 12 }, (_, i) => ({ label: `Label ${i + 1}`, value: 1001 + i }));
    render(<BarChart title="Change" description="Changes." bars={bars} />);
    // 12 columns of 17 px: a value and a label do not fit in each column. The newest value and the first label show.
    expect(screen.getByText('1012')).toBeTruthy();
    expect(screen.queryByText('1011')).toBeNull();
    expect(screen.getByText('Label 1')).toBeTruthy();
    expect(screen.queryByText('Label 2')).toBeNull();
    // Screen readers get all values.
    expect(screen.getByRole('img', { name: /^Change: Label 1 1001/ })).toBeTruthy();
  });

  test('each bar has a tooltip with its label and its value', () => {
    const { container } = render(
      <BarChart
        title="Change"
        description="Changes."
        bars={[
          { label: 'A', value: 1.5 },
          { label: 'B', value: null },
        ]}
      />,
    );
    expect(tooltips(container)).toEqual(['A: 1.5']);
  });

  test('the bars over time have tooltips with their week, and the range bars with their range and average', () => {
    const bars = [
      { start: Day.of(2026, 9, 28), value: 82, low: 81.5, high: 82.5 },
      { start: Day.of(2026, 10, 5), value: null, low: null, high: null },
    ];
    const { container, unmount } = render(
      <TimeBars title="Averages" description="Weeks." bars={bars} barUnit={BarUnit.WEEK} />,
    );
    expect(tooltips(container)).toEqual(['Week of Sep 28, 2026: 82']);
    unmount();
    const ranges = render(
      <TimeBars title="Averages" description="Weeks." bars={bars} barUnit={BarUnit.WEEK} showsRange />,
    );
    expect(tooltips(ranges.container)).toEqual([
      'Week of Sep 28, 2026: 81.5 to 82.5',
      'Week of Sep 28, 2026: average 82',
    ]);
  });

  test('a line chart gives its first, last, lowest and highest value to screen readers', () => {
    const days = daysBetween(Day.of(2026, 9, 29), Day.of(2026, 10, 1));
    const { container } = render(
      <LineChart title="Values" description="Dots." days={days} values={[82.5, null, 81.25]} decimals={1} />,
    );
    expect(
      screen.getByRole('img', { name: 'Values: from 82.5 on Sep 29 to 81.3 on Oct 1, lowest 81.3, highest 82.5' }),
    ).toBeTruthy();
    expect(tooltips(container)).toEqual(['Sep 29: 82.5', 'Oct 1: 81.3']);
  });

  test('a line chart without values says so', () => {
    const days = daysBetween(Day.of(2026, 9, 29), Day.of(2026, 10, 1));
    render(<LineChart title="Values" description="Dots." days={days} values={[null, null, null]} />);
    expect(screen.getByText('No values in this period.')).toBeTruthy();
  });

  test('the key numbers show each value with its label and a tooltip', () => {
    render(
      <KeyNumbers
        items={[
          ['total', '12 l'],
          ['days logged', '3'],
        ]}
      />,
    );
    expect(screen.getByText('12 l')).toBeTruthy();
    expect(screen.getByTitle('days logged: 3')).toBeTruthy();
  });

  test('a press on the overview gives the day under the pointer', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 40));
    const weeks = [Day.of(2026, 9, 7), Day.of(2026, 9, 14), Day.of(2026, 9, 21), Day.of(2026, 9, 28)].map((start) => ({
      start,
      value: 1,
      low: 1,
      high: 1,
    }));
    /** @type {Day[]} */
    const points = [];
    render(
      <Overview
        weeks={weeks}
        fromZero
        from={Day.of(2026, 9, 28)}
        to={Day.of(2026, 10, 4)}
        onPoint={(d) => points.push(d)}
      />,
    );
    const overview = screen.getByRole('img', { name: 'All data' });
    fireEvent.pointerDown(overview, { clientX: 0, button: 0, pointerId: 1 });
    fireEvent.pointerMove(overview, { clientX: 200, pointerId: 1 });
    fireEvent.pointerUp(overview, { pointerId: 1 });
    fireEvent.pointerMove(overview, { clientX: 100, pointerId: 1 });
    // From the first day of the first week to the last day of the last week.
    expect(points).toEqual([Day.of(2026, 9, 7), Day.of(2026, 10, 4)]);
  });

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
