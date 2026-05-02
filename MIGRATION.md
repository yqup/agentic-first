# Agentic First Restructure Notes

Date: 2026-05-02

This note records the restructure from a directory-only repository into an Agentic First umbrella repository with Directory as the first product area.

## 2026-05-02 Follow-up: Repo Split

The Directory internals have now moved to the sibling `pitch-mcp` repo.
This repo owns the top-level Agentic First site (`/`) and route map only.
`pitch-mcp` owns `/directory/*`, including the Directory MCP service,
schemas, validator package, examples, skills, adoption docs, and static
Directory pages.

## 2026-05-02 Production State

The migration is live on Ani:

- Current top-level static release: `agentic-first-20260502T113843Z`.
- Artifact SHA256:
  `389be824744cc0dee0d0cf32ebf07396a3546a88f6e6b14c3c697532e292055c`.
- `https://agentic-first.co/` serves the top-level Agentic First page from
  this repo's `www/` tree.
- `https://agentic-first.co/directory/` serves the Directory product from
  `pitch-mcp`.
- `https://agentic-first.co/directory/mcp` is the Directory MCP endpoint.
- `https://directory.agentic-first.co/` remains separate.
- `agent-first.co`, `www.agent-first.co`, and `www.agentic-first.co` redirect
  to the canonical `agentic-first.co` host.

Top-level static releases can now be deployed through the app-specific Ani
forced-command gate. The gate accepts only `deploy <release-id> <sha256>` and
updates only `/srv/apps/agentic-first/current`. It does not grant normal SSH,
sudo, Docker, Caddy, DNS, secrets, ports, containers, or cross-app access.

Homepage releases must pass `deploy/check-homepage-links.py` before packaging.
This was added after a broken `https://www.tonywood.org/research/` link was
found and replaced with `https://www.tonywood.org/writing/`.

## Original Repo Restructure

- The root of the repo now represents the broader Agentic First concept.
- The existing profile standard, examples, schemas, docs, skills, and Python
  validator were first moved under `directory/`, then into the sibling
  `pitch-mcp` repo.
- Root `README.md` now explains the umbrella idea and points humans into
  `/directory/`.
- Root `llms.txt` gives agents the umbrella route map and Directory entry
  points.
- `ROUTING.md` records the intended public route shape and migration guardrails.
- Directory docs and skills were updated to prefer `https://agentic-first.co/directory/...`.
- Legacy compatibility is explicitly preserved for `https://directory.agentic-first.co/...`.

## Intended Public Shape

Canonical umbrella routes:

- `https://agentic-first.co/`
- `https://agentic-first.co/directory/`
- `https://agentic-first.co/directory/mcp`
- `https://agentic-first.co/directory/healthz`
- `https://agentic-first.co/directory/schemas/*`
- `https://agentic-first.co/directory/feedback`

Legacy routes to keep during migration:

- `https://directory.agentic-first.co/mcp`
- `https://directory.agentic-first.co/healthz`
- `https://directory.agentic-first.co/schemas/*`
- `https://directory.agentic-first.co/feedback`

For MCP clients, proxy legacy routes first. Do not switch `/mcp` to a redirect until client redirect behavior has been checked.

## Validation Run

The restructure was tested locally with:

- `git diff --check`
- JSON parse for every `directory/schemas/*/*.json`
- JSON parse for every `directory/examples/*.json`
- `agentic-first-validate` against every example profile
- fresh virtualenv install of `directory/python/agentic_first_schema`
- CLI validation from the installed package
- Python package build
- `twine check`

Known test gap:

- `pytest` still collects zero tests in `directory/python/agentic_first_schema`, which was already true before this restructure.

Known package warning:

- Setuptools emits a license metadata deprecation warning during build. It does not fail the build, but should be cleaned up before the February 2027 deadline mentioned by setuptools.

## Early Annie Deploy Findings

During the deployment check, the local SSH alias `ani` was confirmed to connect to the live VPS.

Observed live paths on Annie:

- Static site source: `/home/cursor/pitch-mcp/www`
- Caddy source: `/home/cursor/pitch-mcp/infra/caddy/sites/`
- Caddy working copy: `/home/cursor/caddy`
- Directory app repo/source tree: `/home/cursor/pitch-mcp`

Observed deploy scripts on Annie:

- `/home/cursor/pitch-mcp/infra/deploy-app.sh`
- `/home/cursor/pitch-mcp/infra/deploy-caddy.sh`
- `/home/cursor/pitch-mcp/infra/deploy-ani.sh`

Observed running services:

- `pitch-mcp` bound locally on `127.0.0.1:4101`
- Caddy serving the public HTTPS routes

Observed DNS/HTTP state at the time of the early check:

- `https://www.agentic-first.co/` returned 200.
- `https://directory.agentic-first.co/healthz` returned 200.
- `agentic-first.co` apex did not resolve.
- `agent-first.co` pointed at Annie but TLS was not configured correctly.
- `www.agent-first.co` did not resolve.

These observations are historical. The current production state is recorded
above.

## Production Safety Notes

- Codex did not change production during the initial restructure/test pass.
- DNS, Caddy route changes, and MCP proxy changes are production operations and should be made deliberately.
- Back up Caddy fragments before editing Annie.
- Validate Caddy before reload.
- Smoke-test both new and legacy routes after reload.
- Keep access logs under review before retiring legacy routes.
- The top-level Agentic First deploy gate is allowed only for existing static
  site releases. Route, Directory, Caddy, DNS, secret, port, container, and
  cross-app changes still require Tony/top-level approval.

## Remaining Next Steps

1. Commit the source and documentation changes once Tony is happy.
2. Keep link checks in the packaging path for homepage edits.
3. Add product-specific tests in `pitch-mcp` when Directory behaviour changes.
