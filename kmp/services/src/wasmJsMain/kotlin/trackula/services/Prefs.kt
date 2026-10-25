package trackula.services

import kotlinx.browser.window

/** The prefix of the keys of this app in the local storage of the browser. */
private const val PREFIX = "trackula."

/** The setting [key]. Null if it is not set, or if storage is blocked. */
fun readPref(key: String): String? = try {
    window.localStorage.getItem("$PREFIX$key")
} catch (_: Throwable) {
    // The browser throws a DOMException when storage is blocked.
    null
}

/**
 * Sets the setting [key] to [value]. A null [value] removes the setting. If storage is blocked, the setting is lost
 * after a reload.
 */
fun writePref(key: String, value: String?) {
    try {
        if (value == null) {
            window.localStorage.removeItem("$PREFIX$key")
        } else {
            window.localStorage.setItem("$PREFIX$key", value)
        }
    } catch (_: Throwable) {
        // Storage is blocked. See readPref.
    }
}
