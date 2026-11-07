package trackula.model

/**
 * The views of the bottom navigation bar: today as input tiles, a table of the last 5 days on all screens, one small
 * calendar per metric for the last 31 days, or the score only.
 *
 * @property days The number of past days that the view shows. Null for [SCORE]: it shows all days, with zoom buttons.
 */
enum class MainView(val days: Int?) {
    TODAY(1),
    SHORT(5),
    MONTH(31),
    SCORE(null),
    ;

    /** The label in the bottom navigation bar. */
    val label: String
        get() = when (this) {
            TODAY -> "Today"
            SCORE -> "Score"
            else -> "$days days"
        }

    /** The Material Symbols icon in the bottom navigation bar. */
    val icon: String
        get() = when (this) {
            TODAY -> "today"
            SHORT -> "view_week"
            MONTH -> "calendar_month"
            SCORE -> "show_chart"
        }

    /** The days of the view, oldest first, ending on [today]. Only for a view with [days]. */
    fun daysUntil(today: Day): List<Day> = daysBetween(today.addDays(1 - days!!), today)
}
