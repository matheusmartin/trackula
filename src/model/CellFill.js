// The fill of a day cell: how much of the brand color a day with some points shows. See "Day cell" in docs/design.md.

/** The opacity of the brand gradient on a cell with almost 0 points, and the part that the points add. */
const LEAST_FILL = 0.1;
const POINTS_FILL = 0.6;

/**
 * The opacity of the brand gradient on a day cell with a value and `points`, from 0 to 1. 0 points give 0: the cell
 * shows only its grey fill. Some points give 0.1 + 0.6 × points, from 10% to 70%. Only 1 point gives the full gradient,
 * so that "goal reached" and "almost" look different. Examples: 0.625 points give 0.475, 1 point gives 1.
 * @param {number} points From 0 to 1.
 * @returns {number}
 */
export function cellFill(points) {
  if (points >= 1) return 1;
  if (points <= 0) return 0;
  return LEAST_FILL + POINTS_FILL * points;
}

/**
 * True if a cell with `points` has the full gradient, and so the text color for the gradient.
 * @param {number} points From 0 to 1.
 * @returns {boolean}
 */
export function isFullCell(points) {
  return points >= 1;
}
