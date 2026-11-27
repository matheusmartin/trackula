import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { goalText } from '../../model/MetricCells.js';
import { DraftField, GoalDirection, MetricKind, canChangeKind, goalExamples } from '../../model/MetricDraft.js';
import { newMetricId } from '../../model/MetricId.js';
import { useLeaveGuard } from '../Navigation.js';
import { AppCard } from '../components/AppCard.jsx';
import { AppIconButton } from '../components/AppIconButton.jsx';
import { EmojiPicker } from '../components/EmojiPicker.jsx';
import { FilterChip, groupLabel } from '../components/GroupChips.jsx';
import { MetricIcon } from '../components/MetricIcon.jsx';
import { Notice, NoticeKind } from '../components/Notice.jsx';
import { outset } from '../components/Outset.js';
import { PrimaryButton } from '../components/PrimaryButton.jsx';
import { Symbol } from '../components/Symbol.jsx';
import './MetricForm.css';

/** @import { ComponentChildren, JSX } from 'preact' */
/** @import { Metric, NumberGoal } from '../../model/Metric.js' */
/** @import { MetricDraft } from '../../model/MetricDraft.js' */

/**
 * The fields of a {@link FormSetup}.
 * @typedef {object} FormSetupFields
 * @property {string} title
 * @property {MetricDraft} initial
 * @property {string | null} [id] Null by default.
 * @property {MetricKind | null} [valueKind] Null by default.
 * @property {string | null} [note] Null by default.
 * @property {string | null} [deleteQuestion] Null by default.
 * @property {string} [deleteLabel] "Delete metric" by default.
 */

/** What the metrics form shows. */
export class FormSetup {
  /** @param {FormSetupFields} fields */
  constructor({ title, initial, id = null, valueKind = null, note = null, deleteQuestion = null, deleteLabel }) {
    /** The title of the form. Example: "Edit metric". */
    this.title = title;
    /** The values of the form when it opens. */
    this.initial = initial;
    /** The id of the metric. Null for a new metric: the app makes the id from the name, see `newMetricId`. */
    this.id = id;
    /**
     * The kind of the values in the `Log` column of the metric. Null if the column has no values. The kind cannot
     * change between `yesno` and the other kinds, see `canChangeKind`.
     */
    this.valueKind = valueKind;
    /** A text above the fields, for example the problem of an invalid row. Null: no text. */
    this.note = note;
    /** The question of the delete dialog. Null: the form has no delete button. */
    this.deleteQuestion = deleteQuestion;
    /** The text of the delete button. */
    this.deleteLabel = deleteLabel ?? 'Delete metric';
    Object.freeze(this);
  }
}

/**
 * The form of one metric, on its own page: the name and the icon, the kind, the unit, the step, the group and the goal.
 * Save checks the values (see `MetricDraft.check`) and calls `onSave` with the metric. The errors show below the fields
 * after the first Save, and a text above the Save button names the fields with errors. Wide screens: the form is at
 * most `FORM_WIDTH` wide and centered.
 *
 * The buttons at the end: Save, Cancel, then Delete, apart from the others. Close and Cancel ask before they discard a
 * changed form. The Back button of the browser, and a move to another screen, ask too. After a save, a delete or a
 * discard, `onClose` must close the form without the question. The form starts at the top of the page.
 * @param {object} props
 * @param {FormSetup} props.setup
 * @param {Set<string>} props.takenIds The ids that a new metric must not get. See `newMetricId`.
 * @param {string[]} props.groups The groups of the other metrics. A click on a group chip sets the group.
 * @param {boolean} props.busy True while data loads or saves. Save and Delete are disabled.
 * @param {string | null} props.error The error of the last write, or null.
 * @param {(metric: Metric) => void} props.onSave
 * @param {() => void} props.onDelete Deletes the metric or the row, after the user confirms the
 *   `setup.deleteQuestion`.
 * @param {() => void} props.onClose Closes the form without a save.
 * @returns {JSX.Element}
 */
export function MetricForm({ setup, takenIds, groups, busy, error, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(setup.initial);
  // True after the first Save: then each field shows its error, and the errors follow each change.
  const [tried, setTried] = useState(false);
  const [confirmsDelete, setConfirmsDelete] = useState(false);
  const [confirmsDiscard, setConfirmsDiscard] = useState(false);
  const id = setup.id ?? newMetricId(draft.name, takenIds);
  /** @type {Map<DraftField, string>} */
  const errors = tried ? draft.check(id).errors : new Map();

  /** Closes the form. A changed form asks first. */
  function close() {
    if (draft.equals(setup.initial)) onClose();
    else setConfirmsDiscard(true);
  }

  // The Back button of the browser, and the other screens, ask before they discard a changed form, as Close does.
  useLeaveGuard(() => {
    if (draft.equals(setup.initial)) return false;
    setConfirmsDiscard(true);
    return true;
  });
  // The form takes the place of the list: it starts at the top, also when the list was scrolled.
  useLayoutEffect(() => window.scrollTo(0, 0), []);

  function save() {
    setTried(true);
    const metric = draft.check(id).metric;
    if (metric != null) onSave(metric);
  }

  return (
    <div class="metric-form">
      <div class="metric-form-title-row">
        <AppIconButton icon="close" title="Close without saving" onClick={close} />
        <h2 class="metric-form-title headline-small">{setup.title}</h2>
      </div>
      {setup.note != null && <Notice text={setup.note} kind={NoticeKind.ERROR} />}

      <NameAndIcon draft={draft} errors={errors} onChange={setDraft} />
      <KindUnitAndGroup draft={draft} errors={errors} valueKind={setup.valueKind} groups={groups} onChange={setDraft} />
      <Goal draft={draft} errors={errors} onChange={setDraft} />

      {/* The fields with errors can be out of view: this text is next to the Save button. */}
      {errors.size > 0 && <Notice text={errorSummary(errors)} kind={NoticeKind.ERROR} />}
      {error != null && <Notice text={error} kind={NoticeKind.ERROR} />}
      <PrimaryButton text={busy ? 'Saving…' : 'Save'} onClick={save} enabled={!busy} class="fill-width" />
      <button type="button" class="metric-form-text-button label-large" onClick={close}>
        Cancel
      </button>
      {/* Delete is the last button, after a line: not next to Save. */}
      {setup.deleteQuestion != null && (
        <>
          <hr class="metric-form-line" />
          <button
            type="button"
            class="metric-outlined-button metric-outlined-button-error label-large"
            disabled={busy}
            onClick={() => setConfirmsDelete(true)}
          >
            <Symbol name="delete" size={20} />
            {setup.deleteLabel}
          </button>
        </>
      )}

      {confirmsDelete && setup.deleteQuestion != null && (
        <AlertDialog
          title={`${setup.deleteLabel}?`}
          text={setup.deleteQuestion}
          confirm={setup.deleteLabel}
          dismiss="Cancel"
          onConfirm={() => {
            setConfirmsDelete(false);
            onDelete();
          }}
          onDismiss={() => setConfirmsDelete(false)}
        />
      )}
      {confirmsDiscard && (
        <AlertDialog
          title="Discard changes?"
          text="The changes in this form are not saved."
          confirm="Discard"
          dismiss="Keep editing"
          onConfirm={() => {
            setConfirmsDiscard(false);
            onClose();
          }}
          onDismiss={() => setConfirmsDiscard(false)}
        />
      )}
    </div>
  );
}

/** The names of the form fields in the error summary, in the order of the form. */
const fieldNames = new Map([
  [DraftField.NAME, 'Name'],
  [DraftField.ICON, 'Icon'],
  [DraftField.STEP, 'Step'],
  [DraftField.TARGET, 'Target'],
  [DraftField.START, 'Start'],
]);

/**
 * The error summary of the fields of `errors`, in the order of the form. Example: "Correct these fields: Name,
 * Target."
 * @param {Map<DraftField, string>} errors
 * @returns {string}
 */
function errorSummary(errors) {
  const names = [...fieldNames].filter(([field]) => errors.has(field)).map(([, name]) => name);
  return names.length === 1 ? `Correct this field: ${names[0]}.` : `Correct these fields: ${names.join(', ')}.`;
}

/**
 * The name and the icon. The icon shows once: here. An icon from the sheet, for example a Material Symbol, stays until
 * a pick.
 * @param {object} props
 * @param {MetricDraft} props.draft
 * @param {Map<DraftField, string>} props.errors
 * @param {(draft: MetricDraft) => void} props.onChange
 * @returns {JSX.Element}
 */
function NameAndIcon({ draft, errors, onChange }) {
  const iconError = errors.get(DraftField.ICON) ?? null;
  return (
    <Section title="Name and icon">
      <Field
        label="Name"
        value={draft.name}
        error={errors.get(DraftField.NAME) ?? null}
        onChange={(name) => onChange(draft.copy({ name }))}
      />
      <div class="metric-form-icon-row">
        <MetricIcon icon={draft.icon.trim()} large />
        <p
          class={
            iconError != null
              ? 'metric-form-icon-text metric-form-error body-medium'
              : 'metric-form-icon-text body-medium'
          }
        >
          {iconError ?? 'Pick an emoji for the icon.'}
        </p>
      </div>
      <EmojiPicker selected={draft.icon.trim()} onPick={(icon) => onChange(draft.copy({ icon }))} />
    </Section>
  );
}

/** The help text of each kind. */
const kindHelp = new Map([
  [MetricKind.YES_NO, 'Yes/no: a tap marks the day as done or not done.'],
  [MetricKind.NUMBER, 'Number: a value with a ruler, for example a weight. The chart shows a line.'],
  [MetricKind.COUNT, 'Count: a tap adds the step. A right-click or a double-tap subtracts it. The chart shows bars.'],
]);

/**
 * The kind, the unit, the step and the group.
 * @param {object} props
 * @param {MetricDraft} props.draft
 * @param {Map<DraftField, string>} props.errors
 * @param {MetricKind | null} props.valueKind
 * @param {string[]} props.groups
 * @param {(draft: MetricDraft) => void} props.onChange
 * @returns {JSX.Element}
 */
function KindUnitAndGroup({ draft, errors, valueKind, groups, onChange }) {
  const isYesNo = draft.kind === MetricKind.YES_NO;
  return (
    <Section title="Kind, unit and group">
      <Choices label="Kind">
        {MetricKind.entries.map((kind) => (
          <FilterChip
            key={kind.name}
            label={kind.label}
            selected={draft.kind === kind}
            enabled={valueKind == null || canChangeKind(valueKind, kind, true)}
            onClick={() => onChange(draft.copy({ kind }))}
          />
        ))}
      </Choices>
      <Help text={kindHelp.get(draft.kind) ?? ''} />
      {valueKind != null && (
        <Help text="This metric has values, so it cannot change between yes/no and the other kinds." />
      )}
      {!isYesNo && (
        <div class="metric-form-pair metric-form-pair-unit">
          <Field label="Unit" value={draft.unit} onChange={(unit) => onChange(draft.copy({ unit }))} />
          <Field
            label="Step"
            value={draft.step}
            error={errors.get(DraftField.STEP) ?? null}
            isNumber
            onChange={(step) => onChange(draft.copy({ step }))}
          />
        </div>
      )}
      {/* The last field of a yes/no metric: its goal has no fields. */}
      <Field label="Group" value={draft.group} isLast={isYesNo} onChange={(group) => onChange(draft.copy({ group }))} />
      {groups.length > 0 && (
        <Choices label="Groups">
          {groups.map((group) => (
            <FilterChip
              key={group}
              label={groupLabel(group)}
              selected={draft.group.trim() === group}
              onClick={() => onChange(draft.copy({ group }))}
            />
          ))}
        </Choices>
      )}
    </Section>
  );
}

/**
 * The goal: yes or no for a yes/no metric. For the other kinds: the direction, the target, the start, the trend and
 * the points of the goal.
 * @param {object} props
 * @param {MetricDraft} props.draft
 * @param {Map<DraftField, string>} props.errors
 * @param {(draft: MetricDraft) => void} props.onChange
 * @returns {JSX.Element}
 */
function Goal({ draft, errors, onChange }) {
  const preview = draft.previewGoal();
  return (
    <Section title="Goal">
      {draft.kind === MetricKind.YES_NO ? (
        <>
          <Choices label="Goal">
            <FilterChip
              label="Goal yes: do it"
              selected={draft.goalIsYes}
              onClick={() => onChange(draft.copy({ goalIsYes: true }))}
            />
            <FilterChip
              label="Goal no: stop it"
              selected={!draft.goalIsYes}
              onClick={() => onChange(draft.copy({ goalIsYes: false }))}
            />
          </Choices>
          <Help text="A day without a value counts as no." />
        </>
      ) : (
        <>
          <Choices label="Direction">
            {GoalDirection.entries.map((direction) => (
              <FilterChip
                key={direction.name}
                label={direction.label}
                selected={draft.direction === direction}
                onClick={() => onChange(draft.copy({ direction }))}
              />
            ))}
          </Choices>
          <div class="metric-form-pair">
            <Field
              label="Target"
              value={draft.target}
              error={errors.get(DraftField.TARGET) ?? null}
              isNumber
              onChange={(target) => onChange(draft.copy({ target }))}
            />
            <Field
              label="Start (optional)"
              value={draft.start}
              error={errors.get(DraftField.START) ?? null}
              isNumber
              isLast
              onChange={(start) => onChange(draft.copy({ start }))}
            />
          </div>
          <Help text="The start gives 0 points. A value between the start and the target gives a part of 1 point." />
          <Trend draft={draft} onChange={onChange} />
          {preview != null && <GoalPreview goal={preview} unit={draft.unit.trim() || null} />}
        </>
      )}
      <Help text="A new goal also changes the score of past days." />
    </Section>
  );
}

/**
 * The trend checkbox. Only a number metric can use the trend. The highlight goes 8 px past the checkbox and the text,
 * and the checkbox stays aligned with the fields.
 * @param {object} props
 * @param {MetricDraft} props.draft
 * @param {(draft: MetricDraft) => void} props.onChange
 * @returns {JSX.Element}
 */
function Trend({ draft, onChange }) {
  const id = useId();
  const enabled = draft.kind === MetricKind.NUMBER;
  const checked = enabled && draft.usesTrend;
  return (
    <label class={enabled ? 'metric-form-trend' : 'metric-form-trend metric-form-trend-disabled'} style={outset(8, 4)}>
      <span class="metric-form-checkbox">
        <input
          type="checkbox"
          checked={checked}
          disabled={!enabled}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-help`}
          onChange={() => onChange(draft.copy({ usesTrend: !draft.usesTrend }))}
        />
        {checked && <Symbol name="check" size={18} />}
      </span>
      <span class="metric-form-trend-text">
        <span id={`${id}-label`} class="body-large">
          Use the trend
        </span>
        <span id={`${id}-help`} class="metric-form-help body-small">
          {enabled
            ? 'The points come from the trend of the values, not from the value of the day.'
            : 'Only for a number metric.'}
        </span>
      </span>
    </label>
  );
}

/**
 * The goal text as in the sheet, a chart of the points of each value, and 3 examples.
 * @param {object} props
 * @param {NumberGoal} props.goal
 * @param {string | null} props.unit
 * @returns {JSX.Element}
 */
function GoalPreview({ goal, unit }) {
  const examples = goalExamples(goal, unit);
  return (
    <div class="metric-form-preview">
      <p class="body-medium">In the sheet: {goalText(goal)}</p>
      <PointsChart goal={goal} description={examples.join('. ')} />
      {examples.map((example) => (
        <p key={example} class="body-medium">
          • {example}
        </p>
      ))}
    </div>
  );
}

/** The width of the coordinates of {@link PointsChart}. The chart stretches them to its width. */
const CHART_WIDTH = 1000;

/** The height of {@link PointsChart}, in CSS pixels. */
const CHART_HEIGHT = 96;

/** The number of steps of the line of {@link PointsChart}. */
const SAMPLES = 120;

/**
 * A line of the points of each value, from 0 (bottom) to 1 (top), with a dashed line at the target. The values go from
 * a little before the start to a little after the target. Without a start, around the target.
 * @param {object} props
 * @param {NumberGoal} props.goal
 * @param {string} props.description The text for screen readers and the tooltip: the examples.
 * @returns {JSX.Element}
 */
function PointsChart({ goal, description }) {
  const start = goal.start;
  let low;
  let high;
  if (start != null) {
    const pad = Math.abs(goal.target - start) / 4;
    low = Math.min(start, goal.target) - pad;
    high = Math.max(start, goal.target) + pad;
  } else {
    const span = Math.max(Math.abs(goal.target) / 2, 1);
    low = goal.target - span;
    high = goal.target + span;
  }
  /**
   * @param {number} value
   * @returns {number}
   */
  const x = (value) => ((value - low) / (high - low)) * CHART_WIDTH;
  /**
   * @param {number} points
   * @returns {number}
   */
  const y = (points) => (1 - points) * (CHART_HEIGHT - 8) + 4;
  const line = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const value = low + ((high - low) * i) / SAMPLES;
    return `${i === 0 ? 'M' : 'L'}${x(value)} ${y(goal.points(value))}`;
  }).join(' ');
  return (
    <svg
      class="metric-form-chart"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      <line class="metric-form-chart-grid" x1={0} y1={y(0)} x2={CHART_WIDTH} y2={y(0)} />
      <line class="metric-form-chart-grid metric-form-chart-dash" x1={0} y1={y(1)} x2={CHART_WIDTH} y2={y(1)} />
      <line
        class="metric-form-chart-grid metric-form-chart-dash"
        x1={x(goal.target)}
        y1={0}
        x2={x(goal.target)}
        y2={CHART_HEIGHT}
      />
      <path class="metric-form-chart-line" d={line} />
    </svg>
  );
}

/**
 * A card with a `title` and its fields.
 * @param {object} props
 * @param {string} props.title
 * @param {ComponentChildren} props.children
 * @returns {JSX.Element}
 */
function Section({ title, children }) {
  return (
    <AppCard class="metric-form-section">
      <h3 class="metric-form-section-title title-medium">{title}</h3>
      {children}
    </AppCard>
  );
}

/**
 * An outlined text field with a `label`, and its `error` below it. `isNumber` shows the number keyboard on a phone.
 * The Enter key goes to the next field. On the last field (`isLast`), it closes the keyboard.
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.value
 * @param {string | null} [props.error] Null: no error.
 * @param {boolean} [props.isNumber] Default: false.
 * @param {boolean} [props.isLast] Default: false.
 * @param {(value: string) => void} props.onChange
 * @returns {JSX.Element}
 */
function Field({ label, value, error = null, isNumber = false, isLast = false, onChange }) {
  const id = useId();
  const input = useRef(/** @type {HTMLInputElement | null} */ (null));

  /** @param {JSX.TargetedKeyboardEvent<HTMLInputElement>} event */
  function onKeyDown(event) {
    if (event.key !== 'Enter' || input.current == null) return;
    event.preventDefault();
    if (isLast) {
      input.current.blur();
      return;
    }
    const fields = [...(input.current.closest('.metric-form')?.querySelectorAll('input[type="text"]') ?? [])];
    const next = fields[fields.indexOf(input.current) + 1];
    if (next instanceof HTMLElement) next.focus();
  }

  return (
    <div
      class={error != null ? 'field label border metric-form-field invalid' : 'field label border metric-form-field'}
    >
      <input
        ref={input}
        id={id}
        type="text"
        inputMode={isNumber ? 'decimal' : 'text'}
        enterKeyHint={isLast ? 'done' : 'next'}
        autoComplete="off"
        // BeerCSS moves the label to the border when the placeholder does not show: when the field has a value.
        placeholder=" "
        value={value}
        aria-invalid={error != null}
        aria-describedby={error != null ? `${id}-error` : undefined}
        onInput={(event) => onChange(event.currentTarget.value)}
        onKeyDown={onKeyDown}
      />
      <label for={id}>{label}</label>
      {error != null && (
        <output id={`${id}-error`} class="invalid">
          {error}
        </output>
      )}
    </div>
  );
}

/**
 * A row of choice chips that wraps to more lines. `label` is the name of the group for screen readers.
 * @param {object} props
 * @param {string} props.label
 * @param {ComponentChildren} props.children
 * @returns {JSX.Element}
 */
function Choices({ label, children }) {
  return (
    <div class="metric-form-choices" role="group" aria-label={label}>
      {children}
    </div>
  );
}

/**
 * A short help text below a field.
 * @param {object} props
 * @param {string} props.text
 * @returns {JSX.Element}
 */
function Help({ text }) {
  return <p class="metric-form-help body-small">{text}</p>;
}

/**
 * A Material 3 alert dialog: a modal dialog with a `title`, a `text`, and two buttons at the end. The
 * confirm button is the last one, in the error color. Escape and a click out of the dialog call `onDismiss`.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.text
 * @param {string} props.confirm The text of the confirm button.
 * @param {string} props.dismiss The text of the dismiss button.
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onDismiss
 * @returns {JSX.Element}
 */
function AlertDialog({ title, text, confirm, dismiss, onConfirm, onDismiss }) {
  const dialog = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const id = useId();
  useLayoutEffect(() => {
    const element = dialog.current;
    if (element != null && !element.open) element.showModal();
    // The browser puts the focus back on the button that opened the dialog.
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      class="alert-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-text`}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClick={(event) => {
        // A click on the backdrop: the target is the dialog, not its content.
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div class="alert-dialog-content">
        <h2 id={`${id}-title`} class="alert-dialog-title headline-small">
          {title}
        </h2>
        <p id={`${id}-text`} class="alert-dialog-text body-medium">
          {text}
        </p>
        <div class="alert-dialog-buttons">
          <button type="button" class="metric-form-text-button label-large" onClick={onDismiss}>
            {dismiss}
          </button>
          <button type="button" class="metric-form-text-button metric-form-error label-large" onClick={onConfirm}>
            {confirm}
          </button>
        </div>
      </div>
    </dialog>
  );
}
