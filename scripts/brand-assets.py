#!/usr/bin/env python3
"""Rebuild the app icons and the header mark from `public/og.jpg`.

The loose PNGs that used to live in `public/` were tight crops of the artwork:
the star's lower point overlapped the `'N3X` wordmark and the wordmark sat on
the bottom edge, so every square crop (home-screen icon, header mark) sliced
text in half. `og.jpg` is the one composition where the star and the wordmark
are stacked with a real gap, so it is the source of truth here.

Composition rules (Apple's icon grid):
  * app icon  — lockup occupies 62% of the canvas height, centred
  * maskable  — lockup occupies 50%, inside the 80% safe circle
  * wordmark  — 5% of the canvas height separates star from wordmark
  * mark      — star alone at 86%, for the in-app header

Needs Pillow:  python -m pip install pillow
Usage:         python scripts/brand-assets.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

BG = (5, 7, 10)  # --color-bg, so the icon tile melts into the app chrome
PUBLIC = Path(__file__).resolve().parent.parent / "public"
LIT = 40  # luminance of the solid artwork; keeps the faint caption out of the box
GLOW = 0.06  # the sprite keeps this much of its own height of surrounding glow
# Measured on og.jpg: the star's top point ends here, its horizontal axis (the row
# through the left and right points) is below it, and the last row that is star
# and nothing else is where the `'N3X` wordmark's glow starts.
STAR_APEX_ROW = 48
STAR_AXIS_ROW = 287
STAR_LAST_ROW = 438
WORDMARK_ROW_END = 599  # the `N3X GUILD` caption sits below this row

OUTPUTS: list[tuple[str, int, str, float]] = [
    # path, size, part, fraction of the canvas the artwork may fill
    ("icons/n3x-192.png", 192, "lockup", 0.62),
    ("icons/n3x-512.png", 512, "lockup", 0.62),
    ("icons/n3x-apple-180.png", 180, "lockup", 0.62),
    ("icons/n3x-maskable-512.png", 512, "lockup", 0.50),
    ("apple-touch-icon.png", 180, "lockup", 0.62),
    ("__grok/icon-180.png", 180, "lockup", 0.62),
    ("n3x-mark.png", 256, "star", 0.76),
]


def complete_tip(star: Image.Image, axis: int, apex: int, cut: int) -> Image.Image:
    """Rebuild the star's lower point, which the artwork hides behind the wordmark.

    In `og.jpg` the point descends *behind* the `'N3X` letters: the last row that
    is star and nothing else is `cut`, and below it the artwork is wordmark. The
    star is symmetric about its horizontal axis — measured on the 1500 px
    original, the two halves agree within 3 px — so the missing rows are the top
    point's own rows, mirrored. Only that point's silhouette is copied, through
    the centre column, so no letter pixel can enter the sprite.
    """
    end = 2 * axis - apex  # where the mirrored tip reaches its point
    tall = Image.new("RGB", (star.width, end + 1), BG)
    tall.paste(star, (0, 0))
    mask = star.convert("L").point(lambda value: 255 if value > LIT else 0)
    pixels = tall.load()
    centre = star.width // 2
    for y in range(cut + 1, end + 1):
        source_row = 2 * axis - y
        left = centre
        while left > 0 and mask.getpixel((left - 1, source_row)) > 0:
            left -= 1
        right = centre
        while right < star.width - 1 and mask.getpixel((right + 1, source_row)) > 0:
            right += 1
        if right - left < 1:
            continue
        strip = star.crop((left, source_row, right + 1, source_row + 1))
        tall.paste(strip, (left, y))
    return tall


def on_background(sprite: Image.Image, threshold: int = 14) -> Image.Image:
    """Flatten the artwork's own black onto BG.

    og.jpg has a vignette — its corners sit at (6,7,11) and its lower edge at
    (3,4,5) — so a sprite pasted as-is shows up as a rectangle against the app's
    (5,7,10). Everything this dark is background, not artwork.
    """
    mask = sprite.convert("L").point(lambda value: 255 if value <= threshold else 0)
    flattened = sprite.copy()
    flattened.paste(BG, mask=mask)
    return flattened


def content_box(img: Image.Image, box: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    """Bounding box of the artwork inside `box`, plus a collar of its own glow."""
    mask = img.crop(box).convert("L").point(lambda v: 255 if v > LIT else 0)
    found = mask.getbbox()
    if not found:
        raise SystemExit(f"no artwork in {box}")
    left, top, right, bottom = found
    pad = round((bottom - top) * GLOW)
    return (
        max(box[0], box[0] + left - pad),
        max(box[1], box[1] + top - pad),
        min(box[2], box[0] + right + pad),
        min(box[3], box[1] + bottom + pad),
    )


def compose(
    sprites: list[tuple[Image.Image, float]],
    size: int,
    fraction: float,
    gap: float = 0.0,
) -> Image.Image:
    """Centre `sprites` on a square canvas of `BG`.

    Each sprite contributes `height * share` to the layout budget, so equal
    shares keep the original artwork proportions.
    """
    gap_px = round(size * gap)
    budget = size * fraction - gap_px
    unit = sum(im.height * share for im, share in sprites)
    scale = budget / unit
    heights = [max(1, round(im.height * share * scale)) for im, share in sprites]
    total = sum(heights) + gap_px * (len(sprites) - 1)
    y = round((size - total) / 2)
    canvas = Image.new("RGB", (size, size), BG)
    for (art, _), height in zip(sprites, heights):
        width = max(1, round(art.width * height / art.height))
        resized = art.resize((width, height), Image.LANCZOS)
        canvas.paste(resized, (round((size - width) / 2), y))
        y += height + gap_px
    return canvas


def main() -> int:
    source = Image.open(PUBLIC / "og.jpg").convert("RGB")
    apex = 0  # the sprite's own coordinates: it starts at the star's tip row
    axis = STAR_AXIS_ROW - STAR_APEX_ROW
    cut = STAR_LAST_ROW - STAR_APEX_ROW
    raw_star = source.crop((0, STAR_APEX_ROW, source.width, STAR_LAST_ROW + 1))
    star = on_background(
        raw_star.crop(content_box(complete_tip(raw_star, axis, apex, cut), (0, 0, raw_star.width, 2 * axis + 1)))
    )
    wordmark = on_background(
        source.crop(content_box(source, (0, STAR_LAST_ROW + 1, source.width, WORDMARK_ROW_END)))
    )
    print(f"og.jpg          {source.size[0]}x{source.size[1]}")
    print(f"star sprite     {star.size[0]}x{star.size[1]}  (tip rebuilt to row {2 * axis})")
    print(f"wordmark sprite {wordmark.size[0]}x{wordmark.size[1]}")

    lockup = [(star, 1.0), (wordmark, 1.0)]
    for name, size, part, fraction in OUTPUTS:
        art = [lockup[0]] if part == "star" else lockup
        image = compose(art, size, fraction, gap=0.0 if part == "star" else 0.05)
        target = PUBLIC / name
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, "PNG", optimize=True)
        print(f"{name:<30} {size}x{size}  {target.stat().st_size / 1024:6.1f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
