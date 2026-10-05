import 'package:test/test.dart';
import 'package:trackula/services/wheel_steps.dart';

void main() {
  test('WheelSteps keeps the rest until it makes a whole step', () {
    final w = WheelSteps(40);
    expect(w.add(30), 0);
    expect(w.add(30), 1);
    expect(w.add(-70), -1);
    expect(w.add(-30), -1);
    expect(w.add(0), 0);
  });

  test('WheelSteps gives many steps for a large delta', () {
    final w = WheelSteps(9);
    expect(w.add(100), 11);
    expect(w.add(8), 1);
  });
}
