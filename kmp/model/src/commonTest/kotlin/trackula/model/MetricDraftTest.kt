package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class MetricDraftTest {
    private val water = MetricDraft(
        name = " Water ",
        icon = "water_drop",
        kind = MetricKind.COUNT,
        unit = "glasses",
        step = "1",
        group = "Nutrition",
        target = "8",
    )

    @Test
    fun aValidDraftGivesTheMetric() {
        val check = water.check("water")
        assertEquals(emptyMap(), check.errors)
        assertEquals(
            NumberMetric(
                id = "water",
                name = "Water",
                icon = "water_drop",
                unit = "glasses",
                isCount = true,
                goal = NumberGoal(8.0),
                group = "Nutrition",
            ),
            check.metric,
        )
    }

    @Test
    fun aDraftWithEmptyAndInvalidFieldsGivesAnErrorForEachField() {
        val check = MetricDraft(kind = MetricKind.NUMBER, step = "0", target = "lots", start = "x").check("w")
        assertNull(check.metric)
        assertEquals(
            setOf(DraftField.NAME, DraftField.ICON, DraftField.STEP, DraftField.TARGET, DraftField.START),
            check.errors.keys,
        )
        assertEquals("Enter a number.", check.errors[DraftField.TARGET])
    }

    @Test
    fun theStartMustBeOnTheOtherSideOfTheTarget() {
        val check = water.copy(direction = GoalDirection.AT_MOST, target = "80", start = "78").check("w")
        assertEquals("The start must be above the target.", check.errors[DraftField.START])
    }

    @Test
    fun aLongTextIsNotAnIcon() {
        assertTrue(DraftField.ICON in water.copy(icon = "A long text icon!").check("w").errors)
        assertEquals(emptyMap(), water.copy(icon = "💧").check("w").errors)
    }

    @Test
    fun theTrendIsOnlyForANumberMetricAndADecimalCanHaveAComma() {
        val count = water.copy(usesTrend = true, target = "7,5").check("w").metric as NumberMetric
        assertEquals(NumberGoal(7.5), count.goal)
        val number = water.copy(kind = MetricKind.NUMBER, usesTrend = true).check("w").metric as NumberMetric
        assertTrue(number.goal.usesTrend)
    }

    @Test
    fun aYesNoDraftHasNoUnitStepOrNumberGoal() {
        val draft = water.copy(kind = MetricKind.YES_NO, step = "bad", target = "bad", goalIsYes = false)
        val metric = draft.check("smoke").metric
        assertEquals(YesNoMetric("smoke", "Water", "water_drop", "Nutrition", goalIsYes = false), metric)
    }

    @Test
    fun theDraftOfAMetricGivesTheSameMetricBack() {
        val metrics = listOf(
            NumberMetric("weight", "Weight", "monitor_weight", NumberGoal(80.0, true, 84.0, true), "kg", 0.1),
            NumberMetric("waist", "Waist", "straighten", NumberGoal(90.0, isMaximum = true), "cm", 0.5),
            YesNoMetric("teeth", "Teeth", "dentistry", "Hygiene", goalIsYes = false),
        )
        for (m in metrics) assertEquals(m, draftOf(m).check(m.id).metric, m.id)
    }

    @Test
    fun theDraftOfAnInvalidRowKeepsTheValuesThatTheAppCanRead() {
        val table = parseMetrics(
            rows(
                metricsHeader,
                listOf("walk", "Walk", "count", "min", 10, "Activities", "", "at least 30"),
                listOf("run", "Run", "count", "km", "", "", "directions_run", "lots"),
            ),
        )
        val walk = draftOf(table.invalid[0])
        assertEquals(
            MetricDraft(
                name = "Walk",
                kind = MetricKind.COUNT,
                unit = "min",
                step = "10",
                group = "Activities",
                target = "30",
            ),
            walk,
        )
        val run = draftOf(table.invalid[1])
        assertEquals("lots", run.target)
        assertEquals("directions_run", run.icon)
    }

    @Test
    fun theDraftOfARowWithoutGoalAsksForTheGoal() {
        val table = parseMetrics(
            rows(
                metricsHeader,
                listOf("waist", "Waist", "number", "cm", 0.5, "", "straighten"),
                listOf("read", "Read", "yesno", "", "", "", "menu_book", ""),
            ),
        )
        val waist = draftOf(table.invalid[0])
        assertEquals(GoalDirection.AT_LEAST, waist.direction)
        assertEquals("Enter a number.", waist.check("waist").errors[DraftField.TARGET])
        val read = draftOf(table.invalid[1])
        assertEquals(YesNoMetric("read", "Read", "menu_book", goalIsYes = true), read.check("read").metric)
    }

    @Test
    fun theDraftOfADeletedMetricHasANameFromTheId() {
        val draft = draftOf(DeletedMetric("morning_teeth", 3, null, isYesNo = true))
        assertEquals("Morning teeth", draft.name)
        assertEquals(MetricKind.YES_NO, draft.kind)
        val steps = draftOf(DeletedMetric("steps", 3, null, isYesNo = false))
        assertEquals(MetricKind.NUMBER, steps.kind)
        assertEquals("Enter a number.", steps.check("steps").errors[DraftField.TARGET])
    }

    @Test
    fun aNewNumberDraftWithoutTargetGivesAnError() {
        val check = water.copy(target = " ").check("water")
        assertNull(check.metric)
        assertEquals(mapOf(DraftField.TARGET to "Enter a number."), check.errors)
    }

    @Test
    fun aMetricWithValuesCannotChangeBetweenYesNoAndTheOtherKinds() {
        assertTrue(canChangeKind(MetricKind.NUMBER, MetricKind.COUNT, hasValues = true))
        assertFalse(canChangeKind(MetricKind.YES_NO, MetricKind.COUNT, hasValues = true))
        assertTrue(canChangeKind(MetricKind.YES_NO, MetricKind.COUNT, hasValues = false))
    }

    @Test
    fun theSummariesShowTheKindTheUnitTheGroupAndTheGoal() {
        val goal = NumberGoal(80.0, isMaximum = true, from = 83.0)
        val weight = NumberMetric("weight", "Weight", "monitor_weight", goal, "kg", group = "Health")
        assertEquals("Number · kg · Health", metricSummary(weight))
        assertEquals("at most 80 from 83", goalSummary(weight))
        assertEquals("Yes/no", metricSummary(YesNoMetric("read", "Read", "menu_book")))
        assertEquals("no", goalSummary(YesNoMetric("smoke", "Smoke", "smoking_rooms", goalIsYes = false)))
    }

    @Test
    fun theGoalExamplesGiveThePointsOfThreeValues() {
        assertEquals(
            listOf("8 glasses or more: 1 point", "4 glasses: 0.5 points", "0 glasses: 0 points"),
            goalExamples(NumberGoal(8.0), "glasses"),
        )
        assertEquals(
            listOf("80 kg or less: 1 point", "81.5 kg: 0.5 points", "83 kg: 0 points"),
            goalExamples(NumberGoal(80.0, isMaximum = true, from = 83.0), "kg"),
        )
        assertEquals(listOf("2 or less: 1 point", "Other values: 0 points"), goalExamples(NumberGoal(2.0, true), null))
    }

    @Test
    fun thePreviewGoalIsTheGoalOfAValidTargetAndStart() {
        assertEquals(NumberGoal(8.0), water.previewGoal())
        assertEquals(NumberGoal(8.0, from = 2.0), water.copy(start = "2").previewGoal())
        assertNull(water.copy(start = "9").previewGoal())
        assertNull(water.copy(target = "").previewGoal())
        assertNull(water.copy(kind = MetricKind.YES_NO).previewGoal())
    }

    @Test
    fun theDeletedSummaryGivesTheNumberOfValuesAndTheLastDay() {
        assertEquals("142 values · last on Oct 30", deletedSummary(DeletedMetric("s", 142, Day(2026, 10, 30), false)))
        assertEquals("1 value · last on Oct 3", deletedSummary(DeletedMetric("s", 1, Day(2026, 10, 3), false)))
        assertEquals("No values", deletedSummary(DeletedMetric("s", 0, null, false)))
    }
}
