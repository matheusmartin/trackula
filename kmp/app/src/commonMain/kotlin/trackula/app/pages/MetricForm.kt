package trackula.app.pages

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import trackula.app.LocalPageScroll
import trackula.app.OnBack
import trackula.app.components.AppCard
import trackula.app.components.AppIconButton
import trackula.app.components.FORM_WIDTH
import trackula.app.components.MetricIcon
import trackula.app.components.Notice
import trackula.app.components.NoticeKind
import trackula.app.components.PrimaryButton
import trackula.app.components.Symbol
import trackula.app.components.TOUCH_TARGET
import trackula.app.components.groupLabel
import trackula.app.components.outset
import trackula.model.DraftField
import trackula.model.GoalDirection
import trackula.model.Metric
import trackula.model.MetricDraft
import trackula.model.MetricKind
import trackula.model.NumberGoal
import trackula.model.canChangeKind
import trackula.model.goalExamples
import trackula.model.goalText
import trackula.model.newMetricId
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** Material Symbols icons that the form suggests. The user can type any other name, or an emoji. */
private val suggestedIcons = listOf(
    "water_drop", "local_drink", "coffee", "restaurant", "nutrition", "pill",
    "monitor_weight", "fitness_center", "directions_walk", "directions_run", "self_improvement", "menu_book",
    "bedtime", "shower", "dentistry", "smoking_rooms", "spa", "favorite",
    "mood", "savings", "school", "code", "music_note", "straighten",
)

/**
 * What the metrics form shows.
 *
 * @property title The title of the form. Example: "Edit metric".
 * @property initial The values of the form when it opens.
 * @property id The id of the metric. Null for a new metric: the app makes the id from the name, see [newMetricId].
 * @property valueKind The kind of the values in the `Log` column of the metric. Null if the column has no values. The
 *   kind cannot change between `yesno` and the other kinds, see [canChangeKind].
 * @property note A text above the fields, for example the problem of an invalid row. Null: no text.
 * @property deleteQuestion The question of the delete dialog. Null: the form has no delete button.
 * @property deleteLabel The text of the delete button.
 */
internal data class FormSetup(
    val title: String,
    val initial: MetricDraft,
    val id: String? = null,
    val valueKind: MetricKind? = null,
    val note: String? = null,
    val deleteQuestion: String? = null,
    val deleteLabel: String = "Delete metric",
)

/**
 * The form of one metric, on its own page: the name and the icon, the kind, the unit, the step, the group and the goal.
 * Save checks the values (see [MetricDraft.check]) and calls [onSave] with the metric. The errors show below the
 * fields after the first Save, and a text above the Save button names the fields with errors. Wide screens: the form
 * is at most [FORM_WIDTH] wide and centered.
 *
 * The buttons at the end: Save, Cancel, then Delete, apart from the others. Close and Cancel ask before they discard
 * a changed form.
 *
 * - [takenIds]: the ids that a new metric must not get. See [newMetricId].
 * - [groups]: the groups of the other metrics. A tap on a group chip sets the group.
 * - [busy]: true while data loads or saves. Save and Delete are disabled.
 * - [error]: the error of the last write, or null.
 * - [onDelete]: deletes the metric or the row, after the user confirms the [FormSetup.deleteQuestion].
 * - [onClose]: closes the form without a save.
 */
@Composable
internal fun MetricForm(
    setup: FormSetup,
    takenIds: Set<String>,
    groups: List<String>,
    busy: Boolean,
    error: String?,
    onSave: (Metric) -> Unit,
    onDelete: () -> Unit,
    onClose: () -> Unit,
) {
    var draft by remember(setup) { mutableStateOf(setup.initial) }
    // True after the first Save: then each field shows its error, and the errors follow each change.
    var tried by remember(setup) { mutableStateOf(false) }
    var confirmsDelete by remember(setup) { mutableStateOf(false) }
    var confirmsDiscard by remember(setup) { mutableStateOf(false) }
    val id = setup.id ?: newMetricId(draft.name, takenIds)
    val errors = if (tried) draft.check(id).errors else emptyMap()

    // Closes the form. A changed form asks first.
    fun close() {
        if (draft == setup.initial) onClose() else confirmsDiscard = true
    }

    // The Back button of the browser closes the form, as its close button does.
    OnBack { close() }
    // The form takes the place of the list: it starts at the top, also when the list was scrolled.
    val scroll = LocalPageScroll.current
    LaunchedEffect(scroll) { scroll?.scrollTo(0) }

    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = FORM_WIDTH).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AppIconButton(icon = "close", title = "Close without saving", onClick = ::close)
                Text(
                    setup.title,
                    modifier = Modifier.padding(start = 4.dp).semantics { heading() },
                    style = MaterialTheme.typography.headlineSmall,
                )
            }
            setup.note?.let { Notice(it, kind = NoticeKind.ERROR) }

            NameAndIcon(draft, errors) { draft = it }
            KindUnitAndGroup(draft, errors, setup.valueKind, groups) { draft = it }
            Goal(draft, errors) { draft = it }

            Column(Modifier.padding(horizontal = 4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Sheet column: $id", style = MaterialTheme.typography.bodyMedium)
                Help(
                    if (setup.id == null) {
                        "The app makes it from the name. It does not change after you save."
                    } else {
                        "It does not change."
                    },
                )
            }

            // The fields with errors can be out of view: this text is next to the Save button.
            if (errors.isNotEmpty()) Notice(errorSummary(errors.keys), kind = NoticeKind.ERROR)
            error?.let { Notice(it, kind = NoticeKind.ERROR) }
            PrimaryButton(
                text = if (busy) "Saving…" else "Save",
                onClick = {
                    tried = true
                    draft.check(id).metric?.let(onSave)
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !busy,
            )
            TextButton(onClick = ::close, modifier = Modifier.fillMaxWidth().heightIn(min = TOUCH_TARGET)) {
                Text("Cancel")
            }
            // Delete is the last button, after a line: not next to Save.
            if (setup.deleteQuestion != null) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                OutlinedButton(
                    onClick = { confirmsDelete = true },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth().heightIn(min = TOUCH_TARGET),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                ) {
                    Symbol("delete", size = 20.dp)
                    Text(setup.deleteLabel, Modifier.padding(start = 8.dp))
                }
            }
        }
    }

    if (confirmsDelete && setup.deleteQuestion != null) {
        AlertDialog(
            onDismissRequest = { confirmsDelete = false },
            title = { Text("${setup.deleteLabel}?") },
            text = { Text(setup.deleteQuestion) },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmsDelete = false
                        onDelete()
                    },
                ) { Text(setup.deleteLabel, color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmsDelete = false }) { Text("Cancel") } },
        )
    }
    if (confirmsDiscard) {
        AlertDialog(
            onDismissRequest = { confirmsDiscard = false },
            title = { Text("Discard changes?") },
            text = { Text("The changes in this form are not saved.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmsDiscard = false
                        onClose()
                    },
                ) { Text("Discard", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmsDiscard = false }) { Text("Keep editing") } },
        )
    }
}

/** The names of the form fields in the error summary. */
private val fieldNames = mapOf(
    DraftField.NAME to "Name",
    DraftField.ICON to "Icon",
    DraftField.STEP to "Step",
    DraftField.TARGET to "Target",
    DraftField.START to "Start",
)

/** The error summary of [fields], in the order of the form. Example: "Correct these fields: Name, Target." */
private fun errorSummary(fields: Set<DraftField>): String {
    val names = DraftField.entries.filter { it in fields }.map(fieldNames::getValue)
    return if (names.size == 1) "Correct this field: ${names[0]}." else "Correct these fields: ${names.joinToString()}."
}

@Composable
private fun NameAndIcon(draft: MetricDraft, errors: Map<DraftField, String>, onChange: (MetricDraft) -> Unit) {
    Section("Name and icon") {
        Field("Name", draft.name, errors[DraftField.NAME]) { onChange(draft.copy(name = it)) }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            MetricIcon(draft.icon.trim(), large = true)
            Box(Modifier.weight(1f)) {
                Field("Icon", draft.icon, errors[DraftField.ICON]) { onChange(draft.copy(icon = it)) }
            }
        }
        Help("Type a Material Symbols name, such as water_drop, or an emoji. Or pick one:")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            for (name in suggestedIcons) {
                IconChoice(name, selected = draft.icon.trim() == name) { onChange(draft.copy(icon = name)) }
            }
        }
    }
}

@Composable
private fun KindUnitAndGroup(
    draft: MetricDraft,
    errors: Map<DraftField, String>,
    valueKind: MetricKind?,
    groups: List<String>,
    onChange: (MetricDraft) -> Unit,
) {
    Section("Kind, unit and group") {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (kind in MetricKind.entries) {
                val allowed = valueKind == null || canChangeKind(valueKind, kind, hasValues = true)
                Choice(kind.label, draft.kind == kind, enabled = allowed) { onChange(draft.copy(kind = kind)) }
            }
        }
        Help(
            when (draft.kind) {
                MetricKind.YES_NO -> "Yes/no: a tap marks the day as done or not done."

                MetricKind.NUMBER -> "Number: a value with a ruler, for example a weight. The chart shows a line."

                MetricKind.COUNT ->
                    "Count: a tap adds the step. A right-click or a double-tap subtracts it. The chart shows bars."
            },
        )
        if (valueKind != null) {
            Help("This metric has values, so it cannot change between yes/no and the other kinds.")
        }
        if (draft.kind != MetricKind.YES_NO) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.weight(2f)) { Field("Unit", draft.unit) { onChange(draft.copy(unit = it)) } }
                Box(Modifier.weight(1f)) {
                    Field("Step", draft.step, errors[DraftField.STEP], isNumber = true) {
                        onChange(draft.copy(step = it))
                    }
                }
            }
        }
        // The last field of a yes/no metric: its goal has no fields.
        Field("Group", draft.group, isLast = draft.kind == MetricKind.YES_NO) { onChange(draft.copy(group = it)) }
        if (groups.isNotEmpty()) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for (group in groups) {
                    Choice(groupLabel(group), draft.group.trim() == group) { onChange(draft.copy(group = group)) }
                }
            }
        }
    }
}

@Composable
private fun Goal(draft: MetricDraft, errors: Map<DraftField, String>, onChange: (MetricDraft) -> Unit) {
    Section("Goal") {
        if (draft.kind == MetricKind.YES_NO) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Choice("Goal yes: do it", draft.goalIsYes) { onChange(draft.copy(goalIsYes = true)) }
                Choice("Goal no: stop it", !draft.goalIsYes) { onChange(draft.copy(goalIsYes = false)) }
            }
            Help("A day without a value counts as no.")
        } else {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for (direction in GoalDirection.entries) {
                    Choice(direction.label, draft.direction == direction) {
                        onChange(draft.copy(direction = direction))
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.weight(1f)) {
                    Field("Target", draft.target, errors[DraftField.TARGET], isNumber = true) {
                        onChange(draft.copy(target = it))
                    }
                }
                Box(Modifier.weight(1f)) {
                    Field("Start (optional)", draft.start, errors[DraftField.START], isNumber = true, isLast = true) {
                        onChange(draft.copy(start = it))
                    }
                }
            }
            Help("The start gives 0 points. A value between the start and the target gives a part of 1 point.")
            Trend(draft, onChange)
            draft.previewGoal()?.let { GoalPreview(it, draft.unit.trim().ifEmpty { null }) }
        }
        Help("A new goal also changes the score of past days.")
    }
}

@Composable
private fun Trend(draft: MetricDraft, onChange: (MetricDraft) -> Unit) {
    val enabled = draft.kind == MetricKind.NUMBER
    // The highlight goes 8 dp past the checkbox and the text, and the checkbox stays aligned with the fields.
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .outset(8.dp, 4.dp)
            .clip(RoundedCornerShape(8.dp))
            .clickable(enabled = enabled, role = Role.Checkbox) { onChange(draft.copy(usesTrend = !draft.usesTrend)) }
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(checked = enabled && draft.usesTrend, onCheckedChange = null, enabled = enabled)
        Column(Modifier.padding(start = 8.dp)) {
            Text("Use the trend")
            Help(
                if (enabled) {
                    "The points come from the trend of the values, not from the value of the day."
                } else {
                    "Only for a number metric."
                },
            )
        }
    }
}

/** The goal text as in the sheet, a chart of the points of each value, and 3 examples. */
@Composable
private fun GoalPreview(goal: NumberGoal, unit: String?) {
    val colors = MaterialTheme.colorScheme
    val examples = goalExamples(goal, unit)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.surfaceContainerLowest, RoundedCornerShape(12.dp))
            .border(1.dp, colors.outlineVariant, RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("In the sheet: ${goalText(goal)}", style = MaterialTheme.typography.bodyMedium)
        PointsChart(
            goal,
            Modifier.fillMaxWidth().height(96.dp).semantics { contentDescription = examples.joinToString(". ") },
        )
        for (example in examples) Text("• $example", style = MaterialTheme.typography.bodyMedium)
    }
}

/**
 * A line of the points of each value, from 0 (bottom) to 1 (top), with a dashed line at the target. The values go
 * from a little before the start to a little after the target. Without a start, around the target.
 */
@Composable
private fun PointsChart(goal: NumberGoal, modifier: Modifier) {
    val line = MaterialTheme.colorScheme.primary
    val grid = MaterialTheme.colorScheme.outlineVariant
    val start = goal.start
    val (low, high) = if (start != null) {
        val pad = abs(goal.target - start) / 4
        min(start, goal.target) - pad to max(start, goal.target) + pad
    } else {
        val span = max(abs(goal.target) / 2, 1.0)
        goal.target - span to goal.target + span
    }
    Canvas(modifier) {
        fun x(value: Double) = ((value - low) / (high - low) * size.width).toFloat()
        fun y(points: Double) = ((1 - points) * (size.height - 8f) + 4f).toFloat()
        val dashes = PathEffect.dashPathEffect(floatArrayOf(6f, 6f))
        drawLine(grid, Offset(0f, y(0.0)), Offset(size.width, y(0.0)))
        drawLine(grid, Offset(0f, y(1.0)), Offset(size.width, y(1.0)), pathEffect = dashes)
        drawLine(grid, Offset(x(goal.target), 0f), Offset(x(goal.target), size.height), pathEffect = dashes)
        val path = Path()
        for (i in 0..SAMPLES) {
            val value = low + (high - low) * i / SAMPLES
            val point = Offset(x(value), y(goal.points(value)))
            if (i == 0) path.moveTo(point.x, point.y) else path.lineTo(point.x, point.y)
        }
        drawPath(path, line, style = Stroke(width = 2.5.dp.toPx()))
    }
}

/** The number of steps of the line of [PointsChart]. */
private const val SAMPLES = 120

/** A card with a [title] and its fields. */
@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    AppCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)
            content()
        }
    }
}

/**
 * A text field with a [label], and its [error] below it. [isNumber] shows the number keyboard on a phone. The action
 * key of the keyboard goes to the next field. On the last field ([isLast]), it closes the keyboard.
 */
@Composable
private fun Field(
    label: String,
    value: String,
    error: String? = null,
    isNumber: Boolean = false,
    isLast: Boolean = false,
    onChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text(label) },
        isError = error != null,
        supportingText = error?.let { { Text(it) } },
        singleLine = true,
        keyboardOptions = KeyboardOptions(
            keyboardType = if (isNumber) KeyboardType.Decimal else KeyboardType.Text,
            imeAction = if (isLast) ImeAction.Done else ImeAction.Next,
        ),
    )
}

/** A chip of a choice: one of the kinds, the goal directions or the groups. */
@Composable
private fun Choice(label: String, selected: Boolean, enabled: Boolean = true, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) },
        enabled = enabled,
        leadingIcon = if (selected) ({ Symbol("done", size = 18.dp) }) else null,
    )
}

/** A button with the suggested icon [name]. The selected icon has a red frame. */
@Composable
private fun IconChoice(name: String, selected: Boolean, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(10.dp)
    Box(
        modifier = Modifier
            .size(TOUCH_TARGET)
            .background(if (selected) colors.primaryContainer else colors.surfaceContainerLowest, shape)
            .border(if (selected) 2.dp else 1.dp, if (selected) colors.primary else colors.outlineVariant, shape)
            .clip(shape)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics {
                contentDescription = name
                this.selected = selected
            },
        contentAlignment = Alignment.Center,
    ) {
        Symbol(name, size = 24.dp, color = colors.primary)
    }
}

/** A short help text below a field. */
@Composable
private fun Help(text: String) {
    Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
}
