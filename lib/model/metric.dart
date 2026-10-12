/// A row of the `Metrics` tab. See docs/data-model.md.
sealed class Metric {
  const Metric({required this.id, required this.name, required this.icon, required this.group});

  final String id;
  final String name;
  final String? group;

  /// A Material Symbols name, such as `water_drop`, or an emoji. Required.
  final String icon;
}

/// A habit that is done or not done. One value per day: `yes` or `no`.
final class YesNoMetric extends Metric {
  const YesNoMetric({required super.id, required super.name, required super.icon, super.group, this.goalIsYes = true});

  /// True if the goal is `yes`, the default. False if the goal is `no`: a habit to stop, for example smoking.
  final bool goalIsYes;
}

/// A quantity or a measurement. Kinds `number` and `count`. One value per day, for example a weight or a day total.
final class NumberMetric extends Metric {
  const NumberMetric({
    required super.id,
    required super.name,
    this.unit,
    this.step = 1,
    this.isCount = false,
    this.goal,
    required super.icon,
    super.group,
  });

  final String? unit;
  final num step;

  /// True if the metric is kind `count`: the same as `number`, but the chart shows bars from 0 instead of a line.
  final bool isCount;

  /// The day goal. Null if the metric has no goal.
  final NumberGoal? goal;
}

/// The day goal of a [NumberMetric]: at least [value], or at most [value] if [isMaximum].
final class NumberGoal {
  const NumberGoal(this.value, {this.isMaximum = false});

  final num value;

  /// True if the goal is a maximum, for example a weight of at most 75 kg. Else it is a minimum.
  final bool isMaximum;

  /// True if [dayValue] reaches the goal. The goal value itself reaches it.
  bool isReachedBy(num dayValue) => isMaximum ? dayValue <= value : dayValue >= value;

  /// How far [dayValue] is from the goal: 0 if it reaches the goal. Example: goal at most 80, 82.5 → 2.5.
  num distanceTo(num dayValue) => isReachedBy(dayValue) ? 0 : (dayValue - value).abs();
}
