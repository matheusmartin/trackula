package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class EmojiTest {
    private val wave = Emoji(
        text = "👋",
        name = "waving hand",
        keywords = listOf("bye", "hello"),
        tones = listOf("👋🏻", "👋🏼", "👋🏽", "👋🏾", "👋🏿"),
    )
    private val ocean = Emoji("🌊", "water wave", listOf("ocean", "sea"))
    private val melon = Emoji("🍉", "watermelon", listOf("fruit"))
    private val droplet = Emoji("💧", "droplet", listOf("drop", "water"))
    private val brazil = Emoji("🇧🇷", "flag: Brazil", listOf("flag"))
    private val groups = listOf(
        EmojiGroup("People", "👋", listOf(wave)),
        EmojiGroup("Animals and nature", "🐻", listOf(ocean)),
        EmojiGroup("Food and drink", "🍔", listOf(melon)),
        EmojiGroup("Travel and places", "🚗", listOf(droplet)),
        EmojiGroup("Flags", "🏁", listOf(brazil)),
    )

    @Test
    fun theListHasGroupsWithTheirEmojisKeywordsAndSkinTones() {
        val text = """
            # A comment.
            🙂	no group
            @People	👋
            👋	waving hand	bye hello	👋🏻 👋🏼 👋🏽 👋🏾 👋🏿

            @Travel and places	🚗
            💧	droplet	drop water
            🌋	volcano
        """.trimIndent()
        assertEquals(
            listOf(
                EmojiGroup("People", "👋", listOf(wave)),
                EmojiGroup("Travel and places", "🚗", listOf(droplet, Emoji("🌋", "volcano"))),
            ),
            parseEmojiList(text),
        )
    }

    @Test
    fun theNameFindsAnEmojiBeforeAKeyword() {
        assertEquals(listOf(ocean, melon, droplet), findEmojis(groups, "water"))
        assertEquals(listOf(ocean, melon, droplet), findEmojis(groups, "WAT"))
    }

    @Test
    fun eachWordMustStartAWordOfTheNameOrOfAKeyword() {
        assertEquals(listOf(ocean), findEmojis(groups, "wave water"))
        assertEquals(listOf(ocean), findEmojis(groups, "wa sea"))
        assertEquals(listOf(brazil), findEmojis(groups, "Brazil"))
        assertEquals(emptyList(), findEmojis(groups, "ater"))
        assertEquals(emptyList(), findEmojis(groups, "water fruitless"))
    }

    @Test
    fun aQueryWithoutWordsFindsNothing() {
        assertEquals(emptyList(), findEmojis(groups, ""))
        assertEquals(emptyList(), findEmojis(groups, "  : "))
    }

    @Test
    fun anEmojiWithSkinTonesGivesTheSelectedTone() {
        assertEquals("👋", wave.withTone(null))
        assertEquals("👋🏽", wave.withTone(2))
        assertEquals("💧", droplet.withTone(2))
    }

    @Test
    fun anEmojiIsShownByItselfAndByItsSkinTones() {
        assertTrue(wave.isShownBy("👋"))
        assertTrue(wave.isShownBy("👋🏿"))
        assertFalse(wave.isShownBy("💧"))
    }

    @Test
    fun theSkinToneOfAnIconIsTheToneOfAllItsModifiers() {
        assertEquals(2, skinToneOf("👋🏽"))
        assertEquals(0, skinToneOf("🧑🏻‍🤝‍🧑🏻"))
        assertEquals(4, skinToneOf("☝🏿"))
        assertNull(skinToneOf("🧑🏻‍🤝‍🧑🏿"))
        assertNull(skinToneOf("👋"))
        assertNull(skinToneOf("water_drop"))
    }
}
