package trackula.model

/**
 * An emoji of the emoji picker of the metrics form. See [parseEmojiList].
 *
 * @property text The emoji, with the default skin tone. Example: 👋.
 * @property name The name in English, from Unicode CLDR. Example: "waving hand".
 * @property keywords The other words that find the emoji, in lowercase. Example: "hello" for 👋.
 */
data class Emoji(val text: String, val name: String, val keywords: List<String> = emptyList())

/**
 * A group of the emoji picker, in the order of Unicode.
 *
 * @property name The name that the picker shows. Example: "Smileys".
 * @property icon The emoji of the group in the picker. Example: 😀.
 */
data class EmojiGroup(val name: String, val icon: String, val emojis: List<Emoji>)

/**
 * The groups of the emoji list [text]: the file `emoji.txt` that design/emoji/make.py makes.
 *
 * - A line that starts with `#` is a comment.
 * - A group line: `@`, the name, a tab and the icon of the group.
 * - An emoji line: the emoji, its name and its keywords, separated by tabs. The keywords are separated by spaces. The
 *   last fields can be missing. An emoji line before the first group line has no group: it is not in the result.
 *
 * Example: `@Smileys⇥😀` and `😀⇥grinning face⇥grin happy` give the group "Smileys" with 😀 "grinning face".
 */
fun parseEmojiList(text: String): List<EmojiGroup> {
    val groups = mutableListOf<EmojiGroup>()
    var group: EmojiGroup? = null
    val emojis = mutableListOf<Emoji>()

    fun endGroup() {
        group?.let { groups += it.copy(emojis = emojis.toList()) }
        emojis.clear()
    }

    for (line in text.lineSequence()) {
        if (line.isBlank() || line.startsWith("#")) continue
        val fields = line.split('\t')
        if (line.startsWith("@")) {
            endGroup()
            group = EmojiGroup(name = fields[0].drop(1), icon = fields.getOrElse(1) { "" }, emojis = emptyList())
        } else if (group != null) {
            emojis += Emoji(
                text = fields[0],
                name = fields.getOrElse(1) { "" },
                keywords = fields.getOrElse(2) { "" }.split(' ').filter { it.isNotEmpty() },
            )
        }
    }
    endGroup()
    return groups
}

/** The words of [text] in lowercase: the parts between the characters that are not letters or digits. */
private fun words(text: String): List<String> {
    val result = mutableListOf<String>()
    val word = StringBuilder()
    for (c in text.lowercase()) {
        if (c.isLetterOrDigit()) {
            word.append(c)
        } else if (word.isNotEmpty()) {
            result += word.toString()
            word.clear()
        }
    }
    if (word.isNotEmpty()) result += word.toString()
    return result
}

/**
 * The emojis of [groups] that [query] finds, in the order of the groups. Each word of [query] must be the start of a
 * word of the name or of a keyword. The emojis that the name finds come first. A query without words finds nothing.
 *
 * Example: "water" finds 🌊 "water wave" and 🍉 "watermelon" by their names, then 💧 "droplet" by its keyword.
 */
fun findEmojis(groups: List<EmojiGroup>, query: String): List<Emoji> {
    val queryWords = words(query)
    if (queryWords.isEmpty()) return emptyList()

    fun finds(targets: List<String>) = queryWords.all { q -> targets.any { it.startsWith(q) } }

    val all = groups.flatMap { it.emojis }
    val byName = all.filter { finds(words(it.name)) }
    val found = byName.toSet()
    return byName + all.filter { it !in found && finds(words(it.name) + it.keywords.flatMap(::words)) }
}
