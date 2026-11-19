// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest';
import { historyBack, onHistoryBack, pushHistoryEntry } from './History.js';

describe('History', () => {
  test('pushHistoryEntry adds an entry with the same URL', () => {
    const url = window.location.href;
    const length = window.history.length;
    pushHistoryEntry();
    expect(window.history.length).toBe(length + 1);
    expect(window.location.href).toBe(url);
  });

  test('historyBack goes one entry back', () => {
    const back = vi.spyOn(window.history, 'back');
    historyBack();
    expect(back).toHaveBeenCalledOnce();
    back.mockRestore();
  });

  test('onHistoryBack calls the handler at each back of the browser', () => {
    const handler = vi.fn();
    onHistoryBack(handler);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
