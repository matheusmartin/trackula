package trackula.services

import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeSource

/**
 * A Google access token. It stays in memory only. It lasts about 1 hour, and there is no refresh token in the browser.
 *
 * The token counts as expired [MARGIN] before Google ends it, as in the Dart googleapis_auth package, so that a
 * request does not start just before the end.
 */
class AccessToken(val value: String, expiresIn: Duration, timeSource: TimeSource = TimeSource.Monotonic) {
    private val deadline = timeSource.markNow() + expiresIn - MARGIN

    /** True if the access token expired. */
    val expired: Boolean get() = deadline.hasPassedNow()

    private companion object {
        val MARGIN = 20.seconds
    }
}
