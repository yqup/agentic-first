---
host: squarespace
host_url: https://www.squarespace.com
host_kind: cms
modes_supported: [1-via-worker, 2]
modes_recommended: 2
status: stable
last_verified: 2026-04-21
gotchas:
  - dotfiles_blocked
  - serializer_strips_link_rel_sometimes
  - wrong_content_type_via_url_mappings
---

# Host recipe — Squarespace

> **Default to Mode 2 via Code Injection.** For a robust Mode 1, put your domain behind Cloudflare and run the Worker recipe. Squarespace itself does not let you serve `/.well-known/` files.

## Decision

| If you have… | Use mode | How |
| --- | --- | --- |
| Cloudflare DNS in front of your Squarespace site | **1 (file) via Cloudflare Worker** | Deploy the Worker recipe (best). Get the canonical URL with no Squarespace surgery. |
| Squarespace admin only | **2 (embed)** | Settings → Advanced → Code Injection → HEADER. |
| You want a separate static-host subdomain | **1 (file)** on `profile.your-domain.example` | Publish the file from GitHub Pages / Cloudflare Pages and submit the subdomain. |

## Mode 2 recipe (recommended for non-Cloudflare users)

1. In Squarespace admin: `Settings → Advanced → Code Injection → HEADER`.
2. Paste:

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

3. Save. Visit your home page; view source; confirm both tags landed.

The `<link rel="agentic-profile">` tag may not survive Squarespace's HTML serializer on every theme — check view-source to verify. The `<script>` tag is the load-bearing piece; if only that survives, you're still good.

## Mode 1 via Cloudflare Worker (most robust)

If your domain DNS goes through Cloudflare:

```js
// worker.js
const PROFILE = JSON.stringify({
  schema_version: "0.1.0",
  updated_at: "2026-04-19T12:00:00Z",
  profile_kind: "company",
  tier: "public",
  company: {
    name: "Acme Robotics",
    website: "https://acme-robotics.example",
    jurisdiction: "GB"
  }
});

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/.well-known/agentic-profile.json") {
      return new Response(PROFILE, {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=300",
          "access-control-allow-origin": "*",
        },
      });
    }
    return fetch(request);
  },
};
```

Deploy with `wrangler deploy`. Bind the Worker to your domain at `your-domain.example/*`. Squarespace continues to handle every other path; the Worker handles only the well-known.

## URL Mapping fallback (worst of the three, last resort)

`Settings → Advanced → URL Mappings`:

```
/.well-known/agentic-profile.json -> /agentic-profile-page 301
```

Then create a normal Squarespace page at `/agentic-profile-page` containing a single Code Block holding the JSON. The directory accepts this with a soft warning because the served `Content-Type` will be `text/html`, not `application/json`.

## Verify

```bash
# Mode 2 (Code Injection)
curl -sSL https://your-squarespace-site.example/ \
  | grep -A 30 'application/agentic-profile+json'

# Mode 1 (Cloudflare Worker)
curl -I https://your-squarespace-site.example/.well-known/agentic-profile.json
# Expect: 200 + content-type: application/json
```

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `<link rel="agentic-profile">` missing from view-source | Squarespace template stripped it | Move the `<link>` into a separate Code Injection injection point (`HEADER` not `FOOTER`). The `<script>` block is sufficient on its own. |
| URL Mapping returns 200 but content-type is `text/html` | URL Mappings always serve through the page renderer | Live with the soft warning, or switch to the Worker recipe. |
| JSON inside the Code Block has curly quotes | Squarespace's text editor mangled the paste | Paste into a Code Block (raw HTML), never into a Text Block. |
| You're on Squarespace 5 (legacy) | Different admin layout | Code Injection lives under `Settings → Code Injection` directly, not under `Advanced`. Same paste pattern. |

## Cross-references

- [Mode 1](../modes/01-file-well-known.md), [Mode 2](../modes/02-script-embed.md).
- [Webflow](./webflow.md), [Wix](./wix.md) — sibling closed-CMS recipes.
