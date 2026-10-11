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
  ///
  /// [writesScores]: true if the load also writes the scores that changed in the `Score` column. Only `SheetsStore`
  /// writes them. See docs/data-model.md.
  Future<Snapshot> load({bool writesScores = true});

  /// Writes [write]. Callers use [change] or [changeAll], which plan the write on the latest data.
  Future<void> apply(LogWrite write);

  /// Reads the latest data, writes the change of [plan] on it, and reads the data again.
  ///
  /// The read before the write keeps row numbers correct after manual edits in the sheet.
  Future<Snapshot> change(LogWrite? Function(LogTable log) plan) => changeAll([plan]);

  /// Runs [plans] one after the other, each on the latest data. So a plan sees the row that an earlier plan added
  /// for the same day.
  ///
  /// It writes the scores once, after the last write: not after each plan. Example: the Save button of 9 Today tiles
  /// writes the score of today once, not 9 times.
  Future<Snapshot> changeAll(List<LogWrite? Function(LogTable log)> plans) async {
    var data = await load(writesScores: false);
    // True if a write came after the last load that wrote the scores.
    var scoresStale = false;
    for (final (i, plan) in plans.indexed) {
      if (plan(data.log) case final write?) {
        await apply(write);
        final isLast = i == plans.length - 1;
        data = await load(writesScores: isLast);
        scoresStale = !isLast;
      }
    }
    return scoresStale ? load() : data;
  }
}
