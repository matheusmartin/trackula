import { describe, expect, test } from 'vitest';
import { newMetricId } from './MetricId.js';

describe('MetricId', () => {
  test('the id comes from the name in lowercase with underscores between the words', () => {
    expect(newMetricId('Morning teeth', new Set())).toBe('morning_teeth');
    expect(newMetricId('  Walk: 10 min! ', new Set())).toBe('walk_10_min');
    expect(newMetricId('Água & café', new Set())).toBe('agua_cafe');
  });

  test('a taken id gets a number', () => {
    expect(newMetricId('Water', new Set(['water']))).toBe('water_2');
    expect(newMetricId('Water', new Set(['water', 'water_2']))).toBe('water_3');
  });

  test('a name without letters or digits and the log headers give other ids', () => {
    expect(newMetricId('💧', new Set())).toBe('metric');
    expect(newMetricId('Date', new Set())).toBe('date_2');
    expect(newMetricId('Score', new Set())).toBe('score_2');
  });

  test('a long name gives an id of at most 40 characters', () => {
    expect(newMetricId('a'.repeat(50), new Set()).length).toBe(40);
  });
});
