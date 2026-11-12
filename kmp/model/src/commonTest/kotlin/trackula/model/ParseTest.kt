package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
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
                listOf("weight", "Weight", "number", "kg", 0.1, "body", "monitor_weight", "at most 80 from 83"),
                listOf("meditate", "Meditate", "yesno", "", "", "habits", "self_improvement", "yes"),
                listOf("morning-shower", "Morning shower", "yesno", "", "", "habits", "🚿", "yes"),
                listOf("water", "Water", "number", "glasses", 1, "habits", "water_drop", "at least 8"),
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
                listOf("kind", "id", "per_day", "name", "unit", "step", "group", "active", "icon", "goal"),
                listOf("yesno", "read", "one", "Read", "", "", "", false, "📖", "yes"),
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
                listOf("c", "C", "yesno", "", "", "", "check", "yes"),
                listOf("c", "C", "yesno", "", "", "", "check", "yes"),
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
                listOf("c", "C", "yesno", "", "", "", "check", "yes", true),
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
                listOf("water", "Water", "number", "glasses", 1, "habits", "water_drop", "at least 8"),
                listOf("read", "Read", "yesno", "", "", "habits", "📚", "yes"),
                listOf("walk", "Walk", "yesno", "", "", "habits", "", "yes"),
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
                listOf("water", "Water", "count", "", "", "", "water_drop", 8),
                listOf("steps", "Steps", "count", "", "", "", "footprint", "at least 8000"),
                listOf("coffee", "Coffee", "count", "", "", "", "coffee", "At  most 2 from 4"),
                listOf("sleep", "Sleep", "number", "h", "", "", "bedtime", ">= 7 from 5"),
                listOf("weight", "Weight", "number", "kg", 0.1, "", "monitor_weight", "at most 80 from 83.5 trend"),
                listOf("fat", "Body fat", "number", "%", "", "", "percent", "<=20"),
            ),
        )
        assertEquals(emptyList(), p.warnings)
        assertEquals(listOf(true, false), p.items.filterIsInstance<YesNoMetric>().map { it.goalIsYes })
        assertEquals(
            listOf(
                NumberGoal(8.0),
                NumberGoal(8000.0),
                NumberGoal(2.0, isMaximum = true, from = 4.0),
                NumberGoal(7.0, from = 5.0),
                NumberGoal(80.0, isMaximum = true, from = 83.5, usesTrend = true),
                NumberGoal(20.0, isMaximum = true),
            ),
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
                listOf("waist", "Waist", "number", "cm", 0.5, "", "straighten", "at most 90 from 88"),
                listOf("sleep", "Sleep", "number", "h", "", "", "bedtime", "at least 7 from 7"),
                listOf("water", "Water", "count", "", "", "", "water_drop", "at least 8 trend"),
                listOf("steps", "Steps", "count", "", "", "", "footprint", "trend"),
            ),
        )
        assertEquals(emptyList(), p.items)
        assertEquals(6, p.warnings.size)
        assertTrue("use yes or no" in p.warnings[0])
        assertTrue("at most 80 from 83 trend" in p.warnings[1])
        assertTrue("must be above the target" in p.warnings[2])
        assertTrue("must be below the target" in p.warnings[3])
        assertTrue("Only a number metric can have a trend" in p.warnings[4])
        assertTrue("invalid goal \"trend\"" in p.warnings[5])
    }

    @Test
    fun parseMetricsSkipsARowWithoutGoalWithAWarning() {
        val p = parseMetrics(
            rows(
                metricsHeader,
                listOf("read", "Read", "yesno", "", "", "", "check", ""),
                listOf("waist", "Waist", "number", "cm", 0.5, "", "straighten"),
                listOf("water", "Water", "count", "", "", "", "water_drop", " "),
            ),
        )
        assertEquals(emptyList(), p.items)
        assertEquals(listOf(2, 3, 4), p.invalid.map { it.row })
        assertEquals("no goal. For a yesno metric, use yes or no.", p.invalid[0].problem)
        val numberProblem = "no goal. Use for example at least 8, at most 80, or at most 80 from 83 trend."
        assertEquals(listOf(numberProblem, numberProblem), p.invalid.drop(1).map { it.problem })
    }

    @Test
    fun parseMetricsReadsASheetWithoutTheGoalColumnAsRowsWithoutGoal() {
        val p = parseMetrics(
            rows(
                listOf("id", "name", "kind", "unit", "step", "group", "icon"),
                listOf("meditate", "Meditate", "yesno", "", "", "", "check"),
                listOf("water", "Water", "count", "", "", "", "water_drop"),
            ),
        )
        assertEquals(emptyList(), p.items)
        assertEquals(listOf("meditate", "water"), p.invalid.map { it.id })
        assertTrue(p.invalid.all { it.problem.startsWith("no goal") })
    }

    @Test
    fun parseMetricsReadsKindCountAsANumberMetricWithBars() {
        val p = parseMetrics(rows(metricsHeader, listOf("steps", "Steps", "count", "", 100, "", "footprint", 8000)))
        assertTrue(assertIs<NumberMetric>(p.items.single()).isCount)
    }

    @Test
    fun parseMetricsReadsNumbersInTextCellsWithoutZerosAtTheEnd() {
        val p = parseMetrics(rows(metricsHeader, listOf("year", 2026, "number", "", "0.5", "", 7, 1)))
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

    @Test
    fun parseMetricsGivesTheRowOfEachMetricAndTheColumnOfEachHeader() {
        val t = parseMetrics(
            rows(
                listOf("kind", "id", "per_day", "name", "unit", "step", "group", "icon", "goal"),
                listOf("yesno", "read", "one", "Read", "", "", "", "menu_book", "yes"),
                listOf(),
                listOf("number", "weight", "", "Weight", "kg", 0.1, "", "monitor_weight", "at most 80"),
            ),
        )
        assertEquals(mapOf("read" to 2, "weight" to 4), t.rows)
        assertEquals(1, t.columns["id"])
        assertEquals(2, t.columns["per_day"])
        assertEquals(9, t.width)
        assertEquals(4, t.lastRow)
    }

    @Test
    fun parseMetricsKeepsEachInvalidRowWithItsCellsAndItsProblem() {
        val t = parseMetrics(
            rows(
                metricsHeader,
                listOf("walk", "Walk", "yesno", "", "", "habits", "", "yes"),
                listOf("read", "Read", "yesno", "", "", "", "menu_book", "yes"),
                listOf("read", "Read again", "yesno", "", "", "", "menu_book", "yes"),
            ),
        )
        assertEquals(listOf("read"), t.items.map { it.id })
        assertEquals(listOf(2, 4), t.invalid.map { it.row })
        val walk = t.invalid[0]
        assertEquals("walk", walk.id)
        assertEquals("habits", walk.cells["group"])
        assertTrue(walk.problem.startsWith("no icon"))
        assertEquals("duplicate id \"read\"", t.invalid[1].problem)
        assertEquals(listOf("Metrics row 2: ${walk.problem}", "Metrics row 4: duplicate id \"read\""), t.warnings)
    }

    @Test
    fun parseMetricsOfAnEmptyTabGivesTheHeaderAsTheLastRow() {
        val t = parseMetrics(rows(metricsHeader))
        assertEquals(1, t.lastRow)
        assertEquals(metricsHeader.size, t.width)
    }

    @Test
    fun parseMetricRowChecksTheCellsOfOneRow() {
        val cells = mapOf("name" to "Water", "kind" to "count", "unit" to "glasses", "icon" to "water_drop")
        assertEquals(
            NumberMetric(
                id = "water",
                name = "Water",
                icon = "water_drop",
                goal = NumberGoal(8.0),
                unit = "glasses",
                isCount = true,
            ),
            parseMetricRow("water", cells + ("goal" to "at least 8")),
        )
        val e = assertFailsWith<InvalidMetricException> { parseMetricRow("water", cells + ("goal" to "lots")) }
        assertTrue(e.message!!.startsWith("invalid goal \"lots\""))
        val empty = assertFailsWith<InvalidMetricException> { parseMetricRow("water", cells + ("goal" to "")) }
        assertTrue(empty.message!!.startsWith("no goal"))
    }

    @Test
    fun isValidMetricIdAcceptsLowercaseLettersDigitsAndTwoSigns() {
        assertTrue(isValidMetricId("morning_teeth-2"))
        assertFalse(isValidMetricId("Morning"))
        assertFalse(isValidMetricId(""))
    }
}
