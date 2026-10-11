import '../model/log_entry.dart';
import '../model/metric.dart';

/// The data of the spreadsheet at one point in time.
final class Snapshot {
  const Snapshot(this.metrics, this.log, this.warnings);

  /// All metrics, in sheet order.
  final List<Metric> metrics;
  final LogTable log;
  final List<String> warnings;
}

/// The storage of the metrics and the log. `SheetsStore` uses Google Sheets. `DemoStore` keeps sample data in memory,
/// for demo mode.
abstract base class Store {
  /// Sets the data validation rules of the sheet again. Nothing in demo mode.
  Future<void> refreshRules();

  /// Reads the metrics and the log, and validates each row.
  Future<Snapshot> load();

  /// Writes [write]. Callers use [change] or [changeAll], which plan the write on the latest data.
  Future<void> apply(LogWrite write);

  /// Reads the latest data, writes the change of [plan] on it, and reads the data again.
  ///
  /// The read before the write keeps row numbers correct after manual edits in the sheet.
  Future<Snapshot> change(LogWrite? Function(LogTable log) plan) => changeAll([plan]);

  /// Runs [plans] one after the other, each on the latest data. So a plan sees the row that an earlier plan added
  /// for the same day.
  Future<Snapshot> changeAll(List<LogWrite? Function(LogTable log)> plans) async {
    var data = await load();
    for (final plan in plans) {
      if (plan(data.log) case final write?) {
        await apply(write);
        data = await load();
      }
    }
    return data;
  }
}
