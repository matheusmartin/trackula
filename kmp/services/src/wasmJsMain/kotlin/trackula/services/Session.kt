@file:OptIn(ExperimentalWasmJsInterop::class)

package trackula.services

import io.ktor.client.HttpClient
import io.ktor.client.engine.js.Js
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.request.bearerAuth
import kotlinx.coroutines.CompletableDeferred
import trackula.sheets.SheetsClient
import trackula.sheets.SheetsStore
import kotlin.time.Duration.Companion.seconds

/** Thrown when the Google sign-in fails or the user closes it. */
class SignInException(message: String) : Exception(message) {
    /** The message only, as in Dart. The app shows this text. */
    override fun toString(): String = message.orEmpty()
}

/** The answer of the Google Identity Services token client. */
private external interface TokenResponse : JsAny {
    @JsName("access_token")
    val accessToken: String?
    val error: String?

    @JsName("error_description")
    val errorDescription: String?
}

/** The error of the token client when the popup does not open or the user closes it. */
private external interface TokenError : JsAny {
    val type: String
}

/** A signed-in Google user. The access token stays in memory only. */
class Session private constructor(val token: AccessToken) {
    val accessToken: String get() = token.value

    /** True if the access token expired. It lasts 1 hour, and there is no refresh token in the browser. */
    val expired: Boolean get() = token.expired

    /** The store of the spreadsheet [spreadsheetId]. Its requests send the access token of this session. */
    fun store(spreadsheetId: String): SheetsStore {
        val http = HttpClient(Js) { defaultRequest { bearerAuth(token.value) } }
        return SheetsStore(SheetsClient(http, spreadsheetId))
    }

    companion object {
        /** The scope of the token: only the files that the user picks or that the app makes. */
        private const val DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"

        /**
         * Opens the Google sign-in popup. Call it from a click handler, or the browser can block the popup. With
         * [selectAccount], the user picks the account. Throws a [SignInException] if the sign-in fails.
         */
        suspend fun signIn(selectAccount: Boolean = true, config: Config = Config.build): Session {
            loadScript("https://accounts.google.com/gsi/client", "Cannot load the Google sign-in.")
            val result = CompletableDeferred<Session>()
            requestToken(
                config.clientId,
                DRIVE_FILE_SCOPE,
                if (selectAccount) "select_account" else "",
                { response ->
                    val token = response.accessToken
                    if (token == null) {
                        val message = response.errorDescription ?: response.error ?: "No access token."
                        result.completeExceptionally(SignInException("Google sign-in failed: $message"))
                    } else {
                        val expiresIn = expiresInSeconds(response).seconds
                        result.complete(Session(AccessToken(token, expiresIn)))
                    }
                },
                { error -> result.completeExceptionally(SignInException("Google sign-in failed: ${error.type}")) },
            )
            return result.await()
        }
    }
}

/** The spreadsheet ID in this browser's local storage. Not secret: access needs a signed-in user. */
var savedSpreadsheetId: String?
    get() = readPref("spreadsheetId")
    set(value) = writePref("spreadsheetId", value)

@Suppress("UNUSED_PARAMETER")
private fun requestToken(
    clientId: String,
    scope: String,
    prompt: String,
    callback: (TokenResponse) -> Unit,
    errorCallback: (TokenError) -> Unit,
): Unit = js(
    """google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scope,
        prompt: prompt,
        callback: callback,
        error_callback: errorCallback,
    }).requestAccessToken()""",
)

/** The lifetime of the token in seconds. Google gives a number or a text. */
@Suppress("UNUSED_PARAMETER")
private fun expiresInSeconds(response: TokenResponse): Int = js("Number(response.expires_in) || 3600")
