import { describe, expect, test } from 'vitest';
import { Config } from './Config.js';

describe('Config', () => {
  test('the project number is the first part of the client ID', () => {
    expect(new Config('123456-abc.apps.googleusercontent.com', 'key').projectNumber).toBe('123456');
  });

  test('an empty value or the example value is missing', () => {
    const example = new Config('REPLACE_WITH_CLIENT_ID.apps.googleusercontent.com', 'REPLACE_WITH_API_KEY');
    expect(example.hasClientId).toBe(false);
    expect(example.hasApiKey).toBe(false);
    expect(new Config('', '').hasClientId).toBe(false);
    const real = new Config('123-abc.apps.googleusercontent.com', 'AIza123');
    expect(real.hasClientId).toBe(true);
    expect(real.hasApiKey).toBe(true);
  });
});
