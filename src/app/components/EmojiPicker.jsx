import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { parseEmojiList } from '../../model/Emoji.js';
import { TOUCH_TARGET } from './Sizes.js';
import './EmojiPicker.css';

/** @import { JSX } from 'preact' */
/** @import { Emoji } from '../../model/Emoji.js' */

/**
 * The emojis after the first load. The list does not change while the app runs.
 * @type {Emoji[] | null}
 */
let loadedEmojis = null;

/**
 * The emojis of the file `emoji.txt`. See design/emoji/make.py. The build puts the file in a separate part, so the
 * browser downloads it only when a picker opens, not with the app. Null if the file does not load.
 * @returns {Promise<Emoji[] | null>}
 */
async function loadEmojis() {
  if (loadedEmojis != null) return loadedEmojis;
  try {
    const { default: text } = await import('./emoji.txt?raw');
    loadedEmojis = parseEmojiList(text);
    return loadedEmojis;
  } catch {
    return null;
  }
}

/** The space between the border of the grid and the emoji buttons, in CSS pixels. EmojiPicker.css has it too. */
const GRID_PADDING = 3;

/** The number of emoji rows that a Page Up or a Page Down key moves: the rows that the grid shows. */
const PAGE_ROWS = 6;

/**
 * The emoji picker of the metrics form: a grid of a fixed height, which scrolls, with all the emojis that the app can
 * show, in the order of Unicode and with the default skin tone. A click on an emoji calls `onPick` with the emoji. The
 * emojis use the emoji font of the device.
 *
 * `selected` is the icon of the form: its emoji has a frame. When the grid opens, it scrolls to that emoji.
 *
 * The grid is one stop of the Tab key: the arrow keys, Home, End, Page Up and Page Down move the focus between the
 * emojis.
 * @param {object} props
 * @param {string} props.selected
 * @param {(emoji: string) => void} props.onPick
 * @returns {JSX.Element}
 */
export function EmojiPicker({ selected, onPick }) {
  // Null until the list loads. Also with a loaded list, the grid shows after the first paint: the form shows at once,
  // also on a slow phone, and the grid comes a moment later.
  const [emojis, setEmojis] = useState(/** @type {Emoji[] | null} */ (null));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void loadEmojis().then((list) => {
      if (!active) return;
      setEmojis(list);
      setFailed(list == null);
    });
    return () => {
      active = false;
    };
  }, []);
  if (emojis != null) return <EmojiGrid emojis={emojis} selected={selected} onPick={onPick} />;
  // An empty grid of the same size, so that the page does not move when the grid shows. The text shows only while the
  // list downloads.
  return (
    <div class="emoji-grid emoji-grid-empty">
      <p class="emoji-picker-help body-small">
        {failed
          ? 'The emojis did not load. Reload the page to try again.'
          : loadedEmojis == null
            ? 'Loading the emojis…'
            : ''}
      </p>
    </div>
  );
}

/**
 * The grid of {@link EmojiPicker}.
 * @param {object} props
 * @param {Emoji[]} props.emojis
 * @param {string} props.selected
 * @param {(emoji: string) => void} props.onPick
 * @returns {JSX.Element}
 */
function EmojiGrid({ emojis, selected, onPick }) {
  const grid = useRef(/** @type {HTMLDivElement | null} */ (null));
  const selectedIndex = emojis.findIndex((emoji) => emoji.text === selected);
  // The button that the Tab key goes to: the selected emoji, else the first emoji.
  const [focusIndex, setFocusIndex] = useState(Math.max(0, selectedIndex));

  // Only when the grid opens: a click on an emoji does not move the grid. The row of the emoji goes to the top.
  useLayoutEffect(() => {
    const button = buttonAt(selectedIndex);
    if (grid.current != null && button != null && selectedIndex > 0) {
      grid.current.scrollTop = button.offsetTop - GRID_PADDING;
    }
  }, []);

  /**
   * @param {number} index
   * @returns {HTMLElement | null} The button of the emoji `index`.
   */
  function buttonAt(index) {
    const button = index >= 0 ? grid.current?.children[index] : null;
    return button instanceof HTMLElement ? button : null;
  }

  /**
   * @param {EventTarget | null} target
   * @returns {number} The index of the emoji button of `target`, or -1.
   */
  function indexOf(target) {
    const button = target instanceof Element ? target.closest('[data-index]') : null;
    return button instanceof HTMLElement ? Number(button.dataset.index) : -1;
  }

  /** @param {JSX.TargetedMouseEvent<HTMLDivElement>} event */
  function onClick(event) {
    const index = indexOf(event.target);
    if (index < 0) return;
    setFocusIndex(index);
    onPick(emojis[index].text);
  }

  /** @param {JSX.TargetedKeyboardEvent<HTMLDivElement>} event */
  function onKeyDown(event) {
    const from = indexOf(event.target);
    if (from < 0 || grid.current == null) return;
    // The columns of `repeat(auto-fill, minmax(48px, 1fr))`. 1 without a layout, as in the tests.
    const columns = Math.max(1, Math.floor((grid.current.clientWidth - 2 * GRID_PADDING) / TOUCH_TARGET));
    /** @type {Record<string, number>} */
    const moves = {
      ArrowLeft: from - 1,
      ArrowRight: from + 1,
      ArrowUp: from - columns,
      ArrowDown: from + columns,
      PageUp: from - columns * PAGE_ROWS,
      PageDown: from + columns * PAGE_ROWS,
      Home: 0,
      End: emojis.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const to = Math.min(emojis.length - 1, Math.max(0, moves[event.key]));
    setFocusIndex(to);
    const button = buttonAt(to);
    button?.focus({ preventScroll: true });
    button?.scrollIntoView?.({ block: 'nearest' });
  }

  return (
    <div class="emoji-grid" ref={grid} role="group" aria-label="Emojis" onClick={onClick} onKeyDown={onKeyDown}>
      {emojis.map((emoji, i) => (
        <button
          key={emoji.text}
          type="button"
          class={i === selectedIndex ? 'emoji-button emoji-button-selected' : 'emoji-button'}
          data-index={i}
          tabIndex={i === focusIndex ? 0 : -1}
          title={emoji.name}
          aria-label={emoji.name}
          aria-pressed={i === selectedIndex}
        >
          {emoji.text}
        </button>
      ))}
    </div>
  );
}
