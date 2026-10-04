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

/// Reads and writes the metrics and the log. [SheetsStore] uses Google Sheets. [DemoStore] keeps sample data in
/// memory, for demo mode.
abstract interface class Store {
  /// Sets the data validation rules of the sheet again. Nothing in demo mode.
  Future<void> refreshRules();

  Future<Snapshot> load();

  /// Reads the latest data, writes the change of [plan] on it, and reads the data again.
  Future<Snapshot> change(LogWrite? Function(LogTable log) plan);

  /// Runs [plans] one after the other, each on the latest data. So a plan sees the row that an earlier plan added
  /// for the same day.
  Future<Snapshot> changeAll(List<LogWrite? Function(LogTable log)> plans);
}
