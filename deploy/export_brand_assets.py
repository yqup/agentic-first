#!/usr/bin/env python3
"""Export the generated brand master with macOS sips; no creative image edits."""

from __future__ import annotations

import base64
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
WWW = ROOT / "www"
MASTER = ROOT / "brand-assets/agentic-first-mark-master.png"


def export_icons():
    if not MASTER.is_file() or not shutil.which("sips"):
        raise RuntimeError("Export on AKAAR with the checked-in master and macOS sips; retain existing exports elsewhere")
    destinations = {
        "static/img/agentic-first-mark.png": 128,
        "apple-touch-icon.png": 180,
        "icon-192.png": 192,
        "icon-512.png": 512,
        "favicon-32.png": 32,
    }
    for relative, size in destinations.items():
        target = WWW / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["sips", "-z", str(size), str(size), str(MASTER), "--out", str(target)],
                       check=True, capture_output=True)
    with tempfile.TemporaryDirectory() as folder:
        small = Path(folder) / "mark.png"
        subprocess.run(["sips", "-z", "64", "64", str(MASTER), "--out", str(small)],
                       check=True, capture_output=True)
        encoded = base64.b64encode(small.read_bytes()).decode("ascii")
    favicon = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title">\n'
        '  <title id="title">Agentic First</title>\n'
        '  <rect width="64" height="64" rx="8" fill="#e8efe8"/>\n'
        f'  <image width="64" height="64" href="data:image/png;base64,{encoded}"/>\n</svg>\n'
    )
    (WWW / "favicon.svg").write_text(favicon, encoding="utf-8")
    png = (WWW / "favicon-32.png").read_bytes()
    (WWW / "favicon.ico").write_bytes(struct.pack("<HHH", 0, 1, 1)
        + struct.pack("<BBBBHHII", 32, 32, 0, 0, 1, 32, len(png), 22) + png)
    mark = base64.b64encode((WWW / "static/img/agentic-first-mark.png").read_bytes()).decode("ascii")
    logo = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 96" role="img" aria-labelledby="title">\n'
        '  <title id="title">Agentic First</title>\n'
        f'  <image width="96" height="96" href="data:image/png;base64,{mark}"/>\n'
        '  <text x="108" y="64" fill="#345b48" font-family="Georgia,serif" font-weight="700" font-size="48">Agentic First</text>\n'
        '</svg>\n'
    )
    (WWW / "static/img/agentic-first-logo.svg").write_text(logo, encoding="utf-8")
    directory = ROOT.parent / "pitch-mcp/www/directory/assets"
    if directory.is_dir():
        for relative in destinations:
            shutil.copyfile(WWW / relative, directory / Path(relative).name)
        for name in ("favicon.svg", "favicon.ico", "agentic-first-logo.svg"):
            source = WWW / name if name.startswith("favicon") else WWW / "static/img" / name
            shutil.copyfile(source, directory / name)
    print("Exported matching header mark, wordmark, favicon and app icons")


if __name__ == "__main__":
    export_icons()
