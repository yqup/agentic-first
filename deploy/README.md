# Deployment Handoff

Agentic First does **not** deploy directly to Ani from this repo.

When a change needs deploying, produce a deployable artifact plus a
single copy-paste message for Tony to send to Annie. Do not SSH into
Ani, request server privileges, edit Caddy, change DNS, inspect secrets,
or touch anything outside Agentic First.

## Files

- `deploy.yaml` - stable app deployment contract.
- `deploy-request.yaml` - one release request for Annie/Kody/Codex to validate and apply.
- `deploy/releases/*.tar.gz` - immutable release archives.
- `deploy/releases/*.sha256` - checksum files for release archives.

## Required Handoff Message

Return exactly one message, with no commentary before or after it. The
message must begin:

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
First. Do not route `/directory/*` to this app; that path belongs to the
Directory product.

## Packaging Rules

Artifacts should be immutable and checksum-addressed. For this static
site, the release artifact is a `tar.gz` archive containing the app root
and excluding `.git/`, local OS files, generated release archives, and
`deploy-request.yaml`.

The release archive, checksum, and `deploy-request.yaml` are the source
of truth for the server-side deployment agent.

## Artifact Delivery Precondition

Prefer publishing the release archive and checksum as GitHub release
assets, then naming those immutable download URLs in `deploy-request.yaml`.
The deploy operator should download those assets, verify the exact SHA256,
and stop without deploying if the download or verification fails.

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
