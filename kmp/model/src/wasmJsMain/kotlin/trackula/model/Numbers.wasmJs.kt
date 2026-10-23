package trackula.model

internal actual fun toFixed(value: Double, decimals: Int): String = jsToFixed(value, decimals)

@OptIn(ExperimentalWasmJsInterop::class)
@Suppress("UNUSED_PARAMETER")
private fun jsToFixed(value: Double, decimals: Int): String = js("value.toFixed(decimals)")
