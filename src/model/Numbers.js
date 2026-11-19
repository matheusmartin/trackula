// Number helpers. JavaScript numbers already give the text that the app shows, so most functions are short.

/**
 * The value as text with exactly `decimals` decimals: `Number.prototype.toFixed`. A half rounds away from zero, on
 * the exact binary value. Examples: (81.25, 1) → "81.3", (82, 1) → "82.0", (2.675, 2) → "2.67".
 * @param {number} value
 * @param {number} decimals
 * @returns {string}
 */
export function toFixed(value, decimals) {
  return value.toFixed(decimals);
}

/**
 * The value as text: the shortest digits that read back as the value, and no ".0" for a whole number. Examples:
 * 8 → "8", 1e-7 → "1e-7". Text for the user always comes from this function or from `Format.js`.
 * @param {number} value
 * @returns {string}
 */
export function numberText(value) {
  return String(value);
}

/**
 * The value rounded to a whole number. A half rounds away from zero. Example: -2.5 → -3.
 * `Math.round` is different: it rounds -2.5 to -2.
 * @param {number} value
 * @returns {number}
 */
export function roundHalfAwayFromZero(value) {
  const whole = Math.trunc(value);
  return Math.abs(value - whole) >= 0.5 ? whole + Math.sign(value) : whole;
}

/**
 * A cell value as a number. Null if the cell is not a number.
 * @param {unknown} cell
 * @returns {number | null}
 */
export function numberOf(cell) {
  return typeof cell === 'number' ? cell : null;
}

/** A decimal number in text: an optional sign, digits with an optional period, and an optional exponent. */
const decimalNumber = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/**
 * The number in the text. Null if the text is not a decimal number. Examples: "8" → 8, "-1.5e3" → -1500.
 * @param {string} text
 * @returns {number | null}
 */
export function parseNumber(text) {
  return decimalNumber.test(text) ? Number(text) : null;
}
