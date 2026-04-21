---
mode: 1
mode_name: file-well-known
status: canonical
recommended: true
data_format: json
discovery_path: /.well-known/agentic-profile.json
content_type: application/json
host_requirements:
  - serve_arbitrary_file_at_dot_path
soft_warning: false
---

# Mode 1 — File at `/.well-known/agentic-profile.json`

> **The canonical mode.** Use this whenever your host lets you serve a file at a path beginning with a dot. Maximum compatibility with every reading agent that knows the standard.

## What it is

A single JSON file, served from the publisher's own domain, at exactly:

```
https://your-domain.example/.well-known/agentic-profile.json
```

with `Content-Type: application/json`. The directory and every conformant reading agent fetch this URL first. No HTML parsing, no regex extraction, no LLM in the loop on the read path.

## When to use it

Use mode 1 if **any** of the following is true:

- You can drop arbitrary files into your site's document root or build output.
- Your static-site framework has a `public/`, `static/`, or equivalent passthrough directory.
- You have SFTP, S3 console, or git-based deploy access to the host.
- You can put a Cloudflare Worker (or equivalent edge function) in front of the host.

If none of those is true, fall through to [Mode 2 (script embed)](./02-script-embed.md).

## The pattern

1. Compose your `agentic-profile.json` (use the [generic publisher skill](../../../skills/agentic-first.agent-prompt.md) or [`SPEC.md`](../../../SPEC.md)).
2. Place it in your site's deploy tree at the path that maps to `/.well-known/agentic-profile.json` after build/deploy. The exact local path is host-specific — see the [host recipes](../hosts/) for the exact target.
3. Confirm the served `Content-Type` is `application/json`. Most static hosts infer this from the `.json` extension; some need an explicit header rule.
4. Add a discovery `<link>` tag to your home page `<head>` so reading agents that start at `/` find the file without guessing:

   ```html
   <link rel="agentic-profile"
         type="application/json"
         href="/.well-known/agentic-profile.json">
   ```

   The link is optional but recommended — it lets a reading agent skip the well-known probe.

## Discovery surface

A reading agent that knows the standard will:

1. `GET https://{domain}/.well-known/agentic-profile.json` — primary.
2. If `404`, fetch `https://{domain}/` and look for `<link rel="agentic-profile">` — gives an alternate URL on the same origin.
3. If neither, fall through to inline-embed and hidden-block detection (modes 2 + 3).

## Validate

```bash
# 1. URL is reachable and serves JSON
curl -I https://your-domain.example/.well-known/agentic-profile.json
# Expect: 200 OK + content-type: application/json

# 2. Body parses as JSON
curl -sS https://your-domain.example/.well-known/agentic-profile.json | jq .
# Expect: pretty-printed JSON, no errors

# 3. Body conforms to the schema
pip install agentic-first-schema
curl -sS https://your-domain.example/.well-known/agentic-profile.json \
  | agentic-first-validate -
# Expect: PASS
```

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `404` on the well-known path | Host blocks dotfiles, or framework strips them from build output | Use the per-host recipe for an explicit passthrough; or drop to [Mode 2](./02-script-embed.md); or front the site with a Cloudflare Worker. |
| `200` but `Content-Type: text/html` | Host rewrites JSON requests to your SPA's index.html | Add an explicit content-type header rule for the well-known path (recipe per host); or use a Worker. |
| `403` | Host treats `.well-known/` as forbidden | Same as 404 — use a Worker, or move to Mode 2. |

## Cross-references

- [Hosts that support Mode 1 directly](../hosts/) — see any file marked `modes_supported: [1, ...]`.
- [Mode 2 (script embed)](./02-script-embed.md) if your host can't serve dotfiles.
- [`SPEC.md`](../../../SPEC.md) for the full schema and field reference.
