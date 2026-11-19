// The emoji picker in the UI tests. See components/EmojiPicker.jsx.
import { fireEvent, screen, within } from '@testing-library/preact';

/** The longest wait for the emoji list in a test. */
const TIMEOUT = 5000;

/**
 * Clicks the emoji with the name `name` in the emoji picker. The grid shows after the list loads.
 * @param {string} name The name of the emoji. Example: "droplet".
 * @returns {Promise<void>}
 */
export async function pickEmoji(name) {
  const grid = await screen.findByRole('group', { name: 'Emojis' }, { timeout: TIMEOUT });
  fireEvent.click(within(grid).getByRole('button', { name }));
}
