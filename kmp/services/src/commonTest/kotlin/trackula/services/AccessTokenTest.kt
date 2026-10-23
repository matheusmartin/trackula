package trackula.services

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TestTimeSource

class AccessTokenTest {
    @Test
    fun theTokenExpires20SecondsBeforeGoogleEndsIt() {
        val clock = TestTimeSource()
        val token = AccessToken("token", expiresIn = 60.minutes, timeSource = clock)
        assertFalse(token.expired)
        clock += 59.minutes + 39.seconds
        assertFalse(token.expired)
        clock += 2.seconds
        assertTrue(token.expired)
    }
}
