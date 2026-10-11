import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../services/picker.dart';
import '../services/session.dart';

/// The page where the user picks a spreadsheet from their Drive with the Google Picker.
final class SetupPage extends StatefulComponent {
  const SetupPage({required this.session, required this.onConnected, super.key});

  final Session session;
  final void Function(String spreadsheetId) onConnected;

  @override
  State<SetupPage> createState() => _SetupPageState();
}

class _SetupPageState extends State<SetupPage> {
  bool _busy = false;
  String? _error;

  Future<void> _choose() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final spreadsheetId = await pickSpreadsheet(component.session.accessToken);
      if (spreadsheetId == null) return;
      await component.session.store(spreadsheetId).ensureTabs();
      component.onConnected(spreadsheetId);
    } on Exception catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Component build(BuildContext context) => article(classes: 'medium-padding', [
    h5([.text('Choose a sheet')]),
    p([
      .text(
        'Pick a Google Sheet from your Drive. If it has no "Metrics" and "Log" tabs, '
        'the app adds them, with example metrics. Other tabs do not change.',
      ),
    ]),
    nav([
      button(disabled: _busy, onClick: _choose, [
        i([.text('folder_open')]),
        span([.text('Choose sheet')]),
      ]),
      if (_busy) progress(classes: 'circle small', []),
    ]),
    if (_error case final e?) p(classes: 'error-text', [.text(e)]),
  ]);
}
