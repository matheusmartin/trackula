import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../components/ui.dart';
import '../services/picker.dart';
import '../services/session.dart';
import '../sheets/sheets_store.dart';

/// Lets the user pick a spreadsheet from their Drive with the Google Picker.
class SetupPage extends StatefulComponent {
  const SetupPage({required this.session, required this.onConnected, super.key});

  final Session session;
  final void Function(String spreadsheetId) onConnected;

  @override
  State<SetupPage> createState() => _SetupPageState();
}

class _SetupPageState extends State<SetupPage> with BusyState {
  Future<void> _choose() => runBusy(() async {
    final picked = await pickSpreadsheet(component.session.accessToken);
    if (picked == null) return;
    await SheetsStore.ensureTabs(component.session.api, picked.id);
    component.onConnected(picked.id);
  });

  @override
  Component build(BuildContext context) {
    return article(classes: 'medium-padding', [
      h5([.text('Choose a sheet')]),
      p([
        .text(
          'Pick a Google Sheet from your Drive. If it has no "Metrics" and "Log" tabs, '
          'the app adds them, with example metrics. Other tabs do not change.',
        ),
      ]),
      nav([
        button(disabled: busy, onClick: _choose, [
          i([.text('folder_open')]),
          span([.text('Choose sheet')]),
        ]),
        if (busy) progress(classes: 'circle small', []),
      ]),
      if (error case final e?) errorText(e),
    ]);
  }
}
