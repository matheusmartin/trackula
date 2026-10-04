import 'dart:js_interop';
import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../model/metric.dart';
import '../model/number_input.dart';

/// Editor for one day of a `number` metric. `count` metrics use taps instead. See HabitTable.
///
/// - Ruler: drag it with a finger or the mouse, or scroll on it. It snaps to the metric step. One tick is one step.
///   With [onChange] (the Today tiles), only a side scroll moves it: a vertical scroll scrolls the page.
/// - Text field: exact values, for example a first value. "81.9" and "81,9" both work.
/// - Save: saves the value. With an empty text field, Save clears the day.
/// - Keys: Enter saves, Escape closes. Arrow keys: one step. On the ruler, Page Up and Page Down: 10 steps.
///   A second tap on the same cell also closes the editor.
///
/// An empty day starts at the latest earlier value, else at the first later value.
/// Styles: lib/constants/theme.dart.
class NumberEditor extends StatefulComponent {
  const NumberEditor({
    required this.metric,
    required this.label,
    required this.current,
    required this.start,
    required this.busy,
    required this.onSave,
    required this.onClear,
    required this.onClose,
    this.autofocus = true,
    this.onChange,
    super.key,
  });

  final NumberMetric metric;

  /// The metric and the day for screen readers, for example "Weight · today". The editor shows no title: the table
  /// row and the selected cell show the metric and the day.
  final String label;

  /// The value of the day. Null if the day is empty.
  final num? current;

  /// The value that an empty day starts at. Null if the metric has no value on another day.
  final num? start;
  final bool busy;
  final void Function(num value) onSave;
  final VoidCallback onClear;
  final VoidCallback onClose;

  /// Focus the ruler at the start. False when many editors show at the same time, as on the Today tiles: else the
  /// page scrolls to the last one.
  final bool autofocus;

  /// Called with the value at each change, and when the user taps the ruler without a move: that confirms the
  /// value. Null after the text field is emptied. With [onChange], the editor shows no Save button, and Enter does
  /// nothing: the parent saves.
  final void Function(num? value)? onChange;

  @override
  State<NumberEditor> createState() => _NumberEditorState();
}

class _NumberEditorState extends State<NumberEditor> {
  /// The space between two ruler ticks, in pixels.
  static const _tick = 9.0;

  /// The ruler shows this many ticks on each side of the value.
  static const _ticks = 60;

  num get _step => component.metric.step;

  String get _unit => component.metric.unit == null ? '' : ' ${component.metric.unit}';

  late num _value = component.current ?? component.start ?? 0;

  /// The text field. Empty if the metric has no value on any day.
  late String _text = component.current == null && component.start == null ? '' : formatStep(_value, _step);
  String? _error;

  /// The pointer x and the value when a ruler drag started. Null when no drag runs.
  ///
  /// The x is `pageX`, not `clientX`: package:web declares `clientX` as an int, but a real mouse gives fractional
  /// positions, for example 546.76. The int check then throws, and the drag does not start.
  (double, num)? _drag;

  /// Window listeners during a ruler drag. They also work when the pointer leaves the ruler.
  late final JSFunction _onDragMove = ((web.PointerEvent e) => _dragMove(e)).toJS;
  late final JSFunction _onDragEnd = ((web.Event _) => _dragEnd()).toJS;

  /// Wheel movement that is less than one tick, in pixels.
  double _wheel = 0;

  @override
  void initState() {
    super.initState();
    // Focus the ruler, so the arrow keys work at once and the editor scrolls into view.
    // The text field gets no focus: on phones that opens the keyboard over the ruler.
    if (component.autofocus) {
      Future(() => (web.document.querySelector('.number-editor .ruler') as web.HTMLElement?)?.focus());
    }
  }

  @override
  void dispose() {
    _dragEnd();
    super.dispose();
  }

  void _set(num v, {bool snap = false}) {
    final value = roundToStep(v, _step, snap: snap);
    if (value == _value && _error == null && _text == formatStep(value, _step)) return;
    setState(() {
      _value = value;
      _text = formatStep(value, _step);
      _error = null;
    });
    component.onChange?.call(value);
  }

  /// The ruler follows the text field while the user types a valid number.
  void _type(String text) {
    setState(() {
      _text = text;
      if (parseDecimal(text) case final v?) _value = v;
      _error = null;
    });
    if (parseDecimal(text) case final v?) {
      component.onChange?.call(v);
    } else if (text.trim().isEmpty) {
      component.onChange?.call(null);
    }
  }

  /// Saves the value. An empty text field clears the day.
  void _save() {
    if (component.onChange != null) return;
    final v = parseDecimal(_text);
    if (v != null) return component.onSave(v);
    if (_text.trim().isEmpty && component.current != null) return component.onClear();
    final example = formatStep(component.start ?? _step * 10, _step);
    setState(() => _error = 'Enter a number, for example $example.');
  }

  void _fieldKey(web.KeyboardEvent e) {
    switch (e.key) {
      case 'Enter':
        _save();
      case 'Escape':
        component.onClose();
      case 'ArrowUp' || 'ArrowDown':
        e.preventDefault();
        _set(_value + (e.key == 'ArrowUp' ? _step : -_step));
    }
  }

  void _rulerKey(web.KeyboardEvent e) {
    if (e.key == 'Enter') return _save();
    if (e.key == 'Escape') return component.onClose();
    final steps = switch (e.key) {
      'ArrowRight' || 'ArrowUp' => 1,
      'ArrowLeft' || 'ArrowDown' => -1,
      'PageUp' => 10,
      'PageDown' => -10,
      _ => 0,
    };
    if (steps == 0) return;
    e.preventDefault();
    _set(_value + steps * _step);
  }

  void _dragStart(web.PointerEvent e) {
    if (e.button != 0) return;
    // Stops text selection and the native drag of a mouse press. They can cancel the pointer events.
    e.preventDefault();
    (e.currentTarget as web.HTMLElement).focus();
    _dragEnd();
    // A tap on the ruler confirms the value, also without a move.
    component.onChange?.call(_value);
    _drag = (e.pageX, _value);
    web.window.addEventListener('pointermove', _onDragMove);
    web.window.addEventListener('pointerup', _onDragEnd);
    web.window.addEventListener('pointercancel', _onDragEnd);
  }

  /// Dragging to the left moves the ticks to the left, so the value under the needle gets bigger.
  void _dragMove(web.PointerEvent e) {
    final drag = _drag;
    if (drag == null) return;
    _set(drag.$2 - (e.pageX - drag.$1) / _tick * _step, snap: true);
  }

  void _dragEnd() {
    _drag = null;
    web.window.removeEventListener('pointermove', _onDragMove);
    web.window.removeEventListener('pointerup', _onDragEnd);
    web.window.removeEventListener('pointercancel', _onDragEnd);
  }

  void _wheelMove(web.WheelEvent e) {
    // On the Today tiles (with onChange), the rulers fill much of the page: a vertical wheel scrolls the page, and only
    // a side wheel or trackpad swipe moves the ruler. Else a page scroll changes values by mistake.
    if (component.onChange != null && e.deltaY.abs() >= e.deltaX.abs()) return;
    e.preventDefault();
    final delta = e.deltaX.abs() > e.deltaY.abs() ? e.deltaX : e.deltaY;
    // deltaMode 1: the delta is in lines, not pixels. One line is one tick.
    _wheel += delta.toDouble() * (e.deltaMode == 1 ? _tick : 1);
    final steps = (_wheel / _tick).truncate();
    if (steps == 0) return;
    _wheel -= steps * _tick;
    _set(_value + steps * _step, snap: true);
  }

  @override
  Component build(BuildContext context) {
    final m = component.metric;
    return div(
      classes: 'editor number-editor',
      attributes: {'role': 'group', 'aria-label': component.label},
      [
        div(classes: 'value', [
          input(
            type: .text,
            value: _text,
            attributes: {'inputmode': 'decimal', 'autocomplete': 'off', 'aria-label': '${m.name}$_unit'},
            events: {
              'input': (e) => _type((e.target as web.HTMLInputElement).value),
              'keydown': (e) => _fieldKey(e as web.KeyboardEvent),
            },
          ),
          if (m.unit case final unit?) span(classes: 'unit', [.text(unit)]),
        ]),
        _ruler(),
        if (component.onChange == null)
          div(classes: 'actions', [
            button(disabled: component.busy, onClick: _save, [.text('Save')]),
          ]),
        if (_error case final e?) span(classes: 'error-text', [.text(e)]),
      ],
    );
  }

  /// Ticks around the value: a long tick with a label every 10 steps, a middle tick every 5 steps.
  /// The strip moves, and the needle stays in the middle. A green tick marks the start value (the value of the nearest
  /// other day, see [NumberEditor.start]), on the nearest tick: it moves with the strip and shows how far the value is
  /// from it. At the start value, the green tick does not show: under the needle, the two colors mix.
  Component _ruler() {
    final center = (_value / _step).round();
    final startTick = switch (component.start) {
      final s? when (s / _step).round() != center => (s / _step).round(),
      _ => null,
    };
    final first = math.max(0, center - _ticks);
    final offset = -((_value / _step - first) * _tick + _tick / 2);
    return div(
      classes: 'ruler',
      attributes: {
        'role': 'slider',
        'tabindex': '0',
        'aria-label': '${component.metric.name} ruler',
        'aria-valuemin': '0',
        'aria-valuenow': '$_value',
        'aria-valuetext': '${formatStep(_value, _step)}$_unit',
      },
      events: {
        'pointerdown': (e) => _dragStart(e as web.PointerEvent),
        'wheel': (e) => _wheelMove(e as web.WheelEvent),
        'keydown': (e) => _rulerKey(e as web.KeyboardEvent),
      },
      [
        div(classes: 'strip', styles: Styles(raw: {'transform': 'translateX(${offset.toStringAsFixed(1)}px)'}), [
          for (var k = first; k <= center + _ticks; k++)
            span(
              key: ValueKey(k),
              classes: [
                'tick',
                if (k % 10 == 0) 'major' else if (k % 5 == 0) 'mid',
                if (k == startTick) 'start',
              ].join(' '),
              [
                if (k % 10 == 0) span([.text(formatShort(roundToStep(k * _step, _step)))]),
              ],
            ),
        ]),
        span(classes: 'needle', []),
      ],
    );
  }
}
