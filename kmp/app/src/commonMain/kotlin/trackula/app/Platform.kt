package trackula.app

import trackula.model.Day
import trackula.services.Config
import trackula.sheets.Store

/**
 * The parts of the app that need the browser: the URL, the clock, local storage, the Google sign-in and the Google
 * Picker. `BrowserPlatform` in wasmJsMain uses the browser. The UI tests use a fake.
 */
interface Platform {
    val config: Config

    /** True if the URL has `?demo`. Then the app uses sample data in memory. See `DemoStore`. */
    val isDemo: Boolean

    /** Today in the time zone of the device. */
    fun today(): Day

    /** The setting [key] in local storage. Null if it is not set, or if storage is blocked. */
    fun readPref(key: String): String?

    /** Sets the setting [key] in local storage. A null [value] removes it. */
    fun writePref(key: String, value: String?)

    /**
     * Opens the Google sign-in popup. Call it from a click handler, or the browser can block the popup. With
     * [selectAccount], the user picks the account. Throws an exception if the sign-in fails.
     */
    suspend fun signIn(selectAccount: Boolean): Session
}

/** A signed-in Google user. */
interface Session {
    /** True if the access token expired. It lasts 1 hour, and there is no refresh token in the browser. */
    val expired: Boolean

    /** Opens the Google Picker. Returns the ID of the picked spreadsheet, or null if the user cancels. */
    suspend fun pickSpreadsheet(): String?

    /** Adds the `Metrics` and `Log` tabs to the spreadsheet [spreadsheetId] if they are missing. */
    suspend fun prepare(spreadsheetId: String)

    /** The store of the spreadsheet [spreadsheetId]. */
    fun store(spreadsheetId: String): Store
}

/** The spreadsheet ID in local storage. Null if the user did not choose a sheet. Not secret: access needs a sign-in. */
var Platform.savedSpreadsheetId: String?
    get() = readPref("spreadsheetId")
    set(value) = writePref("spreadsheetId", value)
