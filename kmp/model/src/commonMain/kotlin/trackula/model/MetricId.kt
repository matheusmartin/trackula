package trackula.model

/** Ids that a new metric does not get: the headers of the `date` and `Score` columns of the `Log` tab. */
private val reservedIds = setOf("date", "score")

/** Letters with accents, and the same letters without accents. */
private val plainLetters: Map<Char, String> = buildMap {
    for ((plain, letters) in listOf(
        "a" to "àáâãäåā", "c" to "çć", "e" to "èéêëē", "i" to "ìíîïī", "n" to "ñń", "o" to "òóôõöøō", "u" to "ùúûüū",
        "y" to "ýÿ", "ss" to "ß", "ae" to "æ", "oe" to "œ",
    )) {
        for (letter in letters) put(letter, plain)
    }
}

/**
 * The id of a new metric with the name [name]: lowercase letters and digits, with `_` between the words. If [taken]
 * has the id, a number goes after it. Each id in [taken] is an id of a metric, of an invalid row or of a `Log`
 * column: a new metric must not get the values of a deleted metric.
 *
 * Examples: "Morning teeth" gives `morning_teeth`. "Água" gives `agua`. With `water` in [taken], "Water" gives
 * `water_2`. A name without letters or digits gives `metric`.
 */
fun newMetricId(name: String, taken: Set<String>): String {
    val plain = name.lowercase().map { plainLetters[it] ?: it.toString() }.joinToString("")
    val base = plain.replace(Regex("[^a-z0-9]+"), "_").trim('_').take(40).trimEnd('_').ifEmpty { "metric" }
    fun isFree(id: String) = id !in taken && id !in reservedIds
    if (isFree(base)) return base
    return generateSequence(2) { it + 1 }.map { "${base}_$it" }.first(::isFree)
}
