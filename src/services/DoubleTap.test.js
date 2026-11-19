import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DoubleTap } from './DoubleTap.js';

// The fake timers of Vitest: a pause takes no real time.
describe('DoubleTap', () => {
  /** @type {string[]} */
  let events;
  /** @type {DoubleTap<string>} */
  let taps;

  beforeEach(() => {
    vi.useFakeTimers();
    events = [];
    taps = new DoubleTap(50);
  });

  afterEach(() => {
    taps.dispose();
    vi.useRealTimers();
  });

  /** @param {string} key */
  function tap(key) {
    taps.tap(
      key,
      () => events.push(`${key}+`),
      () => events.push(`${key}-`),
    );
  }

  /** Waits longer than the double-tap wait. */
  function pause() {
    vi.advanceTimersByTime(80);
  }

  test('a single tap runs after the wait', () => {
    tap('a');
    expect(events).toEqual([]);
    pause();
    expect(events).toEqual(['a+']);
  });

  test('two quick taps are a double-tap without the single tap', () => {
    tap('a');
    tap('a');
    pause();
    expect(events).toEqual(['a-']);
  });

  test('a tap on another key runs the waiting single tap at once', () => {
    tap('a');
    tap('b');
    expect(events).toEqual(['a+']);
    pause();
    expect(events).toEqual(['a+', 'b+']);
  });

  test('three quick taps are a double-tap and a single tap', () => {
    tap('a');
    tap('a');
    tap('a');
    pause();
    expect(events).toEqual(['a-', 'a+']);
  });

  test('slow taps are single taps', () => {
    tap('a');
    pause();
    tap('a');
    pause();
    expect(events).toEqual(['a+', 'a+']);
  });

  test('flush runs the waiting single tap at once and only once', () => {
    tap('a');
    taps.flush();
    expect(events).toEqual(['a+']);
    pause();
    taps.flush();
    expect(events).toEqual(['a+']);
  });

  test('a tap in the single tap is a new tap, not a double-tap', () => {
    taps.tap(
      'a',
      () => tap('a'),
      () => events.push('a-'),
    );
    pause();
    expect(events).toEqual([]);
    pause();
    expect(events).toEqual(['a+']);
  });

  test('dispose drops the waiting single tap', () => {
    tap('a');
    taps.dispose();
    pause();
    expect(events).toEqual([]);
  });
});
