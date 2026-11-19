import { describe, expect, test } from 'vitest';
import { Day } from './Day.js';
import { MainView } from './MainView.js';

describe('MainView', () => {
  test('daysUntil gives the days of the view, oldest first, ending on today', () => {
    const today = Day.of(2026, 10, 2);
    expect(MainView.TODAY.daysUntil(today)).toEqual([today]);
    expect(MainView.SHORT.daysUntil(today).map(String)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
    expect(MainView.MONTH.daysUntil(today).length).toBe(31);
  });

  test('labels', () => {
    expect(MainView.entries.map((v) => v.label)).toEqual(['Today', '5 days', '31 days', 'Score']);
  });
});
