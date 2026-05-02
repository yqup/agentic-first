# Agentic First Restructure Notes

Date: 2026-05-02

This note records the restructure from a directory-only repository into an Agentic First umbrella repository with Directory as the first product area.

## 2026-05-02 Follow-up: Repo Split

The Directory internals have now moved to the sibling `pitch-mcp` repo.
This repo owns the top-level Agentic First site (`/`) and route map only.
`pitch-mcp` owns `/directory/*`, including the Directory MCP service,
schemas, validator package, examples, skills, adoption docs, and static
Directory pages.

## What Changed

- The root of the repo now represents the broader Agentic First concept.
- The existing profile standard, examples, schemas, docs, skills, and Python validator moved under `directory/`.
- Root `README.md` now explains the umbrella idea and points humans into `directory/`.
- Root `llms.txt` now gives agents the umbrella route map and the directory entry points.
- `ROUTING.md` records the intended public route shape and migration guardrails.
- GitHub Actions were updated to use the moved paths under `directory/`.
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

## Annie Deploy Findings

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

Observed DNS/HTTP state at the time of the check:

- `https://www.agentic-first.co/` returned 200.
- `https://directory.agentic-first.co/healthz` returned 200.
- `agentic-first.co` apex did not resolve.
- `agent-first.co` pointed at Annie but TLS was not configured correctly.
- `www.agent-first.co` did not resolve.

Re-check DNS and HTTP before acting on these observations, because deployment may have happened separately through Cursor after this note was written.

## Production Safety Notes

- Codex did not change production during the initial restructure/test pass.
- DNS, Caddy route changes, and MCP proxy changes are production operations and should be made deliberately.
- Back up Caddy fragments before editing Annie.
- Validate Caddy before reload.
- Smoke-test both new and legacy routes after reload.
- Keep access logs under review before retiring legacy routes.

## Suggested Next Steps

1. Confirm the current deployed state from Annie and public DNS.
2. If Cursor has already deployed the static site, compare it against this repo before making further edits.
3. Add `/directory/*` routes in Caddy while preserving `directory.agentic-first.co/*`.
4. Fix DNS/TLS for `agentic-first.co`, `agent-first.co`, and `www.agent-first.co` if those domains remain part of the canonical plan.
5. Add real pytest coverage for the Python validator package.
