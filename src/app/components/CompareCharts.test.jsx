import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { ChangeTable, RangeBarChart } from './CompareCharts.jsx';

afterEach(cleanup);

describe('CompareCharts', () => {
  test('a range bar chart shows the values of the marks and a legend', () => {
    const { container } = render(
      <RangeBarChart
        title="Week"
        description="Weekdays."
        labels={['Mo', 'Tu']}
        ranges={[
          { low: 10, high: 14, average: 12 },
          { low: 3, high: 5, average: 4 },
        ]}
        marks={[15, null]}
        rangeLabel="4 weeks before"
        markLabel="This week"
      />,
    );
    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.queryByText('12')).toBeNull();
    expect(screen.getByText('4 weeks before')).toBeTruthy();
    expect(screen.getByText('Average')).toBeTruthy();
    expect(screen.getByText('This week')).toBeTruthy();
    // The tooltips of the bars, the dots and the diamond.
    expect([...container.querySelectorAll('title')].map((t) => t.textContent)).toEqual([
      'Mo, 4 weeks before: 10 to 14',
      'Mo, 4 weeks before: average 12',
      'Tu, 4 weeks before: 3 to 5',
      'Tu, 4 weeks before: average 4',
      'Mo, This week: 15',
    ]);
  });

  test('a range bar chart without ranges and marks says so', () => {
    render(
      <RangeBarChart
        title="Week"
        description="Weekdays."
        labels={['Mo']}
        ranges={[null]}
        marks={[null]}
        rangeLabel="Before"
        markLabel="Now"
      />,
    );
    expect(screen.getByText('No values in this period.')).toBeTruthy();
  });

  test('a change table shows the values and gives the change to screen readers', () => {
    render(
      <ChangeTable
        title="Weeks"
        description="Points per day."
        columns={['Nov 2', 'Nov 9']}
        rows={[
          ['Habits', [4.7, 6.8]],
          ['Body', [null, 1.5]],
        ]}
        upLabel="More"
        downLabel="Less"
      />,
    );
    expect(screen.getByText('6.8')).toBeTruthy();
    expect(screen.getByText('–')).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Habits, Nov 2: 4.7' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Habits, Nov 9: 6.8, +2.1 from Nov 2' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Body, Nov 2: no value' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Body, Nov 9: 1.5' })).toBeTruthy();
    expect(screen.getByText('More')).toBeTruthy();
    expect(screen.getByText('Less')).toBeTruthy();
    // The cells have the same text as a tooltip, and the rows and the columns have headers.
    expect(screen.getByTitle('Body, Nov 9: 1.5')).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'Habits' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Nov 9' })).toBeTruthy();
  });

  test('a change table without rows says so', () => {
    render(
      <ChangeTable title="Weeks" description="Points." columns={['Nov 9']} rows={[]} upLabel="Up" downLabel="Down" />,
    );
    expect(screen.getByText('No values in this period.')).toBeTruthy();
  });
});
