import { describe, expect, test } from 'vitest';
import { cellFill, isFullCell } from './CellFill.js';

describe('CellFill', () => {
  test('0 points give no gradient, some points 10% to 70%, and only 1 point the full gradient', () => {
    expect([0, 0.25, 0.625, 0.99, 1].map(cellFill)).toEqual([0, 0.25, 0.475, 0.694, 1]);
    expect(cellFill(-0.1)).toBe(0);
  });

  test('only a full point is a full cell', () => {
    expect([0, 0.99, 1].map(isFullCell)).toEqual([false, false, true]);
  });
});
