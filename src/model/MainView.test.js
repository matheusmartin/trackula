import { describe, expect, test } from 'vitest';
import { DayLayout, MainView, dayLayoutOf, tableDayCount } from './MainView.js';

describe('MainView', () => {
  test('labels', () => {
    expect(MainView.entries.map((v) => v.label)).toEqual(['Today', 'Days', 'Score']);
  });
});

describe('dayLayoutOf', () => {
  test('gives the calendars only for their own text', () => {
    expect(dayLayoutOf('CALENDARS')).toBe(DayLayout.CALENDARS);
    expect(dayLayoutOf('TABLE')).toBe(DayLayout.TABLE);
    expect(dayLayoutOf('calendars')).toBe(DayLayout.TABLE);
    expect(dayLayoutOf(null)).toBe(DayLayout.TABLE);
  });
});

describe('tableDayCount', () => {
  test('gives as many days as fit next to the names', () => {
    expect(tableDayCount(358, 136, 40)).toBe(5);
    expect(tableDayCount(456, 136, 40)).toBe(8);
    expect(tableDayCount(696, 136, 40)).toBe(14);
  });

  test('gives 5 days or more, and 14 days or less', () => {
    expect(tableDayCount(0, 136, 40)).toBe(5);
    expect(tableDayCount(300, 136, 40)).toBe(5);
    expect(tableDayCount(1200, 136, 40)).toBe(14);
  });
});
