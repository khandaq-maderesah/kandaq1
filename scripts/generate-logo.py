"""Generates the app's logo assets from the original artwork.

Source: public/image/newlogo2.jpg (emblem + Amharic name on off-white paper).

Outputs:
  public/image/logo-mark.png        round emblem only, transparent (sidebar, headers)
  public/image/logo-full.png        emblem + name, transparent (landing, sign-in)
  public/icons/icon-192.png         PWA icon (emblem on white)
  public/icons/icon-512.png         PWA icon
  public/icons/icon-maskable-512.png  Android adaptive icon (emblem inside the 80% safe zone)
  public/icons/apple-touch-icon.png iOS home screen icon
  public/icons/favicon-64.png       browser tab icon

Usage (needs Pillow + numpy):  python scripts/generate-logo.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "image" / "newlogo2.jpg"
IMAGE_DIR = ROOT / "public" / "image"
ICON_DIR = ROOT / "public" / "icons"

PAPER = np.array([244, 243, 237.0])  # background colour of the source artwork
EMBLEM_CENTER = (688.5, 311.5)       # measured centre of the round emblem (px)
EMBLEM_RADIUS = 262                  # a little beyond the swirl's outer edge
FULL_BOX = (420, 45, 960, 760)       # emblem + Amharic name
WATERMARK_X = 1100                   # source has a small sparkle mark bottom-right


def transparent_artwork() -> np.ndarray:
    """RGBA array: paper background removed, edge colours un-mixed from the paper."""
    rgb = np.asarray(Image.open(SRC).convert("RGB")).astype(float)
    distance = np.sqrt(((rgb - PAPER) ** 2).sum(axis=2))
    alpha = np.clip((distance - 34) / 30, 0, 1)
    a = alpha[..., None]
    unmixed = np.where(a > 0.01, (rgb - (1 - a) * PAPER) / np.maximum(a, 1e-3), rgb)
    rgba = np.dstack([np.clip(unmixed, 0, 255), alpha * 255]).astype(np.uint8)
    rgba[:, WATERMARK_X:, 3] = 0
    return rgba


def main() -> None:
    rgba = transparent_artwork()

    # Round emblem: keep only pixels inside the circle (drops the text below it).
    cx, cy = EMBLEM_CENTER
    r = EMBLEM_RADIUS
    h, w = rgba.shape[:2]
    yy, xx = np.mgrid[:h, :w]
    emblem = rgba.copy()
    emblem[(xx - cx) ** 2 + (yy - cy) ** 2 > r**2, 3] = 0
    box = (int(cx - r - 6), int(cy - r - 6), int(cx + r + 6), int(cy + r + 6))
    mark = Image.fromarray(emblem, "RGBA").crop(box).resize((512, 512), Image.LANCZOS)
    mark.save(IMAGE_DIR / "logo-mark.png", optimize=True)

    full = Image.fromarray(rgba, "RGBA").crop(FULL_BOX)
    full.thumbnail((600, 800), Image.LANCZOS)
    full.save(IMAGE_DIR / "logo-full.png", optimize=True)

    def icon(size: int, scale: float, name: str) -> None:
        canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
        m = mark.resize((int(size * scale),) * 2, Image.LANCZOS)
        offset = (size - m.size[0]) // 2
        canvas.paste(m, (offset, offset), m)
        canvas.convert("RGB").save(ICON_DIR / name, optimize=True)

    icon(512, 0.86, "icon-512.png")
    icon(192, 0.86, "icon-192.png")
    icon(512, 0.68, "icon-maskable-512.png")
    icon(180, 0.86, "apple-touch-icon.png")
    mark.resize((64, 64), Image.LANCZOS).save(ICON_DIR / "favicon-64.png", optimize=True)
    print("Logo assets written to public/image and public/icons.")


if __name__ == "__main__":
    main()
