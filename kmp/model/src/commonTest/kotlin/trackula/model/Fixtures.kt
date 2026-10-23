package trackula.model

/** Metrics that many tests use, as in the Dart tests. */
internal val weight = NumberMetric(id = "weight", name = "Weight", icon = "monitor_weight", unit = "kg", step = 0.1)
internal val water = NumberMetric(id = "water", name = "Water", icon = "water_drop", unit = "glasses")
internal val meditate = YesNoMetric(id = "meditate", name = "Meditate", icon = "self_improvement")

/** [metrics] by id. */
internal fun byId(vararg metrics: Metric): Map<String, Metric> = metrics.associateBy { it.id }

/** Sheet rows, as the Sheets API gives them. */
internal fun rows(vararg rows: List<Any?>): List<List<Any?>> = rows.toList()
