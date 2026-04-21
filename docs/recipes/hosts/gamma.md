---
host: gamma
host_url: https://gamma.app
host_kind: ai-builder
modes_supported: [1-via-cloudflare-worker, 5]
modes_recommended: 1-via-cloudflare-worker
modes_acceptable_no_domain: [5]
status: stable
last_verified: 2026-04-21
gotchas:
  - no_well_known_path
  - no_head_injection
  - no_custom_html_or_script
  - no_body_html_widget
  - ai_rewrites_on_save
  - cname_only_custom_domain
  - mode_5_values_may_be_paraphrased_on_save
---

# Host recipe — Gamma (`gamma.app`)

> **Gamma has no HTML primitives.** As of April 2026 Gamma has no way to inject custom HTML, no `<script>` block, no custom `<head>`, no `/.well-known/` upload, and no body-HTML widget. The "Embed" widget only iframes *external* content (YouTube, Figma, QR codes) *into* a Gamma page — it is not a "paste raw HTML" surface. The "Embed" tab in the Share menu is for putting your *Gamma deck* onto someone else's site as an iframe — also not what we need. Top open Gamma feature request as of 2026: ["Support for Custom CSS and JavaScript Injection"](https://ideas.gamma.app/ideas?category=embed) — explicitly not supported.
>
> Three real paths, in order of trust:
>
> | Recipe | Trust | Effort | Requires |
> | --- | --- | --- | --- |
> | **Mode 1 via Cloudflare Worker on a Pro custom domain** *(recommended)* | High (canonical, no warning) | One-time Worker setup | Pro plan ($20/mo) + DNS at Cloudflare |
> | **Mode 5 plain-text block in a Gamma footer card** *(works on any plan, including free `*.gamma.site`)* | Lowest (soft warning) | Paste a 15-line text block | Nothing |
> | **Host the profile on a separate static host (Vercel/Netlify/Pages) and link to your Gamma deck from it** | High (canonical, no warning) | 5 minutes one-time setup | Free static-host account |
>
> If you have any plan with a custom domain → use the Cloudflare Worker (best trust, profile is canonical). If you don't want to upgrade and don't want a second host → use Mode 5 (works today, soft warning attached). If you don't mind a second domain → host the profile on a static host (best trust, no Gamma plan upgrade needed). All three are documented below.

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

## Mode-5 recipe — plain-text block in a Gamma footer card (works on any plan)

If you don't have a custom domain (free / `*.gamma.site` plan) and don't want a second host, this is the option. It works today, on any Gamma plan, with no DNS / Worker / migration. The cost is the soft warning the directory attaches to Mode 5 submissions; reading agents get a profile, but the trust signal is the lowest of the five modes.

**The recipe — exactly what to type:**

1. In your Gamma site, scroll to the last card on the home page.
2. Add a new card after it (the footer card). Name it something like "About Acme Robotics — machine-readable" or just "About".
3. Paste the [Mode 5 wire format](../modes/05-plaintext-block.md#wire-format-ascii-only-line-oriented) verbatim into that card. Replace the placeholder values with your own. The block is plain ASCII text, no HTML or markdown required:

   ```
   AGENTIC-PROFILE v0.1.0 — machine-readable. Do not edit, reword, translate, or remove.
   schema_version: 0.1.0
   profile_kind: company
   tier: public
   updated_at: 2026-04-19T12:00:00Z
   company.name: Acme Robotics
   company.website: https://acme.gamma.site
   company.jurisdiction: GB
   company.industry: robotics, b2b-saas
   stage.current: Seed
   funding.total_raised_band: 1m-5m
   funding.currency: GBP
   team.headcount_band: 11-50
   contact.preferred_channel: form
   contact.form_url: https://acme.gamma.site/contact
   END AGENTIC-PROFILE
   ```

4. Save. Let Gamma's AI restyle the card visually. **Do not** ask Gamma to "improve" or "shorten" this card — it'll paraphrase the values and break schema validation. The visible "Do not edit" line on the first row is the instruction to Gamma's AI; in our testing it survives most edit cycles when it's in a footer card.
5. Publish.
6. Verify the block survived the publish step by running the curl in [Verify (Mode 5 path)](#verify-mode-5-path) below.
7. Submit to the directory. The directory will tag the submission `discovery_method: plaintext-block` and attach a soft warning.

**Why a footer card.** Gamma's AI is more aggressive on hero / body cards (where it tries to "make the page sing") than on footer cards (where it tends to apply minimal styling). Putting the block in a dedicated footer card maximises the chance it survives unmodified.

**What to do when (not if) Gamma's AI rewrites a value once.** Re-paste the original block. Re-publish. If it keeps happening on the same field, that's the signal to upgrade to one of the other two recipes — Cloudflare Worker if you have Pro, separate static host otherwise.

## Fallback recipe — separate static-host subdomain

If you don't want to upgrade to Pro **and** the Mode 5 block keeps getting paraphrased on each save (or you just don't trust it), **don't keep fighting Gamma.** Instead:

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
- ⚠️ Typing the profile fields as **free-form prose** on a card. The Gamma AI paraphrases on save (`"team.headcount_band: 11-50"` becomes "we're a small team of about a dozen"), so visual extraction fails schema validation. The [Mode 5 plain-text block](#mode-5-recipe--plain-text-block-in-a-gamma-footer-card-works-on-any-plan) addresses this with explicit start/end markers and a "do not edit" instruction line — it is **not** the same thing as free prose, and it has a documented success path.

## Verify (Mode 5 path)

```bash
# 1. The plain-text block survived publish (HTML stripped, marker grep)
curl -sSL https://your-gamma-site.example/ \
  | sed -e 's/<[^>]*>//g' \
  | grep -A 30 'AGENTIC-PROFILE v'
# Expect: the start marker, every key:value line you pasted, the end marker.
# If a value got paraphrased, you'll see it here BEFORE you submit.

# 2. (Optional) parse + schema-validate locally
curl -sSL https://your-gamma-site.example/ \
  | python3 -c '
import sys, re, json
text = re.sub(r"<[^>]*>", " ", sys.stdin.read())
m = re.search(r"AGENTIC-PROFILE v\d+\.\d+\.\d+(.*?)END AGENTIC-PROFILE", text, re.DOTALL)
assert m, "block not found"
out = {}
for line in m.group(1).splitlines():
    line = line.strip()
    if not line or ":" not in line: continue
    k, _, v = line.partition(":")
    cur, parts = out, k.strip().split(".")
    for p in parts[:-1]: cur = cur.setdefault(p, {})
    val = v.strip()
    if "," in val and not val.startswith("\""):
        val = [s.strip() for s in val.split(",")]
    cur[parts[-1]] = val
print(json.dumps(out, indent=2))' \
  | agentic-first-validate -
# Expect: PASS

# 3. Submit
curl -sS -X POST https://directory.agentic-first.co/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"submit_website",
                 "arguments":{"domain":"your-gamma-site.example"}}}'
# Expect: {"ok": true, ...} with warnings[] containing "discovery_method: plaintext-block"
```

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

## History

- **April 21 2026 (early):** First Gamma recipe shipped, claiming Mode 4 worked via an "Embed code / Custom HTML" widget. **That widget does not exist** — Gamma's "Embed" only iframes external URLs.
- **April 21 2026 (mid):** Retracted the embed claim. Recipe rewritten with Mode 1 (Cloudflare Worker on Pro custom domain) and the static-host-subdomain fallback as the only two real paths. Mode 4 demoted to "speculative" because once Gamma drops out, no current host fits its preconditions.
- **April 21 2026 (late) — this version:** Added [Mode 5 (plain-text block)](#mode-5-recipe--plain-text-block-in-a-gamma-footer-card-works-on-any-plan) as a third path that works on any Gamma plan, including the free `*.gamma.site` tier. Mode 5 is the standard's universal fallback for hosts where the only available primitive is "type some text into a page". Soft warning attached, but it's a real path forward where previously the answer was "you cannot adopt this standard from Gamma without leaving Gamma".

The full project commit history is at [github.com/yqup/agentic-first/commits/main/docs/recipes/hosts/gamma.md](https://github.com/yqup/agentic-first/commits/main/docs/recipes/hosts/gamma.md).

## Cross-references

- [Mode 1](../modes/01-file-well-known.md) — the canonical mode the Cloudflare-Worker recipe uses, including a generic Worker template.
- [Mode 5](../modes/05-plaintext-block.md) — the wire format and parser semantics for the plain-text-block recipe in this file. This is the universal fallback for any host where the only thing you can put on a page is text.
- [Vercel recipe](./vercel.md), [Netlify recipe](./netlify.md), [GitHub Pages recipe](./github-pages.md) — for the "host the profile on a separate static host" path.
- [Mode 4 (speculative)](../modes/04-ai-builder-block.md) — the abstract pattern for AI-builder hosts that *do* allow body HTML. No current major host fits the precondition; Mode 5 is the practical answer for the same population today.
