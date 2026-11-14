package trackula.app.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import trackula.app.resources.Res
import trackula.model.Emoji
import trackula.model.EmojiGroup
import trackula.model.SKIN_TONES
import trackula.model.findEmojis
import trackula.model.parseEmojiList
import trackula.model.skinToneOf

/** The hand of the skin tone buttons: first without a tone, then with each tone of [SKIN_TONES]. */
private val toneHands = listOf("✋", "✋🏻", "✋🏼", "✋🏽", "✋🏾", "✋🏿")

/** The emoji groups after the first load. The list does not change while the app runs. */
private var loadedGroups: List<EmojiGroup>? = null

/** The emoji groups of the file `emoji.txt`. See design/emoji/make.py. Null if the file does not load. */
private suspend fun loadGroups(): List<EmojiGroup>? = loadedGroups ?: try {
    parseEmojiList(Res.readBytes("files/emoji.txt").decodeToString()).also { loadedGroups = it }
} catch (e: CancellationException) {
    throw e
} catch (_: Exception) {
    null
}

/**
 * The emoji picker of the metrics form: a search field, the skin tones, a chip for each group and a grid with all the
 * emojis that the app can show. A tap on an emoji calls [onPick] with the emoji, in the selected skin tone.
 *
 * [selected] is the icon of the form. Its emoji has a frame, and its skin tone is the first selected tone. The search
 * finds an emoji by the start of the words of its name or of its keywords. Example: "water" finds 🌊 and 💧.
 */
@Composable
fun EmojiPicker(selected: String, onPick: (String) -> Unit, modifier: Modifier = Modifier) {
    var groups by remember { mutableStateOf(loadedGroups) }
    var failed by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        if (groups == null) {
            groups = loadGroups()
            failed = groups == null
        }
    }
    var query by remember { mutableStateOf("") }
    var tone by remember { mutableStateOf(skinToneOf(selected)) }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Search emoji") },
            leadingIcon = { Symbol("search", size = 20.dp) },
            trailingIcon = if (query.isEmpty()) null else ({ AppIconButton("close", "Clear search", { query = "" }) }),
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
        )
        ToneChoices(tone) { tone = it }
        val loaded = groups
        when {
            loaded != null -> EmojiGrid(loaded, query, tone, selected, onPick)
            failed -> Help("The emojis did not load. Type or paste an emoji in the Icon field.")
            else -> Help("Loading the emojis…")
        }
    }
}

/** The skin tone buttons: no tone, then the tones of [SKIN_TONES]. [tone] is the selected tone. */
@Composable
private fun ToneChoices(tone: Int?, onTone: (Int?) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Help("Skin tone", Modifier.padding(end = 4.dp))
        toneHands.forEachIndexed { i, hand ->
            val value = if (i == 0) null else i - 1
            EmojiButton(
                text = hand,
                description = if (value == null) "No skin tone" else "${SKIN_TONES[value]} skin tone",
                selected = tone == value,
                size = 40.dp,
            ) { onTone(value) }
        }
    }
}

/**
 * The emojis of [groups] in a grid of a fixed height, which scrolls. Without a [query], each group has a title, and a
 * row of chips above the grid goes to a group. The chip of the group at the top of the grid is selected. With a
 * [query], the grid has only the emojis that it finds.
 */
@Composable
private fun EmojiGrid(groups: List<EmojiGroup>, query: String, tone: Int?, selected: String, onPick: (String) -> Unit) {
    val state = rememberLazyGridState()
    val scope = rememberCoroutineScope()
    val titles = remember(groups) { titleIndices(groups) }
    val found = remember(groups, query) { findEmojis(groups, query) }
    val searching = query.isNotBlank()

    if (searching) {
        Help(if (found.isEmpty()) "No emoji for \"${query.trim()}\"." else "${found.size} emojis")
    } else {
        val atTop by remember(titles) { derivedStateOf { titles.indexOfLast { it <= state.firstVisibleItemIndex } } }
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), Arrangement.spacedBy(8.dp)) {
            groups.forEachIndexed { i, group ->
                FilterChip(
                    selected = i == atTop,
                    onClick = { scope.launch { state.scrollToItem(titles[i]) } },
                    label = { Text("${group.icon} ${group.name}") },
                )
            }
        }
    }
    // The grid starts at the top after each change of the query.
    LaunchedEffect(query) { state.scrollToItem(0) }

    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(12.dp)
    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = TOUCH_TARGET),
        state = state,
        modifier = Modifier
            .fillMaxWidth()
            .height(GRID_HEIGHT)
            .background(colors.surfaceContainerLowest, shape)
            .border(1.dp, colors.outlineVariant, shape)
            .clip(shape)
            .padding(4.dp),
    ) {
        if (searching) {
            emojiItems(found, tone, selected, onPick)
        } else {
            for (group in groups) {
                item(key = "title:${group.name}", span = { GridItemSpan(maxLineSpan) }) {
                    Text(
                        group.name,
                        modifier = Modifier.padding(start = 4.dp, top = 8.dp, bottom = 4.dp),
                        style = MaterialTheme.typography.titleSmall,
                    )
                }
                emojiItems(group.emojis, tone, selected, onPick)
            }
        }
    }
}

/** The index of the title of each group in the grid without a query: each group has its title, then its emojis. */
private fun titleIndices(groups: List<EmojiGroup>): List<Int> =
    groups.runningFold(0) { index, group -> index + 1 + group.emojis.size }.dropLast(1)

/** The height of the emoji grid: 6 rows. */
private val GRID_HEIGHT = TOUCH_TARGET * 6 + 8.dp

/** A button for each of [emojis], in the skin [tone]. The emoji of the [selected] icon has a frame. */
private fun LazyGridScope.emojiItems(emojis: List<Emoji>, tone: Int?, selected: String, onPick: (String) -> Unit) {
    items(emojis, key = { it.text }) { emoji ->
        val text = emoji.withTone(tone)
        EmojiButton(text, description = emoji.name, selected = emoji.isShownBy(selected)) { onPick(text) }
    }
}

/**
 * A square button with the emoji [text]. [description] is its name for screen readers and tests. The [selected]
 * button has a red frame and the color of a selected chip.
 */
@Composable
private fun EmojiButton(
    text: String,
    description: String,
    selected: Boolean,
    size: Dp = TOUCH_TARGET,
    onClick: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(10.dp)
    Box(
        modifier = Modifier
            .size(size)
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
                contentDescription = description
                this.selected = selected
            },
        contentAlignment = Alignment.Center,
    ) {
        // The emoji fills a little more than half of the button.
        Text(text, Modifier.clearAndSetSemantics {}, fontSize = (size.value * 0.55f).sp, maxLines = 1)
    }
}

/** A short text in the color of secondary text. */
@Composable
private fun Help(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        modifier = modifier,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}
