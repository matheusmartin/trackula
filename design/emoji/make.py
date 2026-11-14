#!/usr/bin/env python3
"""Makes the emoji list of the metrics form: kmp/app/src/commonMain/composeResources/files/emoji.txt.

The emoji picker of the form shows the emojis of this list, in groups, and finds them by their names and keywords.
The names, the keywords, the groups and the order come from emojibase-data, which has them from Unicode CLDR.

The app does not have an emoji font. In the browser, Compose draws emojis with the Noto Color Emoji font of Google
Fonts: it gets the font slices from fonts.gstatic.com when a text needs them. The list keeps only the emojis that
these slices draw as one glyph. So a new emoji that the font does not have yet is not in the list. When Compose uses a
new version of the font (search the .wasm file of the app for "notocoloremoji"), change FONT_URL and FONT_SHA256.

Run it again to change a version. It needs Python 3, fonttools with brotli, and uharfbuzz. The same versions give the
same bytes:
    pip install fonttools==4.67.0 brotli uharfbuzz==0.57.0
    python3 design/emoji/make.py
"""

import base64
import hashlib
import io
import json
import pathlib
import tarfile
import urllib.request

import uharfbuzz
from fontTools.ttLib import TTFont

# The version of the emojibase-data npm package, and the SHA-512 hash of its file, from the npm registry.
VERSION = "18.0.0"
INTEGRITY = "sha512-TPPRRYv2zPd0jKI+pTpMquwWNZXYAsC3IVsCMeg2X8y8fEzKwOks4/5bz0YavF5r6d71aGPpb6oDnUEwSLLMoA=="

# The slices of the emoji font that Compose 1.12 uses in the browser, and the SHA-256 hash of all slices in order.
FONT_URL = "https://fonts.gstatic.com/s/notocoloremoji/v39/Yq6P-KqIXTD0t4D9z1ESnKM3-HpFabsE4tq3luCC7p-aXxcn.{}.woff2"
FONT_SLICES = 10
FONT_SHA256 = "2c1fbbf0a8378b9703e096cb76924aa8a18ca36de071136a1a0e0f21c283b689"

# The groups of the picker, in the order of emojibase: its group number, then the name and the icon that the app
# shows. Group 2 has the parts of emojis, for example the skin tones: they are not emojis that you can pick.
GROUPS = {
    0: ("Smileys", "😀"),
    1: ("People", "👋"),
    3: ("Animals and nature", "🐻"),
    4: ("Food and drink", "🍔"),
    5: ("Travel and places", "🚗"),
    6: ("Activities", "⚽"),
    7: ("Objects", "💡"),
    8: ("Symbols", "🔣"),
    9: ("Flags", "🏁"),
}

# The longest icon in UTF-16 units: the app and the rule of the Sheets `icon` column accept 16.
MAX_ICON_LENGTH = 16

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "kmp/app/src/commonMain/composeResources/files/emoji.txt"

HEADER = f"""\
# The emojis of the emoji picker of the metrics form. Made by design/emoji/make.py from emojibase-data {VERSION}
# (MIT license), with names and keywords from Unicode CLDR. Do not edit.
# A group line: "@", the name of the group, a tab and the icon of the group. An emoji line: the emoji, its name and
# its keywords, separated by tabs. The keywords are separated by spaces. Each emoji has the default skin tone.
"""


def download(url: str) -> bytes:
    with urllib.request.urlopen(url) as response:
        return response.read()


def emoji_data() -> list:
    package = download(f"https://registry.npmjs.org/emojibase-data/-/emojibase-data-{VERSION}.tgz")
    digest = "sha512-" + base64.b64encode(hashlib.sha512(package).digest()).decode()
    if digest != INTEGRITY:
        raise SystemExit(f"The package file has a different hash: {digest}")
    with tarfile.open(fileobj=io.BytesIO(package)) as archive:
        return json.load(archive.extractfile("package/en/data.json"))


def font_slices() -> list:
    slices = [download(FONT_URL.format(i)) for i in range(FONT_SLICES)]
    digest = hashlib.sha256(b"".join(slices)).hexdigest()
    if digest != FONT_SHA256:
        raise SystemExit(f"The font slices have a different hash: {digest}")
    fonts = []
    for data in slices:
        # HarfBuzz cannot read WOFF2: change each slice to TTF.
        font = TTFont(io.BytesIO(data))
        font.flavor = None
        ttf = io.BytesIO()
        font.save(ttf)
        fonts.append(uharfbuzz.Font(uharfbuzz.Face(ttf.getvalue())))
    return fonts


def draws(fonts: list, text: str) -> bool:
    """True if one of the slices draws [text] as one glyph, not as more glyphs or as an empty box."""
    for font in fonts:
        buffer = uharfbuzz.Buffer()
        buffer.add_str(text)
        buffer.guess_segment_properties()
        uharfbuzz.shape(font, buffer, {})
        if len(buffer.glyph_infos) == 1 and buffer.glyph_infos[0].codepoint != 0:
            return True
    return False


def field(text: str) -> str:
    if "\t" in text or "\n" in text:
        raise SystemExit(f"A tab or a line break in: {text!r}")
    return text


def check_length(text: str) -> str:
    if len(text.encode("utf-16-le")) // 2 > MAX_ICON_LENGTH:
        raise SystemExit(f"Longer than {MAX_ICON_LENGTH} UTF-16 units: {text!r}")
    return text


def main() -> None:
    # The parts of emojis without a group, for example the regional indicator letters, have no order.
    data = sorted((e for e in emoji_data() if e.get("group") in GROUPS), key=lambda emoji: emoji["order"])
    fonts = font_slices()
    lines = [HEADER.rstrip("\n")]
    skipped = []
    for group, (name, icon) in GROUPS.items():
        lines.append(f"@{name}\t{icon}")
        for emoji in (e for e in data if e.get("group") == group):
            text = emoji["emoji"]
            if not draws(fonts, text):
                skipped.append(text)
                continue
            keywords = " ".join(dict.fromkeys(word for tag in emoji.get("tags", []) for word in tag.lower().split()))
            lines.append("\t".join([field(check_length(text)), field(emoji["label"]), field(keywords)]))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    count = sum(1 for line in lines if not line.startswith(("#", "@")))
    print(f"{OUTPUT.relative_to(ROOT)}: {count} emojis, {OUTPUT.stat().st_size} bytes")
    print(f"The font does not draw {len(skipped)} emojis: {' '.join(skipped)}")


if __name__ == "__main__":
    main()
