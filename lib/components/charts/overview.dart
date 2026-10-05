import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../../constants/tokens.dart';
import '../../model/chart.dart';
import '../../model/day.dart';
import '../../model/zoom.dart';
import '../../services/pointer.dart';
import 'chart_parts.dart';

/// A small chart of all data in weeks, with a box on the days from [from] to [to]. A tap or a drag calls [onPoint]
/// with the day under the pointer.
class Overview extends StatefulComponent {
  const Overview({
    required this.weeks,
    required this.fromZero,
    required this.from,
    required this.to,
    required this.onPoint,
    super.key,
  });

  /// One bar for each week of all data, oldest first.
  final List<ZoomBar> weeks;

  /// Bars start at 0, for rates and sums. Else a little below the lowest week, so that changes show.
  final bool fromZero;
  final Day from;
  final Day to;
  final void Function(Day day) onPoint;

  @override
  State<Overview> createState() => _OverviewState();
}

class _OverviewState extends State<Overview> {
  bool _drag = false;

  void _point(web.PointerEvent p) {
    final c = component;
    final rect = (p.currentTarget as web.Element).getBoundingClientRect();
    final f = ((p.pageX - web.window.scrollX - rect.left) / rect.width).clamp(0.0, 1.0);
    final first = c.weeks.first.start, last = c.weeks.last.start.addDays(6);
    c.onPoint(first.addDays((f * (last.serial - first.serial)).round()));
  }

  @override
  Component build(BuildContext context) {
    final c = component;
    final values = [for (final b in c.weeks) ?b.value];
    final hi = values.isEmpty ? 1 : values.reduce(math.max);
    final lo = c.fromZero || values.isEmpty ? 0 : barFloor(values.reduce(math.min), hi);
    const h = 30.0;
    final w = c.weeks.length * 10.0;
    double x(Day d) => (d.serial - c.weeks.first.start.serial) / 7 * 10;
    double bar(num v) => math.max(0.5, (v - lo) / (hi - lo == 0 ? 1 : hi - lo) * h);
    return div(
      styles: const Styles(raw: {'touch-action': 'none', 'cursor': 'pointer', 'user-select': 'none'}),
      events: {
        'pointerdown': (e) {
          final p = e as web.PointerEvent;
          capturePointer(p);
          _drag = true;
          _point(p);
        },
        'pointermove': (e) {
          if (_drag) _point(e as web.PointerEvent);
        },
        'pointerup': (_) => _drag = false,
        'pointercancel': (_) => _drag = false,
      },
      [
        chartSvg(w, h + 2, height: '2rem', label: 'All data', [
          for (final (i, b) in c.weeks.indexed)
            if (b.value case final v?)
              rect(
                x: '${i * 10 + 1}',
                y: '${h + 1 - bar(v)}',
                width: '8',
                height: '${bar(v)}',
                styles: Styles(
                  raw: {
                    'fill': b.start.addDays(6).compareTo(c.from) >= 0 && b.start.compareTo(c.to) <= 0
                        ? filledColor
                        : 'var(--outline-variant)',
                  },
                ),
                [],
              ),
          rect(
            x: '${x(c.from)}',
            y: '0.5',
            width: '${math.max(4.0, x(c.to.addDays(1)) - x(c.from))}',
            height: '${h + 1}',
            styles: const Styles(
              raw: {
                'fill': 'none',
                'stroke': chartPrimary,
                'stroke-width': '1.5',
                'vector-effect': 'non-scaling-stroke',
              },
            ),
            [],
          ),
        ]),
      ],
    );
  }
}
