// The values of the metrics form, their checks, and the summaries of the metrics list.
import { formatNumber, formatTrimmed, shortDay, withUnit } from './Format.js';
import { NumberGoal, NumberMetric, YesNoMetric } from './Metric.js';
import { goalText } from './MetricCells.js';
import { InvalidMetricRow } from './MetricsTable.js';
import { parseDecimal } from './NumberInput.js';
import { InvalidMetricException, cellText, parseMetricRow } from './Parse.js';

/** @import { DeletedMetric } from './DeletedMetric.js' */
/** @import { Metric } from './Metric.js' */
/** @import { Cell } from './Parse.js' */

/** The kind of a metric in the metrics form. */
export class MetricKind {
  /**
   * @param {string} name The name, as the Kotlin enum. Example: `YES_NO`.
   * @param {string} label
   * @param {string} cell The text of the `kind` cell.
   */
  constructor(name, label, cell) {
    this.name = name;
    this.label = label;
    this.cell = cell;
    Object.freeze(this);
  }

  static YES_NO = new MetricKind('YES_NO', 'Yes/no', 'yesno');
  static NUMBER = new MetricKind('NUMBER', 'Number', 'number');
  static COUNT = new MetricKind('COUNT', 'Count', 'count');

  /** All kinds, in the order of the metrics form. */
  static entries = [MetricKind.YES_NO, MetricKind.NUMBER, MetricKind.COUNT];
}

/**
 * The kind of `metric` in the metrics form.
 * @param {Metric} metric
 * @returns {MetricKind}
 */
export function kindOf(metric) {
  if (metric instanceof YesNoMetric) return MetricKind.YES_NO;
  return metric.isCount ? MetricKind.COUNT : MetricKind.NUMBER;
}

/**
 * True if a metric of kind `from` can change to the kind `to`. A metric with values (`hasValues`) cannot change
 * between `yesno` and the other kinds: its values would become invalid. `number` and `count` use the same values.
 * @param {MetricKind} from
 * @param {MetricKind} to
 * @param {boolean} hasValues
 * @returns {boolean}
 */
export function canChangeKind(from, to, hasValues) {
  return !hasValues || (from === MetricKind.YES_NO) === (to === MetricKind.YES_NO);
}

/** The goal direction of a `number` or `count` metric in the metrics form. */
export class GoalDirection {
  /**
   * @param {string} name The name, as the Kotlin enum. Example: `AT_LEAST`.
   * @param {string} label
   */
  constructor(name, label) {
    this.name = name;
    this.label = label;
    Object.freeze(this);
  }

  static AT_LEAST = new GoalDirection('AT_LEAST', 'At least');
  static AT_MOST = new GoalDirection('AT_MOST', 'At most');

  /** All directions, in the order of the metrics form. */
  static entries = [GoalDirection.AT_LEAST, GoalDirection.AT_MOST];
}

/**
 * The fields of the metrics form that can show an error.
 * @typedef {'NAME' | 'ICON' | 'STEP' | 'TARGET' | 'START'} DraftField
 */

/** The fields of the metrics form that can show an error. */
export const DraftField = Object.freeze({
  NAME: 'NAME',
  ICON: 'ICON',
  STEP: 'STEP',
  TARGET: 'TARGET',
  START: 'START',
});

/** A Material Symbols name: lowercase letters, digits and `_`. */
const symbolName = /^[a-z0-9_]+$/;

/** A number of a goal, as the user types it: an optional minus sign, and a period or a comma for decimals. */
const goalNumber = /^-?\d+([.,]\d+)?$/;

/**
 * The fields of a {@link MetricDraft}. Each field is optional.
 * @typedef {object} MetricDraftFields
 * @property {string} [name] Empty by default.
 * @property {string} [icon] Empty by default.
 * @property {MetricKind} [kind] `YES_NO` by default.
 * @property {string} [unit] Empty by default.
 * @property {string} [step] "1" by default.
 * @property {string} [group] Empty by default.
 * @property {boolean} [goalIsYes] True by default.
 * @property {GoalDirection} [direction] `AT_LEAST` by default.
 * @property {string} [target] Empty by default.
 * @property {string} [start] Empty by default.
 * @property {boolean} [usesTrend] False by default.
 */

/**
 * The result of {@link MetricDraft#check}: the metric, or else an error for each field that is not valid.
 * @typedef {object} DraftCheck
 * @property {Metric | null} metric
 * @property {Map<DraftField, string>} errors
 */

/** The values of the metrics form, as text, as the user types them. {@link MetricDraft#check} makes the metric. */
export class MetricDraft {
  /** @param {MetricDraftFields} [fields] */
  constructor({
    name = '',
    icon = '',
    kind = MetricKind.YES_NO,
    unit = '',
    step = '1',
    group = '',
    goalIsYes = true,
    direction = GoalDirection.AT_LEAST,
    target = '',
    start = '',
    usesTrend = false,
  } = {}) {
    this.name = name;
    this.icon = icon;
    this.kind = kind;
    this.unit = unit;
    this.step = step;
    this.group = group;
    /** True if the goal of a `yesno` metric is `yes`. False for a habit to stop, for example smoking. */
    this.goalIsYes = goalIsYes;
    this.direction = direction;
    this.target = target;
    /** The value of 0 points of a number goal. Empty: no start. See `NumberGoal.from`. */
    this.start = start;
    /** True if the points of a `number` metric come from the trend. See `NumberGoal.usesTrend`. */
    this.usesTrend = usesTrend;
    Object.freeze(this);
  }

  /**
   * A copy of this draft with other values in `changes`.
   * @param {MetricDraftFields} changes
   * @returns {MetricDraft}
   */
  copy(changes) {
    return new MetricDraft({ ...this, ...changes });
  }

  /**
   * The metric of the form with the id `id`, or an error for each field that is not valid. The parser of the sheet
   * also checks the metric, so that the app writes only rows that it can read.
   *
   * Example: the name "Water", the icon `water_drop`, the kind count and the goal at least 8 give the metric Water
   * with the goal `at least 8`. An empty target gives the error "Enter a number." for `DraftField.TARGET`.
   * @param {string} id
   * @returns {DraftCheck}
   */
  check(id) {
    /** @type {Map<DraftField, string>} */
    const errors = new Map();
    if (this.name.trim() === '') errors.set(DraftField.NAME, 'Enter a name.');
    const iconText = this.icon.trim();
    if (iconText === '') {
      errors.set(DraftField.ICON, 'Pick an icon.');
    } else if (!symbolName.test(iconText) && iconText.length > 16) {
      errors.set(DraftField.ICON, 'The icon in the sheet is too long. Pick an icon.');
    }
    const isNumber = this.kind !== MetricKind.YES_NO;
    const parsedStep = isNumber ? parseDecimal(this.step) : 1;
    const stepValue = parsedStep !== null && parsedStep > 0 ? parsedStep : null;
    if (stepValue === null) errors.set(DraftField.STEP, 'Enter a number above 0.');
    let goal;
    if (isNumber) goal = numberGoal(this, errors);
    else goal = this.goalIsYes ? 'yes' : 'no';
    if (errors.size > 0) return { metric: null, errors };

    /** @type {Map<string, Cell>} */
    const cells = new Map([
      ['name', this.name.trim()],
      ['kind', this.kind.cell],
      ['unit', isNumber ? this.unit.trim() : ''],
      ['step', isNumber && stepValue !== null ? stepValue : ''],
      ['group', this.group.trim()],
      ['icon', iconText],
      ['goal', goal],
    ]);
    try {
      return { metric: parseMetricRow(id, cells), errors: new Map() };
    } catch (e) {
      if (!(e instanceof InvalidMetricException)) throw e;
      return { metric: null, errors: new Map([[DraftField.TARGET, e.message]]) };
    }
  }

  /**
   * The number goal of the form, for the preview of its points. Null for a `yesno` metric, or if the target or the
   * start is not valid.
   * @returns {NumberGoal | null}
   */
  previewGoal() {
    if (this.kind === MetricKind.YES_NO) return null;
    const targetValue = goalNumberOf(this.target);
    if (targetValue === null) return null;
    let from = null;
    if (this.start.trim() !== '') {
      from = goalNumberOf(this.start);
      if (from === null) return null;
    }
    const goal = new NumberGoal({
      target: targetValue,
      isMaximum: this.direction === GoalDirection.AT_MOST,
      from,
      usesTrend: this.usesTrend && this.kind === MetricKind.NUMBER,
    });
    return from !== null && goal.isReachedBy(from) ? null : goal;
  }
}

/**
 * The text of the goal cell of the `number` or `count` metric of `draft`. Adds an error to `errors` for each invalid
 * field.
 * @param {MetricDraft} draft
 * @param {Map<DraftField, string>} errors
 * @returns {string}
 */
function numberGoal(draft, errors) {
  const targetValue = goalNumberOf(draft.target);
  if (targetValue === null) errors.set(DraftField.TARGET, 'Enter a number.');
  const hasStart = draft.start.trim() !== '';
  const from = hasStart ? goalNumberOf(draft.start) : null;
  if (hasStart && from === null) errors.set(DraftField.START, 'Enter a number, or leave it empty.');
  if (targetValue === null || errors.has(DraftField.START)) return '';
  const goal = new NumberGoal({
    target: targetValue,
    isMaximum: draft.direction === GoalDirection.AT_MOST,
    from,
    usesTrend: draft.usesTrend && draft.kind === MetricKind.NUMBER,
  });
  if (from !== null && goal.isReachedBy(from)) {
    const side = goal.isMaximum ? 'above' : 'below';
    errors.set(DraftField.START, `The start must be ${side} the target.`);
  }
  return goalText(goal);
}

/**
 * The number in `text`, as the user types a number of a goal. Null if `text` is not such a number.
 * @param {string} text
 * @returns {number | null}
 */
function goalNumberOf(text) {
  const t = text.trim();
  return goalNumber.test(t) ? Number(t.replace(',', '.')) : null;
}

/**
 * The form values of `source`, to change it, to fix it or to restore it:
 *
 * - A {@link Metric}: its values, to change it.
 * - An {@link InvalidMetricRow}: the values that the app can read go in their fields. A goal that the app cannot read
 *   goes in the target field, so that the form shows the error. A `number` or `count` row without a goal gets an empty
 *   target, so that Save asks for one. A `yesno` row without a goal gets `yes`.
 * - A {@link DeletedMetric}: the name comes from the id: `morning_teeth` gives "Morning teeth". The kind is `yesno` if
 *   all values are `yes` or `no`, else `number`. The target is empty: the user must enter the goal.
 * @param {Metric | InvalidMetricRow | DeletedMetric} source
 * @returns {MetricDraft}
 */
export function draftOf(source) {
  if (source instanceof YesNoMetric || source instanceof NumberMetric) return draftOfMetric(source);
  if (source instanceof InvalidMetricRow) return draftOfRow(source);
  return draftOfDeleted(source);
}

/**
 * The form values of `metric`, to change it.
 * @param {Metric} metric
 * @returns {MetricDraft}
 */
function draftOfMetric(metric) {
  const base = new MetricDraft({
    name: metric.name,
    icon: metric.icon,
    kind: kindOf(metric),
    group: metric.group ?? '',
  });
  if (metric instanceof YesNoMetric) return base.copy({ goalIsYes: metric.goalIsYes });
  const goal = metric.goal;
  return base.copy({
    unit: metric.unit ?? '',
    step: formatTrimmed(metric.step),
    direction: goal.isMaximum ? GoalDirection.AT_MOST : GoalDirection.AT_LEAST,
    target: formatTrimmed(goal.target),
    start: goal.from === null ? '' : formatTrimmed(goal.from),
    usesTrend: goal.usesTrend,
  });
}

/**
 * The form values of the invalid row `row`, to fix it. See {@link draftOf}.
 * @param {InvalidMetricRow} row
 * @returns {MetricDraft}
 */
function draftOfRow(row) {
  /**
   * @param {string} name
   * @returns {string} The trimmed text of the cell in column `name`.
   */
  const text = (name) => cellText(row.cells.get(name) ?? null).trim();
  const kind = MetricKind.entries.find((k) => k.cell === text('kind').toLowerCase()) ?? MetricKind.YES_NO;
  const goalCell = row.cells.get('goal') ?? null;
  // The goal alone, in a row that is valid apart from the goal.
  let goal = null;
  try {
    goal = parseMetricRow(
      'x',
      new Map([
        ['kind', kind.cell],
        ['icon', 'x'],
        ['goal', goalCell],
      ]),
    );
  } catch (e) {
    if (!(e instanceof InvalidMetricException)) throw e;
  }
  const base = goal === null ? new MetricDraft({ kind, target: text('goal') }) : draftOfMetric(goal);
  return base.copy({
    name: text('name'),
    icon: text('icon'),
    unit: text('unit'),
    step: text('step') || '1',
    group: text('group'),
  });
}

/**
 * The form values of the deleted metric `deleted`, to restore it. See {@link draftOf}.
 * @param {DeletedMetric} deleted
 * @returns {MetricDraft}
 */
function draftOfDeleted(deleted) {
  const name = deleted.id.replaceAll('_', ' ').replaceAll('-', ' ');
  return new MetricDraft({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    kind: deleted.isYesNo ? MetricKind.YES_NO : MetricKind.NUMBER,
  });
}

/**
 * The kind, the unit and the group of `metric` for the metrics list, with " · " between them. Examples:
 * "Number · kg · Health", "Yes/no".
 * @param {Metric} metric
 * @returns {string}
 */
export function metricSummary(metric) {
  const unit = metric instanceof NumberMetric ? metric.unit : null;
  return [kindOf(metric).label, unit, metric.group].filter((part) => part !== null).join(' · ');
}

/**
 * The goal of `metric` as in the `goal` cell, for the metrics list. Examples: "at least 8", "yes".
 * @param {Metric} metric
 * @returns {string}
 */
export function goalSummary(metric) {
  if (metric instanceof YesNoMetric) return metric.goalIsYes ? 'yes' : 'no';
  return goalText(metric.goal);
}

/**
 * Examples of the points of `goal`, for the metrics form. `unit` goes after each value. Examples for `at least 8`
 * (from 0) with the unit glasses: "8 glasses or more: 1 point", "4 glasses: 0.5 points", "0 glasses: 0 points".
 * @param {NumberGoal} goal
 * @param {string | null} unit
 * @returns {string[]}
 */
export function goalExamples(goal, unit) {
  /**
   * @param {number} x
   * @returns {string} The value with 2 decimals at most, and the unit.
   */
  const value = (x) => withUnit(formatNumber(x, 2), unit);
  const reached = `${value(goal.target)} or ${goal.isMaximum ? 'less' : 'more'}: 1 point`;
  const start = goal.start;
  if (start === null) return [reached, 'Other values: 0 points'];
  const middle = (start + goal.target) / 2;
  return [reached, `${value(middle)}: 0.5 points`, `${value(start)}: 0 points`];
}

/**
 * The values of the deleted metric `deleted`, for the metrics list. Examples: "142 values · last on Oct 30", "No
 * values".
 * @param {DeletedMetric} deleted
 * @returns {string}
 */
export function deletedSummary(deleted) {
  if (deleted.values === 0) return 'No values';
  const count = deleted.values === 1 ? '1 value' : `${deleted.values} values`;
  return deleted.lastDay === null ? count : `${count} · last on ${shortDay(deleted.lastDay)}`;
}
