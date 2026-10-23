package trackula.sheets

import kotlinx.coroutines.delay
import trackula.model.AppendRow
import trackula.model.Day
import trackula.model.LogWrite
import trackula.model.SetCell
import trackula.model.metricsHeader
import trackula.model.parseLog
import trackula.model.parseMetrics
import trackula.model.roundToStep
import kotlin.math.round
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
    private val log: MutableList<MutableList<Any?>> = sampleLog(today)

    override suspend fun refreshRules() = delay(delay)

    /** Reads the sample data. Demo mode has no `Score` column, so [writesScores] does nothing. */
    override suspend fun load(writesScores: Boolean): Snapshot {
        delay(delay)
        val metrics = parseMetrics(listOf(metricsHeader) + sampleMetrics)
        val log = parseLog(log, metrics.items.associateBy { it.id })
        return Snapshot(metrics.items, log.table, metrics.warnings + log.warnings)
    }

    override suspend fun apply(write: LogWrite) {
        delay(delay)
        when (write) {
            is AppendRow -> log.add(write.toCells().toMutableList())

            is SetCell -> {
                val cells = log[write.row - 1]
                while (cells.size <= write.column) cells.add("")
                cells[write.column] = write.value ?: ""
            }
        }
    }

    private companion object {
        val sampleMetrics: List<List<Any>> = listOf(
            listOf("weight", "Weight", "number", "kg", 0.1, "Health", "monitor_weight", "<= 83"),
            listOf("waist", "Waist", "number", "cm", 0.5, "Health", "straighten", "<= 94"),
            listOf("teeth", "Morning teeth", "yesno", "", "", "Hygiene", "dentistry", "yes"),
            listOf("shower", "Morning shower", "yesno", "", "", "Hygiene", "shower", "yes"),
            listOf("meditate", "Meditate", "yesno", "", "", "Activities", "self_improvement", "yes"),
            listOf("read", "Read", "yesno", "", "", "Activities", "menu_book", "yes"),
            listOf("water", "Water", "count", "glasses", 1, "Nutrition", "water_drop", 8),
            listOf("walk", "Walk", "count", "min", 10, "Activities", "directions_walk", 30),
            listOf("vitamins", "Vitamins", "yesno", "", "", "Nutrition", "pill", "yes"),
        )

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

                        m[0] == "waist" -> if (i % 7 == 0) round((95 - (120 - i) / 40.0) * 2) / 2 else ""

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
