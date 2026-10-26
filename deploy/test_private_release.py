import hashlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

spec = importlib.util.spec_from_file_location("private_release", Path(__file__).with_name("fetch-private-release.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PrivateReleaseTests(unittest.TestCase):
    def test_private_redirect_never_forwards_credentials_and_checks_digest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            credential = root / "credential"
            credential.touch(mode=0o600)
            credential.write_text("synthetic-test-credential")
            blob = b"synthetic immutable artifact"
            release = "agentic-first-20261026T120000Z"
            destination = root / "release.tar.gz"
            calls = []
            def request(url, token=None, binary=False):
                calls.append((url,token))
                if "/tags/" in url:
                    return io.BytesIO(json.dumps({"assets":[{"id":123,"size":len(blob),"name":release+".tar.gz"}]}).encode())
                if "/assets/" in url:
                    raise HTTPError(url,302,"redirect",{"Location":"https://release-assets.githubusercontent.com/test?signature=synthetic"},None)
                return io.BytesIO(blob)
            with patch.object(module,"request",request):
                receipt = module.fetch(release,hashlib.sha256(blob).hexdigest(),credential,destination)
            self.assertFalse(receipt["deployed"])
            self.assertEqual(destination.read_bytes(),blob)
            self.assertIsNone(calls[-1][1])
            self.assertEqual(destination.stat().st_mode & 0o777,0o600)
            with patch.object(module,"request",request), self.assertRaises(ValueError):
                module.fetch(release,"0"*64,credential,root/"bad.tar.gz")
            self.assertFalse((root/"bad.tar.gz").exists())

    def test_credentials_and_redirect_hosts_are_restricted(self):
        for url in ("http://api.github.com/a","https://evil.example/a","https://api.github.com:443/a","https://user@api.github.com/a"):
            with self.assertRaises(ValueError):
                module.request(url,"synthetic")
        with self.assertRaises(ValueError):
            module.request("https://api.github.com/a")


if __name__ == "__main__":
    unittest.main()
