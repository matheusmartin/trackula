// The values come from build defines, not from this file. See README.md.
// Local: config.env with --dart-define-from-file. GitHub Actions: repository variables.

/// OAuth client ID from Google Auth Platform → Clients → Trackula web.
///
/// The client ID is public. Do not put the client secret in a define.
const googleClientId = String.fromEnvironment('GOOGLE_CLIENT_ID');

/// API key for the Google Picker, from APIs & Services → Credentials.
///
/// The key is visible in the browser. Restrict it to the app's websites and to the Google Picker API.
const googleApiKey = String.fromEnvironment('GOOGLE_API_KEY');

/// Cloud project number. The Picker uses it to give this app access to the picked file.
/// The first part of the client ID is the project number.
final googleProjectNumber = googleClientId.split('-').first;

bool get hasClientId => googleClientId.isNotEmpty && !googleClientId.startsWith('REPLACE_WITH');

bool get hasApiKey => googleApiKey.isNotEmpty && !googleApiKey.startsWith('REPLACE_WITH');
