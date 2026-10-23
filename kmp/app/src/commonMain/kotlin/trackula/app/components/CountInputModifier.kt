package trackula.app.components

import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.isSecondaryPressed
import androidx.compose.ui.input.pointer.pointerInput
import kotlinx.coroutines.withTimeoutOrNull
import trackula.services.CountInput

/**
 * Sends the presses, clicks and keys of a count cell or tile to [input]. [add] gets +1 or −1. See [CountInput].
 *
 * - A mouse press with the right button is a right-click: it subtracts at once.
 * - A touch press that is longer than the long-press time is a long-press: it does nothing, as on Android.
 * - Enter and Space are a keyboard click. `+`, `=` and `-` add and subtract.
 */
fun <K> Modifier.countInput(input: CountInput<K>, key: K, add: (sign: Int) -> Unit): Modifier = this
    .pointerInput(input, key) {
        awaitEachGesture {
            // A raw press event: awaitFirstDown does not see a press of the right mouse button.
            var press = awaitPointerEvent()
            while (press.type != PointerEventType.Press) press = awaitPointerEvent()
            val down = press.changes.first()
            input.pointerDown(pointerTypeName(down.type))
            if (press.buttons.isSecondaryPressed) {
                press.changes.forEach { it.consume() }
                input.contextMenu(add)
                do {
                    val event = awaitPointerEvent()
                } while (event.type != PointerEventType.Release && event.changes.any { it.pressed })
                return@awaitEachGesture
            }
            val touch = down.type == PointerType.Touch || down.type == PointerType.Stylus
            val up = if (touch) {
                withTimeoutOrNull(viewConfiguration.longPressTimeoutMillis) { waitForUpOrCancellation() }
                    ?: return@awaitEachGesture input.contextMenu(add)
            } else {
                waitForUpOrCancellation() ?: return@awaitEachGesture
            }
            up.consume()
            input.click(key, add)
        }
    }
    .onKeyEvent { event ->
        if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
        when (event.key) {
            Key.Enter, Key.NumPadEnter, Key.Spacebar -> {
                input.click(key, add)
                true
            }

            Key.Plus, Key.NumPadAdd, Key.Equals -> input.keyDown("+", add)

            Key.Minus, Key.NumPadSubtract -> input.keyDown("-", add)

            else -> false
        }
    }
    .focusable()

/** The name of [type] as in the `pointerType` of a browser event: `mouse`, `touch` or `pen`. */
private fun pointerTypeName(type: PointerType): String = when (type) {
    PointerType.Touch -> "touch"
    PointerType.Stylus, PointerType.Eraser -> "pen"
    else -> "mouse"
}
