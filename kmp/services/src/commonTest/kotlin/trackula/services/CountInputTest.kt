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
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.milliseconds

class CountInputTest {
    private val steps = mutableListOf<String>()

    /** Adds the step of a cell to [steps]: "a+1" or "a-1". */
    private fun add(key: String): (Int) -> Unit = { sign -> steps.add(if (sign > 0) "$key+1" else "$key-1") }

    private fun countInputTest(body: suspend TestScope.(input: CountInput<String>) -> Unit) = runTest {
        val input = CountInput<String>(this)
        body(input)
        input.dispose()
    }

    /** Waits longer than the double-tap wait. */
    private fun TestScope.pause() {
        advanceTimeBy(400.milliseconds)
        runCurrent()
    }

    private fun CountInput<String>.mouseClick(key: String) {
        pointerDown("mouse")
        click(key, add(key))
    }

    private fun CountInput<String>.touchTap(key: String) {
        pointerDown("touch")
        click(key, add(key))
    }

    @Test
    fun aMouseClickAddsAStepAtOnceAndTwoQuickClicksAddTwoSteps() = countInputTest { input ->
        input.mouseClick("a")
        input.mouseClick("a")
        assertEquals(listOf("a+1", "a+1"), steps)
    }

    @Test
    fun aRightClickSubtractsAStep() = countInputTest { input ->
        input.pointerDown("mouse")
        input.contextMenu(add("a"))
        assertEquals(listOf("a-1"), steps)
    }

    @Test
    fun aKeyboardClickWithoutAPressAddsAStepAtOnce() = countInputTest { input ->
        input.click("a", add("a"))
        assertEquals(listOf("a+1"), steps)
    }

    @Test
    fun aTouchTapAddsAStepAfterTheWaitAndATouchDoubleTapSubtracts() = countInputTest { input ->
        input.touchTap("a")
        assertEquals(emptyList(), steps)
        pause()
        assertEquals(listOf("a+1"), steps)

        input.touchTap("a")
        input.touchTap("a")
        pause()
        assertEquals(listOf("a+1", "a-1"), steps)
    }

    @Test
    fun aPenWorksLikeTouch() = countInputTest { input ->
        input.pointerDown("pen")
        input.click("a", add("a"))
        assertEquals(emptyList(), steps)
        pause()
        assertEquals(listOf("a+1"), steps)
    }

    @Test
    fun aTouchLongPressDoesNothing() = countInputTest { input ->
        input.pointerDown("touch")
        input.contextMenu(add("a"))
        pause()
        assertEquals(emptyList(), steps)
    }

    @Test
    fun keysAddAndSubtractAndOtherKeysAreNotAnInput() = countInputTest { input ->
        assertTrue(input.keyDown("+", add("a")))
        assertTrue(input.keyDown("=", add("a")))
        assertTrue(input.keyDown("-", add("a")))
        assertFalse(input.keyDown("Enter", add("a")))
        assertEquals(listOf("a+1", "a+1", "a-1"), steps)
    }

    @Test
    fun anInputAtOnceRunsAWaitingTouchTapFirstSoTheStepsKeepTheirOrder() = countInputTest { input ->
        input.touchTap("a")
        input.keyDown("-", add("b"))
        assertEquals(listOf("a+1", "b-1"), steps)
    }
}
