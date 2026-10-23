@file:OptIn(ExperimentalWasmJsInterop::class)

package trackula.services

import trackula.model.Day

/** Today in the time zone of the browser. */
fun today(): Day = Day.tryParse(localDateText()) ?: error("The browser gave a date that is not valid.")

/** Today as `YYYY-MM-DD` in the time zone of the browser. One `Date`, so the day cannot change between the parts. */
private fun localDateText(): String = js(
    """(() => {
        const d = new Date();
        const pad = (n, size) => String(n).padStart(size, '0');
        return pad(d.getFullYear(), 4) + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);
    })()""",
)
