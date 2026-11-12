package trackula.model

/** The kind of a metric in the metrics form. [cell] is the text of the `kind` cell. */
enum class MetricKind(val label: String, val cell: String) {
    YES_NO("Yes/no", "yesno"),
    NUMBER("Number", "number"),
    COUNT("Count", "count"),
}

/** The kind of [metric] in the metrics form. */
fun kindOf(metric: Metric): MetricKind = when {
    metric is YesNoMetric -> MetricKind.YES_NO
    metric is NumberMetric && metric.isCount -> MetricKind.COUNT
    else -> MetricKind.NUMBER
}

/**
 * True if a metric of kind [from] can change to the kind [to]. A metric with values ([hasValues]) cannot change
 * between `yesno` and the other kinds: its values would become invalid. `number` and `count` use the same values.
 */
fun canChangeKind(from: MetricKind, to: MetricKind, hasValues: Boolean): Boolean =
    !hasValues || (from == MetricKind.YES_NO) == (to == MetricKind.YES_NO)

/** The goal direction of a `number` or `count` metric in the metrics form. */
enum class GoalDirection(val label: String) {
    AT_LEAST("At least"),
    AT_MOST("At most"),
}

/** The fields of the metrics form that can show an error. */
enum class DraftField { NAME, ICON, STEP, TARGET, START }

/** A Material Symbols name: lowercase letters, digits and `_`. */
private val symbolName = Regex("^[a-z0-9_]+$")

/** A number of a goal, as the user types it: an optional minus sign, and a period or a comma for decimals. */
private val goalNumber = Regex("""^-?\d+([.,]\d+)?$""")

/**
 * The values of the metrics form, as text, as the user types them. [check] makes the metric.
 *
 * @property goalIsYes True if the goal of a `yesno` metric is `yes`. False for a habit to stop, for example smoking.
 * @property start The value of 0 points of a number goal. Empty: no start. See [NumberGoal.from].
 * @property usesTrend True if the points of a `number` metric come from the trend. See [NumberGoal.usesTrend].
 */
data class MetricDraft(
    val name: String = "",
    val icon: String = "",
    val kind: MetricKind = MetricKind.YES_NO,
    val unit: String = "",
    val step: String = "1",
    val group: String = "",
    val goalIsYes: Boolean = true,
    val direction: GoalDirection = GoalDirection.AT_LEAST,
    val target: String = "",
    val start: String = "",
    val usesTrend: Boolean = false,
) {
    /**
     * The metric of the form with the id [id], or an error for each field that is not valid. The parser of the sheet
     * also checks the metric, so that the app writes only rows that it can read.
     *
     * Example: the name "Water", the icon `water_drop`, the kind count and the goal at least 8 give the metric Water
     * with the goal `at least 8`. An empty target gives the error "Enter a number." for [DraftField.TARGET].
     */
    fun check(id: String): DraftCheck {
        val errors = mutableMapOf<DraftField, String>()
        if (name.isBlank()) errors[DraftField.NAME] = "Enter a name."
        val iconText = icon.trim()
        if (iconText.isEmpty()) {
            errors[DraftField.ICON] = "Enter an icon: a Material Symbols name or an emoji."
        } else if (!symbolName.matches(iconText) && iconText.length > 16) {
            errors[DraftField.ICON] = "Use a Material Symbols name in lowercase, such as water_drop, or one emoji."
        }
        val isNumber = kind != MetricKind.YES_NO
        val stepValue = if (isNumber) parseDecimal(step)?.takeIf { it > 0 } else 1.0
        if (stepValue == null) errors[DraftField.STEP] = "Enter a number above 0."
        val goal = when {
            isNumber -> numberGoal(errors)
            goalIsYes -> "yes"
            else -> "no"
        }
        if (errors.isNotEmpty()) return DraftCheck(null, errors)

        val cells = mapOf(
            "name" to name.trim(),
            "kind" to kind.cell,
            "unit" to if (isNumber) unit.trim() else "",
            "step" to if (isNumber && stepValue != null) stepValue else "",
            "group" to group.trim(),
            "icon" to iconText,
            "goal" to goal,
        )
        return try {
            DraftCheck(parseMetricRow(id, cells), emptyMap())
        } catch (e: InvalidMetricException) {
            DraftCheck(null, mapOf(DraftField.TARGET to e.message.orEmpty()))
        }
    }

    /**
     * The number goal of the form, for the preview of its points. Null for a `yesno` metric, or if the target or the
     * start is not valid.
     */
    fun previewGoal(): NumberGoal? {
        if (kind == MetricKind.YES_NO) return null
        val targetValue = numberOf(target) ?: return null
        val from = if (start.isBlank()) null else numberOf(start) ?: return null
        val trend = usesTrend && kind == MetricKind.NUMBER
        val goal = NumberGoal(targetValue, direction == GoalDirection.AT_MOST, from, trend)
        return if (from != null && goal.isReachedBy(from)) null else goal
    }

    /** The text of the goal cell of a `number` or `count` metric. Adds an error to [errors] for each invalid field. */
    private fun numberGoal(errors: MutableMap<DraftField, String>): String {
        val targetValue = numberOf(target)
        if (targetValue == null) errors[DraftField.TARGET] = "Enter a number."
        val from = if (start.isBlank()) null else numberOf(start)
        if (start.isNotBlank() && from == null) errors[DraftField.START] = "Enter a number, or leave it empty."
        if (targetValue == null || errors.containsKey(DraftField.START)) return ""
        val trend = usesTrend && kind == MetricKind.NUMBER
        val goal = NumberGoal(targetValue, direction == GoalDirection.AT_MOST, from, trend)
        if (from != null && goal.isReachedBy(from)) {
            val side = if (goal.isMaximum) "above" else "below"
            errors[DraftField.START] = "The start must be $side the target."
        }
        return goalText(goal)
    }

    private fun numberOf(text: String): Double? {
        val t = text.trim()
        return if (goalNumber.matches(t)) t.replace(',', '.').toDouble() else null
    }
}

/** The result of [MetricDraft.check]: the metric, or else an error for each field that is not valid. */
data class DraftCheck(val metric: Metric?, val errors: Map<DraftField, String>)

/** The form values of [metric], to change it. */
fun draftOf(metric: Metric): MetricDraft {
    val base = MetricDraft(
        name = metric.name,
        icon = metric.icon,
        kind = kindOf(metric),
        group = metric.group.orEmpty(),
    )
    return when (metric) {
        is YesNoMetric -> base.copy(goalIsYes = metric.goalIsYes)

        is NumberMetric -> {
            val goal = metric.goal
            base.copy(
                unit = metric.unit.orEmpty(),
                step = formatTrimmed(metric.step),
                direction = if (goal.isMaximum) GoalDirection.AT_MOST else GoalDirection.AT_LEAST,
                target = formatTrimmed(goal.target),
                start = goal.from?.let(::formatTrimmed).orEmpty(),
                usesTrend = goal.usesTrend,
            )
        }
    }
}

/**
 * The form values of the invalid row [row], to fix it. The values that the app can read go in their fields. A goal
 * that the app cannot read goes in the target field, so that the form shows the error. A `number` or `count` row
 * without a goal gets an empty target, so that Save asks for one. A `yesno` row without a goal gets `yes`.
 */
fun draftOf(row: InvalidMetricRow): MetricDraft {
    fun text(name: String) = cellText(row.cells[name]).trim()
    val kind = MetricKind.entries.firstOrNull { it.cell == text("kind").lowercase() } ?: MetricKind.YES_NO
    val goalCell = row.cells["goal"]
    // The goal alone, in a row that is valid apart from the goal.
    val goal = try {
        parseMetricRow("x", mapOf("kind" to kind.cell, "icon" to "x", "goal" to goalCell))
    } catch (_: InvalidMetricException) {
        null
    }
    val base = goal?.let { draftOf(it) } ?: MetricDraft(kind = kind, target = text("goal"))
    return base.copy(
        name = text("name"),
        icon = text("icon"),
        unit = text("unit"),
        step = text("step").ifEmpty { "1" },
        group = text("group"),
    )
}

/**
 * The form values of the deleted metric [deleted], to restore it. The name comes from the id: `morning_teeth` gives
 * "Morning teeth". The kind is `yesno` if all values are `yes` or `no`, else `number`. The target is empty: the user
 * must enter the goal.
 */
fun draftOf(deleted: DeletedMetric): MetricDraft = MetricDraft(
    name = deleted.id.replace('_', ' ').replace('-', ' ').replaceFirstChar { it.uppercaseChar() },
    kind = if (deleted.isYesNo) MetricKind.YES_NO else MetricKind.NUMBER,
)

/**
 * The kind, the unit and the group of [metric] for the metrics list, with " · " between them. Examples:
 * "Number · kg · Health", "Yes/no".
 */
fun metricSummary(metric: Metric): String {
    val unit = (metric as? NumberMetric)?.unit
    return listOfNotNull(kindOf(metric).label, unit, metric.group).joinToString(" · ")
}

/** The goal of [metric] as in the `goal` cell, for the metrics list. Examples: "at least 8", "yes". */
fun goalSummary(metric: Metric): String = when (metric) {
    is YesNoMetric -> if (metric.goalIsYes) "yes" else "no"
    is NumberMetric -> goalText(metric.goal)
}

/**
 * Examples of the points of [goal], for the metrics form. [unit] goes after each value. Examples for `at least 8`
 * (from 0) with the unit glasses: "8 glasses or more: 1 point", "4 glasses: 0.5 points", "0 glasses: 0 points".
 */
fun goalExamples(goal: NumberGoal, unit: String?): List<String> {
    fun value(x: Double) = withUnit(formatNumber(x, 2), unit)
    val reached = "${value(goal.target)} or ${if (goal.isMaximum) "less" else "more"}: 1 point"
    val start = goal.start ?: return listOf(reached, "Other values: 0 points")
    val middle = (start + goal.target) / 2
    return listOf(reached, "${value(middle)}: 0.5 points", "${value(start)}: 0 points")
}

/**
 * The values of the deleted metric [deleted], for the metrics list. Examples: "142 values · last on Oct 30",
 * "No values".
 */
fun deletedSummary(deleted: DeletedMetric): String {
    val count = when (deleted.values) {
        0 -> return "No values"
        1 -> "1 value"
        else -> "${deleted.values} values"
    }
    return deleted.lastDay?.let { "$count · last on ${shortDay(it)}" } ?: count
}
