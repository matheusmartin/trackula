package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ParseTest {
    private val metrics = byId(weight, water, meditate)
    private val d29 = Day(2026, 9, 29)
    private val d30 = Day(2026, 9, 30)

    @Test
    fun parseMetricsParsesTheExampleRows() {
        val p = parseMetrics(
            rows(
                metricsHeader,
                listOf("weight", "Weight", "number", "kg", 0.1, "body", "monitor_weight"),
                listOf("meditate", "Meditate", "yesno", "", "", "habits", "self_improvement"),
                listOf("morning-shower", "Morning shower", "yesno", "", "", "habits", "🚿"),
                listOf("water", "Water", "number", "glasses", 1, "habits", "water_drop"),
            ),
        )
        assertEquals(emptyList(), p.warnings)
        assertEquals(listOf("weight", "meditate", "morning-shower", "water"), p.items.map { it.id })
        assertEquals(0.1, assertIs<NumberMetric>(p.items[0]).step)
        assertIs<YesNoMetric>(p.items[1])
    }

    @Test
    fun parseMetricsFindsColumnsByHeaderNameAndIgnoresOtherColumnsSuchAsPerDayAndActive() {
        val p = parseMetrics(
            rows(
                listOf("kind", "id", "per_day", "name", "unit", "step", "group", "active", "icon"),
                listOf("yesno", "read", "one", "Read", "", "", "", false, "📖"),
            ),
        )
        assertEquals("read", p.items.single().id)
    }

    @Test
    fun parseMetricsSkipsInvalidRowsWithAWarning() {
        val p = parseMetrics(
            rows(
                metricsHeader,
                listOf("Bad Id", "x", "number"),
                listOf("a", "A", "text"),
                listOf("", "B", "number"),
                listOf("c", "C", "yesno", "", "", "", "check"),
                listOf("c", "C", "yesno", "", "", "", "check"),
                listOf(),
            ),
        )
        assertEquals(listOf("c"), p.items.map { it.id })
        assertEquals(4, p.warnings.size)
    }

    @Test
    fun parseMetricsIgnoresRowsThatContainOnlyUncheckedCheckboxes() {
        val p = parseMetrics(
            rows(
                metricsHeader + "active",
                listOf("c", "C", "yesno", "", "", "", "check", "", true),
                listOf("", "", "", "", "", "", "", "", false),
            ),
        )
        assertEquals(listOf("c"), p.items.map { it.id })
        assertEquals(emptyList(), p.warnings)
    }

    @Test
    fun parseMetricsReadsTheIconAndSkipsARowWithoutIconWithAWarning() {
        val p = parseMetrics(
            rows(
                metricsHeader,
                listOf("water", "Water", "number", "glasses", 1, "habits", "water_drop"),
                listOf("read", "Read", "yesno", "", "", "habits", "📚"),
                listOf("walk", "Walk", "yesno", "", "", "habits"),
            ),
        )
        assertEquals(listOf("water_drop", "📚"), p.items.map { it.icon })
        assertTrue("no icon" in p.warnings.single())
    }

    @Test
    fun parseMetricsThrowsWithoutTheIconColumn() {
        val e = assertFailsWith<HeaderException> {
            parseMetrics(rows(listOf("id", "name", "kind", "unit", "step", "group")))
        }
        assertEquals(listOf("icon"), e.missing)
    }

    @Test
    fun parseMetricsThrowsIfAColumnIsMissing() {
        assertFailsWith<HeaderException> { parseMetrics(rows(listOf("id", "name"))) }
    }

    @Test
    fun parseMetricsReadsTheGoal() {
        val p = parseMetrics(
            rows(
                metricsHeader,
                listOf("meditate", "Meditate", "yesno", "", "", "", "check", "Yes"),
                listOf("smoke", "Smoke", "yesno", "", "", "", "check", "no"),
                listOf("read", "Read", "yesno", "", "", "", "check"),
                listOf("water", "Water", "count", "", "", "", "water_drop", 8),
                listOf("steps", "Steps", "number", "", "", "", "footprint", ">= 8000"),
                listOf("weight", "Weight", "number", "kg", 0.1, "", "monitor_weight", "<=75.5"),
                listOf("waist", "Waist", "number", "cm", 0.5, "", "straighten", ""),
            ),
        )
        assertEquals(emptyList(), p.warnings)
        assertEquals(listOf(true, false, true), p.items.filterIsInstance<YesNoMetric>().map { it.goalIsYes })
        assertEquals(
            listOf(NumberGoal(8.0), NumberGoal(8000.0), NumberGoal(75.5, isMaximum = true), null),
            p.items.filterIsInstance<NumberMetric>().map { it.goal },
        )
    }

    @Test
    fun parseMetricsSkipsARowWithAnInvalidGoalWithAWarning() {
        val p = parseMetrics(
            rows(
                metricsHeader,
                listOf("meditate", "Meditate", "yesno", "", "", "", "check", "maybe"),
                listOf("weight", "Weight", "number", "kg", 0.1, "", "monitor_weight", "< 75"),
            ),
        )
        assertEquals(emptyList(), p.items)
        assertEquals(2, p.warnings.size)
        assertTrue("use yes or no" in p.warnings[0])
        assertTrue("<= 75 (at most 75)" in p.warnings[1])
    }

    @Test
    fun parseMetricsReadsASheetWithoutTheGoalColumn() {
        val p = parseMetrics(
            rows(
                listOf("id", "name", "kind", "unit", "step", "group", "icon"),
                listOf("meditate", "Meditate", "yesno", "", "", "", "check"),
                listOf("water", "Water", "count", "", "", "", "water_drop"),
            ),
        )
        assertEquals(emptyList(), p.warnings)
        assertTrue(assertIs<YesNoMetric>(p.items[0]).goalIsYes)
        assertNull(assertIs<NumberMetric>(p.items[1]).goal)
    }

    @Test
    fun parseMetricsReadsKindCountAsANumberMetricWithBars() {
        val p = parseMetrics(rows(metricsHeader, listOf("steps", "Steps", "count", "", 100, "", "footprint")))
        assertTrue(assertIs<NumberMetric>(p.items.single()).isCount)
    }

    @Test
    fun parseMetricsReadsNumbersInTextCellsWithoutZerosAtTheEnd() {
        val p = parseMetrics(rows(metricsHeader, listOf("year", 2026, "number", "", "0.5", "", 7)))
        val metric = assertIs<NumberMetric>(p.items.single())
        assertEquals(Triple("2026", 0.5, "7"), Triple(metric.name, metric.step, metric.icon))
        val small = parseMetrics(rows(metricsHeader, listOf("x", 0.1234567, "yesno", "", "", "", "check", 1e-7)))
        assertTrue("invalid goal \"1e-7\"" in small.warnings.single())
    }

    @Test
    fun parseLogReadsNumbersAsTextWithASignOrWithoutDigitsBeforeOrAfterThePoint() {
        val p = parseLog(
            rows(listOf("date", "weight", "water"), listOf("2026-09-30", "+82", ".5"), listOf("2026-10-01", "8.")),
            metrics,
        )
        assertEquals(emptyList(), p.warnings)
        assertEquals(listOf(82.0, 0.5, 8.0), p.table.entries.map { it.value })
    }

    @Test
    fun exceptionTextIsTheMessageOnlyAsInDart() {
        assertEquals("Tab \"Log\" has no column(s): date", HeaderException(LOG_TITLE, listOf("date")).toString())
        assertEquals("The log tab has no column \"water\".", MissingColumnException("water").toString())
    }

    @Test
    fun parseLogReadsOneRowPerDayAndOneColumnPerMetric() {
        val p = parseLog(
            rows(
                listOf("date", "weight", "meditate", "water"),
                listOf("2026-09-29", 82.4, "", 8),
                listOf("2026-09-30", "82.1", true, 5),
            ),
            metrics,
        )
        assertEquals(emptyList(), p.warnings)
        assertEquals(mapOf("weight" to 1, "meditate" to 2, "water" to 3), p.table.columns)
        assertEquals(mapOf(d29 to 2, d30 to 3), p.table.rows)
        assertEquals(82.1, p.table.valueAt("weight", d30))
        assertEquals(1.0, p.table.valueAt("meditate", d30))
        assertNull(p.table.valueAt("meditate", d29))
    }

    @Test
    fun parseLogWarnsAboutInvalidCellsAndDuplicateDaysAndIgnoresColumnsWithNoMetric() {
        val p = parseLog(
            rows(
                listOf("date", "weight", "steps", "meditate"),
                listOf("30/09/2026", 82.1),
                listOf("2026-09-29", "heavy", 100, 2),
                listOf("2026-09-29", 82.0),
            ),
            metrics,
        )
        assertEquals(listOf(4 to 82.0), p.table.entries.map { it.row to it.value })
        assertEquals(4, p.table.rows[d29])
        assertTrue("steps" !in p.table.columns)
        assertEquals(4, p.warnings.size)
    }

    @Test
    fun parseLogReadsRealDatesAndOldTextDates() {
        val p = parseLog(
            rows(listOf("date", "weight"), listOf(46296, 81.9), listOf("2026-10-02", 82), listOf(0, 83)),
            metrics,
        )
        assertEquals(mapOf(Day(2026, 10, 1) to 2, Day(2026, 10, 2) to 3), p.table.rows)
        assertTrue("invalid date \"0\"" in p.warnings.single())
    }

    @Test
    fun textDateRowsFindsDatesStoredAsTextOnly() {
        assertEquals(
            listOf(TextDateRow(2, Day(2026, 10, 1)), TextDateRow(6, Day(2026, 10, 3))),
            textDateRows(
                rows(
                    listOf("date", "weight"),
                    listOf("2026-10-01", 1),
                    listOf(46297, 2),
                    listOf("01/10/2026", 3),
                    listOf(),
                    listOf("2026-10-03"),
                ),
            ),
        )
    }

    @Test
    fun parseLogReadsYesAndNoInAnyCaseAndOldYesNoValues() {
        val p = parseLog(
            rows(
                listOf("date", "meditate"),
                listOf("2026-09-27", "YES"),
                listOf("2026-09-28", "yes"),
                listOf("2026-09-29", " No "),
                listOf("2026-09-30", 1),
            ),
            metrics,
        )
        assertEquals(emptyList(), p.warnings)
        assertEquals(
            listOf(1.0, 0.0, 1.0),
            listOf(Day(2026, 9, 28), d29, d30).map { p.table.valueAt("meditate", it) },
        )
    }

    @Test
    fun parseLogWarnsAboutInvalidYesNoValues() {
        val p = parseLog(rows(listOf("date", "meditate"), listOf("2026-09-30", "maybe")), metrics)
        assertEquals(emptyList(), p.table.entries)
        assertTrue("yes or no" in p.warnings.single())
    }

    @Test
    fun legacyYesNoCellsFindsOldYesNoValuesOnly() {
        val cells = legacyYesNoCells(
            rows(
                listOf("date", "weight", "meditate"),
                listOf("2026-09-27", 1, 1),
                listOf("2026-09-28", 82, "yes"),
                listOf("2026-09-29", 82, "TRUE"),
                listOf("2026-09-30", 82, 0),
                listOf("2026-10-01", 82, ""),
                listOf("2026-10-02", 82, "maybe"),
                listOf("2026-10-03", 82),
            ),
            metrics,
        )
        assertEquals(listOf(LegacyCell(2, 2, "yes"), LegacyCell(4, 2, "yes"), LegacyCell(5, 2, "no")), cells)
    }

    @Test
    fun parseLogThrowsIfColumnAIsNotDate() {
        assertFailsWith<HeaderException> { parseLog(rows(listOf("day", "weight")), metrics) }
    }

    @Test
    fun columnLetter() {
        assertEquals(
            listOf("A", "B", "Z", "AA", "AB", "AZ", "BA"),
            listOf(0, 1, 25, 26, 27, 51, 52).map(::columnLetter),
        )
    }
}
