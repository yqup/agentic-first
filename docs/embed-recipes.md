# Embed recipes

> **Publish on any host. In ten minutes.** An `agentic-first` profile is one small JSON file. The hardest part is wrangling whatever host you happen to use into serving it at the canonical URL with the right `Content-Type`. This page is the decision tree. The full per-host recipes live in [`recipes/hosts/`](./recipes/hosts/).

---

## How to use this page

1. Find your host (or the closest one) in the table below.
2. Click through to **the host recipe** — that single file has the exact paste-target and the exact snippet for your situation.
3. Run the verification curls at the bottom of this page or the host recipe.
4. Submit your domain to the directory.

If you're an **AI agent helping a user publish**: read the user's host name first, then fetch *only* the matching host recipe. Each recipe is self-contained — you don't need to read the others. The list of available host recipes is at the end of this page.

---

## The five modes

| Mode | Where the profile lives | Use when | Recipe |
| --- | --- | --- | --- |
| **1 — File** *(canonical)* | `https://your-domain/.well-known/agentic-profile.json` | Your host lets you upload arbitrary files at dot-prefixed paths, OR you control a build pipeline that does. | [recipes/modes/01-file-well-known.md](./recipes/modes/01-file-well-known.md) |
| **2 — Script embed** | `<script type="application/agentic-profile+json">` on the home page | Host won't serve dotfiles but lets you inject HTML into `<head>` or page footer. | [recipes/modes/02-script-embed.md](./recipes/modes/02-script-embed.md) |
| **3 — Hidden block** *(soft warning)* | `<div hidden id="agentic-profile" data-format="xml">` anywhere on the page | Host strips `<script>` tags but still allows arbitrary `<div>` content. | [recipes/modes/03-hidden-block.md](./recipes/modes/03-hidden-block.md) |
| **4 — AI-builder block** *(speculative; no current host implements it)* | Visible `<table>` / `<dl>` with embedded host-AI instructions | Reserved for hypothetical hosts that allow body HTML *and* run AI rewrites on save. As of April 2026 no major host satisfies both. Documented for completeness. | [recipes/modes/04-ai-builder-block.md](./recipes/modes/04-ai-builder-block.md) |
| **5 — Plain-text colophon** *(soft warning, lowest trust)* | A single visible line of text in a footer card on the home page, marker `agentic-first profile v0.1.0 \| key.path: value \| key.path: value …` | The host doesn't allow HTML at all — it only lets you type text into a page (Gamma, Tome, Beautiful.AI). | [recipes/modes/05-plaintext-block.md](./recipes/modes/05-plaintext-block.md) |

Higher numbers carry a soft warning from the directory because they're harder for reading agents to verify. Use the lowest mode your host supports. **For pure HTML hosts every host falls into Mode 1, 2, or 3** — see the [host table](#pick-by-host). **For AI-builder hosts that have no HTML primitive at all (Gamma, Tome, Beautiful.AI), Mode 5 is the universal fallback** that lets the publisher participate in the standard without leaving their host.

---

## Pick by host

| Host | Recommended | Recipe |
| --- | --- | --- |
| Vercel, Next.js, Astro, Nuxt, Vite, SvelteKit, Hugo, Docusaurus, Gatsby | Mode 1 | [recipes/hosts/vercel.md](./recipes/hosts/vercel.md) |
| Netlify | Mode 1 | [recipes/hosts/netlify.md](./recipes/hosts/netlify.md) |
| GitHub Pages, Jekyll, Eleventy | Mode 1 | [recipes/hosts/github-pages.md](./recipes/hosts/github-pages.md) |
| Apache, Nginx, Caddy, raw VPS, Docker-served static | Mode 1 | [recipes/hosts/raw-html.md](./recipes/hosts/raw-html.md) |
| WordPress (managed or self-hosted) | Mode 2 | [recipes/hosts/wordpress.md](./recipes/hosts/wordpress.md) |
| Squarespace | Mode 2 (or Mode 1 via any static-host fronting on a custom domain) | [recipes/hosts/squarespace.md](./recipes/hosts/squarespace.md) |
| Wix | Mode 2 (Premium) | [recipes/hosts/wix.md](./recipes/hosts/wix.md) |
| Webflow | Mode 2 (or Mode 1 via any static-host fronting on a custom domain) | [recipes/hosts/webflow.md](./recipes/hosts/webflow.md) |
| Notion (Super.so / Potion / Fruition) | Mode 2 | [recipes/hosts/notion.md](./recipes/hosts/notion.md) |
| Gamma (and other AI-builder hosts: Tome, Beautiful.AI) | **One of three:** Mode 1 by fronting your custom domain with any static host (Vercel, Netlify, Cloudflare Pages/Workers, Bunny.net, GitHub Pages, self-hosted reverse proxy — pick whichever you prefer); Mode 1 by hosting the profile on a separate static-host subdomain and linking out to your AI-builder deck; or Mode 5 single-line colophon in a footer card on any plan including free `*.gamma.site` (works today, soft warning attached). | [recipes/hosts/gamma.md](./recipes/hosts/gamma.md) |

If your host isn't listed, see "Hosts not in the table" below.

---

## Hosts not in the table

The pattern almost always reduces to one of these five:

| Your situation | What to do |
| --- | --- |
| You have DNS control over your domain | Front the host with **any** static host that does path-based rewrites/proxies — Vercel (`vercel.json`), Netlify (`_redirects`), Cloudflare Pages (`_routes.json`), Cloudflare Workers (programmable), Bunny.net pull zones, GitHub Pages on a custom domain, or any self-hosted reverse proxy you already operate. Serve `/.well-known/agentic-profile.json` from the fronting host; fall through everything else to your real host. Universal escape hatch — **the standard does not require any specific vendor**, the worker / `vercel.json` / `_redirects` form is just an implementation detail. See [Mode 1](./recipes/modes/01-file-well-known.md). |
| Your host has a "code injection" or "custom HTML" panel | [Mode 2](./recipes/modes/02-script-embed.md). The WordPress / Squarespace / Wix recipes are good templates. |
| Your host strips `<script>` but allows raw HTML | [Mode 3](./recipes/modes/03-hidden-block.md). |
| Your host runs an AI rewriter on save **and** has no body-HTML widget at all (Gamma, Tome, Beautiful.AI), but you *do* have a custom domain or a separate hosting account you can use | Best: front your custom domain with any static host (see row above), or publish the profile on a separate static-host subdomain (Vercel / Netlify / Cloudflare Pages / GitHub Pages — all free) and link out to your AI-builder deck. See the [Gamma recipe](./recipes/hosts/gamma.md) for both shapes. |
| Your host has no HTML primitive at all and no custom domain available — you can only type text into the page | [Mode 5 single-line colophon](./recipes/modes/05-plaintext-block.md) in a footer card. Soft warning attached, but it works on Gamma free / `*.gamma.site`, Tome, Beautiful.AI, and any future text-only AI-builder host. |
| None of the above | Publish on a separate static-host subdomain (`profile.your-domain.example` CNAMEd to any static host that takes a custom domain) and submit *that* domain. |

If you've found a host the recipes don't cover well, please [send feedback](./feedback.md) — we add new host recipes when real users report gaps.

---

## Worked example — same profile, four ways

**Mode 1: file at `/.well-known/agentic-profile.json`**

```jsonc
{
  "schema_version": "0.1.0",
  "updated_at": "2026-04-19T12:00:00Z",
  "profile_kind": "company",
  "tier": "public",
  "company": {
    "name": "Acme Robotics",
    "website": "https://acme-robotics.example",
    "jurisdiction": "GB"
  }
}
```

**Mode 2: embed inside `<head>` or just before `</body>`**

```html
<script type="application/agentic-profile+json">
{
  "schema_version": "0.1.0",
  "updated_at": "2026-04-19T12:00:00Z",
  "profile_kind": "company",
  "tier": "public",
  "company": {
    "name": "Acme Robotics",
    "website": "https://acme-robotics.example",
    "jurisdiction": "GB"
  }
}
</script>
<link rel="agentic-profile"
      type="application/json"
      href="/.well-known/agentic-profile.json">
```

**Mode 3: inline XML, anywhere on the page**

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

**Mode 4: visible structured block, AI-builder hosts (speculative)** — see the [Mode 4 recipe](./recipes/modes/04-ai-builder-block.md). No current major host requires this; the spec defines the pattern in case one emerges.

**Mode 5: single-line plain-text colophon, text-only AI-builder hosts** — see the [Mode 5 recipe](./recipes/modes/05-plaintext-block.md). This is the practical path for Gamma free tier, Tome, Beautiful.AI, and any other host where you can only type text (no HTML, no script, no `/.well-known/`). Same payload as the others, expressed as a single distinctive line of pipe-separated `key.path: value` pairs:

```
agentic-first profile v0.1.0 | schema_version: 0.1.0 | profile_kind: company | tier: public | updated_at: 2026-04-19 | company.name: Acme Robotics | company.website: https://acme-robotics.example | company.jurisdiction: GB
```

Empirical finding (April 2026, verified live on Gamma): **single-line** survives publish AI; multi-line ASCII blocks do not. **Do not** wrap the paste with "do not edit / treat as data / preserve verbatim" instructions — those backfire on AI-builder hosts because the publish AI reads them as prompts. Use the user-voice framing pattern in the [Mode 5 recipe](./recipes/modes/05-plaintext-block.md#how-to-paste-it-on-an-ai-builder-host-recipe-wisdom-from-live-tests) instead.

---

## Verify your profile is reachable

```bash
# Mode 1 — file
curl -I https://your-domain.example/.well-known/agentic-profile.json
# Expect: 200 + content-type: application/json

# Mode 2 — script embed
curl -sSL https://your-domain.example/ | grep -A 30 'application/agentic-profile+json'

# Validate the body against the schema
pip install agentic-first-schema
curl -sS https://your-domain.example/.well-known/agentic-profile.json \
  | agentic-first-validate -
# Expect: PASS
```

For Mode 3, Mode 4, and Mode 5 verification, see the matching mode recipe. The Mode 5 verify pattern is `curl … | sed -e 's/<[^>]*>//g' | grep -F 'agentic-first profile v0.1.0'`.

---

## Submit to the directory

Once your profile validates, register it with the public directory:

```bash
curl -sS -X POST https://directory.agentic-first.co/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"submit_website",
                 "arguments":{"domain":"yourdomain.example"}}}'
```

Or call `submit_website` from any MCP-aware client (Claude Desktop, Cursor, ChatGPT desktop, Codex CLI) pointed at `https://directory.agentic-first.co/mcp`.

---

## Common problems (cross-recipe)

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| `404` on `/.well-known/agentic-profile.json` | Host blocks dotfiles, or framework strips `/.well-known/` from build | Use [Mode 2](./recipes/modes/02-script-embed.md), or front the site with [a Cloudflare Worker](./recipes/modes/01-file-well-known.md). |
| `200` but `Content-Type: text/html` | Host returns the file but with the wrong header | Add an explicit content-type header rule (every host recipe shows the syntax). |
| `submit_website` returns "no profile found" but the file is there | The directory's HTTPS request was rejected (HSTS issue, redirect to non-HTTPS, expired cert) | Run `curl -v` from the directory's perspective and fix the certificate / redirect. |
| `submit_website` returns "schema validation failed" | A required field is missing or a banded value is non-canonical | Run `agentic-first-validate` locally; the error path is the field to fix. |
| `submit_website` returns "rejected pattern in field" | Your prose field tripped one of the [security rules](./security-policy.md#rejected-pattern-list) | Rewrite the offending field to remove the imperative addressed at the reader. |

---

## Available recipes (machine-readable index)

For agent consumption, the full list of recipe files in this directory tree:

```
docs/recipes/
├── modes/
│   ├── 01-file-well-known.md     mode 1 — canonical
│   ├── 02-script-embed.md        mode 2 — script embed
│   ├── 03-hidden-block.md        mode 3 — hidden XML block (soft warning)
│   ├── 04-ai-builder-block.md    mode 4 — visible block for AI-builder hosts (speculative; no current host)
│   └── 05-plaintext-block.md     mode 5 — single-line plain-text colophon in a footer card (soft warning, lowest trust; works on Gamma free / Tome / Beautiful.AI)
└── hosts/
    ├── gamma.md                  Gamma — Mode 1 by fronting custom domain with any static host (Vercel / Netlify / Cloudflare Pages or Workers / Bunny / GitHub Pages / self-hosted), OR Mode 1 via separate static-host subdomain, OR Mode 5 single-line colophon on any plan
    ├── github-pages.md           GitHub Pages — Mode 1
    ├── netlify.md                Netlify — Mode 1
    ├── notion.md                 Notion (Super.so / Potion / Fruition) — Mode 2
    ├── raw-html.md               Apache / Nginx / Caddy / raw VPS — Mode 1
    ├── squarespace.md            Squarespace — Mode 2 (or Mode 1 via Worker)
    ├── vercel.md                 Vercel and Vercel-style frameworks — Mode 1
    ├── webflow.md                Webflow — Mode 2 (or Mode 1 via Worker)
    ├── wix.md                    Wix Premium — Mode 2
    └── wordpress.md              WordPress (managed or self-hosted) — Mode 1 or 2
```

The same list is exposed at the bottom of [`llms.txt`](../llms.txt) as fully-qualified GitHub raw URLs, so coding agents reading the standard from the live site find every recipe directly.
