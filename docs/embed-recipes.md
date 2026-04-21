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

## The four modes

| Mode | Where the profile lives | Use when | Recipe |
| --- | --- | --- | --- |
| **1 — File** *(canonical)* | `https://your-domain/.well-known/agentic-profile.json` | Your host lets you upload arbitrary files at dot-prefixed paths, OR you control a build pipeline that does. | [recipes/modes/01-file-well-known.md](./recipes/modes/01-file-well-known.md) |
| **2 — Script embed** | `<script type="application/agentic-profile+json">` on the home page | Host won't serve dotfiles but lets you inject HTML into `<head>` or page footer. | [recipes/modes/02-script-embed.md](./recipes/modes/02-script-embed.md) |
| **3 — Hidden block** *(soft warning)* | `<div hidden id="agentic-profile" data-format="xml">` anywhere on the page | Host strips `<script>` tags but still allows arbitrary `<div>` content. | [recipes/modes/03-hidden-block.md](./recipes/modes/03-hidden-block.md) |
| **4 — AI-builder block** *(soft warning)* | Visible `<table>` / `<dl>` with embedded host-AI instructions | Host's AI rewrites the page on every save (Gamma, Tome, Beautiful.AI, Framer AI, Wix ADI). | [recipes/modes/04-ai-builder-block.md](./recipes/modes/04-ai-builder-block.md) |

Higher numbers carry a soft warning from the directory because they're harder for reading agents to verify. Use the lowest mode your host supports.

---

## Pick by host

| Host | Recommended | Recipe |
| --- | --- | --- |
| Vercel, Next.js, Astro, Nuxt, Vite, SvelteKit, Hugo, Docusaurus, Gatsby | Mode 1 | [recipes/hosts/vercel.md](./recipes/hosts/vercel.md) |
| Netlify | Mode 1 | [recipes/hosts/netlify.md](./recipes/hosts/netlify.md) |
| GitHub Pages, Jekyll, Eleventy | Mode 1 | [recipes/hosts/github-pages.md](./recipes/hosts/github-pages.md) |
| Apache, Nginx, Caddy, raw VPS, Docker-served static | Mode 1 | [recipes/hosts/raw-html.md](./recipes/hosts/raw-html.md) |
| WordPress (managed or self-hosted) | Mode 2 | [recipes/hosts/wordpress.md](./recipes/hosts/wordpress.md) |
| Squarespace | Mode 2 (or Mode 1 via Cloudflare Worker) | [recipes/hosts/squarespace.md](./recipes/hosts/squarespace.md) |
| Wix | Mode 2 (Premium) | [recipes/hosts/wix.md](./recipes/hosts/wix.md) |
| Webflow | Mode 2 (or Mode 1 via Cloudflare Worker) | [recipes/hosts/webflow.md](./recipes/hosts/webflow.md) |
| Notion (Super.so / Potion / Fruition) | Mode 2 | [recipes/hosts/notion.md](./recipes/hosts/notion.md) |
| Gamma (and other AI-builder hosts) | Mode 4 | [recipes/hosts/gamma.md](./recipes/hosts/gamma.md) |

If your host isn't listed, see "Hosts not in the table" below.

---

## Hosts not in the table

The pattern almost always reduces to one of these four:

| Your situation | What to do |
| --- | --- |
| You have DNS control over your domain | Put a [Cloudflare Worker](./recipes/modes/01-file-well-known.md) in front of any host. Worker serves `/.well-known/agentic-profile.json`, falls through everything else. Universal escape hatch. |
| Your host has a "code injection" or "custom HTML" panel | [Mode 2](./recipes/modes/02-script-embed.md). The WordPress / Squarespace / Wix recipes are good templates. |
| Your host strips `<script>` but allows raw HTML | [Mode 3](./recipes/modes/03-hidden-block.md). |
| Your host runs an AI that rewrites your page on save | [Mode 4](./recipes/modes/04-ai-builder-block.md). The Gamma recipe is the canonical example. |
| None of the above | Publish on a separate static-host subdomain (`profile.your-domain.example` CNAMEd to GitHub Pages or Cloudflare Pages) and submit *that* domain. |

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

**Mode 4: visible structured block, AI-builder hosts** — see the [Mode 4 recipe](./recipes/modes/04-ai-builder-block.md) for the full table pattern with embedded host-AI instructions.

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

For Mode 3 and Mode 4 verification, see the matching mode recipe.

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
│   └── 04-ai-builder-block.md    mode 4 — visible block for AI-builder hosts (soft warning)
└── hosts/
    ├── gamma.md                  Gamma — Mode 4
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
