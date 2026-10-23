// advanceTimeBy and runCurrent move the virtual clock of the test.
@file:OptIn(ExperimentalCoroutinesApi::class)

package trackula.services

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.Duration.Companion.milliseconds

class DoubleTapTest {
    private val events = mutableListOf<String>()

    /** Runs [body] with a double-tap filter that waits 50 ms. The test clock is virtual: a pause takes no real time. */
    private fun doubleTapTest(body: suspend TestScope.(taps: DoubleTap<String>) -> Unit) = runTest {
        val taps = DoubleTap<String>(this, wait = 50.milliseconds)
        body(taps)
        taps.dispose()
    }

    private fun DoubleTap<String>.tap(key: String) = tap(key, { events.add("$key+") }, { events.add("$key-") })

    private fun TestScope.pause() {
        advanceTimeBy(80.milliseconds)
        runCurrent()
    }

    @Test
    fun aSingleTapRunsAfterTheWait() = doubleTapTest { taps ->
        taps.tap("a")
        assertEquals(emptyList(), events)
        pause()
        assertEquals(listOf("a+"), events)
    }

    @Test
    fun twoQuickTapsAreADoubleTapWithoutTheSingleTap() = doubleTapTest { taps ->
        taps.tap("a")
        taps.tap("a")
        pause()
        assertEquals(listOf("a-"), events)
    }

    @Test
    fun aTapOnAnotherKeyRunsTheWaitingSingleTapAtOnce() = doubleTapTest { taps ->
        taps.tap("a")
        taps.tap("b")
        assertEquals(listOf("a+"), events)
        pause()
        assertEquals(listOf("a+", "b+"), events)
    }

    @Test
    fun threeQuickTapsAreADoubleTapAndASingleTap() = doubleTapTest { taps ->
        taps.tap("a")
        taps.tap("a")
        taps.tap("a")
        pause()
        assertEquals(listOf("a-", "a+"), events)
    }

    @Test
    fun slowTapsAreSingleTaps() = doubleTapTest { taps ->
        taps.tap("a")
        pause()
        taps.tap("a")
        pause()
        assertEquals(listOf("a+", "a+"), events)
    }

    @Test
    fun flushRunsTheWaitingSingleTapAtOnceAndOnlyOnce() = doubleTapTest { taps ->
        taps.tap("a")
        taps.flush()
        assertEquals(listOf("a+"), events)
        pause()
        taps.flush()
        assertEquals(listOf("a+"), events)
    }

    @Test
    fun aTapInTheSingleTapIsANewTapNotADoubleTap() = doubleTapTest { taps ->
        taps.tap("a", { taps.tap("a") }, { events.add("a-") })
        pause()
        assertEquals(emptyList(), events)
        pause()
        assertEquals(listOf("a+"), events)
    }

    @Test
    fun disposeDropsTheWaitingSingleTap() = doubleTapTest { taps ->
        taps.tap("a")
        taps.dispose()
        pause()
        assertEquals(emptyList(), events)
    }
}
