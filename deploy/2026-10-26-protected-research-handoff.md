# Search-First Homepage And Private Artifact Prerequisite

Status: implementation and local verification only. Do not deploy before the
paired directory v2 release and its protected-research runbook are ready.

The homepage now leads to guided European-alternative searches. Open Company
Information is secondary. The copied catalogue is retired; its old URL returns
a v2 pointer with an empty entries list. The highlights script contains no data.
GitHub documentation links were replaced with public site explanations. Public
tracking was not added to the research journey. The countryside image is reused
from Tony's own site by the directory assets, not an external runtime dependency.

The matching application and full runbook are in the sibling private repository:
`pitch-mcp/directory/PROTECTED-RESEARCH.md`. Deploy the paired versions together;
the root page depends on `/directory/assets/discovery.css` and its local image.

## Verification

- Homepage metadata/discovery checker passes locally.
- Both public roots pass the private-research boundary scan.
- Desktop 1440x1000 and mobile 390x844 prototype checks cover search, registration,
  pending approval, owner approval with MFA, report reading, comparisons, quota
  exhaustion, allowance requests/overrides and session revocation.
- `deploy/test_private_release.py` verifies digest checks and that GitHub
  credentials are not forwarded to signed asset-download URLs.

## Artifact Intake Is Not Installed

`fetch-private-release.py` is a scoped operator helper candidate. It retrieves
one exact release asset from this repository using an operator-owned 0600
credential file, validates an independently supplied SHA256 and creates a new
private output file. It neither extracts nor deploys. Tests use synthetic data;
an authenticated production download has not been exercised.

The current server helper still downloads public GitHub release URLs with curl.
Integrate and rehearse private intake before changing repository visibility.
No existing host gate, credentials, Caddy, DNS or runtime was changed here.

## Public-Only Packaging

On AKAAR, build only the web root, deployment manifest/checkers and licence:

```sh
python3 deploy/build-public-release.py --release agentic-first-YYYYMMDDTHHMMSSZ \
  --output /private/tmp/agentic-first-YYYYMMDDTHHMMSSZ.tar.gz
```

The builder excludes Git history, source notes, old `deploy/releases` archives
and deployment requests. It rejects a non-retired copied catalogue. Pair this
with the v2 directory rollback; an older directory release would republish
research even if the homepage is sanitized.

Historical MIT/Apache notices remain in force as applicable. This implementation
does not claim to revoke earlier licences or retrieve public copies. A read-only
GitHub check still reports this repository PUBLIC and lists 20 releases. Remote
release archives, forks and third-party caches require operator follow-through.

Do not mark this as deployed or change visibility until authenticated artifact
delivery and the JENZ rehearsal have current receipts.
