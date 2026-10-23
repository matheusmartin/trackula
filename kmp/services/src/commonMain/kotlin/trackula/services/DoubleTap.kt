package trackula.services

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds

/**
 * A filter that tells single taps from double-taps. One tap waits at a time, for any key, such as a cell.
 *
 * A single tap runs only when [wait] ends without a second tap on the same key. A second tap in that time
 * is a double-tap: it runs at once and the single tap is dropped. A tap on another key runs the waiting
 * single tap at once. Fast repeated taps on one key alternate: 3 quick taps are a double-tap and a single tap.
 *
 * The wait runs in [scope]. Cancel the scope, or call [dispose], when the input goes away.
 */
class DoubleTap<K>(private val scope: CoroutineScope, private val wait: Duration = 300.milliseconds) {
    private var key: K? = null
    private var single: (() -> Unit)? = null
    private var timer: Job? = null

    /** True while a single tap waits. */
    private val waiting: Boolean get() = timer?.isActive == true

    /** Adds a tap on [key]. [onSingle] runs after [wait] if no second tap comes, and [onDouble] runs at the second tap. */
    fun tap(key: K, onSingle: () -> Unit, onDouble: () -> Unit) {
        if (waiting && this.key == key) {
            timer?.cancel()
            single = null
            onDouble()
            return
        }
        flush()
        this.key = key
        single = onSingle
        timer = scope.launch {
            delay(wait)
            // The wait has ended: a tap in onSingle is a new tap, not a double-tap.
            timer = null
            runSingle()
        }
    }

    /** Runs the waiting single tap at once, if there is one. */
    fun flush() {
        if (!waiting) return
        timer?.cancel()
        runSingle()
    }

    /** Runs the waiting single tap, and removes it so that it runs only once. */
    private fun runSingle() {
        val single = single
        this.single = null
        single?.invoke()
    }

    fun dispose() {
        timer?.cancel()
    }
}
