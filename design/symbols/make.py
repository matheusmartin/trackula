#!/usr/bin/env python3
"""Makes the small Material Symbols font of the app buttons: kmp/app/src/commonMain/composeResources/font/symbols.ttf.

Compose draws the icons of the app buttons (refresh, logout and the other names in ICONS) with this font. The font
has only these icons, so it is small. The metric icons can be any Material Symbol: the app loads the full font for
them at run time.

Run it again when you add an icon name to the app. It needs Python 3 and fonttools with brotli:
    pip install fonttools brotli
    python3 design/symbols/make.py
"""

import io
import pathlib
import tarfile
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# The version of the material-symbols npm package. The full font of the metric icons uses the same version.
VERSION = "0.48.1"

# The icons of the app buttons and of the bottom navigation bar.
ICONS = """
    arrow_back calendar_month check chevron_left chevron_right close done folder_open login logout refresh
    show_chart swap_horiz today view_week warning zoom_in zoom_out
""".split()

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "kmp/app/src/commonMain/composeResources/font/symbols.ttf"


def main() -> None:
    url = f"https://registry.npmjs.org/material-symbols/-/material-symbols-{VERSION}.tgz"
    with urllib.request.urlopen(url) as response, tarfile.open(fileobj=io.BytesIO(response.read())) as archive:
        woff2 = archive.extractfile("package/material-symbols-outlined.woff2").read()
    font = TTFont(io.BytesIO(woff2))
    font.flavor = None
    # A static font, as the default icon style of the Material Symbols CSS: outlined, weight 400, size 24.
    font = instancer.instantiateVariableFont(font, {"FILL": 0, "wght": 400, "GRAD": 0, "opsz": 24})
    options = subset.Options()
    # Keep the ligatures of ICONS only: the text "refresh" becomes the refresh icon. Without the closure, the subset
    # does not add the ligatures of all the other icons, which also start from the letters.
    options.layout_features = ["liga", "rlig", "calt", "ccmp"]
    options.layout_closure = False
    options.flavor = None
    subsetter = subset.Subsetter(options)
    letters = [font.getBestCmap()[ord(c)] for c in "_abcdefghijklmnopqrstuvwxyz0123456789" if ord(c) in font.getBestCmap()]
    glyphs = set(font.getGlyphOrder())
    missing = [name for name in ICONS if name not in glyphs]
    if missing:
        raise SystemExit(f"No glyph for: {missing}")
    subsetter.populate(glyphs=letters + ICONS, unicodes=[ord(c) for c in "_abcdefghijklmnopqrstuvwxyz0123456789"])
    subsetter.subset(font)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    font.save(OUTPUT)
    print(f"{OUTPUT.relative_to(ROOT)}: {OUTPUT.stat().st_size} bytes, {len(ICONS)} icons")


if __name__ == "__main__":
    main()
