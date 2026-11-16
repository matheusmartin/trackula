// Numbers that the user types, and the decimals of a step.
import { roundHalfAwayFromZero, toFixed } from './Numbers.js';

/** A number that the user types, after a comma becomes a period: digits with optional decimals, or only decimals. */
const decimal = /^(\d+(\.\d+)?|\.\d+)$/;

/**
 * Reads a number that the user typed. A period and a comma both work as decimal mark: "81.9" and "81,9" are 81.9.
 *
 * A dot at the end is allowed while the user types: "81." is 81. Returns null if `text` is empty, is not a number, or
 * is below 0.
 * @param {string} text
 * @returns {number | null}
 */
export function parseDecimal(text) {
  let t = text.trim().replaceAll(',', '.');
  if (t.endsWith('.')) t = t.slice(0, -1);
  return decimal.test(t) ? Number(t) : null;
}

/**
 * The number of decimals of `step`, at most 6. Examples: 0.1 → 1, 0.25 → 2, 5 → 0.
 * @param {number} step
 * @returns {number}
 */
export function stepDecimals(step) {
  for (let decimals = 0; decimals <= 6; decimals++) if (Number(toFixed(step, decimals)) === step) return decimals;
  return 6;
}

/**
 * Rounds `value` to the decimals of `step`. With `snap`, also to the nearest multiple of `step`. Never below 0.
 *
 * This removes float noise, for example 0.1 + 0.2 = 0.30000000000000004.
 * @param {number} value
 * @param {number} step
 * @param {boolean} [snap] False by default.
 * @returns {number}
 */
export function roundToStep(value, step, snap = false) {
  const x = snap ? roundHalfAwayFromZero(value / step) * step : value;
  return Number(toFixed(Math.max(0, x), stepDecimals(step)));
}

/**
 * `value` with the decimals of `step`. Examples: (82, 0.1) → "82.0", (1250, 250) → "1250".
 * @param {number} value
 * @param {number} step
 * @returns {string}
 */
export function formatStep(value, step) {
  return toFixed(value, stepDecimals(step));
}
