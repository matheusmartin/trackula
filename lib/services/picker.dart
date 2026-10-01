import 'dart:async';
import 'dart:js_interop';

import 'package:web/web.dart' as web;

import '../config.dart';

/// A spreadsheet that the user picked.
typedef PickedSheet = ({String id, String name});

/// Opens the Google Picker with the user's spreadsheets. Returns null if the user cancels.
///
/// Picking a file gives this app `drive.file` access to it. See
/// https://developers.google.com/workspace/drive/picker/guides/overview
Future<PickedSheet?> pickSpreadsheet(String accessToken) async {
  await _loadPicker();
  final result = Completer<PickedSheet?>();

  void onPick(_PickerResult r) {
    switch (r.action) {
      case 'picked':
        final doc = r.docs!.toDart.first;
        result.complete((id: doc.id, name: doc.name));
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

Future<void>? _loading;

/// Loads https://apis.google.com/js/api.js and then the `picker` module, once.
Future<void> _loadPicker() => _loading ??= () async {
  final script = web.HTMLScriptElement()..src = 'https://apis.google.com/js/api.js';
  final loaded = Completer<void>();
  script.onload = ((web.Event _) => loaded.complete()).toJS;
  script.onerror = ((web.Event _) => loaded.completeError('Cannot load the Google Picker.')).toJS;
  web.document.head!.append(script);
  await loaded.future;

  final picker = Completer<void>();
  _gapiLoad('picker', (() => picker.complete()).toJS);
  await picker.future;
}();

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
  external void setVisible(bool visible);
}

extension type _PickerResult._(JSObject _) implements JSObject {
  external String get action;
  external JSArray<_PickerDoc>? get docs;
}

extension type _PickerDoc._(JSObject _) implements JSObject {
  external String get id;
  external String get name;
}
