import { describe, expect, test } from 'vitest';
import { outset } from './Outset.js';

describe('outset', () => {
  test('the element keeps its size and position, and the box is larger on each side', () => {
    const element = document.createElement('div');
    Object.assign(element.style, outset(8, 4));
    // The margin moves the box out by the same amount as the padding moves the content in.
    expect(element.style.margin).toBe('-4px -8px');
    expect(element.style.padding).toBe('4px 8px');
  });
});
