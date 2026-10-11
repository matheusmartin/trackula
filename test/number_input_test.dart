import 'package:test/test.dart';
import 'package:trackula/model/number_input.dart';

void main() {
  group('number input', () {
    test('parseDecimal reads a period or a comma, and rejects other text', () {
      expect(['81.9', '81,9', ' 82 ', '81.', ',5', '0'].map(parseDecimal), [81.9, 81.9, 82, 81, 0.5, 0]);
      expect(['', 'abc', '-1', '1.2.3', '8 1'].map(parseDecimal), everyElement(isNull));
    });

    test('stepDecimals', () {
      expect([0.1, 0.25, 5, 1.0, 250].map(stepDecimals), [1, 2, 0, 0, 0]);
    });

    test('roundToStep removes float noise, snaps to the step, and is never below 0', () {
      expect(roundToStep(0.1 + 0.2, 0.1), 0.3);
      expect(roundToStep(81.93, 0.1, snap: true), 81.9);
      expect(roundToStep(1237, 250, snap: true), 1250);
      expect(roundToStep(-0.3, 0.1), 0);
    });

    test('formatStep', () {
      expect([formatStep(82, 0.1), formatStep(1250, 250), formatStep(90.5, 0.5)], ['82.0', '1250', '90.5']);
    });
  });
}
