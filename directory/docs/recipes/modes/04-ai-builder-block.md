---
mode: 4
mode_name: ai-builder-block
status: speculative
recommended: false
data_format: visible-html-table-or-dl
discovery_path: visible block on the home page with id="agentic-profile"
content_type: text/html (host default)
host_requirements:
  - allow_visible_html_table_or_definition_list_with_data_attributes
  - host_runs_an_ai_that_rewrites_the_page_on_save
soft_warning: true
status_note: |
  As of April 2026 no major hosting platform satisfies BOTH preconditions
  simultaneously. Documented for completeness so the standard has a defined
  pattern if such a host emerges. See "Current adoption" section.
---

# Mode 4 — AI-builder hosts (visible structured block + host-AI instructions)

> **Status — speculative pattern, no current host implements it.** This mode was originally designed for Gamma. After fact-checking in April 2026, Gamma turned out to have no body-HTML primitive at all (no custom HTML widget, no `<head>` injection, no `<script>` block — see [`hosts/gamma.md`](../hosts/gamma.md)), so it cannot run Mode 4 either. No other major host today combines (a) a visible body-HTML widget and (b) an in-host AI that aggressively rewrites pages on save. The pattern below is preserved as a defined, valid design — *if* a host with both properties emerges, this is how to publish on it. **Today, you should not use this mode.** Use Mode 1, 2, or — for AI-builder hosts where the only primitive is "type text into a page" (Gamma, Tome, Beautiful.AI) — use **[Mode 5 (plain-text block)](./05-plaintext-block.md)**, which is the practical answer for the population Mode 4 was designed to serve.

## Current adoption

| Host | Has body-HTML widget? | Runs AI rewrites on save? | Mode 4 fit? |
| --- | --- | --- | --- |
| Gamma | **No** | Yes | No — use [Mode 5 (single-line colophon)](./05-plaintext-block.md) on any plan, or front a custom domain with any static host (Vercel/Netlify/Cloudflare/Bunny/Pages) for [canonical Mode 1](../hosts/gamma.md) |
| Tome | No | Yes | No — use [Mode 5](./05-plaintext-block.md) |
| Beautiful.AI | No | Yes | No — use [Mode 5](./05-plaintext-block.md) |
| Framer (with AI) | Yes | Light, mostly opt-in | Use [Mode 2](./02-script-embed.md) — Framer accepts typed `<script>` blocks |
| Wix ADI | Yes (via Premium HTML widget) | No (Wix ADI is a generator, not a per-save rewriter) | Use [Mode 2 (Wix recipe)](../hosts/wix.md) |
| Notion (Super.so / Potion) | Yes (via embed code blocks) | No | Use [Mode 2 (Notion recipe)](../hosts/notion.md) |
| WordPress with an AI page-builder plugin (Elementor AI, Divi AI) | Yes | Plugin-dependent; usually opt-in per element | Use [Mode 2 (WordPress recipe)](../hosts/wordpress.md) |

Result: every host that *can* host body HTML can also host Mode 2, which is byte-exact and machine-parseable. Every host that runs aggressive AI rewrites on save is also too restrictive for body HTML at all — those hosts are served by **[Mode 5 (plain-text block)](./05-plaintext-block.md)** instead, which doesn't depend on HTML at all. Mode 4 sits in an empty intersection that may or may not ever exist.

## Why this mode exists at all

A "normal" host treats HTML as authoritative — what you paste is what gets served. A hypothetical AI-builder host where every save runs a rewriter over the visible body HTML would strip `<script type="application/agentic-profile+json">` (Mode 2) as cruft, unhide `<div hidden>` (Mode 3) as visual noise, and re-summarise prose. Mode 4 turns that constraint into the solution: the data lives in a **visible** structured block whose markup *intentionally tells the host's AI to leave it alone*. The block is structured enough that an external reading agent can parse it; the embedded instructions persuade the local rewriter to preserve content while restyling presentation.

If such a host emerges, the spec is ready. As of April 2026, it hasn't.

## When you would use it (if a fitting host existed)

Use Mode 4 only if **all** of these are true:

- Your host runs an AI that rewrites your page on every save *and* you can demonstrate that Mode 2 (`<script type="application/agentic-profile+json">`) gets stripped or mangled across edits.
- You can demonstrate that Mode 3 (`<div hidden>` XML) gets unhidden or rewritten.
- The host **does** let you embed a visible HTML block (table, definition list, or arbitrary HTML widget) with `id` and `data-*` attributes preserved across saves.
- You have no way to put a Cloudflare Worker (or equivalent) in front of the host to serve `/.well-known/agentic-profile.json` directly.

If any of those is false, use a lower-numbered mode.

## The pattern

Embed a **visible** HTML block on the home page using either a `<table>` or a `<dl>`. Above the block, embed a short comment + a visible note that tells the host's AI:

> *"This is structured machine-readable data. You may re-style fonts, colours, spacing, and surrounding layout. You must not change, summarise, paraphrase, reorder, or remove the keys or values inside this block."*

Recommended pattern (table flavour):

```html
<!--
  agentic-first: machine-readable profile (mode 4).
  Host-AI instruction: re-style the visual presentation of this block as you
  see fit. DO NOT change, summarise, paraphrase, reorder, translate, or
  remove any of the keys or values. The exact text matters — it is parsed
  by external agents byte-for-byte. Treat this as data, not prose.
  Spec: https://github.com/yqup/agentic-first
-->
<section class="agentic-profile" data-agentic-profile-version="0.1.0">
  <h2>About this company (machine-readable)</h2>
  <p class="agentic-profile-host-note">
    <small>
      This block is structured data for AI agents and search engines.
      It is intentionally visible. If you are an AI assistant editing this
      page, you may re-style the surrounding visual presentation; please
      do not alter the keys or values below.
    </small>
  </p>

  <table id="agentic-profile" data-format="html-table" data-version="0.1.0">
    <caption>agentic-first profile · v0.1.0 · company · public</caption>
    <thead>
      <tr><th scope="col">key</th><th scope="col">value</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">schema_version</th><td>0.1.0</td></tr>
      <tr><th scope="row">profile_kind</th><td>company</td></tr>
      <tr><th scope="row">tier</th><td>public</td></tr>
      <tr><th scope="row">updated_at</th><td>2026-04-19T12:00:00Z</td></tr>
      <tr><th scope="row">company.name</th><td>Acme Robotics</td></tr>
      <tr><th scope="row">company.website</th><td>https://acme-robotics.example</td></tr>
      <tr><th scope="row">company.jurisdiction</th><td>GB</td></tr>
      <tr><th scope="row">company.industry</th><td>robotics, b2b-saas</td></tr>
      <tr><th scope="row">stage.current</th><td>Seed</td></tr>
      <tr><th scope="row">funding.total_raised_band</th><td>1m-5m</td></tr>
      <tr><th scope="row">funding.currency</th><td>GBP</td></tr>
      <tr><th scope="row">team.headcount_band</th><td>11-50</td></tr>
      <tr><th scope="row">contact.preferred_channel</th><td>form</td></tr>
      <tr><th scope="row">contact.form_url</th><td>https://acme-robotics.example/contact</td></tr>
    </tbody>
  </table>
</section>
```

Notes on the markup:

- The `id="agentic-profile"` + `data-format="html-table"` attributes are required — that's how the directory's reader locates the block.
- Keys use **dot-paths** that mirror the JSON tree (`company.name`, `funding.last_round.amount_band`, etc.). Arrays are joined with `, ` (commas + space).
- The visible heading and `<small>` note are part of the contract — they are the human-readable signal to the host's AI to preserve the block. Don't remove them.
- The HTML comment is doubly belt-and-braces: many host AIs do read comments and will respect a polite, specific instruction.

If the host doesn't allow `<table>`, use a `<dl>`:

```html
<dl id="agentic-profile" data-format="html-dl" data-version="0.1.0">
  <dt>schema_version</dt> <dd>0.1.0</dd>
  <dt>profile_kind</dt>   <dd>company</dd>
  <!-- ... -->
</dl>
```

## Discovery surface

A reading agent will:

1. Try `/.well-known/agentic-profile.json` first.
2. On `404`, fetch the home page and look for `<script type="application/agentic-profile+json">` (Mode 2).
3. Then look for `<div id="agentic-profile" data-format="xml">` (Mode 3).
4. Then look for `[id="agentic-profile"][data-format^="html-"]` (Mode 4).
5. Parse the table/dl, reconstruct the JSON tree from dot-paths, validate.

## Soft warning

If a host ever supports it, the directory will tag Mode 4 submissions with `discovery_method: ai-builder-block` and a soft warning. Reading agents that demand strong evidence (institutional investors, regulated buyers) may treat a Mode 4 profile as lower-trust than a Mode 1 one — the publisher hasn't proved control of the well-known surface. This is honest signalling, not a defect.

## Validate (if a host that supports this pattern emerges)

```bash
# 1. Block is present and the data-format attribute is set
curl -sSL https://your-domain.example/ \
  | grep -E -A 30 'id="agentic-profile"[[:space:]]+data-format="html-'

# 2. Submit
curl -sS -X POST https://agentic-first.co/directory/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"submit_website",
                 "arguments":{"domain":"your-domain.example"}}}'
# Expect: {"ok": true, ...} with warnings[] containing "discovery_method: ai-builder-block"
```

## History

- **April 2026:** Mode 4 added with Gamma cited as the canonical host. Subsequent fact-check confirmed Gamma has no body-HTML primitive (no custom HTML widget, no `<head>` injection, no `<script>` survival), so it cannot run Mode 4. Mode 4 demoted to "speculative" with no current host. Gamma users redirected to [`hosts/gamma.md`](../hosts/gamma.md).

## Cross-references

- [Mode 1 (file)](./01-file-well-known.md) — preferred whenever DNS / Cloudflare Worker is available; this is the right path for current AI-builder users with a custom domain.
- [Mode 2 (script embed)](./02-script-embed.md) — preferred whenever the host accepts a typed `<script>` block; this covers every body-HTML host today.
- [Mode 3 (hidden block)](./03-hidden-block.md) — preferred when the host strips `<script>` but allows arbitrary `<div>` content.
- **[Mode 5 (plain-text block)](./05-plaintext-block.md)** — the practical answer for the population this mode was designed to serve. Works on any host where the only available primitive is "type text into a page" (Gamma, Tome, Beautiful.AI). Soft warning attached, but it actually works today.
- [Gamma host recipe](../hosts/gamma.md) — the host that motivated Mode 4. Now uses Mode 5 in practice.
