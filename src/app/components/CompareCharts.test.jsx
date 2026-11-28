import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { ChangeTable } from './CompareCharts.jsx';

afterEach(cleanup);

describe('CompareCharts', () => {
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
