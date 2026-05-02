---
host: webflow
host_url: https://webflow.com
host_kind: cms
modes_supported: [1-via-worker, 2]
modes_recommended: 2
status: stable
last_verified: 2026-04-21
gotchas:
  - dotfiles_blocked
  - hosting_owned_by_webflow_cdn
---

# Host recipe — Webflow

> **Default to Mode 2 via Project Settings → Custom Code → Head Code.** For Mode 1, put a Cloudflare Worker in front of the Webflow CDN. Webflow's hosting does not allow serving `/.well-known/` files directly.

## Decision

| If you have… | Use mode | How |
| --- | --- | --- |
| Webflow Site Plan + Custom Code | **2 (embed)** | Project Settings → Custom Code → Head Code (project-wide). |
| Cloudflare DNS in front of your Webflow site | **1 (file) via Cloudflare Worker** | Use the Mode 1 Worker recipe. |
| Webflow Free or Starter | Neither — those plans don't have Custom Code | Move to a separate static-host subdomain or upgrade to Site Plan. |

## Mode 2 recipe (recommended)

1. In Webflow Designer: `Project Settings → Custom Code → Head Code`.
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

3. Save. Publish to your custom domain (or `*.webflow.io` for staging).
4. View source on the live site; confirm both tags are in `<head>`.

## Mode 1 via Cloudflare Worker

If your custom domain is on Cloudflare DNS:

```js
// worker.js — same as Squarespace recipe
const PROFILE = JSON.stringify({ /* your profile */ });
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/.well-known/agentic-profile.json") {
      return new Response(PROFILE, {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=300",
        },
      });
    }
    return fetch(request);
  },
};
```

Bind the Worker to `your-domain.example/*`. Webflow continues to serve every other path.

## Verify

```bash
# Mode 2
curl -sSL https://your-webflow-site.example/ \
  | grep -A 30 'application/agentic-profile+json'

# Mode 1 (Worker)
curl -I https://your-webflow-site.example/.well-known/agentic-profile.json
# Expect: 200 + content-type: application/json
```

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| Tags only appear on the published `*.webflow.io` and not the custom domain | Republish required after DNS change | Trigger a fresh publish from Designer → Publish. |
| 404 on the well-known path even with the Worker bound | Worker route excludes `/.well-known/*` | Check the Worker route covers the full path. |
| `<link rel>` rewritten with absolute URL by Webflow | Webflow's CMS-aware HTML parser sometimes rewrites paths | Check view-source and adjust the `href` to the rewritten form, or accept the rewrite (it still works). |

## Cross-references

- [Mode 1](../modes/01-file-well-known.md), [Mode 2](../modes/02-script-embed.md).
- [Squarespace](./squarespace.md), [Wix](./wix.md), [Ghost](./wordpress.md) — sibling closed-CMS recipes.
