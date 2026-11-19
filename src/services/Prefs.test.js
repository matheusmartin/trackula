// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { readPref, writePref } from './Prefs.js';

describe('Prefs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  test('a setting is in local storage with the prefix of the app', () => {
    expect(readPref('spreadsheetId')).toBeNull();
    writePref('spreadsheetId', 'sheet-1');
    expect(readPref('spreadsheetId')).toBe('sheet-1');
    expect(window.localStorage.getItem('trackula.spreadsheetId')).toBe('sheet-1');
  });

  test('a null value removes the setting', () => {
    writePref('spreadsheetId', 'sheet-1');
    writePref('spreadsheetId', null);
    expect(readPref('spreadsheetId')).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  test('blocked storage gives null and does not throw', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('The storage is blocked.', 'SecurityError');
    });
    expect(readPref('spreadsheetId')).toBeNull();
    expect(() => writePref('spreadsheetId', 'sheet-1')).not.toThrow();
    expect(() => writePref('spreadsheetId', null)).not.toThrow();
  });
});
