/**
 * The rows of a grid with `columns` columns, as the CSS grid `grid-auto-flow: row dense` places them.
 * A wide item takes a full row. A small item goes into the first row that has space, also a row before a wide item.
 * So small items fill the gaps, and the small items in a row have the same height. `isWide` tells the wide items.
 * Each row is a list of the indexes of its items.
 *
 * The app shows the items in the order of the rows, so that the order of the keyboard focus is the order on the
 * screen. Example: 3 columns, items small, wide, small → rows [0, 2] and [1].
 * @template T
 * @param {T[]} items
 * @param {number} columns
 * @param {(item: T) => boolean} isWide
 * @returns {number[][]}
 */
export function tileRows(items, columns, isWide) {
  if (columns <= 0) throw new Error('A grid needs at least 1 column.');
  /** @type {number[][]} */
  const rows = [];
  /** @type {Set<number>} */
  const wideRows = new Set();
  items.forEach((item, i) => {
    if (isWide(item)) {
      wideRows.add(rows.length);
      rows.push([i]);
    } else {
      const row = rows.findIndex((r, index) => !wideRows.has(index) && r.length < columns);
      if (row < 0) rows.push([i]);
      else rows[row].push(i);
    }
  });
  return rows;
}
