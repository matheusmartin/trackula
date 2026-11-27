import { useEffect, useId, useMemo, useRef } from 'preact/hooks';
import { MetricDraft, MetricKind, deletedSummary, draftOf, kindOf } from '../../model/MetricDraft.js';
import {
  planDeleteMetric,
  planDeleteRow,
  planEditMetric,
  planFixRow,
  planMoveMetric,
  planMoveMetricTo,
  planSaveMetric,
} from '../../model/MetricsWrite.js';
import { isValidMetricId } from '../../model/Parse.js';
import { Route, Screen } from '../../model/Route.js';
import { useNavigator, useRoute } from '../Navigation.js';
import { AppCard } from '../components/AppCard.jsx';
import { AppIconButton } from '../components/AppIconButton.jsx';
import { Button } from '../components/Button.jsx';
import { Notice, NoticeKind } from '../components/Notice.jsx';
import { Symbol } from '../components/Symbol.jsx';
import { FormSetup, MetricForm } from './MetricForm.jsx';
import { Help, MetricList } from './MetricList.jsx';
import './MetricsPage.css';

/** @import { ComponentChildren, JSX } from 'preact' */
/** @import { DeletedMetric } from '../../model/DeletedMetric.js' */
/** @import { Metric } from '../../model/Metric.js' */
/** @import { InvalidMetricRow, MetricsTable } from '../../model/MetricsTable.js' */
/** @import { MetricsWrite } from '../../model/MetricsWrite.js' */
/** @import { Snapshot } from '../../sheets/Store.js' */

/** The form of a new metric. */
class NewTarget {}

/** The form of the metric `id`, to change it. */
class EditTarget {
  /** @param {string} id */
  constructor(id) {
    this.id = id;
    Object.freeze(this);
  }
}

/** The form of the invalid row `row`, to fix it. */
class FixTarget {
  /** @param {InvalidMetricRow} row */
  constructor(row) {
    this.row = row;
    Object.freeze(this);
  }
}

/** The form of the deleted metric `deleted`, to restore it. */
class RestoreTarget {
  /** @param {DeletedMetric} deleted */
  constructor(deleted) {
    this.deleted = deleted;
    Object.freeze(this);
  }
}

/**
 * What the metrics form shows: a new metric, a metric to change, an invalid row to fix, or a deleted metric.
 * @typedef {NewTarget | EditTarget | FixTarget | RestoreTarget} FormTarget
 */

/**
 * The form of the address `route`. Null for the list of metrics, and for a row or a deleted metric that the sheet does
 * not have.
 * @param {Route} route
 * @param {Snapshot} data
 * @returns {FormTarget | null}
 */
function targetOf(route, data) {
  const param = route.param ?? '';
  switch (route.screen) {
    case Screen.NEW_METRIC:
      return new NewTarget();
    case Screen.EDIT_METRIC:
      return new EditTarget(param);
    case Screen.FIX_ROW: {
      const row = data.metricsTable.invalid.find((r) => String(r.row) === param);
      return row == null ? null : new FixTarget(row);
    }
    case Screen.RESTORE_METRIC: {
      const deleted = data.deleted.find((d) => d.id === param);
      return deleted == null ? null : new RestoreTarget(deleted);
    }
    default:
      return null;
  }
}

/**
 * A plan of a change to the `Metrics` tab: it gets the latest `Metrics` tab and gives the writes.
 * @typedef {(table: MetricsTable) => MetricsWrite[]} MetricsPlan
 */

/**
 * The metrics screen. It shows the metrics in the order of the sheet, which is also the order in the app, the rows of
 * the `Metrics` tab that are not valid, and the deleted metrics: the `Log` columns without a metric. A click on a
 * metric, Add metric, Fix or Restore opens the form (see {@link MetricForm}). Each form has its own address (see
 * `Route`), so the Back button of the browser closes it. Wide screens: the screen is at most `FORM_WIDTH` wide and
 * centered. The screen needs the `Navigator` of the App in `NavigatorContext`.
 * @param {object} props
 * @param {Snapshot} props.data The latest data of the sheet.
 * @param {boolean} props.busy True while data loads or saves. The buttons that write are disabled.
 * @param {string | null} props.error The error of the last load or write, or null.
 * @param {(plan: MetricsPlan, onDone: () => void) => void} props.onWrite Writes a change to the `Metrics` tab. The
 *   plan runs on the latest data. `onDone` runs after a write without an error, for example to close the form.
 * @param {boolean} [props.hasMouse] True if the device has a mouse. Then a drag moves a metric to a new place. Else the
 *   arrows of each row move it one place up or down. See {@link MetricList}. Default: false.
 * @returns {JSX.Element}
 */
export function MetricsPage({ data, busy, error, onWrite, hasMouse = false }) {
  const navigator = useNavigator();
  const route = useRoute(navigator);
  // The form of the address. It stays the same object while the address stays: a reload keeps the changes of the form.
  const form = useMemo(() => targetOf(route, data), [route]);
  const metrics = data.metrics;
  const table = data.metricsTable;
  // The problems of the Log tab and of the scores. The problems of the Metrics tab are its invalid rows.
  const otherProblems = data.warnings.filter((w) => !table.warnings.includes(w));

  // A metric, a row or a deleted metric that is gone from the sheet, for example after a reload, has no form: the
  // screen before shows.
  const edited = form instanceof EditTarget ? (metrics.find((m) => m.id === form.id) ?? null) : null;
  const isGone = (route.isForm && form == null) || (form instanceof EditTarget && edited == null);
  useEffect(() => {
    // Only while the screen shows: a write can close the form at the same time.
    if (isGone && navigator.route.equals(route)) navigator.back(true);
  }, [route, isGone]);

  const shownForm = form != null && !isGone ? form : null;
  const formState = useFormSetup(shownForm, edited, data);

  if (shownForm != null && formState != null) {
    const target = shownForm;
    const takenIds = new Set([
      ...metrics.map((m) => m.id),
      ...table.invalid.map((row) => row.id),
      ...data.deleted.map((d) => d.id),
    ]);
    const groups = [...new Set(metrics.map((m) => m.group).filter((g) => g != null))];
    // After a save, a delete or a discard: the guard of the form does not ask again.
    const close = () => navigator.back(true);
    return (
      <MetricForm
        key={formState.version}
        setup={formState.setup}
        takenIds={takenIds}
        groups={groups}
        busy={busy}
        error={error}
        onSave={(metric) => onWrite((t) => planSave(target, t, metric), close)}
        onDelete={() => {
          if (target instanceof EditTarget) onWrite((t) => [planDeleteMetric(t, target.id)], close);
          else if (target instanceof FixTarget) onWrite((t) => [planDeleteRow(t, target.row)], close);
        }}
        onClose={close}
      />
    );
  }

  return (
    <div class="metrics-page">
      <div class="metrics-title-row">
        <AppIconButton icon="arrow_back" title="Back" onClick={() => navigator.back()} />
        <h2 class="metrics-title headline-small">Metrics</h2>
        {/* Without metrics, the button is in the empty state. */}
        {metrics.length > 0 && <AddButton enabled={!busy} onClick={() => navigator.go(Route.NEW_METRIC)} />}
      </div>
      <Help
        text={
          'Changes go to the Metrics tab of your sheet. The order here is the order in the app.' +
          (hasMouse && metrics.length > 1 ? ' Drag a metric to move it.' : '')
        }
      />
      {error != null && <Notice text={error} kind={NoticeKind.ERROR} />}
      {/* The problems first: the line of the sheet problems on the other screens opens this screen. */}
      {table.invalid.length > 0 && (
        <OtherRows icon="warning" title="Rows with problems" help={null}>
          {table.invalid.map((row) => (
            <OtherRow
              key={row.row}
              title={`Row ${row.row} · ${row.id || 'no id'}`}
              text={capitalized(row.problem)}
              button="Fix"
              enabled={!busy}
              onClick={() => navigator.go(Route.fixRow(row.row))}
            />
          ))}
        </OtherRows>
      )}
      {otherProblems.length > 0 && (
        <OtherRows
          icon="warning"
          title="Other problems in the sheet"
          help="Change these in the sheet. Then load the sheet again with the reload button."
        >
          <ul class="metrics-problems">
            {otherProblems.map((problem, i) => (
              <li key={i} class="body-medium">
                {problem}
              </li>
            ))}
          </ul>
        </OtherRows>
      )}

      {metrics.length === 0 ? (
        <EmptyState enabled={!busy} onAdd={() => navigator.go(Route.NEW_METRIC)} />
      ) : (
        <MetricList
          metrics={metrics}
          busy={busy}
          hasMouse={hasMouse}
          onEdit={(m) => navigator.go(Route.editMetric(m.id))}
          onMove={(m, up) =>
            onWrite(
              (t) => nonNull(planMoveMetric(t, m.id, up)),
              () => {},
            )
          }
          onDrop={(m, other) =>
            onWrite(
              (t) => nonNull(planMoveMetricTo(t, m.id, other.id)),
              () => {},
            )
          }
        />
      )}

      {data.deleted.length > 0 && (
        <OtherRows
          icon="history"
          title="Deleted metrics"
          help="Their values stay in the Log tab. Restore a metric to show it again with all its values."
        >
          {data.deleted.map((deleted) => (
            <OtherRow
              key={deleted.id}
              title={deleted.id}
              text={deletedSummary(deleted)}
              button="Restore"
              enabled={!busy}
              onClick={() => navigator.go(Route.restoreMetric(deleted.id))}
            />
          ))}
        </OtherRows>
      )}
    </div>
  );
}

/**
 * The write of `write` in a list: no write if it is null.
 * @param {MetricsWrite | null} write
 * @returns {MetricsWrite[]}
 */
function nonNull(write) {
  return write == null ? [] : [write];
}

/**
 * `text` with a capital first letter. Example: "no icon." gives "No icon.".
 * @param {string} text
 * @returns {string}
 */
function capitalized(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The setup of the form of `target`, and its version. The setup stays the same while the target and the values of
 * the edited metric stay the same: a load of the same data keeps the changes in the form. A new setup gets a new
 * version: the form starts again with its values.
 * @param {FormTarget | null} target
 * @param {Metric | null} edited The metric of an {@link EditTarget}.
 * @param {Snapshot} data
 * @returns {{ setup: FormSetup, version: number } | null}
 */
function useFormSetup(target, edited, data) {
  const last = useRef(
    /** @type {{ target: FormTarget, edited: Metric | null, setup: FormSetup, version: number } | null} */ (null),
  );
  if (target == null) return null;
  const previous = last.current;
  if (previous != null && previous.target === target && sameMetric(previous.edited, edited)) return previous;
  const next = { target, edited, setup: setupOf(target, edited, data), version: (previous?.version ?? 0) + 1 };
  last.current = next;
  return next;
}

/**
 * True if `a` and `b` are both null, or are metrics with the same values.
 * @param {Metric | null} a
 * @param {Metric | null} b
 * @returns {boolean}
 */
function sameMetric(a, b) {
  if (a === b) return true;
  return a != null && b != null && a.id === b.id && draftOf(a).equals(draftOf(b));
}

/**
 * The form of `target`. `edited` is the metric of an {@link EditTarget}.
 * @param {FormTarget} target
 * @param {Metric | null} edited
 * @param {Snapshot} data
 * @returns {FormSetup}
 */
function setupOf(target, edited, data) {
  if (target instanceof EditTarget) {
    const metric = /** @type {Metric} */ (edited);
    return new FormSetup({
      title: 'Edit metric',
      initial: draftOf(metric),
      id: metric.id,
      valueKind: data.log.entries.some((e) => e.metricId === metric.id) ? kindOf(metric) : null,
      deleteQuestion:
        `Delete "${metric.name}"? The app stops showing it. Its values stay in the Log tab ` +
        'of the sheet, and you can restore it here.',
    });
  }
  if (target instanceof FixTarget) {
    const id = target.row.id;
    return new FormSetup({
      title: `Fix row ${target.row.row}`,
      initial: draftOf(target.row),
      // A row with an invalid id or with the id of another metric gets a new id from its name.
      id: isValidMetricId(id) && !data.metricsTable.rows.has(id) ? id : null,
      note: capitalized(target.row.problem),
      deleteQuestion: `Delete row ${target.row.row} of the Metrics tab?`,
      deleteLabel: 'Delete row',
    });
  }
  if (target instanceof RestoreTarget) {
    const deleted = target.deleted;
    let valueKind = null;
    if (deleted.values > 0) valueKind = deleted.isYesNo ? MetricKind.YES_NO : MetricKind.NUMBER;
    return new FormSetup({ title: 'Restore metric', initial: draftOf(deleted), id: deleted.id, valueKind });
  }
  return new FormSetup({ title: 'Add metric', initial: new MetricDraft() });
}

/**
 * The writes of a Save in the form of `target`.
 * @param {FormTarget} target
 * @param {MetricsTable} table
 * @param {Metric} metric
 * @returns {MetricsWrite[]}
 */
function planSave(target, table, metric) {
  if (target instanceof EditTarget) return planEditMetric(table, metric);
  if (target instanceof FixTarget) return planFixRow(table, target.row, metric);
  return planSaveMetric(table, metric);
}

/**
 * The button that opens the form of a new metric: a filled button of Material 3.
 * @param {object} props
 * @param {boolean} props.enabled
 * @param {() => void} props.onClick
 * @returns {JSX.Element}
 */
function AddButton({ enabled, onClick }) {
  return <Button variant="filled" size="large" icon="add" text="Add metric" enabled={enabled} onClick={onClick} />;
}

/**
 * The screen without metrics: an icon, a short text and the Add metric button.
 * @param {object} props
 * @param {boolean} props.enabled
 * @param {() => void} props.onAdd
 * @returns {JSX.Element}
 */
function EmptyState({ enabled, onAdd }) {
  return (
    <AppCard class="metrics-empty">
      <Symbol name="playlist_add" size={40} color="var(--primary)" />
      <h3 class="metrics-empty-title title-medium">No metrics yet</h3>
      <p class="metrics-empty-text body-medium">
        Add a metric to record it each day, for example a habit or your weight.
      </p>
      <AddButton enabled={enabled} onClick={onAdd} />
    </AppCard>
  );
}

/**
 * A card of rows that are not metrics: the rows with problems, or the deleted metrics.
 * @param {object} props
 * @param {string} props.icon
 * @param {string} props.title
 * @param {string | null} props.help
 * @param {ComponentChildren} props.children
 * @returns {JSX.Element}
 */
function OtherRows({ icon, title, help, children }) {
  return (
    <AppCard class="metrics-other">
      <div class="metrics-other-title">
        <Symbol name={icon} color={icon === 'warning' ? 'var(--error)' : 'var(--on-surface-variant)'} />
        <h3 class="title-medium">{title}</h3>
      </div>
      {help != null && <Help text={help} />}
      {children}
    </AppCard>
  );
}

/**
 * A row of {@link OtherRows}: a `title`, a `text` and a `button`. The title is the description of the button for
 * screen readers.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.text
 * @param {string} props.button
 * @param {boolean} props.enabled
 * @param {() => void} props.onClick
 * @returns {JSX.Element}
 */
function OtherRow({ title, text, button, enabled, onClick }) {
  const titleId = useId();
  return (
    <div class="metrics-other-row">
      <span class="metrics-other-texts">
        <span id={titleId} class="body-large">
          {title}
        </span>
        <Help text={text} />
      </span>
      <Button variant="outlined" text={button} enabled={enabled} describedBy={titleId} onClick={onClick} />
    </div>
  );
}
