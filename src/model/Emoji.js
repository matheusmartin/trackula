// The emoji list of the emoji picker of the metrics form.

/**
 * An emoji of the emoji picker of the metrics form. See {@link parseEmojiList}.
 * @typedef {object} Emoji
 * @property {string} text The emoji, with the default skin tone. Example: 👋.
 * @property {string} name The name in English, from Unicode CLDR, for screen readers. Example: "waving hand".
 */

/**
 * The emojis of the emoji list `text`, in the same order: the file `emoji.txt` that design/emoji/make.py makes. Each
 * line has an emoji, a tab and its name. A line that starts with `#` is a comment.
 *
 * Example: `😀⇥grinning face` gives 😀 with the name "grinning face".
 * @param {string} text
 * @returns {Emoji[]}
 */
export function parseEmojiList(text) {
  return text
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim() !== '' && !line.startsWith('#'))
    .map((line) => {
      const parts = line.split('\t');
      return { text: parts[0], name: parts[1] ?? '' };
    });
}
