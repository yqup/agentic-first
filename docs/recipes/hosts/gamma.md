---
host: gamma
host_url: https://gamma.app
host_kind: ai-builder
modes_supported: [1-via-cloudflare-worker]
modes_recommended: 1-via-cloudflare-worker
status: stable
last_verified: 2026-04-21
gotchas:
  - no_well_known_path
  - no_head_injection
  - no_custom_html_or_script
  - no_body_html_widget
  - ai_rewrites_on_save
  - cname_only_custom_domain
---

# Host recipe — Gamma (`gamma.app`)

> **Gamma cannot host an `agentic-first` profile directly.** As of April 2026 Gamma has no way to inject custom HTML, no `<script>` block, no custom `<head>`, no `/.well-known/` upload, and no body-HTML widget. The "Embed" widget only iframes *external* content (YouTube, Figma, QR codes) *into* a Gamma page — it is not a "paste raw HTML" surface. The "Embed" tab in the Share menu is for putting your *Gamma deck* onto someone else's site as an iframe — also not what we need. Top open Gamma feature request as of 2026: ["Support for Custom CSS and JavaScript Injection"](https://ideas.gamma.app/ideas?category=embed) — explicitly not supported.
>
> The realistic paths are: **Mode 1 via a Cloudflare Worker on a custom domain** (recommended), or **host your profile on a separate static host and link to your Gamma deck from it**. There is no in-Gamma-page embed mode that the directory will accept.

## What Gamma actually exposes

| Surface you might hope for | Reality (April 2026) |
| --- | --- |
| `/.well-known/agentic-profile.json` upload | Not available. Gamma owns the routing under `*.gamma.site` and on custom domains. |
| `<head>` code injection (Google Analytics-style) | Not available. No editor panel. |
| Custom HTML / JavaScript widget | Not available. The "Embed" block iframes a remote URL; it does not accept raw HTML. |
| Body HTML / Markdown with raw `<script>` | Not available. Editor produces Gamma's own typed blocks; raw script tags are not preserved. |
| `<table>` / `<dl>` paste from your clipboard | Editor accepts visible content but **the AI re-styles it on save**. There is no "raw HTML" mode where a `<table id="agentic-profile" data-format="html-table">` will round-trip with attributes intact. |
| Public API to insert HTML | Pro+ API generates whole Gammas from prompts (`POST /v1.0/generations`). There is no endpoint to inject HTML into an existing Gamma. |
| Custom domain | Pro+ ($20/mo). The custom domain CNAMEs to Gamma's CDN, which means **you can put Cloudflare in front**. That is the only door we can use. |

## Recommended recipe — Mode 1 via Cloudflare Worker on a custom domain

This is the only path that produces a real, byte-exact, schema-validated profile while keeping the user's marketing site on Gamma.

**Prereqs:**
- Gamma Pro plan (custom domain unlock).
- A domain you control, with DNS at Cloudflare.

**Steps:**

1. In Gamma: Settings → Custom domain → enter your domain (e.g. `acme.example`). Gamma will tell you the CNAME target.
2. In Cloudflare DNS: add the CNAME (orange-cloud / proxied — that's what makes step 4 possible).
3. Verify the Gamma site loads at `https://acme.example/`.
4. In Cloudflare → Workers & Pages → create a Worker bound to the route `acme.example/.well-known/agentic-profile.json`. Paste the worker below, replacing the JSON with your validated profile.
5. (Optional) Bind the Worker to a `link rel` redirect for `/agentic-profile.json` if you want a non-well-known fallback.

**Worker:**

```javascript
// Worker bound to: acme.example/.well-known/agentic-profile.json
// Everything else falls through to Gamma.
export default {
  async fetch(request) {
    const profile = {
      schema_version: "0.1.0",
      updated_at: "2026-04-19T12:00:00Z",
      profile_kind: "company",
      tier: "public",
      company: {
        name: "Acme Robotics",
        website: "https://acme.example",
        jurisdiction: "GB",
        industry: ["robotics", "b2b-saas"]
      },
      stage: { current: "Seed" },
      funding: { total_raised_band: "1m-5m", currency: "GBP" },
      team: { headcount_band: "11-50" },
      contact: { preferred_channel: "form", form_url: "https://acme.example/contact" }
    };
    return new Response(JSON.stringify(profile, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300",
        "access-control-allow-origin": "*"
      }
    });
  }
};
```

That's it. Mode 1 is active on your domain; Gamma still serves every other URL.

## Fallback recipe — separate static-host subdomain

If you don't want to upgrade to Pro, **don't try to embed inside Gamma.** Instead:

1. Buy or reuse a domain (e.g. `acme.example`).
2. Publish a one-page static site at `https://acme.example/` (Vercel, Netlify, GitHub Pages, Cloudflare Pages — all free, all 5 minutes).
3. Put `/.well-known/agentic-profile.json` on it (see [Vercel recipe](./vercel.md), [Netlify recipe](./netlify.md), [GitHub Pages recipe](./github-pages.md)).
4. On the static page, link out to your Gamma deck: `<a href="https://acme.gamma.site/">Pitch deck →</a>`.
5. Submit `acme.example` to the directory. Reading agents will get a clean Mode 1 profile and visitors get one click to your Gamma deck.

This is materially better than fighting Gamma. The profile is canonical, byte-exact, and verifiable.

## What does *not* work — explicit "we tried" list

So that downstream agents (and you) don't waste cycles re-discovering these:

- ❌ Pasting `<script type="application/agentic-profile+json">…</script>` into a Gamma text card. The editor renders it as visible text; on save the AI either rewrites it as prose or drops the tag.
- ❌ Pasting `<div hidden id="agentic-profile" data-format="xml">…</div>`. Same outcome — Gamma's editor doesn't accept raw HTML.
- ❌ Pasting a `<table id="agentic-profile" data-format="html-table">` into a card. The AI re-styles it into Gamma's own typed table component, stripping `id` and `data-*` attributes. The reader can no longer find it.
- ❌ Using the "Embed" block to embed a *Gist* of `agentic-profile.json`. The Gist iframe loads inside the Gamma page; the JSON is not at the canonical path on your domain, so the directory will not pick it up.
- ❌ Typing the profile fields as plaintext on a card and hoping a reading agent extracts them. The Gamma AI paraphrases on save (`"team.headcount_band: 11-50"` becomes "we're a small team of about a dozen"), so even visual extraction will fail schema validation.

## Verify (Mode 1 via Worker path)

```bash
curl -sS -I https://acme.example/.well-known/agentic-profile.json
# Expect: HTTP/2 200, content-type: application/json

curl -sS https://acme.example/.well-known/agentic-profile.json \
  | python -m json.tool | head -10
# Expect: pretty-printed profile

curl -sS https://acme.example/some-deck-page
# Expect: Gamma page HTML (the Worker only intercepts /.well-known/agentic-profile.json)

# Submit
curl -sS -X POST https://directory.agentic-first.co/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"submit_website",
                 "arguments":{"domain":"acme.example"}}}'
# Expect: {"ok": true, ...} with discovery_method: file (no soft warning)
```

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| Worker returns the profile, but Gamma also returns 404 for everything else | Worker route is matching too broadly (e.g. `acme.example/*`) | Bind the route to the exact path `acme.example/.well-known/agentic-profile.json`, nothing wider. |
| `submit_website` says "no profile found" but the curl above works | Cloudflare proxy is off (DNS-only / grey cloud) — Worker isn't actually intercepting | Switch the CNAME to proxied (orange cloud) and re-test. |
| You're on the Free or Plus plan and don't want to pay | Custom domain requires Pro | Use the [fallback recipe](#fallback-recipe--separate-static-host-subdomain) instead. The directory doesn't care that the profile and the deck live on different hosts. |
| You only have a `*.gamma.site` URL | No DNS, no Cloudflare, no Worker | Use the fallback recipe. There is no in-Gamma path. |

## Why this changed

We previously published a "Mode 4 visible structured table" recipe for Gamma, claiming it worked via an "Embed code / Custom HTML" widget. That widget does not exist — Gamma's "Embed" only iframes external URLs. The recipe has been retracted; the source-of-truth is this file. See the project [CHANGELOG](https://github.com/yqup/agentic-first/commits/main/docs/recipes/hosts/gamma.md) for the correction.

## Cross-references

- [Mode 1](../modes/01-file-well-known.md) — the canonical mode this recipe uses, including a generic Cloudflare Worker template.
- [Vercel recipe](./vercel.md), [Netlify recipe](./netlify.md), [GitHub Pages recipe](./github-pages.md) — for the fallback "host the profile on a separate static host" path.
- [Mode 4 (speculative)](../modes/04-ai-builder-block.md) — the abstract pattern for AI-builder hosts that do allow body HTML. No current major host fits the precondition; documented for completeness.
