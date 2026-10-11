import 'dart:async';
import 'dart:js_interop';

import 'package:web/web.dart' as web;

import '../config.dart';

/// Thrown when the browser cannot load the Google Picker, for example without a network connection.
final class PickerException implements Exception {
  const PickerException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Opens the Google Picker with the user's spreadsheets. Returns the ID of the picked spreadsheet, or null if the user
/// cancels. Throws a [PickerException] if the Picker cannot load.
///
/// Picking a file gives this app `drive.file` access to it. See
/// https://developers.google.com/workspace/drive/picker/guides/overview
Future<String?> pickSpreadsheet(String accessToken) async {
  await _loadPicker();
  final result = Completer<String?>();

  void onPick(_PickerResult r) {
    switch (r.action) {
      case 'picked':
        result.complete(r.docs!.toDart.first.id);
      case 'cancel':
        result.complete(null);
    }
  }

  _PickerBuilder()
      .addView(_DocsView('spreadsheets').setMode('list'))
      .setOAuthToken(accessToken)
      .setDeveloperKey(googleApiKey)
      .setAppId(googleProjectNumber)
      .setTitle('Choose the Trackula sheet')
      .setCallback(onPick.toJS)
      .build()
      .setVisible(true);
  return result.future;
}

/// The load of the Picker. Null before the first load, and after a failed load.
Future<void>? _loading;

/// Loads the Picker once. After a failed load, the next call tries again.
Future<void> _loadPicker() async {
  try {
    await (_loading ??= _loadScripts());
  } on PickerException {
    _loading = null;
    rethrow;
  }
}

/// Loads https://apis.google.com/js/api.js and then the `picker` module.
Future<void> _loadScripts() async {
  final script = web.HTMLScriptElement()..src = 'https://apis.google.com/js/api.js';
  final loaded = Completer<void>();
  script.onload = ((web.Event _) => loaded.complete()).toJS;
  script.onerror = ((web.Event _) => loaded.completeError(
    const PickerException('Cannot load the Google Picker.'),
  )).toJS;
  web.document.head!.append(script);
  await loaded.future;

  final picker = Completer<void>();
  // A closure, not a tear-off: toJS cannot convert the optional FutureOr parameter of complete.
  // ignore: unnecessary_lambdas
  _gapiLoad('picker', (() => picker.complete()).toJS);
  await picker.future;
}

@JS('gapi.load')
external void _gapiLoad(String module, JSFunction callback);

@JS('google.picker.DocsView')
extension type _DocsView._(JSObject _) implements JSObject {
  external _DocsView(String viewId);
  external _DocsView setMode(String mode);
}

@JS('google.picker.PickerBuilder')
extension type _PickerBuilder._(JSObject _) implements JSObject {
  external _PickerBuilder();
  external _PickerBuilder addView(_DocsView view);
  external _PickerBuilder setOAuthToken(String token);
  external _PickerBuilder setDeveloperKey(String key);
  external _PickerBuilder setAppId(String appId);
  external _PickerBuilder setTitle(String title);
  external _PickerBuilder setCallback(JSFunction callback);
  external _Picker build();
}

extension type _Picker._(JSObject _) implements JSObject {
  // The JavaScript API has a positional bool.
  // ignore: avoid_positional_boolean_parameters
  external void setVisible(bool visible);
}

extension type _PickerResult._(JSObject _) implements JSObject {
  external String get action;
  external JSArray<_PickerDoc>? get docs;
}

extension type _PickerDoc._(JSObject _) implements JSObject {
  external String get id;
}
