---
mode: 2
mode_name: script-embed
status: supported
recommended: false
data_format: json
discovery_path: home page <head> or <body>
content_type: application/agentic-profile+json
host_requirements:
  - allow_arbitrary_html_in_head_or_footer
soft_warning: false
---

# Mode 2 — `<script type="application/agentic-profile+json">` data island

> **The escape hatch for hosts that won't serve `/.well-known/`.** Embed the same JSON inside a typed `<script>` tag on your home page. Reading agents extract the body verbatim — no DOM parsing, no fragile regex.

## What it is

A `<script>` tag with a custom MIME type carrying the same JSON body that would otherwise live at `/.well-known/agentic-profile.json`:

```html
<script type="application/agentic-profile+json">
{
  "schema_version": "0.1.0",
  "updated_at": "2026-04-19T12:00:00Z",
  "profile_kind": "company",
  "tier": "public",
  "company": { "name": "Acme Robotics", "website": "https://acme-robotics.example", "jurisdiction": "GB" }
}
</script>
```

Browsers ignore the tag (the MIME type isn't `text/javascript`, so the body is treated as inert data). Reading agents that know the standard look for it explicitly. The pattern mirrors the well-established `<script type="application/ld+json">` Schema.org convention.

## When to use it

Use mode 2 when your host:

- lets you inject arbitrary HTML into the `<head>` of every page or into the home page footer, **but**
- won't let you serve a file at a dot-prefixed path (no `/.well-known/`), **and**
- you don't want to put a Cloudflare Worker in front of it.

Common in this bucket: WordPress (without SFTP), Squarespace, Wix, Webflow, Ghost, Shopify themes, Notion-via-Super.so/Potion/Fruition, Carrd Pro.

## The pattern

Paste two things into your site-wide `<head>`:

```html
<script type="application/agentic-profile+json">
{ ...your full profile JSON, exactly as it would be at /.well-known/agentic-profile.json... }
</script>
<link rel="agentic-profile"
      type="application/json"
      href="/.well-known/agentic-profile.json">
```

Notes:

- The `<link>` tag is part of mode 2 too. If your host happens to also serve a static file at the well-known path, the link tells the agent where to find it (cheaper than parsing HTML). If it doesn't, the link is harmless.
- Keep the JSON body minified or pretty — agents tolerate either.
- Do not double-encode the JSON. The body is the JSON itself, not a JSON string.

## Discovery surface

A reading agent will:

1. Try `/.well-known/agentic-profile.json` first. If `200`, use it and stop.
2. On `404`, fetch the home page and look for `<script type="application/agentic-profile+json">`.
3. Parse the script body as JSON.

## Validate

```bash
# 1. The script tag is present in the rendered home page
curl -sSL https://your-domain.example/ \
  | grep -A 30 'application/agentic-profile+json'
# Expect: the script tag plus its full JSON body

# 2. Extract the body and validate it
curl -sSL https://your-domain.example/ \
  | python3 -c 'import sys, re, json; html = sys.stdin.read(); m = re.search(r"<script[^>]+application/agentic-profile\+json[^>]*>(.*?)</script>", html, re.S); print(m.group(1).strip() if m else "NOT FOUND")' \
  | agentic-first-validate -
# Expect: PASS
```

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `<script>` tag stripped from the rendered HTML | Host's HTML serializer removes unknown script types | Use Mode 3 (hidden block) instead, or front with a Cloudflare Worker for Mode 1. |
| JSON body re-encoded (curly quotes, HTML entities) | WYSIWYG editor mangling | Paste into the host's "raw HTML" or "code injection" panel, never into a rich-text block. |
| Tag is on a sub-page but not the home page | Page-specific code injection | Move it to site-wide `<head>` injection — agents only probe the home page. |
| Multiple agentic-profile script tags on one page | Pasted twice during edits | Keep exactly one. Agents pick the first and may warn on duplicates. |

## Cross-references

- [Mode 1 (file)](./01-file-well-known.md) — preferred when available.
- [Mode 3 (hidden block)](./03-hidden-block.md) — fallback when even `<script>` tags get stripped.
- [WordPress recipe](../hosts/wordpress.md), [Squarespace recipe](../hosts/squarespace.md), [Wix recipe](../hosts/wix.md), [Webflow recipe](../hosts/webflow.md) — host-specific paste targets.
