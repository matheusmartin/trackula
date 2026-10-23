@file:OptIn(ExperimentalWasmJsInterop::class)

package trackula.services

import kotlinx.coroutines.CompletableDeferred

/** The answer of the Google Picker: the action and the picked files. */
private external interface PickerResult : JsAny {
    val action: String
    val docs: JsArray<PickerDoc>?
}

private external interface PickerDoc : JsAny {
    val id: String
}

/**
 * Opens the Google Picker with the user's spreadsheets. Returns the ID of the picked spreadsheet, or null if the user
 * cancels. Throws a [ScriptException] if the Picker cannot load.
 *
 * Picking a file gives this app `drive.file` access to it. See
 * https://developers.google.com/workspace/drive/picker/guides/overview
 */
suspend fun pickSpreadsheet(accessToken: String, config: Config = Config.build): String? {
    loadScript("https://apis.google.com/js/api.js", "Cannot load the Google Picker.")
    val module = CompletableDeferred<Unit>()
    gapiLoad("picker") { module.complete(Unit) }
    module.await()

    val result = CompletableDeferred<String?>()
    showPicker(accessToken, config.apiKey, config.projectNumber, "Choose the Trackula sheet") { r ->
        when (r.action) {
            "picked" -> result.complete(r.docs?.get(0)?.id)
            "cancel" -> result.complete(null)
        }
    }
    return result.await()
}

@Suppress("UNUSED_PARAMETER")
private fun gapiLoad(module: String, callback: () -> Unit): Unit = js("gapi.load(module, callback)")

@Suppress("UNUSED_PARAMETER")
private fun showPicker(
    token: String,
    key: String,
    appId: String,
    title: String,
    callback: (PickerResult) -> Unit,
): Unit = js(
    """new google.picker.PickerBuilder()
        .addView(new google.picker.DocsView('spreadsheets').setMode('list'))
        .setOAuthToken(token)
        .setDeveloperKey(key)
        .setAppId(appId)
        .setTitle(title)
        .setCallback(callback)
        .build()
        .setVisible(true)""",
)
