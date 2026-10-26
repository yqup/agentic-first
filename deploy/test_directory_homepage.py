"""Homepage navigation and public category links; no browser or provider calls."""
import json
import importlib.util
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class HomeParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.main = False
        self.categories = False
        self.more = False
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "main":
            self.main = True
        if tag == "nav" and attrs.get("aria-label") == "Directory categories":
            self.categories = True
        if tag == "details" and attrs.get("class") == "nav-more":
            self.more = True
        if tag == "a":
            self.links.append({"href": attrs.get("href", ""), "main": self.main,
                               "category": self.categories, "more": self.more})

    def handle_endtag(self, tag):
        if tag == "main":
            self.main = False
        if tag == "nav":
            self.categories = False
        if tag == "details":
            self.more = False


class DirectoryHomepageTests(unittest.TestCase):
    def setUp(self):
        self.html = (ROOT / "www/index.html").read_text()
        self.page = HomeParser()
        self.page.feed(self.html)

    def test_company_information_is_menu_only(self):
        links = [link for link in self.page.links if link["href"].startswith("/companies")]
        self.assertEqual(len(links), 1)
        self.assertTrue(links[0]["more"])
        self.assertFalse(links[0]["main"])
        self.assertIn('href="/" aria-current="page">Home', self.html)

    def test_visible_categories_open_european_directory_searches(self):
        categories = [link for link in self.page.links if link["category"]]
        self.assertEqual(len(categories), 8)
        for link in categories:
            url = urlsplit(link["href"])
            params = parse_qs(url.query, keep_blank_values=True)
            self.assertEqual(url.path, "/directory/")
            self.assertEqual(params.get("region"), ["europe"])
            self.assertTrue(params.get("q", [""])[0] or params.get("group", [""])[0])

    def test_each_category_has_real_public_results(self):
        catalog_path = ROOT.parent / "pitch-mcp/www/directory/tools.json"
        if not catalog_path.exists():
            self.skipTest("Paired directory checkout is needed for catalogue integration")
        entries = json.loads(catalog_path.read_text())["entries"]
        spec = importlib.util.spec_from_file_location("public_listing", ROOT.parent / "pitch-mcp/apps/api/src/pitch_api/public_listing.py")
        listing = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(listing)
        overrides = json.loads((ROOT.parent / "pitch-mcp/directory/public-listing-facts.json").read_text())["tools"]
        european = [item for item in entries if item.get("company", {}).get("region") in {"eu", "uk", "ch", "europe"}]
        for link in (link for link in self.page.links if link["category"]):
            params = parse_qs(urlsplit(link["href"]).query, keep_blank_values=True)
            query, group = params.get("q", [""])[0], params.get("group", [""])[0]
            results = [item for item in european if (not group or {**listing.inferred(item), **overrides.get(item["slug"],{})}["area"] == group)
                       and (not query or query in item.get("alternatives_to", []))]
            self.assertTrue(results, link["href"])

    def test_no_login_or_research_promotion(self):
        for path in ("/directory/access", "/directory/membership"):
            self.assertNotIn(path, self.html)

    def test_categories_use_one_local_icon_set(self):
        for name in ("bot", "cpu", "database", "workflow", "users", "mail", "cloud", "terminal"):
            self.assertIn(f'src="/directory/assets/icons/{name}.svg"',self.html)


if __name__ == "__main__":
    unittest.main()
