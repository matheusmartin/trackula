import { describe, expect, test } from 'vitest';
import { BackDispatcher } from './Back.js';
import { FakeHistory } from './testing/FakePlatform.js';

describe('BackDispatcher', () => {
  test('back calls the newest handler and keeps its entry', () => {
    const history = new FakeHistory();
    const dispatcher = new BackDispatcher(history);
    /** @type {string[]} */
    const calls = [];
    dispatcher.add(() => calls.push('detail'));
    dispatcher.add(() => calls.push('form'));
    expect(history.entries).toBe(2);

    history.userBack();

    // The handler did not close its screen: its entry is there for the next back.
    expect(calls).toEqual(['form']);
    expect(history.entries).toBe(2);
  });

  test('a handler that closes its screen removes its entry', () => {
    const history = new FakeHistory();
    const dispatcher = new BackDispatcher(history);
    let open = true;
    const handler = () => {
      open = false;
      dispatcher.remove(handler);
    };
    dispatcher.add(handler);

    history.userBack();

    expect(open).toBe(false);
    expect(history.entries).toBe(0);
    // No handler: the next back does nothing in the app.
    history.userBack();
    expect(history.entries).toBe(0);
  });

  test('a screen that closes with its own button removes its entry and calls no handler', () => {
    const history = new FakeHistory();
    const dispatcher = new BackDispatcher(history);
    /** @type {string[]} */
    const calls = [];
    const detail = () => calls.push('detail');
    const form = () => calls.push('form');
    dispatcher.add(detail);
    dispatcher.add(form);

    dispatcher.remove(form);

    expect(calls).toEqual([]);
    expect(history.entries).toBe(1);
    history.userBack();
    expect(calls).toEqual(['detail']);
  });
});
