package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals

class MainViewTest {
    @Test
    fun daysUntilGivesTheDaysOfTheViewOldestFirstEndingOnToday() {
        val today = Day(2026, 10, 2)
        assertEquals(listOf(today), MainView.TODAY.daysUntil(today))
        assertEquals(
            listOf("2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"),
            MainView.SHORT.daysUntil(today).map { "$it" },
        )
        assertEquals(31, MainView.MONTH.daysUntil(today).size)
    }

    @Test
    fun labels() {
        assertEquals(listOf("Today", "5 days", "31 days", "Score"), MainView.entries.map { it.label })
    }
}
