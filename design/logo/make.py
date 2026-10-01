"""Makes the Trackula logo files from web/images/logo.svg (the Fang T icon, Blood orange).

Usage: python3 design/logo/make.py <path to svg2png>
svg2png is a small macOS tool: svg2png <in.svg> <out.png> <width> <height>. See svg2png.swift.
Output:
- design/logo/trackula-icon-512.png: the icon.
- design/logo/trackula-logo.svg and .png: the icon and the word "Trackula", 1200 x 360, transparent background.
- web/favicon.ico: the icon at 32 x 32 (PNG data), for browsers without SVG icons.
"""
import pathlib
import re
import subprocess
import sys

OUT = pathlib.Path(__file__).parent
ROOT = OUT.parent.parent
ICON = ROOT / "web/images/logo.svg"
FONT = "Helvetica Neue, Helvetica, Arial, sans-serif"
WORD_COLOR = "#BE123C"


def main():
    svg2png = sys.argv[1]
    icon = ICON.read_text()
    body = re.search(r"<svg[^>]*>(.*)</svg>", icon, re.S).group(1)
    logo = OUT / "trackula-logo.svg"
    logo.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="360" viewBox="0 0 1200 360">'
        f'<g transform="translate(20 20) scale(0.625)">{body}</g>'
        f'<text x="380" y="222" font-family="{FONT}" font-weight="600" font-size="150" letter-spacing="-3" fill="{WORD_COLOR}">Trackula</text></svg>'
    )
    subprocess.run([svg2png, str(ICON), str(OUT / "trackula-icon-512.png"), "512", "512"], check=True)
    subprocess.run([svg2png, str(logo), str(OUT / "trackula-logo.png"), "1200", "360"], check=True)
    subprocess.run([svg2png, str(ICON), str(ROOT / "web/favicon.ico"), "32", "32"], check=True)


if __name__ == "__main__":
    main()
