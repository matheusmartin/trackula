// The drop place and the shifts of the items of a list while the user drags one item.

/**
 * The place where a dragged item of a list lands: the index of the item that is at that place now. `from` is the
 * index of the dragged item, `offset` is how far it moved down (negative: up), and `heights` are the heights of all
 * the items, in the same unit. The dragged item goes past an item when it moves past the middle of that item.
 *
 * Examples: 3 items of height 50. The first item moved 30 down lands at 1. Moved 20 down, it stays at 0. Moved 80
 * down, it lands at 2.
 * @param {number} from
 * @param {number} offset
 * @param {number[]} heights
 * @returns {number}
 */
export function dropIndex(from, offset, heights) {
  let to = from;
  let passed = 0;
  if (offset > 0) {
    while (to + 1 < heights.length && offset > passed + heights[to + 1] / 2) {
      passed += heights[to + 1];
      to++;
    }
  } else {
    while (to - 1 >= 0 && -offset > passed + heights[to - 1] / 2) {
      passed += heights[to - 1];
      to--;
    }
  }
  return to;
}

/**
 * How far the item `index` moves to make space while the item `from` is over the place `to`: the items between the
 * two places move up or down by the `height` of the dragged item. Other items, and the dragged item, do not move.
 *
 * Example: the item 0 of height 50 is over the place 2. The items 1 and 2 move 50 up: -50.
 * @param {number} index
 * @param {number} from
 * @param {number} to
 * @param {number} height
 * @returns {number}
 */
export function dragShift(index, from, to, height) {
  if (index >= from + 1 && index <= to) return -height;
  if (index >= to && index < from) return height;
  return 0;
}
