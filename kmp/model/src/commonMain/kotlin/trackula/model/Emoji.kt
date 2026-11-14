package trackula.model

/**
 * An emoji of the emoji picker of the metrics form. See [parseEmojiList].
 *
 * @property text The emoji without a skin tone. Example: 👋.
 * @property name The name in English, from Unicode CLDR. Example: "waving hand".
 * @property keywords The other words that find the emoji, in lowercase. Example: "hello" for 👋.
 * @property tones The emoji with each of the 5 skin tones, from light to dark. Empty if the emoji has no skin tones.
 */
data class Emoji(
    val text: String,
    val name: String,
    val keywords: List<String> = emptyList(),
    val tones: List<String> = emptyList(),
) {
    /**
     * The emoji with the skin [tone], an index of [SKIN_TONES]. Null [tone], or an emoji without skin tones: [text].
     * Example: 👋 and the tone 2 (medium) give 👋🏽.
     */
    fun withTone(tone: Int?): String = if (tone == null || tones.isEmpty()) text else tones[tone]

    /** True if [icon] is this emoji, with or without a skin tone. */
    fun isShownBy(icon: String): Boolean = icon == text || icon in tones
}

/**
 * A group of the emoji picker, in the order of Unicode.
 *
 * @property name The name that the picker shows. Example: "Smileys".
 * @property icon The emoji of the group in the picker. Example: 😀.
 */
data class EmojiGroup(val name: String, val icon: String, val emojis: List<Emoji>)

/** The names of the 5 skin tones, from light to dark, in the order of [Emoji.tones]. */
val SKIN_TONES = listOf("Light", "Medium-light", "Medium", "Medium-dark", "Dark")

/**
 * The groups of the emoji list [text]: the file `emoji.txt` that design/emoji/make.py makes.
 *
 * - A line that starts with `#` is a comment.
 * - A group line: `@`, the name, a tab and the icon of the group.
 * - An emoji line: the emoji, its name, its keywords and its skin tones, separated by tabs. The keywords are separated
 *   by spaces, and the skin tones also. The last fields can be missing. An emoji line before the first group line
 *   has no group: it is not in the result.
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
                keywords = spaced(fields.getOrElse(2) { "" }),
                tones = spaced(fields.getOrElse(3) { "" }),
            )
        }
    }
    endGroup()
    return groups
}

/** The parts of [text] between spaces. */
private fun spaced(text: String): List<String> = text.split(' ').filter { it.isNotEmpty() }

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

/**
 * The skin tone of [icon], an index of [SKIN_TONES]: the tone of its skin tone modifiers, if they are all the same.
 * Null if [icon] has no skin tone modifier, or different ones. Examples: 👋🏽 gives 2. 🧑🏻‍🤝‍🧑🏻 gives 0. 🧑🏻‍🤝‍🧑🏿 and
 * 👋 give null.
 */
fun skinToneOf(icon: String): Int? {
    // A modifier from U+1F3FB (light) to U+1F3FF (dark) is the surrogate pair D83C DFFB to D83C DFFF in UTF-16.
    val tones = icon.zipWithNext()
        .filter { (high, low) -> high == '\uD83C' && low in '\uDFFB'..'\uDFFF' }
        .map { (_, low) -> low - '\uDFFB' }
        .toSet()
    return tones.singleOrNull()
}
