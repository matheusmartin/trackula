import { useEffect, useRef, useState } from 'preact/hooks';
import { dragShift, dropIndex } from '../../model/Drag.js';
import { goalSummary, metricSummary } from '../../model/MetricDraft.js';
import { AppCard } from '../components/AppCard.jsx';
import { AppIconButton } from '../components/AppIconButton.jsx';
import { MetricIcon } from '../components/MetricIcon.jsx';
import { Symbol } from '../components/Symbol.jsx';
import './MetricList.css';

/** @import { JSX } from 'preact' */
/** @import { Metric } from '../../model/Metric.js' */

/** The distance in CSS pixels that the mouse must move with the button down before a drag starts. */
const DRAG_SLOP = 6;

/**
 * A drag of a metric in {@link MetricList}.
 * @typedef {object} DragState
 * @property {string} id The id of the dragged metric.
 * @property {number} offset How far the row moved down, in CSS pixels. Negative: up.
 * @property {number[]} heights The height of each row when the drag started, in the order of the list.
 */

/**
 * The metrics in a card, in the order of the sheet. A click on a metric opens its form (`onEdit`).
 *
 * Without a mouse (`hasMouse` false), the arrows of each row move the metric one place (`onMove`). With a mouse, a
 * drag of a row moves the metric. The other rows make space while it moves, and `onDrop` gets the metric and the metric
 * at the drop place. The handle of each row also moves the metric with the up and down arrow keys. The list shows the
 * new order at once, until the write ends: then the data has the new order, or the page shows the error. While `busy`,
 * the metrics do not move.
 * @param {object} props
 * @param {Metric[]} props.metrics
 * @param {boolean} props.busy
 * @param {boolean} props.hasMouse
 * @param {(metric: Metric) => void} props.onEdit
 * @param {(metric: Metric, up: boolean) => void} props.onMove
 * @param {(metric: Metric, other: Metric) => void} props.onDrop
 * @returns {JSX.Element}
 */
export function MetricList({ metrics, busy, hasMouse, onEdit, onMove, onDrop }) {
  const [dropped, setDropped] = useState(/** @type {Metric[] | null} */ (null));
  useEffect(() => {
    if (!busy) setDropped(null);
  }, [busy]);
  const shown = dropped ?? metrics;

  // The drag of the latest pointer event, and a copy in the state for the view.
  const dragging = useRef(/** @type {DragState | null} */ (null));
  const [drag, setDrag] = useState(/** @type {DragState | null} */ (null));
  // The mouse button is down on a row: a move of more than DRAG_SLOP starts a drag.
  const press = useRef(/** @type {{ id: string, pointerId: number, y: number } | null} */ (null));
  // True from a drop until the click event after it: that click does not open the form.
  const dropClick = useRef(false);
  const rows = useRef(/** @type {Map<string, HTMLElement>} */ (new Map()));
  // The metric that an arrow button or a key moved, and its buttons that can get the focus, in order. A disabled button
  // loses the focus, and a row that moves in the page can lose it too.
  const refocus = useRef(/** @type {{ id: string, selectors: string[] } | null} */ (null));

  useEffect(() => {
    const target = refocus.current;
    if (target == null) return;
    const row = rows.current.get(target.id);
    const button = target.selectors
      .map((selector) => row?.querySelector(selector))
      .find((b) => b instanceof HTMLButtonElement && !b.disabled);
    if (busy) return;
    refocus.current = null;
    // Only if the focus is lost: the user can be in another place now.
    const lost = document.activeElement == null || document.activeElement === document.body;
    if (button instanceof HTMLElement && lost) button.focus({ preventScroll: true });
  }, [shown, busy]);

  /**
   * Updates the drag and the view.
   * @param {DragState | null} next
   */
  function setDragging(next) {
    dragging.current = next;
    setDrag(next);
  }

  /**
   * @param {JSX.TargetedPointerEvent<HTMLDivElement>} event
   * @param {Metric} metric
   */
  function onPointerDown(event, metric) {
    dropClick.current = false;
    if (!hasMouse || busy || event.button !== 0 || event.pointerType === 'touch') return;
    press.current = { id: metric.id, pointerId: event.pointerId, y: event.clientY };
  }

  /** @param {JSX.TargetedPointerEvent<HTMLDivElement>} event */
  function onPointerMove(event) {
    const pressed = press.current;
    if (pressed == null || event.pointerId !== pressed.pointerId) return;
    const moved = event.clientY - pressed.y;
    let current = dragging.current;
    if (current == null) {
      if (Math.abs(moved) < DRAG_SLOP) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      current = { id: pressed.id, offset: 0, heights: shown.map((m) => rows.current.get(m.id)?.offsetHeight ?? 0) };
    }
    // The dragged row stays in the card: from the top of the first row to the bottom of the last row.
    const from = shown.findIndex((m) => m.id === current.id);
    const above = sum(current.heights.slice(0, from));
    const below = sum(current.heights.slice(from + 1));
    setDragging({ ...current, offset: Math.min(below, Math.max(-above, moved)) });
  }

  /** @param {JSX.TargetedPointerEvent<HTMLDivElement>} event */
  function onPointerUp(event) {
    if (press.current?.pointerId !== event.pointerId) return;
    press.current = null;
    const current = dragging.current;
    if (current == null) return;
    setDragging(null);
    // The click of this release comes next, in the same task.
    dropClick.current = true;
    setTimeout(() => {
      dropClick.current = false;
    }, 0);
    const from = shown.findIndex((m) => m.id === current.id);
    const to = from < 0 ? from : dropIndex(from, current.offset, current.heights);
    if (to === from) return;
    const next = [...shown];
    next.splice(to, 0, ...next.splice(from, 1));
    setDropped(next);
    onDrop(shown[from], shown[to]);
  }

  function cancelDrag() {
    press.current = null;
    if (dragging.current != null) setDragging(null);
  }

  /** @param {JSX.TargetedMouseEvent<HTMLDivElement>} event */
  function onClickCapture(event) {
    if (!dropClick.current) return;
    dropClick.current = false;
    event.stopPropagation();
    event.preventDefault();
  }

  /**
   * Moves `metric` one place with an arrow button or a key of the handle. The focus stays on the row of the metric:
   * the button gets the focus again after the write and after the move in the list.
   * @param {Metric} metric
   * @param {boolean} up
   */
  function move(metric, up) {
    const arrows = up ? ['[data-move="up"]', '[data-move="down"]'] : ['[data-move="down"]', '[data-move="up"]'];
    refocus.current = { id: metric.id, selectors: hasMouse ? ['.metric-handle'] : [...arrows, '.metric-row-edit'] };
    onMove(metric, up);
  }

  const from = drag == null ? -1 : shown.findIndex((m) => m.id === drag.id);
  const to = drag == null || from < 0 ? from : dropIndex(from, drag.offset, drag.heights);
  return (
    <AppCard class={drag != null ? 'metric-list metric-list-dragging' : 'metric-list'}>
      {shown.map((m, i) => {
        const isDragged = i === from;
        let shift = 0;
        if (isDragged && drag != null) shift = drag.offset;
        else if (drag != null && from >= 0) shift = dragShift(i, from, to, drag.heights[from]);
        return (
          <div
            key={m.id}
            class={isDragged ? 'metric-list-item metric-list-item-dragged' : 'metric-list-item'}
            ref={(element) => {
              if (element != null) rows.current.set(m.id, element);
              else rows.current.delete(m.id);
            }}
            style={shift === 0 ? undefined : { transform: `translateY(${shift}px)` }}
            onPointerDown={(event) => onPointerDown(event, m)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={cancelDrag}
            onLostPointerCapture={cancelDrag}
            onClickCapture={onClickCapture}
          >
            <MetricRow
              metric={m}
              busy={busy}
              isFirst={i === 0}
              isLast={i === shown.length - 1}
              hasMouse={hasMouse}
              onEdit={() => onEdit(m)}
              onMove={(up) => move(m, up)}
            />
          </div>
        );
      })}
    </AppCard>
  );
}

/**
 * The sum of `values`.
 * @param {number[]} values
 * @returns {number}
 */
function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * A metric in the list: a click opens its form. The click area is the full row, from edge to edge of the card, so
 * that its highlight has no gaps. Without a mouse (`hasMouse` false), the arrows are buttons on the row: they move the
 * metric up or down. With a mouse, a handle shows that a drag of the row moves the metric. The handle is also a
 * button: the up and down arrow keys move the metric.
 * @param {object} props
 * @param {Metric} props.metric
 * @param {boolean} props.busy
 * @param {boolean} props.isFirst
 * @param {boolean} props.isLast
 * @param {boolean} props.hasMouse
 * @param {() => void} props.onEdit
 * @param {(up: boolean) => void} props.onMove
 * @returns {JSX.Element}
 */
function MetricRow({ metric, busy, isFirst, isLast, hasMouse, onEdit, onMove }) {
  const canMoveUp = !busy && !isFirst;
  const canMoveDown = !busy && !isLast;
  const name = metric.name;

  /** @param {JSX.TargetedKeyboardEvent<HTMLButtonElement>} event */
  function onHandleKey(event) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const up = event.key === 'ArrowUp';
    if (up ? canMoveUp : canMoveDown) onMove(up);
  }

  return (
    <div class={hasMouse ? 'metric-row metric-row-mouse' : 'metric-row'}>
      <button type="button" class="metric-row-edit" onClick={onEdit}>
        <MetricIcon icon={metric.icon} />
        <span class="metric-row-texts">
          <span class="metric-row-name body-large">{name}</span>
          <Help text={metricSummary(metric)} />
          <span class="metric-row-goal">
            <Symbol name="flag" size={16} color="var(--on-surface-variant)" />
            <Help text={goalSummary(metric)} />
          </span>
        </span>
      </button>
      <span class="metric-row-actions">
        {hasMouse ? (
          <button
            type="button"
            class="app-icon-button metric-handle"
            title={`Move ${name}: drag the row, or use the up and down arrow keys`}
            aria-label={`Move ${name}`}
            aria-keyshortcuts="ArrowUp ArrowDown"
            onKeyDown={onHandleKey}
          >
            <Symbol name="drag_indicator" color="var(--on-surface-variant)" />
          </button>
        ) : (
          <>
            <AppIconButton
              icon="arrow_upward"
              title={`Move ${name} up`}
              enabled={canMoveUp}
              data-move="up"
              onClick={() => onMove(true)}
            />
            <AppIconButton
              icon="arrow_downward"
              title={`Move ${name} down`}
              enabled={canMoveDown}
              data-move="down"
              onClick={() => onMove(false)}
            />
          </>
        )}
      </span>
    </div>
  );
}

/**
 * A short text in the color of secondary text.
 * @param {object} props
 * @param {string} props.text
 * @returns {JSX.Element}
 */
export function Help({ text }) {
  return <span class="metrics-help body-small">{text}</span>;
}
