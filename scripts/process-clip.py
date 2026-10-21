#!/usr/bin/env python3
"""Process a generated magenta sprite sheet into a transparent WebP clip."""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path("/workspace")
SPRITE_PY = ROOT / ".grok/skills/generate2dsprite/scripts/generate2dsprite.py"


def chroma_to_webp(src: Path, dest: Path, cols: int, rows: int) -> None:
    work = dest.parent / f".work-{dest.stem}"
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True)
    raw = work / "raw-sheet.png"
    Image.open(src).convert("RGBA").save(raw)
    cmd = [
        sys.executable, str(SPRITE_PY), "process",
        "--input", str(raw),
        "--target", "player",
        "--mode", "sheet",
        "--rows", str(rows),
        "--cols", str(cols),
        "--output-dir", str(work),
        "--shared-scale",
        "--align", "feet",
        "--component-mode", "largest",
    ]
    subprocess.run(cmd, check=False)
    sheet = work / "sheet-transparent.png"
    if not sheet.exists():
        sheet = work / "raw-sheet-clean.png"
    if not sheet.exists():
        # fallback: local magenta key
        im = Image.open(raw).convert("RGBA")
        px = im.load()
        w, h = im.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if r > 180 and b > 180 and g < 80:
                    px[x, y] = (0, 0, 0, 0)
        im.save(sheet)
    im = Image.open(sheet).convert("RGBA")
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", lossless=True, quality=90, method=6)
    print(f"wrote {dest} {im.size} from {src.name}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("input")
    p.add_argument("dest")
    p.add_argument("--cols", type=int, required=True)
    p.add_argument("--rows", type=int, required=True)
    args = p.parse_args()
    chroma_to_webp(Path(args.input), Path(args.dest), args.cols, args.rows)


if __name__ == "__main__":
    main()
