package trackula.services

import kotlinx.coroutines.CoroutineScope

/**
 * The input handler of count cells and tiles. It turns clicks, keys and taps into steps: +1 adds the metric step,
 * −1 subtracts it.
 *
 * - Mouse and keyboard: a click adds a step at once, so two quick clicks add two steps. A right-click subtracts.
 * - Touch: a tap adds a step after the double-tap wait, and a double-tap subtracts instead. See [DoubleTap].
 *   A long-press also opens the context menu on Android: it does nothing.
 * - Keys on a focused cell: `+` adds, `-` subtracts.
 *
 * The UI sends the browser events of the cell to the functions of this class, and always prevents the browser menu
 * on a count cell. [K] identifies a cell, for example a metric id and a day.
 */
class CountInput<K>(scope: CoroutineScope) {
    /** Touch taps: a tap waits for a second tap on the same cell. */
    private val taps = DoubleTap<K>(scope)

    /**
     * The pointer type of the last press: `mouse`, `touch` or `pen`. Null after the click, so a keyboard click (Enter
     * or Space) works like a mouse click.
     */
    private var pressType: String? = null

    /** Handles a `pointerdown` event with the `pointerType` of the event. */
    fun pointerDown(pointerType: String) {
        pressType = pointerType
    }

    /** Handles a click on the cell [key]. [add] gets +1 or −1. */
    fun click(key: K, add: (sign: Int) -> Unit) {
        if (takeTouchPress()) {
            taps.tap(key, onSingle = { add(1) }, onDouble = { add(-1) })
        } else {
            addNow(add, 1)
        }
    }

    /** Handles a `contextmenu` event: a right-click subtracts. A touch long-press does nothing. */
    fun contextMenu(add: (sign: Int) -> Unit) {
        if (!takeTouchPress()) addNow(add, -1)
    }

    /**
     * Handles a `keydown` event with the `key` of the event. Returns true if the key is an input: then the UI prevents
     * the default action of the key.
     */
    fun keyDown(key: String, add: (sign: Int) -> Unit): Boolean {
        val sign = when (key) {
            "+", "=" -> 1
            "-" -> -1
            else -> return false
        }
        addNow(add, sign)
        return true
    }

    fun dispose() = taps.dispose()

    /** Adds at once. A waiting touch tap runs first, so the steps keep their order. */
    private fun addNow(add: (sign: Int) -> Unit, sign: Int) {
        taps.flush()
        add(sign)
    }

    /** True if the last press was a touch or a pen. Clears the press. */
    private fun takeTouchPress(): Boolean {
        val touch = pressType == "touch" || pressType == "pen"
        pressType = null
        return touch
    }
}
