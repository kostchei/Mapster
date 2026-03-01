#!/usr/bin/env python3
"""
Cut 7 small sub-hex pieces out of each 1037x901 hex-tile image.

Inputs:
  D:\\Code\\Mapster\\Examples\\Hexs\\hex-tile-*.png
  (layout is calibrated from hex-tile-blank.png)

Outputs:
  D:\\Code\\Mapster\\Examples\\Hexs\\subhexes\\<tile-name>\\<tile-name>--<slot>.png
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi


ROOT = Path(r"D:\Code\Mapster")
HEXS_DIR = ROOT / "Examples" / "Hexs"
BLANK_PATH = HEXS_DIR / "hex-tile-blank.png"
OUT_DIR = HEXS_DIR / "subhexes"


def derive_layout(blank_path: Path):
    img = np.array(Image.open(blank_path).convert("RGBA"))
    alpha = img[:, :, 3]
    rgb = img[:, :, :3]
    gray = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]

    inside = alpha > 150
    line = inside & (gray < 100)
    line = ndi.binary_dilation(line, iterations=1)

    dt = ndi.distance_transform_edt(~line)
    dt[~inside] = 0

    # Find 7 center peaks (center + ring of 6)
    # Small-hex inradius is ~143 px; these settings isolate one peak per cell.
    from skimage.feature import peak_local_max  # imported here to keep top imports minimal

    coords = peak_local_max(dt, min_distance=70, threshold_abs=25, num_peaks=20)
    if len(coords) < 7:
        raise RuntimeError(f"Expected >=7 peaks from blank tile, found {len(coords)}")

    centers = []
    for y, x in coords[:7]:
        centers.append((float(x), float(y), float(dt[y, x])))

    # Identify center cell as nearest to image midpoint.
    h, w = dt.shape
    mid = np.array([w / 2.0, h / 2.0])
    c_idx = min(range(len(centers)), key=lambda i: np.linalg.norm(np.array(centers[i][:2]) - mid))
    cx, cy, cdist = centers[c_idx]

    others = [c for i, c in enumerate(centers) if i != c_idx]
    inradius = float(np.median([c[2] for c in centers]))
    radius = inradius / math.cos(math.radians(30))  # circumradius for flat-top hex

    slots = {"c": (cx, cy)}
    target_angles = {
        "n": 270.0,
        "ne": 330.0,
        "se": 30.0,
        "s": 90.0,
        "sw": 150.0,
        "nw": 210.0,
    }
    taken = set()
    for x, y, _ in others:
        dx = x - cx
        dy = y - cy
        angle = (math.degrees(math.atan2(dy, dx)) + 360) % 360
        key = min(
            target_angles.keys(),
            key=lambda k: min(abs(angle - target_angles[k]), 360 - abs(angle - target_angles[k])),
        )
        if key in taken:
            raise RuntimeError(f"Duplicate directional assignment for angle {angle:.1f}: {key}")
        slots[key] = (x, y)
        taken.add(key)

    required = {"c", "n", "ne", "se", "s", "sw", "nw"}
    if not required.issubset(slots.keys()):
        raise RuntimeError(f"Failed to map all 7 directional slots. Got: {sorted(slots.keys())}")

    return slots, radius


def hex_polygon(cx: float, cy: float, radius: float):
    points = []
    for i in range(6):
        a = math.radians(60 * i)
        points.append((cx + radius * math.cos(a), cy + radius * math.sin(a)))
    return points


def crop_masked_hex(src_rgba: Image.Image, cx: float, cy: float, radius: float):
    mask = Image.new("L", src_rgba.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(hex_polygon(cx, cy, radius), fill=255)

    out = Image.new("RGBA", src_rgba.size, (0, 0, 0, 0))
    out.paste(src_rgba, (0, 0), mask)

    bbox = out.getbbox()
    if bbox is None:
        return out
    return out.crop(bbox)


def build_contact_sheet(tile_name: str, pieces: dict[str, Image.Image], out_dir: Path):
    order = ["nw", "n", "ne", "sw", "c", "se", "s"]
    thumbs = [pieces[k] for k in order]
    w = max(im.width for im in thumbs)
    h = max(im.height for im in thumbs)
    pad = 12
    cols = 3
    rows = 3
    sheet = Image.new("RGBA", (cols * (w + pad) + pad, rows * (h + pad) + 40), (255, 255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    draw.text((pad, 10), tile_name, fill=(0, 0, 0, 255))

    positions = {
        "nw": (0, 0),
        "n": (1, 0),
        "ne": (2, 0),
        "sw": (0, 1),
        "c": (1, 1),
        "se": (2, 1),
        "s": (1, 2),
    }
    for slot, (cx, cy) in positions.items():
        im = pieces[slot]
        x = pad + cx * (w + pad) + (w - im.width) // 2
        y = 28 + pad + cy * (h + pad) + (h - im.height) // 2
        sheet.alpha_composite(im, (x, y))
        draw.text((x + 6, y + 6), slot, fill=(0, 0, 0, 255))

    sheet.save(out_dir / f"{tile_name}--sheet.png")


def main():
    slots, radius = derive_layout(BLANK_PATH)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(HEXS_DIR.glob("hex-tile-*.png"))
    total = 0

    print("Sub-hex layout:")
    for k in ["nw", "n", "ne", "sw", "c", "se", "s"]:
        x, y = slots[k]
        print(f"  {k}: ({x:.1f}, {y:.1f})")
    print(f"  radius: {radius:.2f}px")

    for src in files:
        tile_name = src.stem
        tile_out = OUT_DIR / tile_name
        tile_out.mkdir(parents=True, exist_ok=True)

        im = Image.open(src).convert("RGBA")
        pieces = {}
        for slot in ["nw", "n", "ne", "sw", "c", "se", "s"]:
            cx, cy = slots[slot]
            piece = crop_masked_hex(im, cx, cy, radius - 2.0)
            piece.save(tile_out / f"{tile_name}--{slot}.png")
            pieces[slot] = piece
            total += 1

        build_contact_sheet(tile_name, pieces, tile_out)

    print(f"Processed {len(files)} source tiles")
    print(f"Wrote {total} sub-hex pieces under: {OUT_DIR}")


if __name__ == "__main__":
    main()
