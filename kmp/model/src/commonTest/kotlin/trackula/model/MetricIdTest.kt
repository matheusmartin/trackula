package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals

class MetricIdTest {
    @Test
    fun theIdComesFromTheNameInLowercaseWithUnderscoresBetweenTheWords() {
        assertEquals("morning_teeth", newMetricId("Morning teeth", emptySet()))
        assertEquals("walk_10_min", newMetricId("  Walk: 10 min! ", emptySet()))
        assertEquals("agua_cafe", newMetricId("Água & café", emptySet()))
    }

    @Test
    fun aTakenIdGetsANumber() {
        assertEquals("water_2", newMetricId("Water", setOf("water")))
        assertEquals("water_3", newMetricId("Water", setOf("water", "water_2")))
    }

    @Test
    fun aNameWithoutLettersOrDigitsAndTheLogHeadersGiveOtherIds() {
        assertEquals("metric", newMetricId("💧", emptySet()))
        assertEquals("date_2", newMetricId("Date", emptySet()))
        assertEquals("score_2", newMetricId("Score", emptySet()))
    }

    @Test
    fun aLongNameGivesAnIdOfAtMost40Characters() {
        assertEquals(40, newMetricId("a".repeat(50), emptySet()).length)
    }
}
