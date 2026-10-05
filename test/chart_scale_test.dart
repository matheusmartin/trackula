import 'package:test/test.dart';
import 'package:trackula/model/chart.dart';

void main() {
  test('linearY puts the highest value at the top and the lowest at the bottom', () {
    expect(linearY(10, 0, 10, 50), 0);
    expect(linearY(0, 0, 10, 50), 50);
    expect(linearY(5, 0, 10, 50), 25);
    expect(linearY(10, 0, 10, 50, padding: 2), 2);
    expect(linearY(0, 0, 10, 50, padding: 2), 48);
  });

  test('linearY puts all values in the middle when they are equal', () {
    expect(linearY(7, 7, 7, 50, padding: 2), 25);
  });

  test('barFloor is a quarter of the range below the lowest value, and at least 1 % of the top', () {
    expect(barFloor(80, 84), 79);
    expect(barFloor(100, 100), 99);
    expect(barFloor(99, 100), 98);
    expect(barFloor(0, 0), 0);
    expect(barFloor(-100, -100), -101);
    expect(barFloor(-20, 20), -30);
  });
}
