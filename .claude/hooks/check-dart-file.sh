#!/usr/bin/env bash
# Runs after Claude edits a file. For a Dart file in lib/ or test/: formats it and checks the import rules of
# CLAUDE.md. Exit code 2 sends the message back to Claude, so that it corrects the file.

file=$(grep -o '"file_path" *: *"[^"]*"' | head -1 | sed 's/.*: *"\(.*\)"/\1/')
case "$file" in
  *.dart) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0
rel=${file#"$CLAUDE_PROJECT_DIR"/}

if command -v dart >/dev/null 2>&1; then
  dart format "$file" >/dev/null 2>&1
fi

errors=()
imports=$(grep -E "^import '" "$file")
has() { grep -qE "$1" <<<"$imports"; }

case "$rel" in
  lib/model/*)
    has "^import 'package:" && errors+=("lib/model/ is pure Dart: import only dart:* and other lib/model/ files.")
    has "^import '\.\./" && errors+=("lib/model/ must not import other lib/ folders.")
    ;;
  lib/sheets/*)
    has "'\.\./(services|components|pages)/" && errors+=("lib/sheets/ can import only lib/model/.")
    ;;
  lib/services/*)
    has "'\.\./(components|pages)/" && errors+=("lib/services/ must not import lib/components/ or lib/pages/.")
    ;;
  lib/components/*)
    has "'\.\./(pages|sheets)/" && errors+=("lib/components/ must not import lib/pages/ or lib/sheets/.")
    ;;
esac

if grep -qE '^[[:space:]]*@css' "$file" && has "package:web/|auth_browser"; then
  errors+=("Do not put @css in a file that imports browser-only code (package:web, auth_browser).")
fi

if [ ${#errors[@]} -gt 0 ]; then
  printf '%s: import rule broken (see CLAUDE.md):\n' "$rel" >&2
  printf -- '- %s\n' "${errors[@]}" >&2
  exit 2
fi
exit 0
