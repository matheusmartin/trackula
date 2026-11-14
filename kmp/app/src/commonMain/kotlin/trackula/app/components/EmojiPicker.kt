package trackula.app.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import trackula.app.resources.Res
import trackula.model.Emoji
import trackula.model.parseEmojiList

/** The emojis after the first load. The list does not change while the app runs. */
private var loadedEmojis: List<Emoji>? = null

/** The emojis of the file `emoji.txt`. See design/emoji/make.py. Null if the file does not load. */
private suspend fun loadEmojis(): List<Emoji>? = loadedEmojis ?: try {
    parseEmojiList(Res.readBytes("files/emoji.txt").decodeToString()).also { loadedEmojis = it }
} catch (e: CancellationException) {
    throw e
} catch (_: Exception) {
    null
}

/**
 * The emoji picker of the metrics form: a grid of a fixed height, which scrolls, with all the emojis that the app can
 * show, in the order of Unicode and with the default skin tone. A tap on an emoji calls [onPick] with the emoji.
 *
 * [selected] is the icon of the form: its emoji has a frame. When the grid opens, it scrolls to that emoji.
 */
@Composable
fun EmojiPicker(selected: String, onPick: (String) -> Unit, modifier: Modifier = Modifier) {
    var emojis by remember { mutableStateOf(loadedEmojis) }
    var failed by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        if (emojis == null) {
            emojis = loadEmojis()
            failed = emojis == null
        }
    }
    val loaded = emojis
    when {
        loaded != null -> EmojiGrid(loaded, selected, onPick, modifier)
        failed -> Help("The emojis did not load. Reload the page to try again.", modifier)
        else -> Help("Loading the emojis…", modifier)
    }
}

/** The grid of [EmojiPicker]. */
@Composable
private fun EmojiGrid(emojis: List<Emoji>, selected: String, onPick: (String) -> Unit, modifier: Modifier) {
    val state = rememberLazyGridState()
    // Only when the grid opens: a tap on an emoji does not move the grid.
    LaunchedEffect(Unit) {
        val index = emojis.indexOfFirst { it.text == selected }
        if (index > 0) state.scrollToItem(index)
    }
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(12.dp)
    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = TOUCH_TARGET),
        state = state,
        modifier = modifier
            .fillMaxWidth()
            .height(GRID_HEIGHT)
            .background(colors.surfaceContainerLowest, shape)
            .border(1.dp, colors.outlineVariant, shape)
            .clip(shape)
            .padding(4.dp),
    ) {
        items(emojis, key = { it.text }) { emoji ->
            EmojiButton(emoji, selected = emoji.text == selected) { onPick(emoji.text) }
        }
    }
}

/** The height of the emoji grid: 6 rows. */
private val GRID_HEIGHT = TOUCH_TARGET * 6 + 8.dp

/**
 * A square button with [emoji]. Its name is the name of the button for screen readers and tests. The [selected]
 * button has a red frame and the color of a selected chip.
 */
@Composable
private fun EmojiButton(emoji: Emoji, selected: Boolean, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(10.dp)
    Box(
        modifier = Modifier
            .size(TOUCH_TARGET)
            .then(
                if (selected) {
                    Modifier.background(colors.primaryContainer, shape).border(2.dp, colors.primary, shape)
                } else {
                    Modifier
                },
            )
            .clip(shape)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics {
                contentDescription = emoji.name
                this.selected = selected
            },
        contentAlignment = Alignment.Center,
    ) {
        // The emoji fills a little more than half of the button.
        Text(emoji.text, Modifier.clearAndSetSemantics {}, fontSize = 26.sp, maxLines = 1)
    }
}

/** A short text in the color of secondary text. */
@Composable
private fun Help(text: String, modifier: Modifier) {
    Text(
        text,
        modifier = modifier,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}
