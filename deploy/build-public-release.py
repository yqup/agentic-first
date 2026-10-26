#!/usr/bin/env python3
"""Create a public-only homepage archive. Never include source history or old releases."""
import argparse
import hashlib
import io
import json
import re
import tarfile
from pathlib import Path


def build(root, output, release):
    if not re.fullmatch(r"agentic-first-[0-9]{8}T[0-9]{6}Z", release):
        raise ValueError("Invalid release ID")
    if output.exists():
        raise ValueError("Output already exists")
    pointer = json.loads((root / "www/static/agentic-tools.json").read_text())
    if pointer.get("entries") != [] or pointer.get("catalog_version") != "2.0":
        raise ValueError("Legacy copied catalogue must not be released")
    files = [p for p in (root / "www").rglob("*") if p.is_file()]
    files += [root / "deploy/deploy.yaml", root / "deploy/check-homepage-links.py",
              root / "deploy/check-public-page-discovery.py", root / "LICENSE"]
    with output.open("xb") as stream, tarfile.open(fileobj=stream, mode="w:gz") as archive:
        for path in sorted(files):
            if path.is_symlink():
                raise ValueError("Symlinks are not allowed in public artifacts")
            if path.name.startswith(".env") or path.suffix in {".sqlite3", ".db", ".pem"}:
                raise ValueError("Unexpected private file in web root")
            archive.add(path, "agentic-first/" + str(path.relative_to(root)), recursive=False)
        receipt = json.dumps({"release": release, "content_boundary":"public-only-v2"}).encode()
        info = tarfile.TarInfo("agentic-first/public-boundary.json")
        info.size, info.mode = len(receipt), 0o644
        archive.addfile(info, io.BytesIO(receipt))
    return hashlib.sha256(output.read_bytes()).hexdigest()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(build(Path(__file__).resolve().parents[1], args.output, args.release))
