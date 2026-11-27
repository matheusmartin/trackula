// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest';
import { currentHash, currentIndex, historyBack, onHistoryChange, pushHash, replaceHash } from './History.js';

describe('History', () => {
  test('pushHash adds an entry with the address and the index, and keeps the rest of the URL', () => {
    window.history.replaceState(null, '', '/app/?demo');
    const length = window.history.length;
    expect(currentIndex()).toBe(0);

    pushHash('#/metric/weight', 1);

    expect(window.history.length).toBe(length + 1);
    expect(window.location.pathname).toBe('/app/');
    expect(window.location.search).toBe('?demo');
    expect(currentHash()).toBe('#/metric/weight');
    expect(currentIndex()).toBe(1);
  });

  test('replaceHash changes the current entry', () => {
    const length = window.history.length;
    replaceHash('#/days', 3);
    expect(window.history.length).toBe(length);
    expect(currentHash()).toBe('#/days');
    expect(currentIndex()).toBe(3);
  });

  test('historyBack goes one entry back', () => {
    const back = vi.spyOn(window.history, 'back');
    historyBack();
    expect(back).toHaveBeenCalledOnce();
    back.mockRestore();
  });

  test('onHistoryChange calls the handler at each change of the entry', () => {
    const handler = vi.fn();
    onHistoryChange(handler);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
