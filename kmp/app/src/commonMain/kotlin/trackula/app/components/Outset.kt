package trackula.app.components

import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.constrainWidth
import androidx.compose.ui.unit.offset

/**
 * Makes the modifiers after it [horizontal] larger on the left and on the right, and [vertical] larger at the top and
 * at the bottom. The layout does not change: the element keeps its size and its position. Use it with the same
 * padding after the click modifier, so that the hover and press highlight has space around the content, and the
 * content stays aligned with the other content.
 *
 * Example: `Modifier.outset(8.dp, 4.dp).clip(shape).clickable { }.padding(horizontal = 8.dp, vertical = 4.dp)`. A
 * click in the outset space does nothing: the click area is the size of the element.
 */
fun Modifier.outset(horizontal: Dp, vertical: Dp): Modifier = layout { measurable, constraints ->
    val x = horizontal.roundToPx()
    val y = vertical.roundToPx()
    val placeable = measurable.measure(constraints.offset(2 * x, 2 * y))
    val width = constraints.constrainWidth(placeable.width - 2 * x)
    val height = constraints.constrainHeight(placeable.height - 2 * y)
    layout(width, height) { placeable.place(-x, -y) }
}
