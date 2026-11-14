package trackula.model

/**
 * The place where a dragged item of a list lands: the index of the item that is at that place now. [from] is the index
 * of the dragged item, [offset] is how far it moved down (negative: up), and [heights] are the heights of all the
 * items, in the same unit. The dragged item goes past an item when it moves past the middle of that item.
 *
 * Examples: 3 items of height 50. The first item moved 30 down lands at 1. Moved 20 down, it stays at 0. Moved 80
 * down, it lands at 2.
 */
fun dropIndex(from: Int, offset: Float, heights: List<Float>): Int {
    var to = from
    var passed = 0f
    if (offset > 0) {
        while (to + 1 < heights.size && offset > passed + heights[to + 1] / 2) {
            passed += heights[to + 1]
            to++
        }
    } else {
        while (to - 1 >= 0 && -offset > passed + heights[to - 1] / 2) {
            passed += heights[to - 1]
            to--
        }
    }
    return to
}

/**
 * How far the item [index] moves to make space while the item [from] is over the place [to]: the items between the
 * two places move up or down by the [height] of the dragged item. Other items, and the dragged item, do not move.
 *
 * Example: the item 0 of height 50 is over the place 2. The items 1 and 2 move 50 up: -50.
 */
fun dragShift(index: Int, from: Int, to: Int, height: Float): Float = when (index) {
    in from + 1..to -> -height
    in to until from -> height
    else -> 0f
}
