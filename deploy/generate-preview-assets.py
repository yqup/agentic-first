#!/usr/bin/env python3
"""Generate crawler preview and app icon PNGs for Agentic First.

The output is deliberately dependency-free so release checks can recreate the
assets on a plain Python install.
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WWW = ROOT / "www"


PALETTE = {
    "paper": (251, 247, 239),
    "ink": (38, 36, 52),
    "muted": (111, 105, 124),
    "blue": (47, 95, 142),
    "blue_dark": (31, 63, 104),
    "blue_light": (228, 237, 247),
    "green": (68, 123, 92),
    "green_dark": (42, 87, 64),
    "green_light": (229, 242, 235),
    "gold": (195, 125, 55),
    "cream": (255, 252, 246),
    "line": (217, 205, 188),
}


FONT: dict[str, tuple[str, ...]] = {
    " ": ("00000", "00000", "00000", "00000", "00000", "00000", "00000"),
    "+": ("00000", "00100", "00100", "11111", "00100", "00100", "00000"),
    ".": ("00000", "00000", "00000", "00000", "00000", "01100", "01100"),
    "-": ("00000", "00000", "00000", "11111", "00000", "00000", "00000"),
    "/": ("00001", "00010", "00100", "01000", "10000", "00000", "00000"),
    "0": ("01110", "10001", "10011", "10101", "11001", "10001", "01110"),
    "1": ("00100", "01100", "00100", "00100", "00100", "00100", "01110"),
    "2": ("01110", "10001", "00001", "00010", "00100", "01000", "11111"),
    "3": ("11110", "00001", "00001", "01110", "00001", "00001", "11110"),
    "4": ("00010", "00110", "01010", "10010", "11111", "00010", "00010"),
    "5": ("11111", "10000", "10000", "11110", "00001", "00001", "11110"),
    "6": ("00110", "01000", "10000", "11110", "10001", "10001", "01110"),
    "7": ("11111", "00001", "00010", "00100", "01000", "01000", "01000"),
    "8": ("01110", "10001", "10001", "01110", "10001", "10001", "01110"),
    "9": ("01110", "10001", "10001", "01111", "00001", "00010", "11100"),
    "A": ("01110", "10001", "10001", "11111", "10001", "10001", "10001"),
    "B": ("11110", "10001", "10001", "11110", "10001", "10001", "11110"),
    "C": ("01110", "10001", "10000", "10000", "10000", "10001", "01110"),
    "D": ("11110", "10001", "10001", "10001", "10001", "10001", "11110"),
    "E": ("11111", "10000", "10000", "11110", "10000", "10000", "11111"),
    "F": ("11111", "10000", "10000", "11110", "10000", "10000", "10000"),
    "G": ("01110", "10001", "10000", "10111", "10001", "10001", "01111"),
    "H": ("10001", "10001", "10001", "11111", "10001", "10001", "10001"),
    "I": ("01110", "00100", "00100", "00100", "00100", "00100", "01110"),
    "J": ("00111", "00010", "00010", "00010", "00010", "10010", "01100"),
    "K": ("10001", "10010", "10100", "11000", "10100", "10010", "10001"),
    "L": ("10000", "10000", "10000", "10000", "10000", "10000", "11111"),
    "M": ("10001", "11011", "10101", "10101", "10001", "10001", "10001"),
    "N": ("10001", "11001", "10101", "10011", "10001", "10001", "10001"),
    "O": ("01110", "10001", "10001", "10001", "10001", "10001", "01110"),
    "P": ("11110", "10001", "10001", "11110", "10000", "10000", "10000"),
    "Q": ("01110", "10001", "10001", "10001", "10101", "10010", "01101"),
    "R": ("11110", "10001", "10001", "11110", "10100", "10010", "10001"),
    "S": ("01111", "10000", "10000", "01110", "00001", "00001", "11110"),
    "T": ("11111", "00100", "00100", "00100", "00100", "00100", "00100"),
    "U": ("10001", "10001", "10001", "10001", "10001", "10001", "01110"),
    "V": ("10001", "10001", "10001", "10001", "10001", "01010", "00100"),
    "W": ("10001", "10001", "10001", "10101", "10101", "10101", "01010"),
    "X": ("10001", "10001", "01010", "00100", "01010", "10001", "10001"),
    "Y": ("10001", "10001", "01010", "00100", "00100", "00100", "00100"),
    "Z": ("11111", "00001", "00010", "00100", "01000", "10000", "11111"),
}


def _rgb(hex_name: str) -> tuple[int, int, int]:
    return PALETTE[hex_name]


def _blank(width: int, height: int, color: tuple[int, int, int]) -> bytearray:
    return bytearray(color * width * height)


def _set_px(pixels: bytearray, width: int, height: int, x: int, y: int, color: tuple[int, int, int]) -> None:
    if x < 0 or y < 0 or x >= width or y >= height:
        return
    i = (y * width + x) * 3
    pixels[i : i + 3] = bytes(color)


def _rect(
    pixels: bytearray,
    width: int,
    height: int,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    color: tuple[int, int, int],
) -> None:
    x0, x1 = max(0, x0), min(width, x1)
    y0, y1 = max(0, y0), min(height, y1)
    row = bytes(color) * max(0, x1 - x0)
    for y in range(y0, y1):
        start = (y * width + x0) * 3
        pixels[start : start + len(row)] = row


def _line(
    pixels: bytearray,
    width: int,
    height: int,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    color: tuple[int, int, int],
    thickness: int = 4,
) -> None:
    dx = abs(x1 - x0)
    dy = -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    x, y = x0, y0
    radius = max(1, thickness // 2)
    while True:
        _rect(pixels, width, height, x - radius, y - radius, x + radius + 1, y + radius + 1, color)
        if x == x1 and y == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x += sx
        if e2 <= dx:
            err += dx
            y += sy


def _circle(
    pixels: bytearray,
    width: int,
    height: int,
    cx: int,
    cy: int,
    radius: int,
    color: tuple[int, int, int],
) -> None:
    r2 = radius * radius
    for y in range(cy - radius, cy + radius + 1):
        for x in range(cx - radius, cx + radius + 1):
            if (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2:
                _set_px(pixels, width, height, x, y, color)


def _border(
    pixels: bytearray,
    width: int,
    height: int,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    color: tuple[int, int, int],
    thickness: int = 3,
) -> None:
    _rect(pixels, width, height, x0, y0, x1, y0 + thickness, color)
    _rect(pixels, width, height, x0, y1 - thickness, x1, y1, color)
    _rect(pixels, width, height, x0, y0, x0 + thickness, y1, color)
    _rect(pixels, width, height, x1 - thickness, y0, x1, y1, color)


def _text_width(text: str, scale: int, spacing: int) -> int:
    width = 0
    for char in text.upper():
        glyph = FONT.get(char, FONT[" "])
        width += len(glyph[0]) * scale + spacing
    return max(0, width - spacing)


def _text(
    pixels: bytearray,
    width: int,
    height: int,
    x: int,
    y: int,
    text: str,
    color: tuple[int, int, int],
    scale: int = 6,
    spacing: int = 4,
) -> None:
    cursor = x
    for char in text.upper():
        glyph = FONT.get(char, FONT[" "])
        for row_i, row in enumerate(glyph):
            for col_i, on in enumerate(row):
                if on == "1":
                    _rect(
                        pixels,
                        width,
                        height,
                        cursor + col_i * scale,
                        y + row_i * scale,
                        cursor + (col_i + 1) * scale,
                        y + (row_i + 1) * scale,
                        color,
                    )
        cursor += len(glyph[0]) * scale + spacing


def _center_text(
    pixels: bytearray,
    width: int,
    height: int,
    y: int,
    text: str,
    color: tuple[int, int, int],
    scale: int,
    spacing: int,
) -> None:
    _text(pixels, width, height, (width - _text_width(text, scale, spacing)) // 2, y, text, color, scale, spacing)


def _write_png(path: Path, width: int, height: int, pixels: bytearray) -> None:
    raw = bytearray()
    stride = width * 3
    for y in range(height):
        raw.append(0)
        start = y * stride
        raw.extend(pixels[start : start + stride])

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), level=9))
        + chunk(b"IEND", b"")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def _social_image() -> None:
    width, height = 1200, 627
    pixels = _blank(width, height, _rgb("paper"))
    _rect(pixels, width, height, 0, 0, width, 18, _rgb("blue_dark"))
    _rect(pixels, width, height, 0, height - 18, width, height, _rgb("green_dark"))
    _rect(pixels, width, height, 64, 56, 1136, 568, _rgb("cream"))
    _border(pixels, width, height, 64, 56, 1136, 568, _rgb("line"), 4)

    _text(pixels, width, height, 108, 100, "AGENTIC FIRST", _rgb("ink"), scale=13, spacing=8)
    _text(pixels, width, height, 112, 196, "OPEN COMPANY INFORMATION", _rgb("muted"), scale=5, spacing=4)
    _text(pixels, width, height, 112, 238, "OPEN TOOL DIRECTORY", _rgb("muted"), scale=5, spacing=4)

    left = (112, 332, 500, 510)
    right = (700, 332, 1088, 510)
    _rect(pixels, width, height, *left, _rgb("blue_light"))
    _rect(pixels, width, height, *right, _rgb("green_light"))
    _border(pixels, width, height, *left, _rgb("blue"), thickness=5)
    _border(pixels, width, height, *right, _rgb("green"), thickness=5)
    _line(pixels, width, height, 500, 421, 700, 421, _rgb("gold"), thickness=10)
    _circle(pixels, width, height, 500, 421, 18, _rgb("gold"))
    _circle(pixels, width, height, 700, 421, 18, _rgb("gold"))

    _text(pixels, width, height, 148, 370, "OPEN COMPANY", _rgb("blue_dark"), scale=7, spacing=5)
    _text(pixels, width, height, 148, 434, "INFORMATION", _rgb("blue_dark"), scale=7, spacing=5)
    _text(pixels, width, height, 750, 370, "OPEN TOOL", _rgb("green_dark"), scale=7, spacing=5)
    _text(pixels, width, height, 750, 434, "DIRECTORY", _rgb("green_dark"), scale=7, spacing=5)
    _text(pixels, width, height, 108, 548, "AGENTIC-FIRST.CO", _rgb("muted"), scale=5, spacing=4)
    _write_png(WWW / "static/img/agentic-first-social.png", width, height, pixels)


def _icon(path: Path, size: int) -> None:
    pixels = _blank(size, size, _rgb("paper"))
    margin = max(8, size // 12)
    _rect(pixels, size, size, margin, margin, size - margin, size - margin, _rgb("cream"))
    _border(pixels, size, size, margin, margin, size - margin, size - margin, _rgb("line"), max(2, size // 80))
    _rect(pixels, size, size, margin * 2, margin * 2, size // 2 - margin // 2, size - margin * 2, _rgb("blue_light"))
    _rect(pixels, size, size, size // 2 + margin // 2, margin * 2, size - margin * 2, size - margin * 2, _rgb("green_light"))
    _border(pixels, size, size, margin * 2, margin * 2, size // 2 - margin // 2, size - margin * 2, _rgb("blue"), max(2, size // 64))
    _border(
        pixels,
        size,
        size,
        size // 2 + margin // 2,
        margin * 2,
        size - margin * 2,
        size - margin * 2,
        _rgb("green"),
        max(2, size // 64),
    )
    _line(pixels, size, size, size // 2 - margin // 2, size // 2, size // 2 + margin // 2, size // 2, _rgb("gold"), max(4, size // 28))
    _center_text(pixels, size, size, size // 2 - size // 9, "AF", _rgb("ink"), scale=max(5, size // 30), spacing=max(3, size // 80))
    _write_png(path, size, size, pixels)


def main() -> int:
    _social_image()
    _icon(WWW / "apple-touch-icon.png", 180)
    _icon(WWW / "icon-192.png", 192)
    _icon(WWW / "icon-512.png", 512)
    social = WWW / "static/img/agentic-first-social.png"
    if social.stat().st_size >= 1_000_000:
        raise SystemExit(f"{social} must stay below 1 MB")
    print(f"generated {social} ({social.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
