# Public-Only Homepage: Deployed

26 October 2026. Tony approved deploying the search-first homepage after the
paired public-only Directory. No login or research publication was launched.

## Release Identity

- Repository: `https://github.com/yqup/agentic-first`, branch `main`.
- Source: `70a3b197ebd8dd861ceb8893505e8734bb70fe71`.
- Release: `agentic-first-20261026T113329Z`.
- Archive SHA256: `933db5acfb3fd8ee2ef1efd2e3f6f15b098c5554ef701355435cd73e0cbd2b1e`.
- [Published archive](https://github.com/yqup/agentic-first/releases/download/agentic-first-20261026T113329Z/agentic-first-20261026T113329Z.tar.gz).
- [Checksum](https://github.com/yqup/agentic-first/releases/download/agentic-first-20261026T113329Z/agentic-first-20261026T113329Z.sha256).

The exact candidate archive prepared before the gate hold was used unchanged.
Later documentation commits do not identify different deployed website bytes.

## Qualification And Deployment

The paired public-only Directory was promoted first, then independently checked
over HTTPS. Its public assets supply this homepage's stylesheet, search module
and countryside image. Search runs on public JSON using the visitor's CPU;
there is no agent, model call or per-search inference charge.

A separately identified public-only homepage fallback was prepared in an
isolated worktree: `agentic-first-20261026T152108Z`, source
`aefffdf262ed6b38c6b1ec404d47ef7cf843a319`, archive SHA256
`9359df943d785795e16b9392e69fedc07d98792c490e03fdafd882e43c25dd68`.
Only its stale manifest was corrected; the approved main website was not edited.

JENZ static fixture run `agentic-first-static-01670ed8098446fabd4e3066f6c42678`
passed at `2026-10-26T15:23:47Z`: baseline, candidate, restart, expected 404
failure, rollback and repromotion, with 22 file hashes and sentinel preservation.
This was an unprivileged loopback HTTP fixture, not a production Caddy test.

The existing forced-command gate installed the safe fallback first, then ran:

```sh
ssh agentic-first-deploy-ani deploy agentic-first-20261026T113329Z \
  933db5acfb3fd8ee2ef1efd2e3f6f15b098c5554ef701355435cd73e0cbd2b1e
```

ANI terminal receipt passed at `2026-10-26T15:47:00Z`:
`/srv/deploy-state/agentic-first/receipts/agentic-first-20261026T113329Z.yaml`.
Current target is `releases/agentic-first-20261026T113329Z` and the receipt's
`previous_release` is the safe `agentic-first-20261026T152108Z` fallback.
File smoke and all 27 homepage links passed. No service restart, Caddy, DNS,
secrets or Directory mutation was performed by the static deployment.

## Independent Verification

- Live homepage metadata/social-image and 27-link checks passed.
- Full-site HTTPS boundary check passed at `15:50:52Z`: 21 published homepage
  files match exact local hashes; packaged `/README.md` remains blocked (404).
- All 135 public Directory listings remain discoverable, research tools deny
  publication, account routes return 404 without cookies, and the old copied
  homepage catalogue is an empty v2 pointer.
- Live desktop 1280x720 and phone-size 390x844 checks cover homepage categories,
  Data & databases -> Baserow/SeaTable results, concise Baserow detail and More.
  No relevant console warnings/errors, blank page, overlay or mobile overflow.
- Six homepage/artifact tests and six CPU-search tests passed. The paired app
  suite passed 378 tests; deployment/operator checks passed 86 tests, with the
  existing Starlette/httpx deprecation warning only.

Open Company Information remains accessible through More, not a homepage
section. Login remains deferred and detailed research stays unpublished.
Historic releases, forks, caches, licences and downloaded copies were not
removed or retrospectively protected. Do not use those releases for rollback.
