import { afterEach, describe, expect, test, vi } from 'vitest';
import { Day } from '../model/Day.js';
import { today } from './Today.js';

describe('today', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('is the date of the device in its time zone', () => {
    vi.useFakeTimers();
    // new Date(year, monthIndex, …) uses the time zone of the device, as today() does.
    vi.setSystemTime(new Date(2026, 10, 16, 23, 59, 59));
    expect(today()).toBe(Day.of(2026, 11, 16));
    vi.setSystemTime(new Date(2027, 0, 1, 0, 0, 0));
    expect(today()).toBe(Day.of(2027, 1, 1));
  });
});
