#!/usr/bin/env python3
"""Validate public crawler metadata and discovery files.

This checker keeps social-preview and crawler basics out of "looks fine in my
browser" territory. It can validate the local static root and, after a release,
optionally fetch the deployed page with crawler-style requests.
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen


CANONICAL = "https://agentic-first.co/"
TITLE = "Agentic First | Open Company Information and Tool Directory"
DESCRIPTION = (
    "Agentic First maps Open Company Information and the Open Tool Directory so "
    "companies and agentic builders can publish and find reliable agent-readable resources."
)
OG_DESCRIPTION = (
    "A route map for Open Company Information and the Open Tool Directory, helping companies "
    "and agentic builders publish and find reliable agent-readable resources."
)
SOCIAL_IMAGE = "https://agentic-first.co/static/img/agentic-first-social.png"
SOCIAL_ALT = (
    "Agentic First route map showing Open Company Information and the Open Tool Directory "
    "as separate public agentic surfaces."
)
CRAWLER_USER_AGENT = "LinkedInBot/1.0 (+https://www.linkedin.com/)"
MAX_SOCIAL_IMAGE_BYTES = 1_000_000
SECRET_WORDS = ("api_key", "apikey", "bearer", "password", "private_key", "secret", "token")


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self._in_title = False
        self._script_type: str | None = None
        self._script_parts: list[str] = []
        self.meta: dict[str, str] = {}
        self.links: dict[str, str] = {}
        self.scripts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {name.lower(): value or "" for name, value in attrs}
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            key = attr.get("property") or attr.get("name")
            if key and attr.get("content"):
                self.meta[key] = attr["content"]
        if tag == "link":
            for rel in attr.get("rel", "").lower().split():
                if attr.get("href"):
                    self.links[rel] = attr["href"]
        if tag == "script" and attr.get("type") == "application/ld+json":
            self._script_type = attr["type"]
            self._script_parts = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        if tag == "script" and self._script_type == "application/ld+json":
            self.scripts.append("".join(self._script_parts).strip())
            self._script_type = None
            self._script_parts = []

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        if self._script_type == "application/ld+json":
            self._script_parts.append(data)


def _parse_html(html: str) -> PageParser:
    parser = PageParser()
    parser.feed(html)
    return parser


def _require(failures: list[str], condition: bool, message: str) -> None:
    if not condition:
        failures.append(message)


def _png_size(data: bytes) -> tuple[int, int] | None:
    if not data.startswith(b"\x89PNG\r\n\x1a\n") or len(data) < 24:
        return None
    return struct.unpack(">II", data[16:24])


def _read_json_ld(parser: PageParser, failures: list[str]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for script in parser.scripts:
        try:
            data = json.loads(script)
        except json.JSONDecodeError as exc:
            failures.append(f"JSON-LD is not valid JSON: {exc}")
            continue
        if isinstance(data, dict):
            records.append(data)
        elif isinstance(data, list):
            records.extend(record for record in data if isinstance(record, dict))
    return records


def _json_type(record: dict[str, Any]) -> set[str]:
    value = record.get("@type")
    if isinstance(value, str):
        return {value}
    if isinstance(value, list):
        return {str(item) for item in value}
    return set()


def _validate_html(parser: PageParser, failures: list[str]) -> None:
    _require(failures, parser.title.strip() == TITLE, "HTML title must be unique and match the public preview title.")
    _require(failures, parser.meta.get("description") == DESCRIPTION, "meta description is missing or does not match.")
    _require(failures, parser.links.get("canonical") == CANONICAL, "canonical URL must be the absolute HTTPS homepage URL.")

    _require(failures, parser.meta.get("og:title") == TITLE, "og:title is missing or does not match.")
    _require(failures, parser.meta.get("og:type") == "website", "og:type must be website.")
    _require(failures, parser.meta.get("og:url") == CANONICAL, "og:url must match canonical.")
    _require(failures, parser.meta.get("og:description") == OG_DESCRIPTION, "og:description is missing or does not match.")
    _require(failures, parser.meta.get("og:image") == SOCIAL_IMAGE, "og:image is missing or does not match.")
    _require(failures, parser.meta.get("og:image:secure_url") == SOCIAL_IMAGE, "og:image:secure_url must match og:image.")
    _require(failures, parser.meta.get("og:image:type") == "image/png", "og:image:type must be image/png.")
    _require(failures, parser.meta.get("og:image:width") == "1200", "og:image:width must be 1200.")
    _require(failures, parser.meta.get("og:image:height") == "627", "og:image:height must be 627.")
    _require(failures, parser.meta.get("og:image:alt") == SOCIAL_ALT, "og:image:alt is missing or does not match.")

    _require(failures, parser.meta.get("twitter:card") == "summary_large_image", "twitter:card must be summary_large_image.")
    _require(failures, parser.meta.get("twitter:title") == TITLE, "twitter:title must match title.")
    _require(failures, parser.meta.get("twitter:description") == OG_DESCRIPTION, "twitter:description must match OG description.")
    _require(failures, parser.meta.get("twitter:image") == SOCIAL_IMAGE, "twitter:image must match og:image.")
    _require(failures, parser.meta.get("twitter:image:alt") == SOCIAL_ALT, "twitter:image:alt is missing or does not match.")

    _require(failures, parser.links.get("manifest") == "/site.webmanifest", "web manifest link is missing.")
    _require(failures, parser.links.get("apple-touch-icon") == "/apple-touch-icon.png", "Apple touch icon link is missing.")

    json_ld = _read_json_ld(parser, failures)
    article = next((record for record in json_ld if _json_type(record) & {"Article", "BlogPosting"}), None)
    _require(failures, article is not None, "Article or BlogPosting JSON-LD is required.")
    if article:
        _require(failures, bool(article.get("headline")), "JSON-LD headline is required.")
        _require(failures, bool(article.get("author")), "JSON-LD author is required.")
        _require(failures, bool(article.get("datePublished")), "JSON-LD datePublished is required.")
        _require(failures, bool(article.get("dateModified")), "JSON-LD dateModified is required.")
        _require(failures, article.get("url") == CANONICAL, "JSON-LD url must match canonical.")
        image = article.get("image")
        image_values = image if isinstance(image, list) else [image]
        _require(failures, SOCIAL_IMAGE in image_values, "JSON-LD image must include the social image.")
        page = article.get("mainEntityOfPage")
        if isinstance(page, dict):
            _require(failures, page.get("@id") == CANONICAL, "JSON-LD mainEntityOfPage must match canonical.")
        else:
            _require(failures, False, "JSON-LD mainEntityOfPage object is required.")


def _path_for_url(root: Path, url: str) -> Path:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != "agentic-first.co":
        raise ValueError(f"{url} must be an absolute https://agentic-first.co URL")
    return root / parsed.path.lstrip("/")


def _check_png_file(path: Path, width: int, height: int, failures: list[str]) -> None:
    _require(failures, path.exists(), f"{path} is missing.")
    if not path.exists():
        return
    data = path.read_bytes()
    _require(failures, len(data) < MAX_SOCIAL_IMAGE_BYTES, f"{path} must stay below 1 MB.")
    _require(failures, _png_size(data) == (width, height), f"{path} must be {width} x {height}.")


def _validate_local_files(root: Path, parser: PageParser, failures: list[str]) -> None:
    try:
        social_path = _path_for_url(root, parser.meta.get("og:image", ""))
    except ValueError as exc:
        failures.append(str(exc))
    else:
        _check_png_file(social_path, 1200, 627, failures)
    _check_png_file(root / "apple-touch-icon.png", 180, 180, failures)
    _check_png_file(root / "icon-192.png", 192, 192, failures)
    _check_png_file(root / "icon-512.png", 512, 512, failures)

    required_files = [
        "robots.txt",
        "sitemap.xml",
        "feed.xml",
        "favicon.svg",
        "site.webmanifest",
        "llms.txt",
        ".well-known/agentic-profile.json",
    ]
    for required_file in required_files:
        _require(failures, (root / required_file).exists(), f"{required_file} is missing.")

    robots = (root / "robots.txt").read_text(encoding="utf-8")
    _require(failures, "Sitemap: https://agentic-first.co/sitemap.xml" in robots, "robots.txt must point to sitemap.xml.")
    _require(failures, "Disallow: /" not in robots, "robots.txt must not block the public site.")

    sitemap = (root / "sitemap.xml").read_text(encoding="utf-8")
    for url in (CANONICAL, "https://agentic-first.co/companies/", "https://agentic-first.co/directory/"):
        _require(failures, f"<loc>{url}</loc>" in sitemap, f"sitemap.xml must include {url}.")

    feed = (root / "feed.xml").read_text(encoding="utf-8")
    _require(failures, f"<link>{CANONICAL}</link>" in feed, "feed.xml must link to the canonical homepage.")
    _require(failures, 'href="https://agentic-first.co/feed.xml"' in feed, "feed.xml must include a self atom:link.")

    manifest = json.loads((root / "site.webmanifest").read_text(encoding="utf-8"))
    _require(failures, manifest.get("start_url") == CANONICAL, "site.webmanifest start_url must match canonical.")
    _require(failures, manifest.get("scope") == CANONICAL, "site.webmanifest scope must match canonical.")

    llms = (root / "llms.txt").read_text(encoding="utf-8").lower()
    _require(failures, "does not grant authority" in llms, "llms.txt must explicitly say discovery grants no authority.")

    profile = (root / ".well-known/agentic-profile.json").read_text(encoding="utf-8").lower()
    for word in SECRET_WORDS:
        _require(failures, word not in profile, f"agentic-profile.json must not expose {word}.")


def _fetch(url: str, timeout: float) -> tuple[int, dict[str, str], bytes]:
    request = Request(
        url,
        headers={
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "User-Agent": CRAWLER_USER_AGENT,
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.status, {key.lower(): value for key, value in response.headers.items()}, response.read()
    except HTTPError as exc:
        return exc.code, {key.lower(): value for key, value in exc.headers.items()}, exc.read()
    except (URLError, TimeoutError) as exc:
        raise RuntimeError(f"{url} failed: {exc}") from exc


def _validate_live(live_url: str, timeout: float, failures: list[str]) -> None:
    status, headers, body = _fetch(live_url, timeout)
    _require(failures, status == 200, f"{live_url} must return HTTP 200 to crawlers.")
    _require(failures, "text/html" in headers.get("content-type", ""), f"{live_url} must return text/html.")
    parser = _parse_html(body.decode("utf-8", errors="replace"))
    _validate_html(parser, failures)

    image_url = parser.meta.get("og:image", "")
    status, image_headers, image_body = _fetch(image_url, timeout)
    _require(failures, status == 200, f"{image_url} must return HTTP 200 anonymously.")
    _require(failures, "set-cookie" not in image_headers, f"{image_url} should not set cookies for crawler requests.")
    _require(failures, image_headers.get("content-type", "").split(";")[0] == "image/png", f"{image_url} must return image/png.")
    _require(failures, len(image_body) < MAX_SOCIAL_IMAGE_BYTES, f"{image_url} must stay below 1 MB.")
    _require(failures, _png_size(image_body) == (1200, 627), f"{image_url} must be 1200 x 627.")

    for path in ("robots.txt", "sitemap.xml", "feed.xml", "site.webmanifest", "favicon.svg", "apple-touch-icon.png", "llms.txt"):
        url = urljoin(CANONICAL, path)
        status, _, _ = _fetch(url, timeout)
        _require(failures, status == 200, f"{url} must return HTTP 200 to crawlers.")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="www", help="static site root")
    parser.add_argument("--live-url", help="optional deployed page URL to test with crawler-style requests")
    parser.add_argument("--timeout", type=float, default=10.0)
    args = parser.parse_args()

    root = Path(args.root)
    failures: list[str] = []
    html = root / "index.html"
    parsed = _parse_html(html.read_text(encoding="utf-8"))
    _validate_html(parsed, failures)
    _validate_local_files(root, parsed, failures)

    if args.live_url:
        try:
            _validate_live(args.live_url, args.timeout, failures)
        except RuntimeError as exc:
            failures.append(str(exc))

    if failures:
        for failure in failures:
            print(f"public discovery check failed: {failure}", file=sys.stderr)
        return 1

    mode = "local and live" if args.live_url else "local"
    print(f"public discovery check passed ({mode})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
