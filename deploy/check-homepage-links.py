#!/usr/bin/env python3
"""Check links from the top-level static homepage.

This intentionally uses only the Python standard library so it can run
wherever the deployment handoff is reviewed.
"""

from __future__ import annotations

import argparse
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        if tag in {"a", "link"} and attr.get("href"):
            self.links.append(str(attr["href"]))
        if tag == "img" and attr.get("src"):
            self.links.append(str(attr["src"]))


def _check_http(url: str, timeout: float) -> str | None:
    request = Request(url, method="HEAD", headers={"User-Agent": "agentic-first-link-check/1.0"})
    try:
        with urlopen(request, timeout=timeout) as response:
            if 200 <= response.status < 400:
                return None
            return f"{url} returned HTTP {response.status}"
    except HTTPError as exc:
        if exc.code == 405:
            request = Request(url, method="GET", headers={"User-Agent": "agentic-first-link-check/1.0"})
            try:
                with urlopen(request, timeout=timeout) as response:
                    if 200 <= response.status < 400:
                        return None
                    return f"{url} returned HTTP {response.status}"
            except (HTTPError, URLError, TimeoutError) as get_exc:
                return f"{url} failed GET fallback: {get_exc}"
        return f"{url} returned HTTP {exc.code}"
    except (URLError, TimeoutError) as exc:
        return f"{url} failed: {exc}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="www", help="static site root")
    parser.add_argument(
        "--base-url",
        default="https://agentic-first.co",
        help="base URL for root-relative routed links such as /directory/",
    )
    parser.add_argument("--timeout", type=float, default=10.0)
    args = parser.parse_args()

    root = Path(args.root)
    html = root / "index.html"
    parsed = LinkParser()
    parsed.feed(html.read_text(encoding="utf-8"))

    failures: list[str] = []
    for link in sorted(set(parsed.links)):
        if link.startswith(("mailto:", "tel:", "#")):
            continue
        url = urlparse(link)
        if url.scheme in {"http", "https"}:
            failure = _check_http(link, args.timeout)
            if failure:
                failures.append(failure)
            continue
        if link.startswith("/"):
            local_path = root / link.lstrip("/")
            if local_path.exists():
                continue
            failure = _check_http(urljoin(args.base_url, link), args.timeout)
            if failure:
                failures.append(failure)
            continue
        local_path = (html.parent / link).resolve()
        try:
            local_path.relative_to(root.resolve())
        except ValueError:
            failures.append(f"{link} resolves outside {root}")
            continue
        if not local_path.exists():
            failures.append(f"{link} missing at {local_path}")

    if failures:
        for failure in failures:
            print(f"link check failed: {failure}", file=sys.stderr)
        return 1

    print(f"checked {len(set(parsed.links))} links from {html}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
