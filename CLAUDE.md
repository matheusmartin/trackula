# Trackula: repository rules

Read `README.md` first. It has the commands, the configuration and the overview. This file has the rules for how
the code is organised. Write all docs, comments and commit messages in ASD-STE100 Simplified Technical English, as
in `README.md`.

## Folders

| Folder            | Contents                                                              | Can import                                  |
|-------------------|-----------------------------------------------------------------------|---------------------------------------------|
| `lib/model/`      | Data model, parsing, validation, write planning, stats, zoom.         | `dart:*` and `lib/model/` only.             |
| `lib/sheets/`     | The `Store` interface and its implementations (`SheetsStore`, `DemoStore`). | `lib/model/`, Google Sheets packages.  |
| `lib/services/`   | Browser APIs: sign-in, Picker, browser storage, input helpers.        | `lib/model/`, `lib/sheets/`, `lib/config.dart`. |
| `lib/components/` | UI parts that more than one page can use.                             | `lib/model/`, `lib/services/`.              |
| `lib/pages/`      | One file for each screen.                                             | All of the above, and other pages.          |
| `lib/constants/`  | App CSS (`@css`) on top of BeerCSS.                                   | No browser-only code.                       |
| `lib/config.dart` | Reads the build defines. Nothing else.                                | —                                           |
| `test/`           | Unit tests.                                                           | —                                           |
| `docs/`           | Docs for users and developers.                                        | —                                           |
| `web/`            | Static files: `index.html`, `theme.css`, icons.                       | —                                           |
| `design/`         | Source files for the logo. Not part of the build.                     | —                                           |

Rules:

- Imports go in one direction only: `model` → `sheets` → `services` → `components` → `pages`. A folder must not
  import a folder to its right. Example: `lib/components/` must not import `lib/pages/`.
- `lib/model/` is pure Dart. Do not import `package:jaspr`, `package:web` or `package:googleapis` there. Put new
  logic in `lib/model/` when you can, because there you can test it with `dart test`.
- Do not put `@css` in a file that imports browser-only code (`package:web`, `googleapis_auth/auth_browser`). Jaspr
  runs `@css` code on the Dart VM, and browser-only imports make the build fail.
- Use relative imports inside `lib/`. Example: `import '../model/metric.dart';`.
- Do not add a new folder in `lib/` without a good reason. If you add one, add it to this table and to the
  "Project structure" section of `README.md`.

## Files and names

- File names: `snake_case.dart`. A page file has the screen name, for example `metric_detail.dart`.
- Test files: `test/<area>_test.dart`, where `<area>` is the `lib/model/` file or the feature. Example:
  `test/zoom_test.dart` tests `lib/model/zoom.dart`.
- Each public class and each public member has a `///` doc comment. The comment tells why, not only what.

## Code

- Format with `dart format` (line width 120, from `analysis_options.yaml`).
- `dart analyze` must show no issues.
- `dart test` must pass. Add or change tests when you change `lib/model/` or `lib/sheets/demo_store.dart`.
- Colors: use the Material theme variables (`var(--primary)`…). Put new colors in `web/theme.css`, not in Dart code.

## Data and docs

- If you change the sheet format (tabs, columns, values), update `docs/data-model.md` in the same commit.
- If you change a command, a requirement or the configuration, update `README.md` in the same commit.

## Dependencies

- Add a package with `dart pub add <name>`. Do not edit `pubspec.lock` by hand.
- The Jaspr version in `pubspec.yaml` and the `jaspr_cli` version in `.github/workflows/deploy.yml` must be the same.

## Secrets

- Do not commit `config.env`. Git ignores it.
- Never add the OAuth client secret to the repository.

## Commits

- Use Conventional Commits: `type(scope): summary`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
  Scopes: `ui`, `data`. Example: `feat(data): require a metric icon and show it in the detail title`.
- Write the summary in lowercase, in the imperative.
