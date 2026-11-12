package trackula.app.pages

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import trackula.app.components.AppCard
import trackula.app.components.AppIconButton
import trackula.app.components.MetricIcon
import trackula.app.components.Symbol
import trackula.model.DeletedMetric
import trackula.model.InvalidMetricRow
import trackula.model.Metric
import trackula.model.MetricDraft
import trackula.model.MetricKind
import trackula.model.MetricsTable
import trackula.model.MetricsWrite
import trackula.model.deletedSummary
import trackula.model.draftOf
import trackula.model.goalSummary
import trackula.model.isValidMetricId
import trackula.model.kindOf
import trackula.model.metricSummary
import trackula.model.planDeleteMetric
import trackula.model.planDeleteRow
import trackula.model.planEditMetric
import trackula.model.planFixRow
import trackula.model.planMoveMetric
import trackula.model.planSaveMetric
import trackula.sheets.Snapshot

/** What the metrics form shows: a new metric, a metric to change, an invalid row to fix, or a deleted metric. */
private sealed interface FormTarget {
    data object New : FormTarget

    data class Edit(val id: String) : FormTarget

    data class Fix(val row: InvalidMetricRow) : FormTarget

    data class Restore(val deleted: DeletedMetric) : FormTarget
}

/**
 * The metrics screen. It shows the metrics in the order of the sheet, which is also the order in the app, the rows of
 * the `Metrics` tab that are not valid, and the deleted metrics: the `Log` columns without a metric. A tap on a
 * metric, Add metric, Fix or Restore opens the form (see [MetricForm]). The arrows move a metric up or down.
 *
 * - [data]: the latest data of the sheet.
 * - [busy]: true while data loads or saves. The buttons that write are disabled.
 * - [error]: the error of the last load or write, or null.
 * - [onWrite]: writes a change to the `Metrics` tab. The plan runs on the latest data. `onDone` runs after a write
 *   without an error, for example to close the form.
 * - [onClose]: closes the screen.
 */
@Composable
fun MetricsPage(
    data: Snapshot,
    busy: Boolean,
    error: String?,
    onWrite: (plan: (MetricsTable) -> List<MetricsWrite>, onDone: () -> Unit) -> Unit,
    onClose: () -> Unit,
) {
    var form by remember { mutableStateOf<FormTarget?>(null) }
    val metrics = data.metrics
    val table = data.metricsTable

    // A metric that is gone from the sheet, for example after a reload, has no form.
    val edited = (form as? FormTarget.Edit)?.let { target -> metrics.firstOrNull { it.id == target.id } }
    LaunchedEffect(form, edited == null) {
        if (form is FormTarget.Edit && edited == null) form = null
    }

    val target = form
    if (target != null && (target !is FormTarget.Edit || edited != null)) {
        val takenIds = metrics.map { it.id }.toSet() + table.invalid.map { it.id } + data.deleted.map { it.id }
        val groups = metrics.mapNotNull { it.group }.distinct()
        val close = { form = null }
        val setup = remember(target, edited) { setupOf(target, edited, data) }
        MetricForm(
            setup = setup,
            takenIds = takenIds,
            groups = groups,
            busy = busy,
            error = error,
            onSave = { metric -> onWrite({ t -> planSave(target, t, metric) }, close) },
            onDelete = {
                when (target) {
                    is FormTarget.Edit -> onWrite({ t -> listOf(planDeleteMetric(t, target.id)) }, close)
                    is FormTarget.Fix -> onWrite({ t -> listOf(planDeleteRow(t, target.row)) }, close)
                    else -> Unit
                }
            },
            onClose = close,
        )
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AppIconButton(icon = "arrow_back", title = "Back", onClick = onClose)
            Text("Metrics", Modifier.weight(1f), style = MaterialTheme.typography.headlineSmall)
            Button(onClick = { form = FormTarget.New }, enabled = !busy) {
                Symbol("add", size = 20.dp)
                Text("Add metric", Modifier.padding(start = 8.dp))
            }
        }
        Help("Changes go to the Metrics tab of your sheet. The order here is the order in the app.")
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }

        if (metrics.isEmpty()) {
            Text("No metrics yet.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            AppCard(Modifier.fillMaxWidth()) {
                metrics.forEachIndexed { i, m ->
                    if (i > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    MetricRow(
                        metric = m,
                        busy = busy,
                        isFirst = i == 0,
                        isLast = i == metrics.lastIndex,
                        onEdit = { form = FormTarget.Edit(m.id) },
                        onMove = { up -> onWrite({ t -> listOfNotNull(planMoveMetric(t, m.id, up)) }, {}) },
                    )
                }
            }
        }

        if (table.invalid.isNotEmpty()) {
            OtherRows("warning", "Rows with problems", help = null) {
                for (row in table.invalid) {
                    OtherRow(
                        title = "Row ${row.row} · ${row.id.ifEmpty { "no id" }}",
                        text = row.problem.replaceFirstChar { it.uppercaseChar() },
                        button = "Fix",
                        enabled = !busy,
                    ) { form = FormTarget.Fix(row) }
                }
            }
        }

        if (data.deleted.isNotEmpty()) {
            OtherRows(
                icon = "history",
                title = "Deleted metrics",
                help = "Their values stay in the Log tab. Restore a metric to show it again with all its values.",
            ) {
                for (deleted in data.deleted) {
                    OtherRow(deleted.id, deletedSummary(deleted), "Restore", !busy) {
                        form = FormTarget.Restore(deleted)
                    }
                }
            }
        }
    }
}

/** The form of [target]. [edited] is the metric of a [FormTarget.Edit]. */
private fun setupOf(target: FormTarget, edited: Metric?, data: Snapshot): FormSetup = when (target) {
    FormTarget.New -> FormSetup(title = "Add metric", initial = MetricDraft())

    is FormTarget.Edit -> {
        val metric = edited!!
        FormSetup(
            title = "Edit metric",
            initial = draftOf(metric),
            id = metric.id,
            valueKind = kindOf(metric).takeIf { data.log.entries.any { it.metricId == metric.id } },
            deleteQuestion = "Delete \"${metric.name}\"? The app stops showing it. Its values stay in the Log tab " +
                "of the sheet, and you can restore it here.",
        )
    }

    is FormTarget.Fix -> {
        val id = target.row.id
        FormSetup(
            title = "Fix row ${target.row.row}",
            initial = draftOf(target.row),
            // A row with an invalid id or with the id of another metric gets a new id from its name.
            id = id.takeIf { isValidMetricId(it) && it !in data.metricsTable.rows },
            note = target.row.problem.replaceFirstChar { it.uppercaseChar() },
            deleteQuestion = "Delete row ${target.row.row} of the Metrics tab?",
            deleteLabel = "Delete row",
        )
    }

    is FormTarget.Restore -> FormSetup(
        title = "Restore metric",
        initial = draftOf(target.deleted),
        id = target.deleted.id,
        valueKind = when {
            target.deleted.values == 0 -> null
            target.deleted.isYesNo -> MetricKind.YES_NO
            else -> MetricKind.NUMBER
        },
    )
}

/** The writes of a Save in the form of [target]. */
private fun planSave(target: FormTarget, table: MetricsTable, metric: Metric): List<MetricsWrite> = when (target) {
    is FormTarget.Edit -> planEditMetric(table, metric)
    is FormTarget.Fix -> planFixRow(table, target.row, metric)
    FormTarget.New, is FormTarget.Restore -> planSaveMetric(table, metric)
}

/** A metric in the list: a tap opens its form. The arrows move it up or down. */
@Composable
private fun MetricRow(
    metric: Metric,
    busy: Boolean,
    isFirst: Boolean,
    isLast: Boolean,
    onEdit: () -> Unit,
    onMove: (up: Boolean) -> Unit,
) {
    Row(Modifier.padding(start = 16.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Row(
            modifier = Modifier.weight(1f).clickable(onClickLabel = "Edit", onClick = onEdit).padding(vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            MetricIcon(metric)
            Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(metric.name, fontSize = 16.sp)
                Help(metricSummary(metric))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Symbol("flag", size = 16.dp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Help(goalSummary(metric))
                }
            }
        }
        AppIconButton("arrow_upward", "Move ${metric.name} up", { onMove(true) }, enabled = !busy && !isFirst)
        AppIconButton("arrow_downward", "Move ${metric.name} down", { onMove(false) }, enabled = !busy && !isLast)
    }
}

/** A card of rows that are not metrics: the rows with problems, or the deleted metrics. */
@Composable
private fun OtherRows(icon: String, title: String, help: String?, content: @Composable () -> Unit) {
    AppCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                val color = if (icon == "warning") {
                    MaterialTheme.colorScheme.error
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
                Symbol(icon, color = color)
                Text(title, style = MaterialTheme.typography.titleMedium)
            }
            help?.let { Help(it) }
            content()
        }
    }
}

/** A row of [OtherRows]: a [title], a [text] and a [button]. */
@Composable
private fun OtherRow(title: String, text: String, button: String, enabled: Boolean, onClick: () -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, fontSize = 16.sp)
            Help(text)
        }
        OutlinedButton(onClick = onClick, enabled = enabled) { Text(button) }
    }
}

/** A short text in the color of secondary text. */
@Composable
private fun Help(text: String) {
    Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
}
