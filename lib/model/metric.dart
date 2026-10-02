/// A row of the `metrics` tab. See docs/data-model.md.
sealed class Metric {
  const Metric({required this.id, required this.name, required this.group, required this.active, this.icon});

  final String id;
  final String name;
  final String? group;
  final bool active;

  /// A Material Symbols name, such as `water_drop`, or an emoji. Null shows the first letter of [name].
  final String? icon;
}

/// A habit that is done or not done. One value per day: `yes` or `no`.
final class YesNoMetric extends Metric {
  const YesNoMetric({required super.id, required super.name, super.group, super.active = true, super.icon});
}

/// A quantity or a measurement. Kinds `number` and `count`. One value per day, for example a weight or a day total.
final class NumberMetric extends Metric {
  const NumberMetric({
    required super.id,
    required super.name,
    this.unit,
    this.step = 1,
    this.isCount = false,
    super.group,
    super.active = true,
    super.icon,
  });

  final String? unit;
  final num step;

  /// Kind `count`: the same as `number`, but the chart shows bars from 0 instead of a line.
  final bool isCount;
}
