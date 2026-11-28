import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Day, daysBetween } from '../../model/Day.js';
import { BarUnit } from '../../model/Zoom.js';
import { BarChart, LineChart, StackedBarChart, TimeBars } from './Charts.jsx';

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

  test('a click on the column of a bar over time calls onBar with the bar, also on the range bars', () => {
    const bars = [
      { start: Day.of(2026, 9, 28), value: 82, low: 81.5, high: 82.5 },
      { start: Day.of(2026, 10, 5), value: null, low: null, high: null },
    ];
    for (const showsRange of [false, true]) {
      /** @type {Day[]} */
      const clicked = [];
      const { container, unmount } = render(
        <TimeBars
          title="Averages"
          description="Weeks."
          bars={bars}
          barUnit={BarUnit.WEEK}
          showsRange={showsRange}
          onBar={(bar) => clicked.push(bar.start)}
        />,
      );
      const targets = container.querySelectorAll('.chart-column-target');
      expect(targets).toHaveLength(2);
      // A column without a value also has a target, with a tooltip.
      expect(targets[1].textContent).toBe('Week of Oct 5, 2026: no value');
      fireEvent.click(targets[1]);
      fireEvent.click(/** @type {Element} */ (container.querySelector(showsRange ? '.range-bar' : '.chart-bar')));
      expect(clicked).toEqual([Day.of(2026, 10, 5), Day.of(2026, 9, 28)]);
      unmount();
    }
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

  test('a bar chart with more than 12 bars scrolls to the side, and a chart with fewer bars is centered', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ label: `${i}`, value: i }));
    const { container, unmount } = render(<BarChart title="Many" description="Bars." bars={many} />);
    const scroller = /** @type {HTMLElement} */ (container.querySelector('.chart-scroller'));
    // The keyboard can scroll it.
    expect(scroller.tabIndex).toBe(0);
    // At most 56 px and at least 41.6 px for each bar.
    const content = /** @type {HTMLElement} */ (scroller.firstElementChild);
    expect(content.style.inlineSize).toBe('max(min(100%, 1120px), 832px)');
    unmount();
    const few = render(<BarChart title="Few" description="Bars." bars={many.slice(0, 7)} />);
    expect(few.container.querySelector('.chart-scroller')).toBeNull();
    const columns = /** @type {HTMLElement} */ (few.container.querySelector('.chart-columns'));
    expect(columns.style.maxInlineSize).toBe('392px');
  });
});
