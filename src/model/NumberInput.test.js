import { describe, expect, test } from 'vitest';
import { formatStep, parseDecimal, roundToStep, stepDecimals } from './NumberInput.js';

describe('NumberInput', () => {
  test('parseDecimal reads a period or a comma and rejects other text', () => {
    expect(['81.9', '81,9', ' 82 ', '81.', ',5', '0'].map(parseDecimal)).toEqual([81.9, 81.9, 82, 81, 0.5, 0]);
    for (const text of ['', 'abc', '-1', '1.2.3', '8 1']) expect(parseDecimal(text), text).toBeNull();
  });

  test('stepDecimals', () => {
    expect([0.1, 0.25, 5, 1, 250].map(stepDecimals)).toEqual([1, 2, 0, 0, 0]);
    // At most 6 decimals. The text of 1e-7 has no decimal point.
    expect(stepDecimals(1e-7)).toBe(6);
  });

  test('roundToStep removes float noise, snaps to the step and is never below 0', () => {
    expect(roundToStep(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(roundToStep(81.93, 0.1, true)).toBe(81.9);
    expect(roundToStep(1237, 250, true)).toBe(1250);
    expect(roundToStep(-0.3, 0.1)).toBe(0);
  });

  test('formatStep', () => {
    expect([formatStep(82, 0.1), formatStep(1250, 250), formatStep(90.5, 0.5)]).toEqual(['82.0', '1250', '90.5']);
  });
});
