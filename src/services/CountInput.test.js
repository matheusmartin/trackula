import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CountInput } from './CountInput.js';

// The fake timers of Vitest: a pause takes no real time.
describe('CountInput', () => {
  /** @type {string[]} */
  let steps;
  /** @type {CountInput<string>} */
  let input;

  beforeEach(() => {
    vi.useFakeTimers();
    steps = [];
    input = new CountInput();
  });

  afterEach(() => {
    input.dispose();
    vi.useRealTimers();
  });

  /**
   * Adds the step of a cell to `steps`: "a+1" or "a-1".
   * @param {string} key
   * @returns {(sign: number) => void}
   */
  function add(key) {
    return (sign) => steps.push(sign > 0 ? `${key}+1` : `${key}-1`);
  }

  /** Waits longer than the double-tap wait. */
  function pause() {
    vi.advanceTimersByTime(400);
  }

  /** @param {string} key */
  function mouseClick(key) {
    input.pointerDown('mouse');
    input.click(key, add(key));
  }

  /** @param {string} key */
  function touchTap(key) {
    input.pointerDown('touch');
    input.click(key, add(key));
  }

  test('a mouse click adds a step at once and two quick clicks add two steps', () => {
    mouseClick('a');
    mouseClick('a');
    expect(steps).toEqual(['a+1', 'a+1']);
  });

  test('a right-click subtracts a step', () => {
    input.pointerDown('mouse');
    input.contextMenu(add('a'));
    expect(steps).toEqual(['a-1']);
  });

  test('a keyboard click without a press adds a step at once', () => {
    input.click('a', add('a'));
    expect(steps).toEqual(['a+1']);
  });

  test('a touch tap adds a step after the wait and a touch double-tap subtracts', () => {
    touchTap('a');
    expect(steps).toEqual([]);
    pause();
    expect(steps).toEqual(['a+1']);

    touchTap('a');
    touchTap('a');
    pause();
    expect(steps).toEqual(['a+1', 'a-1']);
  });

  test('a pen works like touch', () => {
    input.pointerDown('pen');
    input.click('a', add('a'));
    expect(steps).toEqual([]);
    pause();
    expect(steps).toEqual(['a+1']);
  });

  test('a touch long-press does nothing', () => {
    input.pointerDown('touch');
    input.contextMenu(add('a'));
    pause();
    expect(steps).toEqual([]);
  });

  test('keys add and subtract and other keys are not an input', () => {
    expect(input.keyDown('+', add('a'))).toBe(true);
    expect(input.keyDown('=', add('a'))).toBe(true);
    expect(input.keyDown('-', add('a'))).toBe(true);
    expect(input.keyDown('Enter', add('a'))).toBe(false);
    expect(steps).toEqual(['a+1', 'a+1', 'a-1']);
  });

  test('an input at once runs a waiting touch tap first, so the steps keep their order', () => {
    touchTap('a');
    input.keyDown('-', add('b'));
    expect(steps).toEqual(['a+1', 'b-1']);
  });
});
