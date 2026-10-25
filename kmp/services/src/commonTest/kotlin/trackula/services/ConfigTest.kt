package trackula.services

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ConfigTest {
    @Test
    fun theProjectNumberIsTheFirstPartOfTheClientId() {
        assertEquals("123456", Config("123456-abc.apps.googleusercontent.com", "key").projectNumber)
    }

    @Test
    fun anEmptyValueOrTheExampleValueIsMissing() {
        val example = Config("REPLACE_WITH_CLIENT_ID.apps.googleusercontent.com", "REPLACE_WITH_API_KEY")
        assertFalse(example.hasClientId)
        assertFalse(example.hasApiKey)
        assertFalse(Config("", "").hasClientId)
        val real = Config("123-abc.apps.googleusercontent.com", "AIza123")
        assertTrue(real.hasClientId)
        assertTrue(real.hasApiKey)
    }
}
