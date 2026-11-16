import { describe, expect, test } from 'vitest';
import { dragShift, dropIndex } from './Drag.js';

describe('Drag', () => {
  const heights = [50, 50, 50];

  test('the item goes past another item after its middle', () => {
    expect(dropIndex(0, 20, heights)).toBe(0);
    expect(dropIndex(0, 30, heights)).toBe(1);
    expect(dropIndex(0, 80, heights)).toBe(2);
    expect(dropIndex(2, -30, heights)).toBe(1);
    expect(dropIndex(2, -80, heights)).toBe(0);
  });

  test('the item stays in the list', () => {
    expect(dropIndex(0, 500, heights)).toBe(2);
    expect(dropIndex(1, -500, heights)).toBe(0);
    expect(dropIndex(1, 0, heights)).toBe(1);
  });

  test('items of different heights use their own middle', () => {
    // The item 1 is 100 high: the item 0 goes past it after 50.
    const mixed = [40, 100, 40];
    expect(dropIndex(0, 45, mixed)).toBe(0);
    expect(dropIndex(0, 55, mixed)).toBe(1);
  });

  test('the items between the places make space', () => {
    // Down: the items after the dragged item move up.
    expect([0, 1, 2, 3].map((i) => dragShift(i, 0, 2, 50))).toEqual([0, -50, -50, 0]);
    // Up: the items before the dragged item move down.
    expect([0, 1, 2, 3].map((i) => dragShift(i, 3, 1, 40))).toEqual([0, 40, 40, 0]);
    // Not moved: nothing moves.
    expect([0, 1, 2].map((i) => dragShift(i, 1, 1, 50))).toEqual([0, 0, 0]);
  });
});
