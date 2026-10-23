package trackula.model

internal actual fun toFixed(value: Double, decimals: Int): String = jsToFixed(value, decimals)

internal actual fun numberText(value: Double): String = jsString(value)

@OptIn(ExperimentalWasmJsInterop::class)
@Suppress("UNUSED_PARAMETER")
private fun jsString(value: Double): String = js("String(value)")

@OptIn(ExperimentalWasmJsInterop::class)
@Suppress("UNUSED_PARAMETER")
private fun jsToFixed(value: Double, decimals: Int): String = js("value.toFixed(decimals)")
