---
host: notion
host_url: https://www.notion.so
host_kind: cms-via-wrapper
modes_supported: [2, 4]
modes_recommended: 2
status: stable
last_verified: 2026-04-21
gotchas:
  - vanilla_notion_unsupported
  - depends_on_wrapper_super_potion_fruition
  - notion_ai_may_rewrite_blocks
---

# Host recipe — Notion (via Super.so / Potion / Fruition)

> **Vanilla `notion.so/...` URLs cannot host an agentic-first profile** — there is no head-injection or static-file surface. Notion-as-a-website only works through a wrapper service. This recipe covers the three common ones.

## Decision

| Wrapper | Mode | How |
| --- | --- | --- |
| [Super.so](https://super.so) | **2 (embed)** | Site Settings → Code Injection → Head. |
| [Potion](https://potion.so) | **2 (embed)** | Site Settings → Custom Code → Head. |
| [Fruition](https://fruitionsite.com) (DIY Cloudflare Worker) | **1 or 2** | Edit the worker source directly — you own it. |
| Vanilla `notion.so/...` URL | None | Move to a wrapper, or publish the profile on a separate static-host subdomain. |

## Mode 2 recipe (Super.so / Potion)

1. In your wrapper's settings, find the "Code Injection" or "Custom Code → Head" panel.
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

3. Save. Visit your live site; view-source; confirm both tags landed.

## Mode 1 recipe via Fruition

Fruition is an open-source Cloudflare Worker that proxies Notion. Edit `worker.js` directly:

```js
// inside Fruition's worker.js, before the existing handler
if (url.pathname === "/.well-known/agentic-profile.json") {
  return new Response(JSON.stringify({ /* your profile */ }), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=300",
    },
  });
}
```

Redeploy the Worker. The well-known URL goes live immediately.

## Mode 4 fallback (rarely needed)

If you write inside Notion-with-AI-features and find your blocks getting paraphrased on save by Notion AI, the [Mode 4 visible-table pattern](../modes/04-ai-builder-block.md) can be embedded inside a Notion code block (Embed → HTML widget for the Super.so wrapper). This is unusual — most Notion sites don't have an active rewriting AI on the rendered page — but the option exists.

## Verify

```bash
# Mode 2
curl -sSL https://your-notion-site.example/ \
  | grep -A 30 'application/agentic-profile+json'

# Mode 1 (Fruition)
curl -I https://your-notion-site.example/.well-known/agentic-profile.json
```

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| Published URL is `notion.so/...` | Vanilla Notion has no recipe | Move to a wrapper (Super.so, Potion, Fruition) or publish the profile on `profile.your-domain.example` separately. |
| Wrapper's Code Injection saved but tags don't appear | Plan tier doesn't include Code Injection | Upgrade or switch wrappers. |
| The `<script>` block inside a Notion code-block widget renders as visible text on the page | The wrapper escapes raw HTML for safety | Use the wrapper's "Custom Code → Head" panel, not an embedded code-block. |

## Cross-references

- [Mode 1](../modes/01-file-well-known.md), [Mode 2](../modes/02-script-embed.md), [Mode 4](../modes/04-ai-builder-block.md).
- [Squarespace](./squarespace.md), [Webflow](./webflow.md) — sibling closed-CMS recipes.
