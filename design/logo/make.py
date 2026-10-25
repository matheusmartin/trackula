"""Makes the Trackula logo files from kmp/app/src/wasmJsMain/resources/logo.svg (the Fang T icon, Blood orange).

Usage: python3 design/logo/make.py <path to svg2png>
svg2png is a small macOS tool: svg2png <in.svg> <out.png> <width> <height>. See svg2png.swift.
Output:
- design/logo/trackula-icon-512.png: the icon.
- design/logo/trackula-logo.svg and .png: the icon and the word "Trackula", 1200 x 360, transparent background.
All web files are in kmp/app/src/wasmJsMain/resources/ (WEB):
- kmp/app/src/commonMain/composeResources/drawable/logo.svg: a copy of the icon, for the UI (sign-in page, header).
- WEB/favicon.ico: the icon at 32 x 32 (PNG data), for browsers without SVG icons.
- WEB/images/icon-192.png and icon-512.png: the icon for the web app manifest (WEB/manifest.webmanifest).
- design/logo/trackula-icon-square.svg: the icon on a full square, without round corners.
- WEB/images/icon-maskable-512.png: the icon on a full square, for the manifest. Android cuts it to its own shape. The
  T is in the inner 80% circle, so no part of it is cut.
- WEB/images/apple-touch-icon.png: the icon on a full square at 180 x 180, for the iOS home screen. iOS rounds the
  corners.
"""
import pathlib
import re
import subprocess
import sys

OUT = pathlib.Path(__file__).parent
ROOT = OUT.parent.parent
WEB = ROOT / "kmp/app/src/wasmJsMain/resources"
ICON = WEB / "logo.svg"
UI_ICON = ROOT / "kmp/app/src/commonMain/composeResources/drawable/logo.svg"
FONT = "Helvetica Neue, Helvetica, Arial, sans-serif"
WORD_COLOR = "#BE123C"


def main():
    svg2png = sys.argv[1]
    icon = ICON.read_text()
    UI_ICON.write_text(icon)
    body = re.search(r"<svg[^>]*>(.*)</svg>", icon, re.S).group(1)
    logo = OUT / "trackula-logo.svg"
    logo.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="360" viewBox="0 0 1200 360">'
        f'<g transform="translate(20 20) scale(0.625)">{body}</g>'
        f'<text x="380" y="222" font-family="{FONT}" font-weight="600" font-size="150" letter-spacing="-3" fill="{WORD_COLOR}">Trackula</text></svg>'
    )
    subprocess.run([svg2png, str(ICON), str(OUT / "trackula-icon-512.png"), "512", "512"], check=True)
    subprocess.run([svg2png, str(logo), str(OUT / "trackula-logo.png"), "1200", "360"], check=True)
    subprocess.run([svg2png, str(ICON), str(WEB / "favicon.ico"), "32", "32"], check=True)
    images = WEB / "images"
    for size in (192, 512):
        subprocess.run([svg2png, str(ICON), str(images / f"icon-{size}.png"), str(size), str(size)], check=True)
    square = OUT / "trackula-icon-square.svg"
    square.write_text(icon.replace(' rx="112"', "", 1))
    subprocess.run([svg2png, str(square), str(images / "icon-maskable-512.png"), "512", "512"], check=True)
    subprocess.run([svg2png, str(square), str(images / "apple-touch-icon.png"), "180", "180"], check=True)


if __name__ == "__main__":
    main()
