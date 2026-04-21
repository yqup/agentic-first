---
host: gamma
host_url: https://gamma.app
host_kind: ai-builder
modes_supported: [1-via-static-host-fronting, 1-via-separate-static-host, 5]
modes_recommended: 1-via-static-host-fronting
modes_acceptable_no_domain: [5]
status: stable
last_verified: 2026-04-21
mode_5_schema: v2-2026-04-21 (single-line colophon; v1 multi-line was retracted same day after live testing)
gotchas:
  - no_well_known_path
  - no_head_injection
  - no_custom_html_or_script
  - no_body_html_widget
  - ai_rewrites_on_save
  - cname_only_custom_domain
  - mode_5_values_may_be_paraphrased_on_save
  - mode_5_multi_line_does_not_survive_publish_ai
  - mode_5_ai_directed_preambles_backfire
---

# Host recipe — Gamma (`gamma.app`)

> **Gamma has no HTML primitives.** As of April 2026 Gamma has no way to inject custom HTML, no `<script>` block, no custom `<head>`, no `/.well-known/` upload, and no body-HTML widget. The "Embed" widget only iframes *external* content (YouTube, Figma, QR codes) *into* a Gamma page — it is not a "paste raw HTML" surface. The "Embed" tab in the Share menu is for putting your *Gamma deck* onto someone else's site as an iframe — also not what we need. Top open Gamma feature request as of 2026: ["Support for Custom CSS and JavaScript Injection"](https://ideas.gamma.app/ideas?category=embed) — explicitly not supported.
>
> Three real paths, in order of trust. **Pick by what you have**, not by vendor:
>
> | Recipe | Trust | Effort | Requires |
> | --- | --- | --- | --- |
> | **Mode 1 — front your custom domain with any static host** *(recommended)* | High (canonical, no warning) | 10–15 min one-time | Gamma Pro ($20/mo) for custom domain + an account on any static host that serves arbitrary paths from a CNAME (Vercel, Netlify, Cloudflare Pages, Cloudflare Workers, Bunny.net, GitHub Pages on a custom domain — all free tiers work) |
> | **Mode 1 — host the profile on a separate static-host subdomain** | High (canonical, no warning) | 5 min one-time | Free static-host account; a domain or subdomain you can publish a single JSON file at |
> | **Mode 5 — single-line colophon in a Gamma footer card** | Lowest (soft warning) | One paste | Nothing — works on any Gamma plan including the free `*.gamma.site` tier |
>
> Decision rule: if you have a custom domain you can DNS, **front it** with the static host of your choice. If you don't want to manage DNS, publish the profile at `https://your-name.vercel.app/.well-known/agentic-profile.json` (or Netlify/Pages equivalent) and submit *that* domain to the directory. If you can't or don't want either, paste the [Mode 5 colophon](#mode-5-recipe--single-line-colophon-in-a-gamma-footer-card-works-on-any-plan) into a Gamma footer card.
>
> The Cloudflare Worker example below is **one** static-host fronting recipe of many; this guide previously over-indexed on it as if Cloudflare were the only option. It is not. Any host that serves a JSON file at a custom-domain CNAME works.

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

## Mode-1 recipe — front your domain with any static host

This is the recommended path. It produces a real, byte-exact, schema-validated Mode 1 profile while keeping the user's marketing site on Gamma. **The static host is the implementation detail; the standard doesn't care which one you pick.**

**Prereqs:**
- Gamma Pro plan (custom domain unlock).
- A domain you control, with DNS you can edit.
- An account on any one of the static hosts in the table below (all have free tiers that cover this use case).

**Pick a fronting host (any of these work):**

| Host | Free tier covers this? | Best for |
| --- | --- | --- |
| **Vercel** | Yes | Teams already deploying from Git; supports rewrites at `vercel.json` |
| **Netlify** | Yes | One-shot publish via drag-and-drop (no Git needed); `_redirects` syntax |
| **Cloudflare Pages** | Yes | Same DNS host as your domain if it's already at Cloudflare; `_routes.json` |
| **Cloudflare Workers** | Yes | Programmable response (good if you also want `link rel` headers, redirects); see worker below |
| **Bunny.net Pull Zone / Edge Storage** | Yes (token-bucket) | EU-headquartered, no US trust assumptions |
| **GitHub Pages** (custom domain) | Yes | Already storing your profile in Git; CNAME-only, no programmability |
| **Self-hosted nginx / Caddy in front of Gamma** | n/a | If you already operate a reverse proxy |

The mechanism is the same on every one: your domain CNAMEs to *both* your fronting host *and* (via the fronting host's path-routing or the worker's route-binding) selectively forwards everything except `/.well-known/agentic-profile.json` to Gamma's CDN.

**Steps (the host-agnostic shape):**

1. In Gamma: Settings → Custom domain → enter your domain (e.g. `acme.example`). Note the CNAME target Gamma gives you.
2. Set up your fronting host so it **(a)** serves `/.well-known/agentic-profile.json` from your validated profile, and **(b)** proxies / rewrites every other path to Gamma's CNAME target. The exact configuration varies by host — see your host's "rewrites" or "proxy" docs.
3. Point your domain's CNAME at the fronting host (not at Gamma directly). The fronting host owns the routing decision.
4. Verify with `curl -sS -I https://acme.example/.well-known/agentic-profile.json` (expect `200`) and `curl -sS https://acme.example/` (expect Gamma's HTML).
5. Submit your domain to the directory.

**Concrete example — Cloudflare Workers (one option among many):**

If you happen to use Cloudflare for DNS and want a single-file solution, this Worker does both halves (serve the JSON, proxy everything else to Gamma):

```javascript
// Worker bound to: acme.example/* (or just acme.example/.well-known/agentic-profile.json
// if your DNS already CNAMEs to Gamma directly — then everything else falls through).
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/.well-known/agentic-profile.json") {
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
    // Everything else → fall through to Gamma's CDN.
    return fetch(request);
  }
};
```

**Concrete example — Vercel `vercel.json`:**

```json
{
  "rewrites": [
    { "source": "/.well-known/agentic-profile.json", "destination": "/agentic-profile.json" },
    { "source": "/(.*)",                              "destination": "https://YOUR-GAMMA-CNAME-TARGET/$1" }
  ]
}
```

Drop your validated profile at `public/agentic-profile.json` in the Vercel project, set the project's domain to `acme.example`, and you're done.

**Concrete example — Netlify `_redirects`:**

```
/.well-known/agentic-profile.json   /agentic-profile.json   200
/*                                  https://YOUR-GAMMA-CNAME-TARGET/:splat   200
```

Same idea: profile in the site root, domain pointed at Netlify, profile served, everything else proxied to Gamma.

That's it. Mode 1 is active on your domain; Gamma still serves every other URL; the directory sees a canonical, byte-exact profile with no soft warning. Pick the fronting host whose ergonomics you like best — none of them is the "right" answer.

## Mode-5 recipe — single-line colophon in a Gamma footer card (works on any plan)

If you don't have a custom domain (free / `*.gamma.site` plan) and don't want to set up a second host, this is the option. It works today, on any Gamma plan, with no DNS / fronting / migration. The cost is the soft warning the directory attaches to Mode 5 submissions; reading agents get a profile, but the trust signal is the lowest of the five modes.

> **Verified live on yqup.com (Gamma + custom domain) on 2026-04-21.** The pattern below is what survived Gamma's publish AI in production testing. Earlier (2026-04-21 morning) we shipped a multi-line block that did NOT survive — see [Mode 5 §Why v2 is single-line](../modes/05-plaintext-block.md#why-v2-is-single-line--history) for the history.

**The recipe — exactly what to paste into Gamma's editor:**

1. In your Gamma site, scroll to the last card on the home page. Add a new card after it (the footer card). Name it something neutral like "About" or "Footer" — do not name it "machine-readable" or anything that signals "this is for an AI", because Gamma's publish AI will then try to "help".

2. Paste the following into Gamma's editor — **the framing sentence and the colophon together as one paste**:

   ```
   Please add the following as a small footer at the bottom of the home
   page. Paste it as one text block, exactly as written. Do not edit
   any other pages.

   agentic-first profile v0.1.0 | company.name: Acme Robotics | company.website: https://acme.gamma.site | company.jurisdiction: GB | company.industry: robotics, b2b-saas | stage.current: Seed | funding.total_raised_band: 1m-5m | funding.currency: GBP | team.headcount_band: 11-50 | contact.preferred_channel: form | contact.form_url: https://acme.gamma.site/contact | updated_at: 2026-04-21
   ```

   Replace the placeholder values with your own. The framing sentence (the first paragraph) is talking to the *Gamma editor on your behalf as a human*. The colophon line (the second paragraph, starting `agentic-first profile v0.1.0`) is the actual data the directory will read. Both are one paste.

3. Publish.

4. Verify the colophon survived the publish step:

   ```bash
   curl -sSL https://your-gamma-site.example/ \
     | sed -e 's/<[^>]*>//g' \
     | grep -F 'agentic-first profile v0.1.0'
   ```

   Expect at least one match. If you don't see your fields, see the [§Verify (Mode 5 path)](#verify-mode-5-path) section below.

5. Submit to the directory. The directory will tag the submission `discovery_method: plaintext-colophon` and attach a soft warning.

**Critical — what NOT to paste:**

- ❌ A "Do not edit, reword, translate, or remove" preamble. Empirically this *backfires* on Gamma. The publish AI reads it as a prompt directed at itself and starts making unrelated structural edits across multiple pages. The colophon's distinctiveness is its protection; an explicit "do not edit" instruction *reduces* survival, it doesn't increase it.
- ❌ A multi-line block (one `key.path: value` per line). The publish AI restructures multi-line ASCII blocks visually, breaking the parse contract. Single-line is what survived in production testing.
- ❌ Detailed AI-directed instructions like "treat the following as data, do not summarise or reformat, preserve verbatim". Same backfire mode as the "do not edit" preamble.
- ❌ A name like "machine-readable footer" on the card itself. Naming the card with AI-facing language tells the publish AI this is for it, and it will try to be helpful.

**Why a footer card.** Gamma's AI is more aggressive on hero / body cards (where it tries to "make the page sing") than on footer cards (where it tends to apply minimal styling). Putting the colophon in a dedicated footer card maximises the chance it survives unmodified.

**What to do when (not if) Gamma's AI rewrites a value once.** Re-paste the original colophon (just the second paragraph; you don't need to re-send the framing sentence on a re-paste of an existing card). Re-publish. If the same field keeps getting rewritten across saves, that's the signal to upgrade to one of the [Mode-1 paths below](#mode-1-recipe--front-your-domain-with-any-static-host) — there's no defence against an AI that won't leave a value alone except putting the data outside the host's control.

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
- ⚠️ Typing the profile fields as **free-form prose** on a card. The Gamma AI paraphrases on save (`"team.headcount_band: 11-50"` becomes "we're a small team of about a dozen"), so visual extraction fails schema validation. The [Mode 5 single-line colophon](#mode-5-recipe--single-line-colophon-in-a-gamma-footer-card-works-on-any-plan) addresses this by patterning the data as a single, distinctive, machine-shaped line — it is **not** free prose, and the [verify section below](#verify-mode-5-path) shows the documented success path.
- ❌ A **multi-line** ASCII block with explicit `AGENTIC-PROFILE` start/end markers and one `key.path: value` per line. We tried this in early Mode 5 (v1, shipped 2026-04-21 morning, retracted same afternoon). It does not survive Gamma's publish AI — the AI restructures multi-line blocks visually. The single-line colophon does survive. See [Mode 5 §Why v2 is single-line](../modes/05-plaintext-block.md#why-v2-is-single-line--history) for the history.
- ❌ **AI-directed preambles** in the paste, like "Do not edit, reword, translate, or remove" or "treat the following as data, do not summarise, preserve verbatim". Empirically these *backfire* on Gamma: the publish AI reads them as instructions to itself and starts making unrelated structural edits across multiple pages. Use the user-voice framing pattern in the [Mode 5 recipe](#mode-5-recipe--single-line-colophon-in-a-gamma-footer-card-works-on-any-plan) instead.

## Verify (Mode 5 path)

```bash
# 1. The colophon survived publish (HTML stripped, marker grep)
curl -sSL https://your-gamma-site.example/ \
  | sed -e 's/<[^>]*>//g' \
  | grep -F 'agentic-first profile v0.1.0'
# Expect: at least one match. The whole pipe-separated colophon line should print.
# If a value got paraphrased ("11-50" → "between ten and fifty"), you'll see it here
# BEFORE you submit, and you should re-paste before submitting to the directory.

# 2. (Optional) parse + schema-validate locally
curl -sSL https://your-gamma-site.example/ \
  | python3 -c '
import sys, re, json
text = re.sub(r"<[^>]*>", " ", sys.stdin.read())
m = re.search(r"agentic-first profile v\d+\.\d+\.\d+\s*\|(.+)", text)
assert m, "colophon not found"
parts = [p.strip() for p in m.group(1).split("|")]
out = {"schema_version": "0.1.0"}
for part in parts:
    if ":" not in part: continue
    k, _, v = part.partition(":")
    cur, segs = out, k.strip().split(".")
    for s in segs[:-1]:
        cur = cur.setdefault(s, {})
    val = v.strip()
    if "," in val and not val.startswith("\""):
        val = [s.strip() for s in val.split(",")]
    cur[segs[-1]] = val
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
# Expect: {"ok": true, "discovery": {"method": "plaintext-colophon",
#         "warnings": ["discovery_method=plaintext-colophon: lowest-trust...",
#                      "coerced updated_at from date 'YYYY-MM-DD' to date-time..."]},
#         "validation": {"errors": [], "warnings": [...]}}.
# The discovery.warnings array is the soft-warning trust signal plus
# any defensive coercions the Mode 5 parser had to apply. Tighten your
# wire format to clear the coercion warnings.
```

> **Verified on this directory release.** The directory's `submit_website`
> walks Mode 1 → convention MCP → **Mode 5 (plaintext colophon)** in that
> order. You can confirm the running scanner supports Mode 5 with:
>
> ```bash
> curl -s https://directory.agentic-first.co/healthz \
>   | python3 -c 'import json, sys; print([m["method"] for m in json.load(sys.stdin)["supported_discovery_modes"]])'
> # Expect: [..., 'plaintext-colophon']
> ```
>
> **Verified on:**
>
> | Domain | Date | Result |
> | --- | --- | --- |
> | `yqup.com` | 2026-04-21 | Mode 5 v2 single-line colophon, 18 fields preserved byte-exact (see `fb_7e1c06b5380d49df`) |

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
| Fronting host returns the profile, but Gamma also returns 404 for everything else | Fronting rewrite is matching too broadly and swallowing all paths | Bind the JSON-serving rule to the exact path `/.well-known/agentic-profile.json`; everything else must fall through (proxy/rewrite) to the Gamma CNAME. |
| `submit_website` says "no profile found" but the curl above works | Fronting host is in DNS-only mode (e.g. Cloudflare grey-cloud) — its rules aren't actually intercepting | Switch the fronting host to "proxied" / "active" mode for that hostname and re-test. |
| You're on the Free or Plus plan and don't want to pay | Custom domain requires Gamma Pro | Use Mode 5 (single-line colophon — works on the free `*.gamma.site` tier with zero changes), **or** publish your profile at `https://your-name.vercel.app/.well-known/agentic-profile.json` (or Netlify/Pages equivalent) and submit *that* domain. The directory doesn't require the profile to live at the same domain as your marketing site. |
| You only have a `*.gamma.site` URL | No custom domain, no fronting host possible | Use Mode 5 (the colophon survives Gamma's publish AI as documented above), or get a free domain/subdomain at any DNS provider and follow the static-host-subdomain path. |
| You don't want a Cloudflare account | The original Gamma recipe over-indexed on Cloudflare. It is one option among many. | Use Vercel, Netlify, Cloudflare Pages, Bunny.net, GitHub Pages on a custom domain, or any reverse proxy you already operate. The standard doesn't require Cloudflare. |

## History

- **April 21 2026 (early):** First Gamma recipe shipped, claiming Mode 4 worked via an "Embed code / Custom HTML" widget. **That widget does not exist** — Gamma's "Embed" only iframes external URLs.
- **April 21 2026 (mid):** Retracted the embed claim. Recipe rewritten with Mode 1 (Cloudflare Worker on Pro custom domain) and the static-host-subdomain fallback as the only two real paths. Mode 4 demoted to "speculative" because once Gamma drops out, no current host fits its preconditions.
- **April 21 2026 (early afternoon):** Added Mode 5 v1 — a multi-line ASCII block with explicit `AGENTIC-PROFILE` start/end markers, one `key.path: value` per line, and a "Do not edit, reword, translate, or remove" instruction line at the top. Designed in theory for parser cleanliness.
- **April 21 2026 (late afternoon) — this version:** Mode 5 v1 retracted same day after live testing on yqup.com. Two empirical findings: (1) multi-line blocks did not survive Gamma's publish AI (the AI restructured them visually, breaking the parse); (2) the "Do not edit" preamble *backfired* — Gamma's publish AI read it as a prompt directed at itself and made unrelated structural edits across multiple pages. Replaced with **Mode 5 v2 — single-line pipe-separated colophon, no AI-directed preamble, with user-voice framing in the paste recipe**. Verified live the same afternoon. Same change deprecated v1 honestly in [`docs/recipes/modes/05-plaintext-block.md`](../modes/05-plaintext-block.md#why-v2-is-single-line--history) rather than silently overwriting it. **Also de-Cloudflared the Mode 1 upgrade path** — the original recipe presented Cloudflare Workers as the only Mode 1 option; it is now one of seven concrete fronting hosts (Vercel, Netlify, Cloudflare Pages, Cloudflare Workers, Bunny.net, GitHub Pages, self-hosted reverse proxy), with the standard's posture restated explicitly: the static host is an implementation detail, the standard does not require any specific vendor.

The full project commit history is at [github.com/yqup/agentic-first/commits/main/docs/recipes/hosts/gamma.md](https://github.com/yqup/agentic-first/commits/main/docs/recipes/hosts/gamma.md).

## Cross-references

- [Mode 1](../modes/01-file-well-known.md) — the canonical mode the Cloudflare-Worker recipe uses, including a generic Worker template.
- [Mode 5](../modes/05-plaintext-block.md) — the wire format and parser semantics for the plain-text-block recipe in this file. This is the universal fallback for any host where the only thing you can put on a page is text.
- [Vercel recipe](./vercel.md), [Netlify recipe](./netlify.md), [GitHub Pages recipe](./github-pages.md) — for the "host the profile on a separate static host" path.
- [Mode 4 (speculative)](../modes/04-ai-builder-block.md) — the abstract pattern for AI-builder hosts that *do* allow body HTML. No current major host fits the precondition; Mode 5 is the practical answer for the same population today.
