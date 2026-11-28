import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Day } from '../../model/Day.js';
import { StripKind, dayBars } from '../../model/DayBars.js';
import { DayStrip } from './DayStrip.jsx';

/** @import { Day as DayType } from '../../model/Day.js' */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// 2026-09-28 is a Monday. 3 weeks of yes, no and no value.
const first = Day.of(2026, 9, 28);
const last = first.addDays(20);
const values = new Map([
  [first, 1],
  [first.addDays(1), 0],
  [first.addDays(5), 1],
]);
const bars = dayBars(StripKind.YES_NO, values, new Map(), first, last);

/**
 * The tooltips of the bars.
 * @param {Element} container
 * @returns {(string | null)[]}
 */
function tooltips(container) {
  return [...container.querySelectorAll('rect title')].map((t) => t.textContent);
}

describe('DayStrip', () => {
  test('one bar for each day, a weekend bar lighter, and the bars out of the box dim', () => {
    const { container } = render(
      <DayStrip
        bars={bars}
        label="All data"
        valueText={(b) => (b.points === 1 ? 'yes' : 'no')}
        from={first}
        to={first.addDays(6)}
      />,
    );
    const rects = /** @type {SVGRectElement[]} */ ([...container.querySelectorAll('rect')]);
    expect(rects).toHaveLength(21);
    expect(tooltips(container).slice(0, 3)).toEqual(['Sep 28: yes', 'Sep 29: no', 'Sep 30: no value']);
    // Saturday Oct 3 with a yes: half the opacity. A day after the box: dim.
    expect(rects[5].style.opacity).toBe('0.5');
    expect(rects[0].style.opacity).toBe('1');
    expect(screen.getByRole('img', { name: 'All data' })).toBeTruthy();
    const box = /** @type {HTMLElement} */ (container.querySelector('.day-strip-box'));
    expect(box.style.left).toBe('0%');
    expect(parseFloat(box.style.width)).toBeCloseTo((7 / 21) * 100);
  });

  test('a narrow strip shows one bar for each week', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 20, 40));
    const { container } = render(<DayStrip bars={bars} label="All data" valueText={() => 'yes'} />);
    expect(container.querySelectorAll('rect')).toHaveLength(3);
    expect(tooltips(container)[0]).toBe('Week of Sep 28: yes');
  });

  test('a tap calls onPoint with the day under the pointer', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 210, 40));
    /** @type {DayType[]} */
    const days = [];
    render(<DayStrip bars={bars} label="All data" valueText={() => ''} onPoint={(d) => days.push(d)} />);
    const strip = screen.getByRole('img', { name: 'All data' });
    fireEvent.pointerDown(strip, { clientX: 105, button: 0, pointerId: 1 });
    fireEvent.pointerUp(strip, { clientX: 105, button: 0, pointerId: 1 });
    expect(days).toEqual([first.addDays(10)]);
  });
});
