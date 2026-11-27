import { useEffect, useRef, useState } from 'preact/hooks';
import { formatTrimmed, withUnit } from '../../model/Format.js';
import { formatStep, parseDecimal, roundToStep } from '../../model/NumberInput.js';
import { roundHalfAwayFromZero } from '../../model/Numbers.js';
import './NumberEditor.css';

/** @import { JSX } from 'preact' */
/** @import { NumberMetric } from '../../model/Metric.js' */

/** The space between two ruler ticks, in CSS pixels. */
export const TICK = 9;

/** The number of ticks that the ruler shows on each side of the value. */
const TICKS = 60;

/** The time that the strip takes to settle on the nearest tick after a drag or a side scroll, in milliseconds. */
const SETTLE_MILLIS = 150;

/** The time without side scroll events after which a side scroll ends and the strip settles, in milliseconds. */
const SCROLL_END_MILLIS = 120;

/** The distance that a touch or a pen moves before a drag starts, in CSS pixels, as the touch slop of Compose. */
export const TOUCH_SLOP = 18;

/** The distance that a mouse moves before a drag starts, in CSS pixels, as the mouse slop of Compose. */
const MOUSE_SLOP = 0.125;

/**
 * Editor for one day of a `number` metric. `count` metrics use taps instead. See HabitTable.
 *
 * - Ruler: drag it with a finger or the mouse, or scroll on it. It snaps to the metric step. One tick is one step.
 *   Without `onClose` (the Today tiles), only a side scroll moves it: a vertical scroll scrolls the page.
 * - Text field: exact values, for example a first value. "81.9" and "81,9" both work. It has a frame as the ruler, so
 *   that it shows as a field.
 * - The value goes to the sheet with `onCommit` when the user releases the ruler (a press without a move confirms the
 *   value), when a side scroll ends, at Enter, and when the focus leaves the editor. Only a value that the user gave
 *   goes, and only if it is not the value of the day. An empty text field clears the day.
 * - Keys: Enter sends the value, Escape gives the value of the day again. Arrow keys: one step. On the ruler, Page Up
 *   and Page Down: 10 steps.
 * - With `onClose` (a table or a calendar): Enter also closes the editor, and so does Escape. A Close button sends the
 *   value and closes, and a Clear button clears a day with a value.
 *
 * An empty day starts at `start`, the value of the nearest other day. When the value of the day changes, for example
 * after a write, the editor shows it, unless the user moves the ruler at that time. After a failed write, the editor
 * keeps the value of the user, so that Enter sends it again.
 * @param {object} props
 * @param {NumberMetric} props.metric
 * @param {string} props.label The metric and the day for screen readers, for example "Weight · today".
 * @param {number | null} props.current The value of the day. Null if the day is empty.
 * @param {number | null} props.start The value that an empty day starts at. Null if the metric has no value on
 *   another day.
 * @param {boolean} props.busy True while data loads or saves: the Clear button is disabled.
 * @param {(value: number | null) => void} props.onCommit Sends a new value of the day. Null clears the day.
 * @param {(() => void) | null} [props.onClose] Closes the editor. Null: the editor has no Close and no Clear button.
 *   Default: null.
 * @param {boolean} [props.autofocus] True if the ruler gets the focus at the start. False when many editors show at the
 *   same time, as on the Today tiles. Default: true.
 * @param {boolean} [props.compact] A smaller value and ruler, for the Today tiles. Default: false.
 * @returns {JSX.Element}
 */
export function NumberEditor({
  metric,
  label,
  current,
  start,
  busy,
  onCommit,
  onClose = null,
  autofocus = true,
  compact = false,
}) {
  // The latest props for the event handlers: a handler can run before the next render.
  const latest = useRef({ step: metric.step, current, start, onCommit, onClose });
  latest.current = { step: metric.step, current, start, onCommit, onClose };
  const state = useRef(
    /** @type {{ value: number, text: string, error: string | null, touched: boolean } | null} */ (null),
  );
  if (state.current == null) state.current = { ...initialState(current, start, metric.step), touched: false };
  const s = state.current;
  const rerender = useRerender();

  // A new value of the day shows, for example after a write or a reload. The value of the user stays while it is new.
  useEffect(() => {
    if (s.touched) return;
    Object.assign(s, initialState(current, start, metric.step));
    rerender();
  }, [current]);

  /**
   * Sets the value, rounded to the step. With `snap`, also to the nearest tick.
   * @param {number} v
   * @param {boolean} [snap]
   */
  function set(v, snap = false) {
    const step = latest.current.step;
    const rounded = roundToStep(v, step, snap);
    s.touched = true;
    if (rounded === s.value && s.error == null && s.text === formatStep(rounded, step)) return;
    s.value = rounded;
    s.text = formatStep(rounded, step);
    s.error = null;
    rerender();
  }

  /**
   * The ruler follows the text field while the user types a valid number.
   * @param {string} newText
   */
  function type(newText) {
    s.text = newText;
    s.error = null;
    s.touched = true;
    const typed = parseDecimal(newText);
    if (typed != null) s.value = typed;
    rerender();
  }

  /**
   * Sends the value that the user gave, if it is not the value of the day. An empty text field clears the day.
   * @returns {boolean} False if the text is not a number: then the editor shows an error.
   */
  function commit() {
    const { step, current: dayValue, start: startValue, onCommit: send } = latest.current;
    if (!s.touched) return true;
    const empty = s.text.trim() === '';
    const typed = empty ? null : parseDecimal(s.text);
    if (!empty && typed == null) {
      s.error = `Enter a number, for example ${formatStep(startValue ?? step * 10, step)}.`;
      rerender();
      return false;
    }
    s.touched = false;
    if (typed !== dayValue) send(typed);
    return true;
  }

  /** Enter: sends the value. With `onClose`, also closes the editor. */
  function enter() {
    if (commit()) latest.current.onClose?.();
  }

  /** Escape: the value of the day again. With `onClose`, also closes the editor. */
  function escape() {
    const { step, current: dayValue, start: startValue, onClose: close } = latest.current;
    Object.assign(s, initialState(dayValue, startValue, step), { touched: false });
    rerender();
    close?.();
  }

  /** @param {JSX.TargetedKeyboardEvent<HTMLInputElement>} event */
  function fieldKey(event) {
    const step = latest.current.step;
    switch (event.key) {
      case 'Enter':
        enter();
        break;
      case 'Escape':
        escape();
        break;
      case 'ArrowUp':
        set(s.value + step);
        break;
      case 'ArrowDown':
        set(s.value - step);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  /** @param {JSX.TargetedKeyboardEvent<HTMLElement>} event */
  function rulerKey(event) {
    const steps = RULER_KEYS.get(event.key);
    if (event.key === 'Enter') enter();
    else if (event.key === 'Escape') escape();
    else if (steps != null) set(s.value + steps * latest.current.step);
    else return;
    event.preventDefault();
  }

  return (
    <div
      class={compact ? 'number-editor number-editor-compact' : 'number-editor'}
      role="group"
      aria-label={label}
      onFocusOut={(event) => {
        // The focus leaves the editor, not only goes from the field to the ruler.
        const next = event.relatedTarget;
        if (!(next instanceof Node && event.currentTarget.contains(next))) commit();
      }}
    >
      <div class="number-editor-value">
        <input
          class="number-editor-field"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellcheck={false}
          aria-label={withUnit(metric.name, metric.unit)}
          value={s.text}
          onInput={(event) => type(event.currentTarget.value)}
          onKeyDown={fieldKey}
        />
        {metric.unit != null && <span class="number-editor-unit">{metric.unit}</span>}
      </div>
      <Ruler
        metric={metric}
        value={s.value}
        start={start}
        compact={compact}
        pageScrolls={onClose == null}
        autofocus={autofocus}
        onEnd={() => {
          // A press without a move confirms the value.
          s.touched = true;
          commit();
        }}
        onSet={set}
        onKey={rulerKey}
      />
      {s.error != null && (
        <p class="number-editor-error body-medium" role="alert">
          {s.error}
        </p>
      )}
      {onClose != null && (
        <div class="number-editor-actions">
          <button type="button" class="number-editor-text-button label-large" onClick={enter}>
            Close
          </button>
          {current != null && (
            <button
              type="button"
              class="number-editor-text-button number-editor-clear label-large"
              disabled={busy}
              onClick={() => {
                s.touched = false;
                onCommit(null);
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The value and the text of the editor for the value of the day `current`. An empty day starts at `start`. The text
 * field is empty if the metric has no value on any day.
 * @param {number | null} current
 * @param {number | null} start
 * @param {number} step
 * @returns {{ value: number, text: string, error: null }}
 */
function initialState(current, start, step) {
  const value = current ?? start ?? 0;
  return { value, text: current == null && start == null ? '' : formatStep(value, step), error: null };
}

/** The steps of the keys of the ruler. */
const RULER_KEYS = new Map([
  ['ArrowRight', 1],
  ['ArrowUp', 1],
  ['ArrowLeft', -1],
  ['ArrowDown', -1],
  ['PageUp', 10],
  ['PageDown', -10],
]);

/**
 * A drag on the ruler, from the press to the release.
 * @typedef {object} Drag
 * @property {number} pointerId
 * @property {number} startX The x of the press.
 * @property {number} slop The distance that the pointer moves before the drag starts.
 * @property {boolean} started True after the pointer moved more than `slop` to the side.
 * @property {number} originX The x where the drag started: the slop point.
 * @property {number} startPosition The strip position when the drag started, in ticks.
 */

/**
 * Ticks around the value: a long tick with a label every 10 steps, a middle tick every 5 steps. The strip moves, and
 * the needle stays in the middle. A green tick marks `start` on the nearest tick: it moves with the strip and shows
 * how far the value is from it. At the start value, the green tick does not show: under the needle, the two colors
 * mix.
 *
 * Dragging to the left moves the ticks to the left, so the value under the needle gets bigger. With `pageScrolls`,
 * a vertical wheel scrolls the page, and only a side wheel or trackpad swipe moves the ruler.
 *
 * The strip follows the finger, the mouse or the trackpad, also between two ticks, so that it moves smoothly. The value
 * snaps to the nearest tick at each move. When the drag or the side scroll ends, the strip settles on that tick. A
 * drag starts after the slop and moves from that point: the value does not jump at the start.
 * @param {object} props
 * @param {NumberMetric} props.metric
 * @param {number} props.value
 * @param {number | null} props.start
 * @param {boolean} props.compact
 * @param {boolean} props.pageScrolls
 * @param {boolean} props.autofocus
 * @param {() => void} props.onEnd Called when a press or a drag ends, and when a side scroll ends.
 * @param {(value: number, snap: boolean) => void} props.onSet
 * @param {(event: JSX.TargetedKeyboardEvent<HTMLElement>) => void} props.onKey
 * @returns {JSX.Element}
 */
function Ruler({ metric, value, start, compact, pageScrolls, autofocus, onEnd, onSet, onKey }) {
  const step = metric.step;
  const latest = useRef({ value, step, pageScrolls, onEnd, onSet });
  latest.current = { value, step, pageScrolls, onEnd, onSet };
  const element = useRef(/** @type {HTMLDivElement | null} */ (null));
  const motion = useRef({
    // The strip position minus the position of the value, in ticks: the part of a tick that the strip moved past the
    // value. From −0.5 to 0.5 during a drag or a side scroll, then 0 again.
    offset: 0,
    // Side scroll movement since the last whole tick, in ticks.
    wheel: 0,
    /** @type {Drag | null} */
    drag: null,
    /** @type {ReturnType<typeof setTimeout> | null} */
    timer: null,
    /** @type {number | null} */
    frame: null,
    /**
     * The timer of the end of a side scroll.
     * @type {ReturnType<typeof setTimeout> | null}
     */
    scrollEnd: null,
  }).current;
  const rerender = useRerender();

  /** @param {number} offset */
  function setOffset(offset) {
    motion.offset = offset;
    rerender();
  }

  /**
   * Moves the strip to `position`, in ticks: the value snaps to the nearest tick, and the offset keeps the rest. At 0,
   * the value stops, and the strip goes at most half a tick past it.
   * @param {number} position
   */
  function moveTo(position) {
    const { step: s, onSet: set } = latest.current;
    set(position * s, true);
    setOffset(clampOffset(position - roundToStep(position * s, s, true) / s));
  }

  /** Stops a running settle animation. The strip stays where it is. */
  function stopSettling() {
    if (motion.timer != null) clearTimeout(motion.timer);
    if (motion.frame != null) cancelAnimationFrame(motion.frame);
    motion.timer = null;
    motion.frame = null;
  }

  /**
   * Moves the strip to the tick of the value, after `delay` milliseconds.
   * @param {number} [delay]
   */
  function settle(delay = 0) {
    stopSettling();
    const animate = () => {
      motion.timer = null;
      motion.wheel = 0;
      const from = motion.offset;
      const startTime = performance.now();
      /** @param {number} now */
      const frame = (now) => {
        const t = Math.min(1, (now - startTime) / SETTLE_MILLIS);
        setOffset(from * (1 - fastOutSlowIn(t)));
        motion.frame = t < 1 ? requestAnimationFrame(frame) : null;
      };
      motion.frame = requestAnimationFrame(frame);
    };
    if (delay > 0) motion.timer = setTimeout(animate, delay);
    else animate();
  }

  useEffect(() => {
    if (autofocus) element.current?.focus();
    return () => {
      stopSettling();
      if (motion.scrollEnd != null) clearTimeout(motion.scrollEnd);
    };
  }, []);

  /** @param {JSX.TargetedPointerEvent<HTMLDivElement>} event */
  function pointerDown(event) {
    // Another mouse button than the primary button: no press and no drag.
    if (event.pointerType === 'mouse' && event.button !== 0) {
      motion.drag = null;
      return;
    }
    // No text selection and no native drag of a mouse press: they can cancel the pointer events.
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is gone: the drag ends with the next event.
    }
    motion.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      slop: event.pointerType === 'mouse' ? MOUSE_SLOP : TOUCH_SLOP,
      started: false,
      originX: event.clientX,
      startPosition: 0,
    };
  }

  /** @param {JSX.TargetedPointerEvent<HTMLDivElement>} event */
  function pointerMove(event) {
    const drag = motion.drag;
    if (drag == null || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    if (!drag.started) {
      if (Math.abs(dx) <= drag.slop) return;
      stopSettling();
      drag.started = true;
      drag.originX = drag.startX + Math.sign(dx) * drag.slop;
      drag.startPosition = latest.current.value / latest.current.step + motion.offset;
    }
    moveTo(drag.startPosition - (event.clientX - drag.originX) / TICK);
  }

  /** @param {JSX.TargetedPointerEvent<HTMLDivElement>} event */
  function pointerEnd(event) {
    const drag = motion.drag;
    if (drag == null || event.pointerId !== drag.pointerId) return;
    motion.drag = null;
    if (drag.started) settle();
    // The end of a drag, or a press without a move, which confirms the value.
    if (event.type === 'pointerup') latest.current.onEnd();
  }

  /** @param {JSX.TargetedWheelEvent<HTMLDivElement>} event */
  function wheel(event) {
    const { value: v, step: s, pageScrolls: scrolls, onSet: set } = latest.current;
    if (scrolls && Math.abs(event.deltaY) >= Math.abs(event.deltaX)) return;
    event.preventDefault();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    // The browser gives pixels, or lines with deltaMode 1: one line is one tick.
    motion.wheel += event.deltaMode === 1 ? delta : delta / TICK;
    const steps = Math.trunc(motion.wheel);
    motion.wheel -= steps;
    stopSettling();
    if (steps !== 0) set(v + steps * s, true);
    // The rest of a tick moves the strip. The value does not change until a whole tick.
    setOffset(clampOffset(motion.wheel));
    settle(SCROLL_END_MILLIS);
    if (motion.scrollEnd != null) clearTimeout(motion.scrollEnd);
    motion.scrollEnd = setTimeout(() => {
      motion.scrollEnd = null;
      latest.current.onEnd();
    }, SCROLL_END_MILLIS);
  }

  const valueTick = roundHalfAwayFromZero(value / step);
  const position = value / step + motion.offset;
  const centerTick = roundHalfAwayFromZero(position);
  const startTick = start == null ? null : roundHalfAwayFromZero(start / step);
  const ticks = [];
  for (let k = Math.max(0, centerTick - TICKS); k <= centerTick + TICKS; k++) {
    const left = `${k * TICK}px`;
    let kind = 'ruler-tick';
    if (k % 10 === 0) kind = 'ruler-tick ruler-tick-major';
    else if (k % 5 === 0) kind = 'ruler-tick ruler-tick-middle';
    ticks.push(<span key={`t${k}`} class={kind} style={{ left }} />);
    if (k === startTick && k !== valueTick) ticks.push(<span key="start" class="ruler-start" style={{ left }} />);
    if (k % 10 === 0) {
      ticks.push(
        <span key={`l${k}`} class="ruler-label" style={{ left }}>
          {formatTrimmed(roundToStep(k * step, step))}
        </span>,
      );
    }
  }

  return (
    <div
      ref={element}
      class={compact ? 'ruler ruler-compact' : 'ruler'}
      role="slider"
      tabIndex={0}
      aria-label={`${metric.name} ruler`}
      aria-valuemin={0}
      aria-valuenow={value}
      aria-valuetext={withUnit(formatStep(value, step), metric.unit)}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerEnd}
      onPointerCancel={pointerEnd}
      onWheel={wheel}
      onKeyDown={onKey}
    >
      <div class="ruler-strip" style={{ transform: `translateX(${-position * TICK}px)` }} aria-hidden="true">
        {ticks}
      </div>
      <span class="ruler-needle" />
    </div>
  );
}

/**
 * `offset` from −0.5 to 0.5: the strip goes at most half a tick past the value.
 * @param {number} offset
 * @returns {number}
 */
function clampOffset(offset) {
  return Math.max(-0.5, Math.min(0.5, offset));
}

/**
 * A function that shows the component again, for state in a ref: the event handlers read and change the ref at once,
 * also before the next render.
 * @returns {() => void}
 */
function useRerender() {
  const [, setVersion] = useState(0);
  return () => setVersion((v) => v + 1);
}

/**
 * A point of the curve `cubic-bezier(x1, y1, x2, y2)` of CSS, from (0, 0) to (1, 1): the x or the y of the point at the
 * curve parameter `u`. Give `p1` and `p2` from the x values or from the y values.
 * @param {number} u From 0 to 1.
 * @param {number} p1
 * @param {number} p2
 * @returns {number}
 */
function bezier(u, p1, p2) {
  return 3 * (1 - u) * (1 - u) * u * p1 + 3 * (1 - u) * u * u * p2 + u * u * u;
}

/**
 * The FastOutSlowIn easing of Compose, the CSS `cubic-bezier(0.4, 0, 0.2, 1)`: the part of the move at the part `t` of
 * the time.
 * @param {number} t From 0 to 1.
 * @returns {number} From 0 to 1.
 */
function fastOutSlowIn(t) {
  // Find the curve parameter u with x(u) = t, then give y(u).
  let low = 0;
  let high = 1;
  for (let i = 0; i < 20; i++) {
    const middle = (low + high) / 2;
    if (bezier(middle, 0.4, 0.2) < t) low = middle;
    else high = middle;
  }
  return bezier((low + high) / 2, 0, 1);
}
