import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Day } from '../../model/Day.js';
import { Overview } from './Overview.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Overview', () => {
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
});
