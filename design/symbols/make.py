#!/usr/bin/env python3
"""Makes the Material Symbols font of the app: src/app/symbols.woff2.

The app draws the icons with this font: the app buttons (refresh, logout and the others) and the metric icons, which
can be any Material Symbol. It is a static font, as the default icon style of the Material Symbols CSS: outlined,
weight 400, size 24, not filled.

The font is 0.33 MB. The app finds an icon by its name (a ligature), so the font keeps only the character codes of the
names, and no glyph names. The variable WOFF2 of BeerCSS (0.46 MB) is an older version, with a fill axis that the app
does not use.

Run it again to change the version. It needs Python 3 and fonttools with brotli. The same versions give the same
bytes:
    pip install fonttools==4.67.0 brotli==1.2.1
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

# The icons of the app buttons, of the bottom navigation bar and of the demo metrics. The script stops if the font
# does not have one.
ICONS = """
    add arrow_back arrow_downward arrow_upward calendar_month check check_circle chevron_left chevron_right close
    delete done error flag folder_open history info login logout more_vert playlist_add radio_button_unchecked
    refresh search show_chart swap_horiz today tune view_week warning zoom_in zoom_out drag_indicator
    dentistry directions_walk menu_book monitor_weight pill self_improvement shower straighten water_drop
""".split()

ROOT = pathlib.Path(__file__).resolve().parents[2]
WOFF2_OUTPUT = ROOT / "src/app/symbols.woff2"

# The characters of the icon names. The WOFF2 maps only these, and not the private-use code of each icon.
NAME_CHARACTERS = range(0x80)


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
    static = io.BytesIO()
    font.save(static)
    static.seek(0)
    save_woff2(TTFont(static))


def save_woff2(font: TTFont) -> None:
    """Saves the font as WOFF2, without the parts that the browser does not use for a ligature."""
    # Format 3: no glyph names. The ligatures find the glyphs by their index.
    font["post"].formatType = 3.0
    for table in font["cmap"].tables:
        table.cmap = {code: glyph for code, glyph in table.cmap.items() if code in NAME_CHARACTERS}
    font.flavor = "woff2"
    font.recalcTimestamp = False
    WOFF2_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    font.save(WOFF2_OUTPUT)
    print(f"{WOFF2_OUTPUT.relative_to(ROOT)}: {WOFF2_OUTPUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
