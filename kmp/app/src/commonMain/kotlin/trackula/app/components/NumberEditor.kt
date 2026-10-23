package trackula.app.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.isPrimaryPressed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import trackula.app.LocalExtraColors
import trackula.model.NumberMetric
import trackula.model.formatStep
import trackula.model.formatTrimmed
import trackula.model.parseDecimal
import trackula.model.roundHalfAwayFromZero
import trackula.model.roundToStep
import trackula.model.withUnit
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.truncate

/** The space between two ruler ticks. */
private val TICK = 9.dp

/** The number of ticks that the ruler shows on each side of the value. */
private const val TICKS = 60

/**
 * Editor for one day of a `number` metric. `count` metrics use taps instead. See HabitTable.
 *
 * - Ruler: drag it with a finger or the mouse, or scroll on it. It snaps to the metric step. One tick is one step.
 *   With [onChange] (the Today tiles), only a side scroll moves it: a vertical scroll scrolls the page.
 * - Text field: exact values, for example a first value. "81.9" and "81,9" both work.
 * - Save: saves the value. With an empty text field, Save clears the day.
 * - Keys: Enter saves, Escape closes. Arrow keys: one step. On the ruler, Page Up and Page Down: 10 steps.
 *
 * An empty day starts at [start], the value of the nearest other day.
 *
 * - [label]: the metric and the day for screen readers, for example "Weight · today".
 * - [current]: the value of the day. Null if the day is empty.
 * - [start]: the value that an empty day starts at. Null if the metric has no value on another day.
 * - [autofocus]: true if the ruler gets the focus at the start. False when many editors show at the same time, as on
 *   the Today tiles.
 * - [onChange]: called with the value at each change, and when the user presses the ruler without a move: that
 *   confirms the value. Null after the text field is emptied. With [onChange], the editor shows no Save button, and
 *   Enter does nothing: the parent saves.
 * - [compact]: a smaller value and ruler, for the Today tiles.
 */
@Composable
fun NumberEditor(
    metric: NumberMetric,
    label: String,
    current: Double?,
    start: Double?,
    busy: Boolean,
    onSave: (Double) -> Unit,
    onClear: () -> Unit,
    onClose: () -> Unit,
    autofocus: Boolean = true,
    onChange: ((Double?) -> Unit)? = null,
    compact: Boolean = false,
) {
    val step = metric.step
    val change by rememberUpdatedState(onChange)
    var value by remember { mutableDoubleStateOf(current ?: start ?: 0.0) }
    // The text field. Empty if the metric has no value on any day.
    var text by remember { mutableStateOf(if (current == null && start == null) "" else formatStep(value, step)) }
    var error by remember { mutableStateOf<String?>(null) }
    val colors = MaterialTheme.colorScheme

    fun set(v: Double, snap: Boolean = false) {
        val rounded = roundToStep(v, step, snap)
        if (rounded == value && error == null && text == formatStep(rounded, step)) return
        value = rounded
        text = formatStep(rounded, step)
        error = null
        change?.invoke(rounded)
    }

    // The ruler follows the text field while the user types a valid number.
    fun type(newText: String) {
        text = newText
        error = null
        val typed = parseDecimal(newText)
        if (typed != null) {
            value = typed
            change?.invoke(typed)
        } else if (newText.isBlank()) {
            change?.invoke(null)
        }
    }

    // Saves the value. An empty text field clears the day.
    fun save() {
        if (change != null) return
        val typed = parseDecimal(text)
        when {
            typed != null -> onSave(typed)
            text.isBlank() && current != null -> onClear()
            else -> error = "Enter a number, for example ${formatStep(start ?: (step * 10), step)}."
        }
    }

    fun fieldKey(event: KeyEvent): Boolean {
        if (event.type != KeyEventType.KeyDown) return false
        when (event.key) {
            Key.Enter, Key.NumPadEnter -> save()
            Key.Escape -> onClose()
            Key.DirectionUp -> set(value + step)
            Key.DirectionDown -> set(value - step)
            else -> return false
        }
        return true
    }

    fun rulerKey(event: KeyEvent): Boolean {
        if (event.type != KeyEventType.KeyDown) return false
        val steps = when (event.key) {
            Key.Enter, Key.NumPadEnter -> return true.also { save() }
            Key.Escape -> return true.also { onClose() }
            Key.DirectionRight, Key.DirectionUp -> 1
            Key.DirectionLeft, Key.DirectionDown -> -1
            Key.PageUp -> 10
            Key.PageDown -> -10
            else -> return false
        }
        set(value + steps * step)
        return true
    }

    Column(
        modifier = Modifier.fillMaxWidth().semantics { contentDescription = label },
        verticalArrangement = Arrangement.spacedBy(if (compact) 4.dp else 8.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val fontSize = if (compact) 22.sp else 28.sp
            BasicTextField(
                value = text,
                onValueChange = ::type,
                modifier = Modifier
                    .width(if (compact) 96.dp else 120.dp)
                    .semantics { contentDescription = withUnit(metric.name, metric.unit) }
                    .onPreviewKeyEvent(::fieldKey),
                textStyle = TextStyle(
                    color = LocalContentColor.current,
                    fontSize = fontSize,
                    fontWeight = FontWeight.Medium,
                    textAlign = TextAlign.Center,
                ),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                cursorBrush = SolidColor(colors.primary),
            )
            metric.unit?.let { Text(it, color = colors.onSurfaceVariant) }
        }
        Ruler(
            metric = metric,
            value = value,
            start = start,
            compact = compact,
            pageScrolls = onChange != null,
            autofocus = autofocus,
            onPress = { change?.invoke(value) },
            onSet = ::set,
            onKey = ::rulerKey,
        )
        if (onChange == null) {
            Button(onClick = ::save, enabled = !busy) { Text("Save") }
        }
        error?.let { Text(it, color = colors.error) }
    }
}

/**
 * Ticks around the value: a long tick with a label every 10 steps, a middle tick every 5 steps. The strip moves, and
 * the needle stays in the middle. A green tick marks [start] on the nearest tick: it moves with the strip and shows
 * how far the value is from it. At the start value, the green tick does not show: under the needle, the two colors
 * mix.
 *
 * Dragging to the left moves the ticks to the left, so the value under the needle gets bigger. With [pageScrolls],
 * a vertical wheel scrolls the page, and only a side wheel or trackpad swipe moves the ruler.
 */
@Composable
private fun Ruler(
    metric: NumberMetric,
    value: Double,
    start: Double?,
    compact: Boolean,
    pageScrolls: Boolean,
    autofocus: Boolean,
    onPress: () -> Unit,
    onSet: (Double, Boolean) -> Unit,
    onKey: (KeyEvent) -> Boolean,
) {
    val step = metric.step
    val colors = MaterialTheme.colorScheme
    val done = LocalExtraColors.current.done
    val currentValue by rememberUpdatedState(value)
    val press by rememberUpdatedState(onPress)
    val set by rememberUpdatedState(onSet)
    val focus = remember { FocusRequester() }
    var focused by remember { mutableStateOf(false) }
    // The pointer x and the value at the press. A drag measures from the press, not from the end of the touch slop.
    var pressX by remember { mutableFloatStateOf(0f) }
    var pressValue by remember { mutableDoubleStateOf(value) }
    // False after a press of another mouse button than the primary button: then a drag does nothing.
    var primaryPress by remember { mutableStateOf(true) }
    // Wheel movement that is less than one tick, in ticks.
    var wheel by remember { mutableFloatStateOf(0f) }
    val measurer = rememberTextMeasurer()
    val shape = RoundedCornerShape(8.dp)
    val labelStyle = TextStyle(color = colors.onSurfaceVariant, fontSize = 11.sp)
    val valueText = withUnit(formatStep(value, step), metric.unit)

    LaunchedEffect(Unit) { if (autofocus) focus.requestFocus() }

    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(if (compact) 44.dp else 52.dp)
            .background(colors.surfaceContainerLowest, shape)
            .border(
                width = if (focused) 2.dp else 1.dp,
                color = when {
                    !focused -> colors.primary.copy(alpha = 0.12f).compositeOver(colors.outlineVariant)
                    pageScrolls -> done
                    else -> colors.primary
                },
                shape = shape,
            )
            .focusRequester(focus)
            .onFocusChanged { focused = it.isFocused }
            .onKeyEvent(onKey)
            .focusable()
            .semantics {
                contentDescription = "${metric.name} ruler"
                stateDescription = valueText
                setProgress { target ->
                    set(target.toDouble(), true)
                    true
                }
            }
            .pointerInput(Unit) {
                // A press confirms the value, also without a move.
                awaitEachGesture {
                    // A raw press event: awaitFirstDown does not see a press of the right mouse button.
                    var event = awaitPointerEvent()
                    while (event.type != PointerEventType.Press) event = awaitPointerEvent()
                    val down = event.changes.first()
                    primaryPress = down.type != PointerType.Mouse || event.buttons.isPrimaryPressed
                    if (!primaryPress) return@awaitEachGesture
                    focus.requestFocus()
                    pressX = down.position.x
                    pressValue = currentValue
                    press()
                }
            }
            .pointerInput(step) {
                detectHorizontalDragGestures { change, _ ->
                    if (!primaryPress) return@detectHorizontalDragGestures
                    change.consume()
                    set(pressValue - (change.position.x - pressX) / TICK.toPx() * step, true)
                }
            }
            .pointerInput(step, pageScrolls) {
                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent()
                        if (event.type != PointerEventType.Scroll) continue
                        val delta = event.changes.first().scrollDelta
                        if (pageScrolls && abs(delta.y) >= abs(delta.x)) continue
                        event.changes.forEach { it.consume() }
                        // On the web, Compose gives the wheel movement in pixels, as the browser: 9 pixels are one tick.
                        wheel += (if (abs(delta.x) > abs(delta.y)) delta.x else delta.y) / TICK.value
                        val steps = truncate(wheel)
                        if (steps != 0f) {
                            wheel -= steps
                            set(currentValue + steps * step, true)
                        }
                    }
                }
            },
    ) {
        val tick = TICK.toPx()
        val center = size.width / 2
        val position = value / step
        val centerTick = roundHalfAwayFromZero(position).toInt()
        val startTick = start?.let { roundHalfAwayFromZero(it / step).toInt() }?.takeIf { it != centerTick }
        val line = colors.onSurface.copy(alpha = 0.25f)
        for (k in max(0, centerTick - TICKS)..centerTick + TICKS) {
            val x = center + ((k - position) * tick).toFloat()
            if (x < -tick || x > size.width + tick) continue
            val (height, color) = when {
                k % 10 == 0 -> 24.dp.toPx() to colors.onSurfaceVariant
                k % 5 == 0 -> 16.dp.toPx() to line
                else -> 10.dp.toPx() to line
            }
            drawLine(color, Offset(x, 0f), Offset(x, height), strokeWidth = 1.dp.toPx())
            if (k == startTick) drawLine(done, Offset(x, 0f), Offset(x, size.height), strokeWidth = 2.dp.toPx())
            if (k % 10 == 0) {
                val layout = measurer.measure(formatTrimmed(roundToStep(k * step, step)), labelStyle)
                val top = if (compact) 24.dp.toPx() else 28.dp.toPx()
                drawText(layout, topLeft = Offset(x - layout.size.width / 2f, top))
            }
        }
        drawLine(colors.primary, Offset(center, 0f), Offset(center, size.height), strokeWidth = 2.dp.toPx())
    }
}
