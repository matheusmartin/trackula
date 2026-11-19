// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ScriptException, loadScript } from './Scripts.js';

// The scripts do not go into the page: the test sends their load and error events. Each test uses its own URL, because
// the loads stay in the module.
describe('loadScript', () => {
  /** @type {HTMLScriptElement[]} */
  let added;

  beforeEach(() => {
    added = [];
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      added.push(/** @type {HTMLScriptElement} */ (node));
      return node;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('loads each script once', async () => {
    const src = 'https://example.com/once.js';
    const first = loadScript(src, 'Cannot load the script.');
    const second = loadScript(src, 'Cannot load the script.');
    expect(added.map((script) => script.src)).toEqual([src]);
    added[0].dispatchEvent(new Event('load'));
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
    await loadScript(src, 'Cannot load the script.');
    expect(added.length).toBe(1);
  });

  test('a failed load throws the error text, and the next call tries again', async () => {
    const src = 'https://example.com/again.js';
    const failed = loadScript(src, 'Cannot load the script.');
    added[0].dispatchEvent(new Event('error'));
    await expect(failed).rejects.toBeInstanceOf(ScriptException);
    await expect(failed).rejects.toThrow('Cannot load the script.');

    const again = loadScript(src, 'Cannot load the script.');
    expect(added.length).toBe(2);
    added[1].dispatchEvent(new Event('load'));
    await expect(again).resolves.toBeUndefined();
  });

  test('the text of the exception is the message only', () => {
    expect(String(new ScriptException('Cannot load the script.'))).toBe('Cannot load the script.');
  });
});
