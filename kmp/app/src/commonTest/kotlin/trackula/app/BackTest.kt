package trackula.app

import kotlin.test.Test
import kotlin.test.assertEquals

class BackTest {
    @Test
    fun backCallsTheNewestHandlerAndKeepsItsEntry() {
        val history = FakeHistory()
        val dispatcher = BackDispatcher(history)
        val calls = mutableListOf<String>()
        dispatcher.add { calls.add("detail") }
        dispatcher.add { calls.add("form") }
        assertEquals(2, history.entries)

        history.userBack()

        // The handler did not close its screen: its entry is there for the next back.
        assertEquals(listOf("form"), calls)
        assertEquals(2, history.entries)
    }

    @Test
    fun aHandlerThatClosesItsScreenRemovesItsEntry() {
        val history = FakeHistory()
        val dispatcher = BackDispatcher(history)
        var open = true
        lateinit var handler: () -> Unit
        handler = {
            open = false
            dispatcher.remove(handler)
        }
        dispatcher.add(handler)

        history.userBack()

        assertEquals(false, open)
        assertEquals(0, history.entries)
        // No handler: the next back does nothing in the app.
        history.userBack()
        assertEquals(0, history.entries)
    }

    @Test
    fun aScreenThatClosesWithItsOwnButtonRemovesItsEntryAndCallsNoHandler() {
        val history = FakeHistory()
        val dispatcher = BackDispatcher(history)
        val calls = mutableListOf<String>()
        val detail: () -> Unit = { calls.add("detail") }
        val form: () -> Unit = { calls.add("form") }
        dispatcher.add(detail)
        dispatcher.add(form)

        dispatcher.remove(form)

        assertEquals(emptyList(), calls)
        assertEquals(1, history.entries)
        history.userBack()
        assertEquals(listOf("detail"), calls)
    }
}
