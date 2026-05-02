# Routing Migration

This repo owns Agentic First as the umbrella site. The Directory is a
sub-path product owned by the sibling `pitch-mcp` repo.

See [`MIGRATION.md`](./MIGRATION.md) for what changed in the repo, what was tested, and what was observed on Annie during deployment discovery.

## Canonical Routes

- `https://agentic-first.co/` - umbrella site
- `https://agentic-first.co/directory/` - directory product and standard
- `https://agentic-first.co/directory/mcp` - directory MCP endpoint
- `https://agentic-first.co/directory/healthz` - directory health endpoint
- `https://agentic-first.co/directory/schemas/*` - directory schemas
- `https://agentic-first.co/directory/feedback` - directory feedback endpoint

## Domain Handling

- `agentic-first.co` is canonical.
- `agent-first.co` should redirect to the same path on `agentic-first.co`.
- `www.agentic-first.co` should redirect to `agentic-first.co` unless the hosting layer requires `www` as canonical.
- `www.agent-first.co` should redirect to `agentic-first.co`.

## Legacy Directory Compatibility

Keep these legacy paths available during migration:

- `https://directory.agentic-first.co/mcp`
- `https://directory.agentic-first.co/healthz`
- `https://directory.agentic-first.co/schemas/*`
- `https://directory.agentic-first.co/feedback`

Recommended first step: proxy legacy requests to the new `/directory/*` routes, preserving method, headers, and body.

Recommended second step: after access logs show legacy usage is quiet, redirect safe GET routes. Keep `/mcp` proxied longer unless MCP client redirect compatibility has been tested.

## Deployment Guardrails

- Confirm the routing layer before changing production: Caddy, Cloudflare, Vercel, or another host.
- Serve `/` from this repo's `www/` tree.
- Serve `/directory/*` from `pitch-mcp`.
- Do not remove old routes without checking logs.
- Do not redirect POST endpoints until clients are known to preserve method and body correctly.
- Do not change DNS or production routing from this repo alone.
