import struct
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WWW = ROOT / "www"


class BrandAssets(unittest.TestCase):
    def test_png_dimensions_and_alpha(self):
        for name, size in {"static/img/agentic-first-mark.png":128, "favicon-32.png":32,
                           "apple-touch-icon.png":180, "icon-192.png":192, "icon-512.png":512}.items():
            data = (WWW / name).read_bytes()
            self.assertTrue(data.startswith(b"\x89PNG\r\n\x1a\n"))
            self.assertEqual(struct.unpack(">II", data[16:24]), (size,size))
            self.assertEqual(data[25], 6, "RGBA export must preserve transparency")

    def test_favicon_is_self_contained_and_ico_has_png(self):
        svg = ET.fromstring((WWW / "favicon.svg").read_text())
        image = svg.find("{http://www.w3.org/2000/svg}image")
        self.assertTrue(image.attrib["href"].startswith("data:image/png;base64,"))
        self.assertIn("#e8efe8", (WWW / "favicon.svg").read_text())
        ico = (WWW / "favicon.ico").read_bytes()
        self.assertEqual(struct.unpack("<HHH", ico[:6]), (0,1,1))
        self.assertEqual(ico[22:], (WWW / "favicon-32.png").read_bytes())

    def test_wordmark_and_matching_directory_exports(self):
        logo = WWW / "static/img/agentic-first-logo.svg"
        self.assertIn(">Agentic First</text>", logo.read_text())
        other = ROOT.parent / "pitch-mcp/www/directory/assets"
        if not other.is_dir():
            self.skipTest("Sibling Directory checkout unavailable")
        for source in (logo, WWW / "favicon.svg", WWW / "favicon.ico",
                       WWW / "favicon-32.png", WWW / "static/img/agentic-first-mark.png",
                       WWW / "apple-touch-icon.png", WWW / "icon-192.png", WWW / "icon-512.png"):
            self.assertEqual(source.read_bytes(), (other / source.name).read_bytes())

    def test_header_retains_accessible_brand_text(self):
        html = (WWW / "index.html").read_text()
        self.assertIn('width="44" height="44" alt="">Agentic First', html)
        self.assertIn('/favicon.svg?v=20261026', html)


if __name__ == "__main__":
    unittest.main()
