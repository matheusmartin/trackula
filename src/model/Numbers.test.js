import { describe, expect, test } from 'vitest';
import { numberOf, numberText, parseNumber, roundHalfAwayFromZero, toFixed } from './Numbers.js';

describe('Numbers', () => {
  test('toFixed rounds a half away from zero', () => {
    expect([
      toFixed(81.25, 1),
      toFixed(82, 1),
      toFixed(2.675, 2),
      toFixed(-2.5, 0),
      toFixed(1250, 0),
      toFixed(-0.001, 2),
      toFixed(-0, 2),
      toFixed(0.1 + 0.2, 6),
    ]).toEqual(['81.3', '82.0', '2.67', '-3', '1250', '-0.00', '0.00', '0.300000']);
  });

  test('toFixed spells NaN and Infinity', () => {
    expect([NaN, Infinity, -Infinity].map((value) => toFixed(value, 2))).toEqual(['NaN', 'Infinity', '-Infinity']);
  });

  test('numberText gives the shortest text', () => {
    expect([8, -2.5, 0.1234567, 0.000001, 1e-7, -1.5e-7, 123456789012345680000, 1e21, -0].map(numberText)).toEqual([
      '8',
      '-2.5',
      '0.1234567',
      '0.000001',
      '1e-7',
      '-1.5e-7',
      '123456789012345680000',
      '1e+21',
      '0',
    ]);
    expect([NaN, -Infinity].map(numberText)).toEqual(['NaN', '-Infinity']);
    expect([5e-324, 1e-323, 5e-323].map(numberText)).toEqual(['5e-324', '1e-323', '5e-323']);
  });

  test('roundHalfAwayFromZero', () => {
    expect([2.5, -2.5, 2.4999, -1.5, 0.4].map(roundHalfAwayFromZero)).toEqual([3, -3, 2, -2, 0]);
  });

  test('parseNumber reads only decimal numbers', () => {
    expect(['8', '-1.5e3', '.5', '+5'].map(parseNumber)).toEqual([8, -1500, 0.5, 5]);
    for (const text of ['', '0x10', 'NaN', 'Infinity', '5d', '1,5', ' 8']) expect(parseNumber(text), text).toBeNull();
  });

  test('numberOf reads only numbers', () => {
    expect([1, 2.5, '1', null, true].map(numberOf)).toEqual([1, 2.5, null, null, null]);
  });
});
