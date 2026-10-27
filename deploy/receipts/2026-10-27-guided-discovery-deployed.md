# Guided Discovery: Deployed

Tony authorised the paired public-only deployment. The Directory was promoted
first through its JENZ-to-ANI image gates, followed by this static homepage using
the existing forced-command gate. No routing, service or access-policy changes
were required. Research and login remain unpublished.

- Repository: `https://github.com/yqup/agentic-first`, `main`.
- Source: `9fb3016924679c92a1bc3e50396974ab5937013f`.
- Release: `agentic-first-20261027T123906Z`.
- Archive SHA256: `66678a29bdf1dd58986c67c5b54c2965bc7d8cd71c34a74f70c33a0233c63c1e`.
- Release: https://github.com/yqup/agentic-first/releases/tag/agentic-first-20261027T123906Z

The public-only builder included the static web root, stable deployment
manifest, two check scripts, licence and public-boundary marker. Git history,
private notes and the old copied catalogue were not included. The stable
manifest is `deploy/deploy.yaml`; the complete current request is
`deploy-request.yaml` at repository root.

Build on AKAAR:

```sh
python3 deploy/build-public-release.py \
  --release agentic-first-20261027T123906Z \
  --output /private/tmp/agentic-first-guided-deploy-20261027T123906Z/agentic-first-20261027T123906Z.tar.gz
```

JENZ rootless run `agentic-first-static-1254a26d1b064456a830e7f8ceab5c8d`
passed at `2026-10-27T12:41:01Z`. Baseline, candidate, restart, synthetic 404,
sanitised rollback and re-promotion passed. All 27 packaged candidate web files
were hash-checked; the data sentinel was preserved and fixture stopped. The
reviewed qualifier SHA256 was
`ebfd7ece3a48b49340222e2e58d5f77d7eba27f05de25335aff33c8303fed6dd`;
a small wrapper pinned only the two package identities without changing the
canonical qualifier or admin repositories.

Sanitised fallback: `agentic-first-20261026T152108Z`, SHA256
`9359df943d785795e16b9392e69fedc07d98792c490e03fdafd882e43c25dd68`.
Never restore a historical research-exposing catalogue. This gate does not
automatically restore a previous release after failure; inspect the receipt and
use only this approved fallback if rollback is needed.

ANI promotion:

```sh
ssh -o BatchMode=yes agentic-first-deploy-ani deploy agentic-first-20261027T123906Z 66678a29bdf1dd58986c67c5b54c2965bc7d8cd71c34a74f70c33a0233c63c1e
```

Terminal receipt passed at `2026-10-27T12:44:27Z`, with checksum, file smoke,
public smoke and all 43 homepage links passing. Current points to
`/srv/apps/agentic-first/releases/agentic-first-20261027T123906Z`.
Server receipt:
`/srv/deploy-state/agentic-first/receipts/agentic-first-20261027T123906Z.yaml`.
It records no services restarted and no Caddy, DNS, secrets or Directory changes
by this static gate. The Directory image was promoted separately.

Independent full-site HTTPS verification passed at `2026-10-27T12:46:19Z`.
All 26 served homepage hashes matched; the packaged README correctly returned
404. The empty v2 catalogue pointer remains empty. All Directory public hashes
matched with 145 listings, research denied and accounts disabled. Public
discovery checks passed locally and live. Fifteen homepage tests and
`git diff --check` passed.

Live browser checks passed at 1365x900 and 390x844: meaningful first screen,
homepage task entry, guided alternative query, pagination, public details,
strict-residency refusal and cleared-filter persistence. No console warnings,
errors, broken homepage images, framework overlay or horizontal overflow.
Screenshots and terminal/independent receipts are retained at
`/private/tmp/agentic-first-guided-deploy-20261027T123906Z/`. No synthetic Matomo
events or QA shortlist entries were created. One browser engine was tested;
social posting, email and vendor transactions were not exercised.

The homepage now links to replace/task/area discovery, eight canonical software
categories, alternatives, Robotics and Components & chips. Counts state 145
software tools and standards, not 145 European or EU-only tools. There are no
approved hardware suppliers yet. Company information remains in the secondary
menu. Search is CPU-only; no agents, login or private research were added.

Paired Directory source: `1eec88accb0908e10502303db4459250c2adab5a`, release
`pitch-mcp-20261027T123906Z`; exact image
`sha256:95b2c25895b99f1a7def65f9ab8c053b704279e08df656d612f4893a4080503f`.
Its private repository contains the separate deployment receipt, including the
540 Python and 44 Node release checks and unrelated broad-check limitations.
Both repositories had no open pull requests at release. Closeout documentation
commits are not new deployed source.
