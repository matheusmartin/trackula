import { describe, expect, test } from 'vitest';
import { parseEmojiList } from './Emoji.js';

describe('Emoji', () => {
  test('the list has each emoji with its name, in the same order', () => {
    const text = ['# A comment.', '👋\twaving hand', '', '💧\tdroplet', '🌋'].join('\n');
    expect(parseEmojiList(text)).toEqual([
      { text: '👋', name: 'waving hand' },
      { text: '💧', name: 'droplet' },
      { text: '🌋', name: '' },
    ]);
  });
});
