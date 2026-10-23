#!/usr/bin/env python3
"""Makes the Material Symbols font of the app: kmp/app/src/commonMain/composeResources/font/symbols.ttf.

Compose draws the icons with this font: the app buttons (refresh, logout and the others) and the metric icons, which
can be any Material Symbol. The Skia build of Compose for the web cannot read WOFF2, so the font is a TTF. It is a
static font, as the default icon style of the Material Symbols CSS: outlined, weight 400, size 24. Without the font
variations it is 1.4 MB (0.5 MB with gzip): less than the 4 MB WOFF2 of the Dart app.

Run it again to change the version. It needs Python 3 and fonttools with brotli. The same versions give the same
bytes:
    pip install fonttools==4.67.0 brotli
    python3 design/symbols/make.py
"""

import base64
import hashlib
import io
import pathlib
import tarfile
import urllib.request

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# The version of the material-symbols npm package, and the SHA-512 hash of its file, from the npm registry.
VERSION = "0.48.1"
INTEGRITY = "sha512-rDJyd4SAEXNSZIX1sBTwRtbOrEzta4aN7hNQPKAhFqOY0yayXIJbXf0R1s8YR+ODbzDD9bdiPCabqrGn5NUikA=="

# The icons of the app buttons and of the bottom navigation bar. The script stops if the font does not have one.
ICONS = """
    arrow_back calendar_month check chevron_left chevron_right close done folder_open login logout refresh
    show_chart swap_horiz today view_week warning zoom_in zoom_out
""".split()

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "kmp/app/src/commonMain/composeResources/font/symbols.ttf"


def main() -> None:
    url = f"https://registry.npmjs.org/material-symbols/-/material-symbols-{VERSION}.tgz"
    with urllib.request.urlopen(url) as response:
        package = response.read()
    digest = "sha512-" + base64.b64encode(hashlib.sha512(package).digest()).decode()
    if digest != INTEGRITY:
        raise SystemExit(f"The package file has a different hash: {digest}")
    with tarfile.open(fileobj=io.BytesIO(package)) as archive:
        woff2 = archive.extractfile("package/material-symbols-outlined.woff2").read()
    font = TTFont(io.BytesIO(woff2))
    font.flavor = None
    missing = [name for name in ICONS if name not in set(font.getGlyphOrder())]
    if missing:
        raise SystemExit(f"No glyph for: {missing}")
    font = instancer.instantiateVariableFont(font, {"FILL": 0, "wght": 400, "GRAD": 0, "opsz": 24})
    # Keep the time stamp of the package font, so that each run gives the same bytes.
    font.recalcTimestamp = False
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    font.save(OUTPUT)
    print(f"{OUTPUT.relative_to(ROOT)}: {OUTPUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
