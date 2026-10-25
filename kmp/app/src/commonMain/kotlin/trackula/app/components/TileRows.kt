package trackula.app.components

/**
 * The rows of a grid with [columns] columns, as the CSS grid `grid-auto-flow: row dense` of the Dart app places them.
 * A wide item takes a full row. A small item goes into the first row that has space, also a row before a wide item.
 * So small items fill the gaps, and the small items in a row have the same height. [isWide] tells the wide items.
 * Each row is a list of the indexes of its items.
 *
 * Example: 3 columns, items small, wide, small → rows [0, 2] and [1].
 */
fun <T> tileRows(items: List<T>, columns: Int, isWide: (T) -> Boolean): List<List<Int>> {
    require(columns > 0) { "A grid needs at least 1 column." }
    val rows = mutableListOf<MutableList<Int>>()
    val wideRows = mutableSetOf<Int>()
    items.forEachIndexed { i, item ->
        if (isWide(item)) {
            wideRows.add(rows.size)
            rows.add(mutableListOf(i))
        } else {
            val row = rows.indices.firstOrNull { it !in wideRows && rows[it].size < columns }
            if (row == null) rows.add(mutableListOf(i)) else rows[row].add(i)
        }
    }
    return rows
}
