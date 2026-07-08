# Deployment

Agentic First may self-deploy only by publishing an immutable artifact
or image and invoking the existing app-specific deployment helper.

Self-deploy does **not** grant SSH, sudo, Docker socket, Caddy, DNS,
secret, permission, or cross-app access. If the app-specific helper is
not available, stop at the artifact plus deployment request and ask the
server-side operator to apply it.

Any new hostname, route, port, secret, Caddy, DNS, privileged container,
or cross-app change requires Tony/top-level approval before deployment.
Do not touch anything outside the existing Agentic First app surface.

The current Ani gate accepts only:

```bash
ssh -i ~/.ssh/agentic-first-deploy_ed25519 -o IdentitiesOnly=yes cursor@ani \
  'deploy <release-id> <sha256>'
```

This is a forced-command deploy key, not normal SSH. It can stage only a
published top-level static release for `agentic-first`.

## Files

- `deploy.yaml` - stable app deployment contract.
- `deploy-request.yaml` - one release request for Annie/Kody/Codex to validate and apply.
- `deploy/releases/*.tar.gz` - immutable release archives.
- `deploy/releases/*.sha256` - checksum files for release archives.

## Deployment Records

Use a handoff message when a server-side operator must review/apply the
release or when the change needs Tony/top-level approval. Return exactly
one message, with no commentary before or after it. The
message must begin:

```text
Annie, please review this Agentic First deployment request.
```

For approved self-deploys through the app-specific helper, record the
same fields in the deployment receipt instead of asking Annie to deploy:

- release id
- source repo and commit SHA
- artifact URL or image digest
- checksum/digest
- complete `deploy-request.yaml`
- smoke tests and results
- rollback target

Ani writes server-side deploy receipts under:

```text
/srv/deploy-state/agentic-first/receipts/<release-id>.yaml
```

Current live release:

```text
agentic-first-20260708T142448Z
66f4d98194b3b66358e032b205c332e36821dc7b0a29780acc571e9018830f14
```

## Required Handoff Message

When a handoff is needed, return exactly one message, with no commentary
before or after it. The message must begin:

```text
Annie, please review this Agentic First deployment request.
```

It must explicitly include:

```text
Do not give Agentic First SSH, sudo, Docker, Caddy, DNS, or secrets. Agentic First is only submitting a deployment request.
```

The message must include:

- short summary of what changed
- complete `deploy-request.yaml`
- artifact URI and exact digest/checksum
- source repo, branch/tag, and full commit SHA
- runtime/service/container affected
- required environment variable names only, no values
- required secret names only, no values
- health check and smoke tests
- whether Caddy/public routing needs to change
- rollback steps
- risk flags:
  - data migration
  - new secrets
  - Caddy change
  - privileged container
  - host mounts
  - downtime expected

Do not include secret values, `.env` contents, or instructions requiring
server admin access. Do not ask Annie to touch anything outside Agentic
First. Do not route `/companies/*` or `/directory/*` to this app; those
paths belong to `pitch-mcp`.

## Packaging Rules

Artifacts should be immutable and checksum-addressed. For this static
site, the release artifact is a `tar.gz` archive containing the app root
and excluding `.git/`, local OS files, generated release archives, and
`deploy-request.yaml`.

The release archive, checksum, and `deploy-request.yaml` are the source
of truth for the server-side deployment agent.

## Link Checks

Run `python3 deploy/check-homepage-links.py --root www` before packaging a
homepage change. The checker parses `www/index.html`, verifies local
static assets, and performs HTTP checks for public links such as
Tonywood.org URLs. Do not publish a release with known broken homepage
links.

## Artifact Delivery Precondition

Prefer publishing the release archive and checksum as GitHub release
assets, then naming those immutable download URLs in `deploy-request.yaml`.
The deploy operator should download those assets, verify the exact SHA256,
and stop without deploying if the download or verification fails.

Checksum files may contain the original local build path. Always verify the
downloaded tarball digest directly as well as confirming the checksum file
contains the expected SHA256.

If GitHub release assets are not used, `deploy-request.yaml` must separate
upload delivery from deployment verification. `upload-agentic-first` can
deliver files to the dropbox at
`/srv/deploy-inbox/agentic-first/incoming/`, but that directory is not the
operator-readable source of truth for deployment. Before deploying, an
Ani-side app-scoped intake step must place the exact release archive and
checksum in an operator-readable Agentic First verification path, currently
`/srv/deploy-inbox/agentic-first/`.

The packaging agent may produce local files under `deploy/releases/`,
but local files alone are not deployable. They must be uploaded by the
approved upload path or published as release assets before Annie can apply
the request. Do not change file permissions as part of this deployment
request.
