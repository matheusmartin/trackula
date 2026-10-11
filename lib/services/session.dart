import 'package:googleapis/sheets/v4.dart';
import 'package:googleapis_auth/auth_browser.dart';
import 'package:http/browser_client.dart';

import '../config.dart';
import '../sheets/sheets_store.dart';
import 'prefs.dart';

/// A signed-in Google user. The access token stays in memory only.
final class Session {
  Session._(AccessCredentials credentials)
    : api = SheetsApi(authenticatedClient(BrowserClient(), credentials)),
      accessToken = credentials.accessToken.data,
      _expiry = credentials.accessToken.expiry;

  /// Opens the Google sign-in popup. Call it from a click handler, or the browser can block the popup.
  static Future<Session> signIn({bool selectAccount = true}) async => Session._(
    await requestAccessCredentials(
      clientId: googleClientId,
      scopes: [SheetsApi.driveFileScope],
      prompt: selectAccount ? 'select_account' : '',
    ),
  );

  final SheetsApi api;
  final String accessToken;
  final DateTime _expiry;

  /// True if the access token expired. It lasts 1 hour, and there is no refresh token in the browser.
  bool get expired => DateTime.now().toUtc().isAfter(_expiry);

  SheetsStore store(String spreadsheetId) => SheetsStore(api, spreadsheetId);
}

/// The spreadsheet ID in this browser's local storage. Not secret: access needs a signed-in user.
String? get savedSpreadsheetId => readPref('spreadsheetId');

set savedSpreadsheetId(String? id) => writePref('spreadsheetId', id);
