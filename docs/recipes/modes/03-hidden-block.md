---
mode: 3
mode_name: hidden-block
status: fallback
recommended: false
data_format: xml
discovery_path: anywhere on the home page DOM
content_type: text/html (host default)
host_requirements:
  - allow_arbitrary_div_or_text_block
soft_warning: true
---

# Mode 3 — Hidden `<div>` block, XML mirror

> **Last resort.** Use only when the host strips `<script>` tags but still lets you inject *any* raw HTML. The directory accepts it but emits a soft warning encouraging an upgrade to Mode 1 or 2.

## What it is

A `<div hidden>` containing an XML mirror of the same profile. The block is invisible to humans (the `hidden` attribute) and findable by reading agents via the stable `id="agentic-profile"` and `data-format="xml"` attributes:

```html
<div hidden id="agentic-profile" data-format="xml">
  <agentic-profile version="0.1.0" kind="company" tier="public">
    <company>
      <name>Acme Robotics</name>
      <website>https://acme-robotics.example</website>
      <jurisdiction>GB</jurisdiction>
    </company>
    <updated_at>2026-04-19T12:00:00Z</updated_at>
  </agentic-profile>
</div>
```

XML rather than JSON because most constrained hosts (Carrd, Linktree, some Notion wrappers, Google Sites embed widgets) re-encode special characters inside JSON braces, but tolerate XML element trees verbatim.

## When to use it

Only when **all** of the following are true:

- Mode 1 is impossible (no `/.well-known/`, no Cloudflare Worker available).
- Mode 2 is impossible (host strips `<script>` tags or rewrites unknown MIME types).
- You can still inject *some* arbitrary HTML — typically a "code block" or "embed" widget that accepts a `<div>`.

If even mode 3 isn't possible, your only option is to publish on a separate static-host subdomain (e.g. `profile.your-domain.example` CNAMEd to GitHub Pages or Cloudflare Pages) and submit *that* domain to the directory. See [host recipes for constrained hosts](../hosts/) for examples.

## The pattern

Paste exactly one block, at any place on the home page that's served as raw HTML:

```html
<div hidden id="agentic-profile" data-format="xml">
  <agentic-profile version="0.1.0" kind="company" tier="public">
    <company>
      <name>Your Company</name>
      <website>https://yourdomain.example</website>
      <jurisdiction>GB</jurisdiction>
    </company>
    <updated_at>2026-04-19T12:00:00Z</updated_at>
  </agentic-profile>
</div>
```

The `id="agentic-profile"` and `data-format="xml"` attributes are required — that's how reading agents locate the block.

## Field mapping

The XML element tree mirrors the JSON tree key-for-key. Every `agentic-first` schema field has a 1:1 XML element. Banded enums become text content of the corresponding element. Arrays become repeated elements. The directory's parser handles both with the same code path.

For complex profiles (industry tags, evidence arrays, key people), prefer Mode 2 if at all possible — XML quickly becomes verbose and error-prone for nested structures.

## Soft warning

The directory accepts mode-3 submissions but tags the resulting record with `discovery_method: hidden-block-xml` and a soft warning visible in `get_company`. Reading agents may downrank profiles that only publish via mode 3. Move to mode 1 or 2 as soon as your host situation allows.

## Validate

```bash
# 1. Block is present and the data-format attribute is set
curl -sSL https://your-domain.example/ \
  | grep -A 20 'id="agentic-profile"'
# Expect: the div, the inner XML, your company name

# 2. Submit and inspect the soft warning
curl -sS -X POST https://directory.agentic-first.co/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"submit_website",
                 "arguments":{"domain":"your-domain.example"}}}'
# Expect: {"ok": true, ...} with warnings[] containing "discovery_method: hidden-block-xml"
```

## Cross-references

- [Mode 1 (file)](./01-file-well-known.md) — strictly preferred.
- [Mode 2 (script embed)](./02-script-embed.md) — preferred over mode 3 when a `<script>` tag survives.
- [Mode 4 (AI-builder block)](./04-ai-builder-block.md) — for hosts where the page is rewritten by an in-host AI (Gamma, etc.) and you need to give *that* AI instructions to leave the data alone.
