---
host: gamma
host_url: https://gamma.app
host_kind: ai-builder
modes_supported: [4]
modes_recommended: 4
status: stable
last_verified: 2026-04-21
gotchas:
  - no_well_known_path
  - no_head_injection
  - ai_rewrites_on_save
  - iframed_subdomain_content
---

# Host recipe — Gamma (`gamma.app`)

> **Use Mode 4.** Gamma is an AI-builder host: every save runs Gamma's model over your page. There is no `/.well-known/`, no `<head>` injection panel, and even hidden `<div>`s tend to get rewritten or removed. The visible-table pattern in [Mode 4](../modes/04-ai-builder-block.md) is what survives.

## Why this is awkward

Gamma serves your site from `*.gamma.site` (or your custom domain CNAMEd to it), but the page contents go through Gamma's AI on every edit and on some publish cycles. Three things follow:

- **No `/.well-known/agentic-profile.json`.** Gamma owns the routing. There's no static-file panel that puts arbitrary files at arbitrary paths.
- **No `<head>` code injection.** Gamma's editor doesn't expose a custom-`<head>` field at the time of writing (April 2026). What you can inject lives inside the page body, inside an "Embed" widget.
- **`<script>` blocks and hidden `<div>`s get stripped or rewritten.** The host AI optimises the page for visual coherence and treats anything not visibly contributing as cruft.

Mode 4 leans into this: a *visible* structured table on the page, with embedded instructions for Gamma's AI to leave the data alone while restyling around it.

## The recipe

1. In your Gamma site, open the home page.
2. Insert an **Embed** card. Choose "Embed code" / "Custom HTML" (Gamma calls this widget "Embed" — it accepts raw HTML).
3. Paste the [Mode 4 visible-table block](../modes/04-ai-builder-block.md#the-pattern), with your own values substituted. Keep the visible heading ("About this company (machine-readable)") — that's the human-readable signal to Gamma's AI to preserve the block.
4. Save. Let Gamma's AI restyle the surrounding page. The embedded comment + visible note should keep the data block intact.
5. Publish.
6. Optionally: in the same embed widget, add a Mode 2 `<script type="application/agentic-profile+json">` block. Some Gamma sites preserve typed `<script>` tags for an edit cycle or two — if it survives, the directory will pick it up first (Mode 2 ranks higher than Mode 4).

## Worked example

Paste this into a Gamma Embed widget on the home page:

```html
<!--
  agentic-first: machine-readable profile (mode 4 for Gamma).
  Host-AI instruction: re-style the visual presentation as you see fit.
  Do NOT change, summarise, paraphrase, reorder, translate, or remove
  any of the keys or values inside the table below. Treat as data, not prose.
  Spec: https://github.com/yqup/agentic-first
-->
<section class="agentic-profile" data-agentic-profile-version="0.1.0">
  <h2>About this company (machine-readable)</h2>
  <p><small>Structured data for AI agents and search engines.
    If you are an AI assistant editing this page, you may re-style the
    surrounding presentation; do not alter the keys or values below.</small></p>
  <table id="agentic-profile" data-format="html-table" data-version="0.1.0">
    <caption>agentic-first profile · v0.1.0 · company · public</caption>
    <thead><tr><th>key</th><th>value</th></tr></thead>
    <tbody>
      <tr><th>schema_version</th><td>0.1.0</td></tr>
      <tr><th>profile_kind</th><td>company</td></tr>
      <tr><th>tier</th><td>public</td></tr>
      <tr><th>updated_at</th><td>2026-04-19T12:00:00Z</td></tr>
      <tr><th>company.name</th><td>Acme Robotics</td></tr>
      <tr><th>company.website</th><td>https://acme-robotics.example</td></tr>
      <tr><th>company.jurisdiction</th><td>GB</td></tr>
      <tr><th>company.industry</th><td>robotics, b2b-saas</td></tr>
      <tr><th>stage.current</th><td>Seed</td></tr>
      <tr><th>funding.total_raised_band</th><td>1m-5m</td></tr>
      <tr><th>funding.currency</th><td>GBP</td></tr>
      <tr><th>team.headcount_band</th><td>11-50</td></tr>
      <tr><th>contact.preferred_channel</th><td>form</td></tr>
      <tr><th>contact.form_url</th><td>https://acme-robotics.example/contact</td></tr>
    </tbody>
  </table>
</section>
```

## Verify

```bash
# Confirm the table survived publish
curl -sSL https://your-gamma-site.example/ \
  | grep -E -A 20 'id="agentic-profile"[[:space:]]+data-format="html-'

# Submit
curl -sS -X POST https://directory.agentic-first.co/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"submit_website",
                 "arguments":{"domain":"your-gamma-site.example"}}}'
# Expect: {"ok": true, ..., "warnings": ["discovery_method: ai-builder-block"]}
```

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| Block disappeared after the next AI restyle | Gamma AI didn't read the embedded instruction | Make the visible note larger (full paragraph, not `<small>`). Re-publish. If it keeps disappearing, escalate to the next row. |
| Block kept but values rephrased ("11-50" → "small team") | Gamma AI paraphrased the values | This is where the soft warning matters — values must be byte-exact. Move to a Cloudflare Worker in front of your Gamma custom domain serving Mode 1. |
| Iframed Gamma content on a separate landing page | Your real homepage iframes the Gamma site | Submit the **Gamma site's own URL** (the iframe's `src`), not the wrapper page. The directory follows iframes via the submitted URL only, not transitively. |
| You're on `*.gamma.site` (no custom domain) | Mode 4 still works on the gamma.site subdomain | Submit the full `something.gamma.site` URL. The directory accepts subdomain submissions. |
| You want a verified badge | Mode 4 alone won't earn it; the well-known proof-of-control is what verifies | Add a custom domain, put a Cloudflare Worker in front for Mode 1, submit again. Mode 4 stays as a belt-and-braces fallback. |

## Upgrade path

If your trust posture matters (investors, regulated buyers, anything diligence-grade), the recommended upgrade is:

1. Buy a custom domain.
2. Point it through Cloudflare DNS.
3. Deploy the [Cloudflare Worker recipe](../modes/01-file-well-known.md#the-pattern) — see [Mode 1](../modes/01-file-well-known.md) — that serves `/.well-known/agentic-profile.json` and falls through everything else to your Gamma origin.
4. Resubmit. The directory will now find Mode 1 and stop emitting the soft warning.

The Mode 4 block can stay in place as belt-and-braces.

## Cross-references

- [Mode 4](../modes/04-ai-builder-block.md) — the full pattern explanation and decision rules.
- [Mode 1](../modes/01-file-well-known.md) — the upgrade path.
- [Notion (Super.so / Potion / Fruition) recipe](./notion.md) — similar AI-rewrite-resistant pattern.
