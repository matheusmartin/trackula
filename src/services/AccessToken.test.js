import { describe, expect, test } from 'vitest';
import { AccessToken } from './AccessToken.js';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

describe('AccessToken', () => {
  test('the token expires 20 seconds before Google ends it', () => {
    let now = 0;
    const token = new AccessToken('token', 60 * MINUTE, () => now);
    expect(token.expired).toBe(false);
    now += 59 * MINUTE + 39 * SECOND;
    expect(token.expired).toBe(false);
    now += 2 * SECOND;
    expect(token.expired).toBe(true);
  });
});
