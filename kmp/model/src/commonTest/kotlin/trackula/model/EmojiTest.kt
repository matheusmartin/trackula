package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals

class EmojiTest {
    @Test
    fun theListHasEachEmojiWithItsNameInTheSameOrder() {
        val text = """
            # A comment.
            👋	waving hand

            💧	droplet
            🌋
        """.trimIndent()
        assertEquals(
            listOf(Emoji("👋", "waving hand"), Emoji("💧", "droplet"), Emoji("🌋", "")),
            parseEmojiList(text),
        )
    }
}
