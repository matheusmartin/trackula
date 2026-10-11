import 'package:test/test.dart';
import 'package:trackula/services/double_tap.dart';

void main() {
  group('DoubleTap', () {
    const wait = Duration(milliseconds: 50);
    Future<void> pause([int ms = 80]) => Future.delayed(Duration(milliseconds: ms));

    late List<String> events;
    late DoubleTap<String> taps;
    void tap(String key) => taps.tap(key, onSingle: () => events.add('$key+'), onDouble: () => events.add('$key-'));

    setUp(() {
      events = [];
      taps = DoubleTap(wait: wait);
    });
    tearDown(() => taps.dispose());

    test('a single tap runs after the wait', () async {
      tap('a');
      expect(events, isEmpty);
      await pause();
      expect(events, ['a+']);
    });

    test('two quick taps are a double-tap, without the single tap', () async {
      tap('a');
      tap('a');
      await pause();
      expect(events, ['a-']);
    });

    test('a tap on another key runs the waiting single tap at once', () async {
      tap('a');
      tap('b');
      expect(events, ['a+']);
      await pause();
      expect(events, ['a+', 'b+']);
    });

    test('3 quick taps are a double-tap and a single tap', () async {
      tap('a');
      tap('a');
      tap('a');
      await pause();
      expect(events, ['a-', 'a+']);
    });

    test('slow taps are single taps', () async {
      tap('a');
      await pause();
      tap('a');
      await pause();
      expect(events, ['a+', 'a+']);
    });

    test('flush runs the waiting single tap at once, and only once', () async {
      tap('a');
      taps.flush();
      expect(events, ['a+']);
      await pause();
      taps.flush();
      expect(events, ['a+']);
    });
  });
}
