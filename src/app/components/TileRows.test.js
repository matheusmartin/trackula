import { describe, expect, test } from 'vitest';
import { tileRows } from './TileRows.js';

/**
 * The rows of a pattern of small (`s`) and wide (`W`) items.
 * @param {string} pattern
 * @param {number} columns
 * @returns {number[][]}
 */
function rows(pattern, columns) {
  return tileRows([...pattern], columns, (item) => item === 'W');
}

describe('tileRows', () => {
  test('small items fill the rows in order', () => {
    expect(rows('sssss', 2)).toEqual([[0, 1], [2, 3], [4]]);
  });

  test('a wide item takes a full row and a later small item fills the gap before it', () => {
    expect(rows('sWs', 3)).toEqual([[0, 2], [1]]);
    expect(rows('sWsss', 2)).toEqual([[0, 2], [1], [3, 4]]);
  });

  test('wide items keep their order', () => {
    expect(rows('WWss', 4)).toEqual([[0], [1], [2, 3]]);
  });

  test('no items give no rows and a grid needs a column', () => {
    expect(rows('', 2)).toEqual([]);
    expect(() => rows('s', 0)).toThrow();
  });
});
