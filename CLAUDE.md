# Trackula: repository rules

Read `README.md` first. It has the overview, the commands, the configuration and the project structure. This file
adds the rules for the code.

## Standards

- Read and follow [Effective Dart](https://dart.dev/effective-dart): Style, Documentation, Usage and Design.
  `analysis_options.yaml` turns on lints for many of its rules.
- Follow Clean Code (Robert C. Martin):
  - A name tells why the thing exists and what it does. Use short names, such as `m` or `d`, only in a small
    scope, for example a lambda or a loop of a few lines.
  - A function does one thing, at one level of abstraction. If a function is long, split it into named parts.
  - A class has one responsibility.
  - Do not repeat code. Put shared logic in one place and use it from all callers.
  - A comment tells why, not what. Remove comments that only repeat the code, and remove commented-out code.
  - Remove dead code: unused functions, parameters and files.
- This project differs from Effective Dart in these points:
  - The maximum line length is 120, not 80. `analysis_options.yaml` sets it for `dart format`.
  - Write all docs, comments and commit messages in ASD-STE100 Simplified Technical English, as in `README.md`.
  - The doc comment of a boolean starts with "True if", "True while" or a similar phrase, not with "Whether".
    Example: "True if the window shows the newest bar."
- `dart analyze` must show no issues, and `dart test` must pass.

## Imports between folders

- `lib/model/` can import only `dart:*` and other `lib/model/` files. It is pure Dart: you can test it with
  `dart test`. Put logic here when you can.
- `lib/sheets/` can import `lib/model/` and the Google Sheets packages.
- `lib/services/` can import `lib/model/`, `lib/sheets/` and `lib/config.dart`.
- `lib/components/` can import `lib/model/` and `lib/services/`.
- `lib/pages/` can import all the folders above, and other pages.
- If you add a folder in `lib/`, add it to this list and to "Project structure" in `README.md`.

## Tests

- The tests of `lib/<folder>/<name>.dart` are in `test/<name>_test.dart`. Example: `test/zoom_test.dart` tests
  `lib/model/zoom.dart`.
- When you change code that has tests, change or add tests in the same commit.

## Docs

- If you change the sheet format (tabs, columns, values), update `docs/data-model.md` in the same commit.
- If you change a command, a requirement or the configuration, update `README.md` in the same commit.

## Dependencies

- Add or change a package with `dart pub add`.
- The Jaspr version in `pubspec.yaml` and the `jaspr_cli` version in `.github/workflows/deploy.yml` must be the same.

## Commits

- Use Conventional Commits: `type(scope): summary`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
  Scopes: `ui`, `data`. Example: `feat(data): require a metric icon and show it in the detail title`.
- Write the summary in lowercase, in the imperative.
