package trackula.model

/**
 * An emoji of the emoji picker of the metrics form. See [parseEmojiList].
 *
 * @property text The emoji, with the default skin tone. Example: 👋.
 * @property name The name in English, from Unicode CLDR, for screen readers. Example: "waving hand".
 */
data class Emoji(val text: String, val name: String)

/**
 * The emojis of the emoji list [text], in the same order: the file `emoji.txt` that design/emoji/make.py makes. Each
 * line has an emoji, a tab and its name. A line that starts with `#` is a comment.
 *
 * Example: `😀⇥grinning face` gives 😀 with the name "grinning face".
 */
fun parseEmojiList(text: String): List<Emoji> = text.lineSequence()
    .filter { it.isNotBlank() && !it.startsWith("#") }
    .map { line -> line.split('\t').let { Emoji(it[0], it.getOrElse(1) { "" }) } }
    .toList()
