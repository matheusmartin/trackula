package trackula.model

/**
 * A calendar day without time or time zone. Stored as `YYYY-MM-DD`.
 *
 * The constructor does not check the values. A value out of range moves the day as in [Day.of], but [equals] and
 * [toString] use the values as they are: so use [Day.of] for values out of range, and [tryParse] for text.
 */
data class Day(val year: Int, val month: Int, val day: Int) : Comparable<Day> {
    /** The number of days since 1970-01-01. Negative before that day. */
    val epochDay: Int get() = epochDayOf(year, month, day)

    /** 1 = Monday, 7 = Sunday. */
    val weekday: Int get() = (epochDay + 3).mod(7) + 1

    fun addDays(n: Int): Day = fromEpochDay(epochDay + n)

    /** The Google Sheets date serial number of this day. Example: 2026-10-02 → 46297. */
    val serial: Int get() = epochDay - SHEETS_EPOCH_DAY

    override fun toString(): String =
        "${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}"

    override fun compareTo(other: Day): Int = compareValuesBy(this, other, Day::year, Day::month, Day::day)

    companion object {
        /**
         * The day of [year], [month] and [day]. Values out of range go into the next or previous months and years, as
         * in a Dart `DateTime`. Examples: (2026, 13, 1) → 2027-01-01, (2026, 3, 0) → 2026-02-28.
         */
        fun of(year: Int, month: Int, day: Int): Day = fromEpochDay(epochDayOf(year, month, day))

        /** The day that is [epochDay] days after 1970-01-01. */
        fun fromEpochDay(epochDay: Int): Day {
            // The days_from_civil algorithm in reverse, by Howard Hinnant. The year starts on March 1.
            val z = epochDay + 719468
            val era = (if (z >= 0) z else z - 146096) / 146097
            val dayOfEra = z - era * 146097
            val yearOfEra = (dayOfEra - dayOfEra / 1460 + dayOfEra / 36524 - dayOfEra / 146096) / 365
            val dayOfYear = dayOfEra - (365 * yearOfEra + yearOfEra / 4 - yearOfEra / 100)
            val shiftedMonth = (5 * dayOfYear + 2) / 153
            val day = dayOfYear - (153 * shiftedMonth + 2) / 5 + 1
            val month = if (shiftedMonth < 10) shiftedMonth + 3 else shiftedMonth - 9
            return Day(yearOfEra + era * 400 + (if (month <= 2) 1 else 0), month, day)
        }

        /**
         * The day of a Google Sheets date serial number. A fraction (the time of day) is ignored.
         * Returns null for a serial number below 1 or after 9999-12-31, and for NaN. Example: 46297 → 2026-10-02.
         */
        fun fromSerial(serial: Double): Day? = if (serial >= 1 && serial < MAX_SERIAL + 1) {
            fromEpochDay(kotlin.math.floor(serial).toInt() + SHEETS_EPOCH_DAY)
        } else {
            null
        }

        private val pattern = Regex("""^(\d{4})-(\d{2})-(\d{2})$""")

        /** The day of a `YYYY-MM-DD` text. Null if [text] is not a valid date. */
        fun tryParse(text: String): Day? {
            val match = pattern.matchEntire(text.trim()) ?: return null
            val (year, month, day) = match.destructured
            val d = Day(year.toInt(), month.toInt(), day.toInt())
            // Reject dates such as 2026-02-30.
            return if (of(d.year, d.month, d.day) == d) d else null
        }

        /** Day 0 of the Google Sheets date count, 1899-12-30, as days since 1970-01-01. */
        private const val SHEETS_EPOCH_DAY = -25569

        /** The serial number of 9999-12-31, the last day that Google Sheets shows. */
        private const val MAX_SERIAL = 2958465

        /**
         * The days_from_civil algorithm by Howard Hinnant. The year starts on March 1, so February is the last month.
         * Values out of range go into the next or previous months and years, as in [of]: the algorithm gets the first
         * day of the month in range, and then the function adds [day] - 1 days.
         */
        private fun epochDayOf(year: Int, month: Int, day: Int): Int {
            val m = (month - 1).mod(12) + 1
            val y = year + (month - 1).floorDiv(12) - (if (m <= 2) 1 else 0)
            val era = (if (y >= 0) y else y - 399) / 400
            val yearOfEra = y - era * 400
            val dayOfYear = (153 * (if (m > 2) m - 3 else m + 9) + 2) / 5
            val dayOfEra = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear
            return era * 146097 + dayOfEra - 719468 + day - 1
        }
    }
}

/** All days from [first] to [last], oldest first. Empty if [last] is before [first]. */
fun daysBetween(first: Day, last: Day): List<Day> = (first.epochDay..last.epochDay).map(Day::fromEpochDay)

/** The earliest day of [days]. Null if [days] is empty. */
fun earliestDay(days: Iterable<Day>): Day? = days.minOrNull()

/** A month of the calendar. */
data class MonthKey(val year: Int, val month: Int)

/** The month of [day]. */
fun monthOf(day: Day): MonthKey = MonthKey(day.year, day.month)

/** The month [delta] months after [month], or before it if [delta] is negative. */
fun addMonths(month: MonthKey, delta: Int): MonthKey = monthOf(Day.of(month.year, month.month + delta, 1))

/** All days of [month], oldest first. */
fun daysOfMonth(month: MonthKey): List<Day> =
    daysBetween(Day(month.year, month.month, 1), Day.of(month.year, month.month + 1, 0))

/** [days] in week rows, Monday to Sunday. Null fills the days before the first day and after the last day. */
fun weekRows(days: List<Day>): List<List<Day?>> {
    val slots = MutableList<Day?>(days.first().weekday - 1) { null }
    slots.addAll(days)
    while (slots.size % 7 != 0) slots.add(null)
    return slots.chunked(7)
}
