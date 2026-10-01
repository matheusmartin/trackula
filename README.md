<img src="design/logo/trackula-logo.png" alt="Trackula logo" width="400">

# Trackula

## Overview

- Web app to track habits and body measurements.
- Storage: one Google Sheet in your Google Drive. You pick it with the Google Picker. You can edit the data by hand.
- If the picked sheet has no `metrics` and `log` tabs, the app adds them.
- Frontend only. No backend. The browser signs in with Google and calls the Sheets API.
- Language: Dart. Framework: [Jaspr](https://jaspr.site), client mode.
- UI: [BeerCSS](https://www.beercss.com) 5.0.3 (Material Design 3 and Material Symbols icons), loaded from the jsdelivr CDN in `web/index.html`.
- Hosting: static files (Cloudflare Pages or GitHub Pages).
- Data model: [docs/data-model.md](docs/data-model.md).

## Requirements

- Dart SDK 3.10 or later. With Homebrew: `brew install dart-sdk`.
- Jaspr CLI: `dart pub global activate jaspr_cli`.
- Put the real SDK `bin` folder first in `PATH`. The Jaspr CLI does not accept the Homebrew `dart` link:

  ```bash
  export PATH="/opt/homebrew/opt/dart-sdk/libexec/bin:$PATH:$HOME/.pub-cache/bin"
  ```

## Configuration

- The app needs the Google OAuth client ID and the Picker API key. They are build defines, not values in the code.
- These values are public in the built app. Git ignores them only to keep them out of the repository. Never add the OAuth client secret.
- Local:
  1. Copy `config.example.env` to `config.env`. Git ignores `config.env`.
  2. Set `GOOGLE_CLIENT_ID` and `GOOGLE_API_KEY`.
  3. Add `--dart-define-from-file=config.env` to `jaspr serve` and `jaspr build`.
- GitHub Actions: set the repository secrets `GOOGLE_CLIENT_ID` and `GOOGLE_API_KEY` in Settings → Secrets and variables → Actions → Secrets. The deploy fails if they are not set.
- If a value is missing, the app shows a message and does not start the sign-in.

## Commands

- Run the development server: `jaspr serve --dart-define-from-file=config.env`
- Run the tests: `dart test`
- Build for production: `jaspr build --dart-define-from-file=config.env`. The output goes to `build/jaspr/`.

## Project structure

- `lib/model/`: data model, parsing, validation and write planning. Pure Dart, no browser code.
- `lib/sheets/`: Google Sheets access.
- `lib/services/`: Google sign-in and browser storage.
- `lib/pages/`, `lib/components/`: UI.
- `lib/constants/theme.dart`: app CSS (`@css`) on top of BeerCSS. Only the habit table and editor. Use Material theme variables (`var(--primary)`…) for colors.
  - Do not put `@css` in files that import browser-only code (`package:web`, `googleapis_auth/auth_browser`). Jaspr runs `@css` code on the Dart VM to create `main.css`, and browser-only imports make it fail.
- `lib/config.dart`: reads the OAuth client ID and the Picker API key from the build defines.
- `test/`: unit tests.
