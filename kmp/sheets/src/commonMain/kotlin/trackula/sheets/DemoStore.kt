package trackula.sheets

import kotlinx.coroutines.delay
import trackula.model.AddMetricsColumns
import trackula.model.AppendRow
import trackula.model.Day
import trackula.model.DeleteMetricRow
import trackula.model.LogWrite
import trackula.model.MetricsWrite
import trackula.model.MoveMetricRow
import trackula.model.SetCell
import trackula.model.SetMetricCells
import trackula.model.deletedMetrics
import trackula.model.metricsHeader
import trackula.model.parseLog
import trackula.model.parseMetrics
import trackula.model.roundHalfAwayFromZero
import trackula.model.roundToStep
import kotlin.random.Random
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds

/**
 * Demo mode: sample metrics and 120 days of sample values in memory. Nothing goes to Google Sheets, and a reload
 * starts again from the sample data. Open the app with `?demo`. See README.md.
 *
 * It keeps the tabs as rows of cells, as the Sheets API returns them, and uses the same parsers and write plans as
 * [SheetsStore]. [today] has no values, so that all inputs can be tried. Each call waits [delay], as a network call.
 * It has no `Score` column: the app calculates the scores that it shows from the values.
 */
class DemoStore(today: Day, private val delay: Duration = 400.milliseconds) : Store() {
    private val metricRows: MutableList<MutableList<Any?>> =
        (listOf(metricsHeader) + sampleMetrics).map { it.toMutableList<Any?>() }.toMutableList()
    private val log: MutableList<MutableList<Any?>> = sampleLog(today)

    override suspend fun refreshRules() = delay(delay)

    /**
     * Reads the sample data. Demo mode has no `Score` column, so [writesScores] does nothing. As in [SheetsStore], a
     * metric without a `Log` column gets one at the end.
     */
    override suspend fun load(writesScores: Boolean): Snapshot {
        delay(delay)
        val metrics = parseMetrics(metricRows)
        val header = log.first()
        header.addAll(metrics.items.map { it.id }.filter { it !in header })
        val ids = metrics.items.associateBy { it.id }
        val parsed = parseLog(log, ids)
        return Snapshot(metrics, parsed.table, metrics.warnings + parsed.warnings, deletedMetrics(log, ids.keys))
    }

    override suspend fun apply(write: LogWrite) {
        delay(delay)
        when (write) {
            is AppendRow -> log.add(write.toCells().toMutableList())
            is SetCell -> set(log[write.row - 1], write.column, write.value ?: "")
        }
    }

    override suspend fun applyMetrics(write: MetricsWrite) {
        delay(delay)
        when (write) {
            is SetMetricCells -> {
                while (metricRows.size < write.row) metricRows.add(mutableListOf())
                for ((column, value) in write.cells) set(metricRows[write.row - 1], column, value)
            }

            is AddMetricsColumns -> write.names.forEachIndexed { i, name -> set(metricRows[0], write.start + i, name) }

            is DeleteMetricRow -> metricRows.removeAt(write.row - 1)

            is MoveMetricRow -> {
                val row = metricRows.removeAt(write.row - 1)
                metricRows.add(if (write.before > write.row) write.before - 2 else write.before - 1, row)
            }
        }
    }

    internal companion object {
        /** Sets the cell [column] of [cells] to [value]. Adds empty cells before it if the row is shorter. */
        fun set(cells: MutableList<Any?>, column: Int, value: Any?) {
            while (cells.size <= column) cells.add("")
            cells[column] = value
        }

        val sampleMetrics: List<List<Any>> = listOf(
            listOf("weight", "Weight", "number", "kg", 0.1, "Health", "monitor_weight", "at most 80 from 84 trend"),
            listOf("waist", "Waist", "number", "cm", 0.5, "Health", "straighten", "at most 90 from 95"),
            listOf("teeth", "Morning teeth", "yesno", "", "", "Hygiene", "dentistry", "yes"),
            listOf("shower", "Morning shower", "yesno", "", "", "Hygiene", "shower", "yes"),
            listOf("meditate", "Meditate", "yesno", "", "", "Activities", "self_improvement", "yes"),
            listOf("read", "Read", "yesno", "", "", "Activities", "menu_book", "yes"),
            listOf("water", "Water", "count", "glasses", 1, "Nutrition", "water_drop", "at least 8"),
            listOf("walk", "Walk", "count", "min", 10, "Activities", "directions_walk", "at least 30"),
            listOf("vitamins", "Vitamins", "yesno", "", "", "Nutrition", "pill", "yes"),
        )

        /**
         * The waist [daysAgo] days before today, for the 120 days of [sampleLog]: once a week, it goes down from 95 cm
         * (119 days ago) to 92 cm (7 days ago), in steps of 0.5 cm. Null on the other days.
         */
        fun sampleWaist(daysAgo: Int): Double? =
            if (daysAgo % 7 == 0) roundHalfAwayFromZero((95 - (120 - daysAgo) / 40.0) * 2) / 2 else null

        /** One row for each of the 120 days before [today]. Values are random, with a fixed seed: the same each time. */
        fun sampleLog(today: Day): MutableList<MutableList<Any?>> {
            val random = Random(7)
            var weight = 84.0
            val rows = mutableListOf<MutableList<Any?>>(
                (listOf("date") + sampleMetrics.map { it[0] }).toMutableList(),
            )
            for (i in 120 downTo 1) {
                val row = mutableListOf<Any?>(today.addDays(-i).toString())
                for (m in sampleMetrics) {
                    row += when {
                        random.nextDouble() < 0.15 -> ""

                        m[0] == "weight" -> {
                            weight += (random.nextDouble() - 0.55) * 0.4
                            roundToStep(weight, 0.1)
                        }

                        m[0] == "waist" -> sampleWaist(i) ?: ""

                        m[2] == "yesno" -> if (random.nextDouble() < 0.75) "yes" else "no"

                        m[0] == "water" -> 3 + random.nextInt(6)

                        else -> 10 * (1 + random.nextInt(6))
                    }
                }
                rows += row
            }
            return rows
        }
    }
}
