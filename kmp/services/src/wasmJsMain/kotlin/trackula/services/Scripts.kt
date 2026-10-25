package trackula.services

import kotlinx.browser.document
import kotlinx.coroutines.CompletableDeferred
import org.w3c.dom.HTMLScriptElement

/** Thrown when the browser cannot load a Google script, for example without a network connection. */
class ScriptException(message: String) : Exception(message) {
    /** The message only, as in Dart. The app shows this text. */
    override fun toString(): String = message.orEmpty()
}

/** The load of each script, by URL. A failed load is not here, so the next call tries again. */
private val loads = mutableMapOf<String, CompletableDeferred<Unit>>()

/** Loads the script [src] once. Throws a [ScriptException] with [error] if the load fails. */
internal suspend fun loadScript(src: String, error: String) {
    val load = loads.getOrPut(src) {
        val loaded = CompletableDeferred<Unit>()
        val script = document.createElement("script") as HTMLScriptElement
        script.src = src
        script.addEventListener("load", { loaded.complete(Unit) })
        script.addEventListener("error", { loaded.completeExceptionally(ScriptException(error)) })
        document.head?.appendChild(script)
        loaded
    }
    try {
        load.await()
    } catch (e: ScriptException) {
        // Another caller can have started a new load after this failure: keep it.
        if (loads[src] === load) loads.remove(src)
        throw e
    }
}
