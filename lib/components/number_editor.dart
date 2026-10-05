import 'dart:js_interop';
import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../constants/tokens.dart';
import '../model/format.dart';
import '../model/metric.dart';
import '../model/number_input.dart';
import '../services/pointer.dart';
import '../services/wheel_steps.dart';

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
  /// An editor with a Save button, for one cell of the table. It takes the focus.
  const NumberEditor.form({
    required this.metric,
    required this.label,
    required this.current,
    required this.start,
    required this.busy,
    required void Function(num value) this.onSave,
    required VoidCallback this.onClear,
    required VoidCallback this.onClose,
    super.key,
  }) : onChange = null,
       autofocus = true;

  /// An editor without a Save button, as on the Today tiles: [onChange] gets each value, and the parent saves. It
  /// does not take the focus: many of them show at the same time.
  const NumberEditor.live({
    required this.metric,
    required this.label,
    required this.current,
    required this.start,
    required void Function(num? value) this.onChange,
    super.key,
  }) : busy = false,
       onSave = null,
       onClear = null,
       onClose = null,
       autofocus = false;

  final NumberMetric metric;

  /// The metric and the day for screen readers, for example "Weight · today". The editor shows no title: the table
  /// row and the selected cell show the metric and the day.
  final String label;

  /// The value of the day. Null if the day is empty.
  final num? current;

  /// The value that an empty day starts at. Null if the metric has no value on another day.
  final num? start;

  /// True while a write runs: the Save button is disabled. Only [NumberEditor.form].
  final bool busy;

  /// Saves a value. Only [NumberEditor.form].
  final void Function(num value)? onSave;

  /// Clears the day: Save with an empty text field. Only [NumberEditor.form].
  final VoidCallback? onClear;

  /// Closes the editor: the Escape key. Only [NumberEditor.form].
  final VoidCallback? onClose;

  /// Focus the ruler at the start. False when many editors show at the same time: else the page scrolls to the last
  /// one.
  final bool autofocus;

  /// Called with the value at each change, and when the user taps the ruler without a move: that confirms the
  /// value. Null after the text field is emptied. Only [NumberEditor.live]: the editor shows no Save button, and
  /// Enter does nothing.
  final void Function(num? value)? onChange;

  @override
  State<NumberEditor> createState() => _NumberEditorState();
}

class _NumberEditorState extends State<NumberEditor> {
  /// The space between two ruler ticks, in pixels. The CSS of `.tick` uses the same value.
  static const _tick = rulerTick + 0.0;

  /// The ruler shows this many ticks on each side of the value.
  static const _ticks = 60;

  num get _step => component.metric.step;

  String get _unit => unitSuffix(component.metric.unit);

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

  /// Wheel moves: one tick is one step.
  final _wheel = WheelSteps(_tick);

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
    final onSave = component.onSave;
    if (onSave == null) return;
    final v = parseDecimal(_text);
    if (v != null) return onSave(v);
    if (_text.trim().isEmpty && component.current != null) return component.onClear?.call();
    final example = formatStep(component.start ?? _step * 10, _step);
    setState(() => _error = 'Enter a number, for example $example.');
  }

  void _fieldKey(web.KeyboardEvent e) {
    switch (e.key) {
      case 'Enter':
        _save();
      case 'Escape':
        component.onClose?.call();
      case 'ArrowUp' || 'ArrowDown':
        e.preventDefault();
        _set(_value + (e.key == 'ArrowUp' ? _step : -_step));
    }
  }

  void _rulerKey(web.KeyboardEvent e) {
    if (e.key == 'Enter') return _save();
    if (e.key == 'Escape') return component.onClose?.call();
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
    if (component.onChange != null && !isSideWheel(e)) return;
    e.preventDefault();
    // One line of a line-mode wheel is one tick.
    final steps = _wheel.add(wheelPixels(e, isSideWheel(e) ? e.deltaX : e.deltaY, _tick));
    if (steps != 0) _set(_value + steps * _step, snap: true);
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
        if (component.onSave != null)
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
