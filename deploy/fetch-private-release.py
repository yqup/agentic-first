#!/usr/bin/env python3
"""Download one exact private release asset; never deploy or follow an auth redirect.

Operator integration candidate. The existing host gate does not yet call this.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import tempfile
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

REPO = "yqup/agentic-first"
MAX_BYTES = 50 * 1024 * 1024


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request(url, token=None, binary=False):
    parsed = urlsplit(url)
    allowed = {"api.github.com"} if token else {"release-assets.githubusercontent.com", "objects.githubusercontent.com"}
    if parsed.scheme != "https" or parsed.hostname not in allowed or parsed.username or parsed.port:
        raise ValueError("Unexpected artifact host")
    headers = {"Accept": "application/octet-stream" if binary else "application/vnd.github+json",
               "User-Agent": "agentic-first-private-artifact", "X-GitHub-Api-Version": "2022-11-28"}
    if token:
        headers["Authorization"] = "Bearer " + token
    return build_opener(NoRedirect()).open(Request(url, headers=headers), timeout=60)


def fetch(release, expected, credential, destination):
    if not re.fullmatch(r"agentic-first-[0-9]{8}T[0-9]{6}Z", release):
        raise ValueError("Invalid release ID")
    if not re.fullmatch(r"[0-9a-f]{64}", expected):
        raise ValueError("Invalid SHA256")
    info = credential.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or info.st_uid != os.getuid():
        raise ValueError("Credential must be an owner-only regular file owned by the operator")
    token = credential.read_text().strip()
    if not token or "\n" in token:
        raise ValueError("Invalid credential file")
    if destination.exists():
        raise ValueError("Destination already exists")
    with request(f"https://api.github.com/repos/{REPO}/releases/tags/{release}", token) as response:
        metadata = json.loads(response.read(2 * 1024 * 1024))
    assets = [asset for asset in metadata["assets"] if asset["name"] == release + ".tar.gz"]
    if len(assets) != 1 or not 0 < assets[0]["size"] <= MAX_BYTES:
        raise ValueError("Expected bounded release asset not found")
    asset_id = assets[0]["id"]
    if type(asset_id) is not int or asset_id < 1:
        raise ValueError("Invalid asset ID")
    try:
        response = request(f"https://api.github.com/repos/{REPO}/releases/assets/{asset_id}", token, True)
    except HTTPError as exc:
        if exc.code != 302:
            raise
        # Signed redirect URL is never logged; credentials never cross origins.
        response = request(exc.headers["Location"], binary=True)
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = None
    try:
        with response, tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as output:
            temporary = Path(output.name)
            checksum, count = hashlib.sha256(), 0
            while chunk := response.read(64 * 1024):
                count += len(chunk)
                if count > MAX_BYTES:
                    raise ValueError("Artifact too large")
                checksum.update(chunk)
                output.write(chunk)
            output.flush()
            os.fsync(output.fileno())
        if checksum.hexdigest() != expected:
            raise ValueError("Artifact checksum mismatch")
        os.link(temporary, destination)  # Atomic creation, never overwrite a release.
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)
    return {"release": release, "sha256": expected, "bytes": count, "deployed": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("release")
    parser.add_argument("sha256")
    parser.add_argument("--credential-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(fetch(args.release, args.sha256, args.credential_file, args.output)))
    except Exception:
        # HTTP exception text can contain a signed download URL. Deliberately omit it.
        raise SystemExit("Private artifact retrieval failed; nothing deployed.") from None


if __name__ == "__main__":
    main()
