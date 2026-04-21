---
host: wix
host_url: https://www.wix.com
host_kind: cms
modes_supported: [1-via-velo, 2]
modes_recommended: 2
status: stable
last_verified: 2026-04-21
plan_required: Premium (for Custom Code)
gotchas:
  - custom_code_requires_premium_plan
  - velo_required_for_proper_content_type
---

# Host recipe — Wix

> **Default to Mode 2 via Custom Code → Head.** For a proper Mode 1 with the right `Content-Type`, use a Velo HTTP function. The Custom Code panel requires a Premium plan.

## Decision

| If you have… | Use mode | How |
| --- | --- | --- |
| Wix Premium with Custom Code enabled | **2 (embed)** | Settings → Custom Code → Add Custom Code → Head, all pages. |
| Wix with Velo (developer mode) enabled | **1 (file)** via an `http-functions.js` route | Best for the right `Content-Type`. |
| Wix Free | Neither — the free plan doesn't expose custom code | Move to a separate static-host subdomain or upgrade. |

## Mode 2 recipe (recommended)

1. In Wix admin: `Settings → Custom Code → + Add Custom Code`.
2. Name it "agentic-first profile".
3. Paste:

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

4. Place code in: **Head**.
5. Add code to pages: **All pages** + **Load code once**.
6. Apply.

Verify by view-source on the published site.

## Mode 1 recipe via Velo

If you've enabled Velo (Wix's developer mode):

1. Create `backend/http-functions.js` if it doesn't exist.
2. Add:

   ```javascript
   import { ok } from 'wix-http-functions';

   const PROFILE = {
     schema_version: "0.1.0",
     updated_at: "2026-04-19T12:00:00Z",
     profile_kind: "company",
     tier: "public",
     company: {
       name: "Acme Robotics",
       website: "https://acme-robotics.example",
       jurisdiction: "GB"
     }
   };

   export function get_agenticProfile(request) {
     return ok({
       headers: { "content-type": "application/json" },
       body: JSON.stringify(PROFILE),
     });
   }
   ```

3. The function is exposed at `https://your-wix-site.example/_functions/agenticProfile`.
4. Add a URL redirect (or DNS-level redirect via Cloudflare) from `/.well-known/agentic-profile.json` to `/_functions/agenticProfile`. Wix doesn't let you serve dot-prefixed paths directly — the redirect is the workaround.

If you can put Cloudflare in front of the Wix domain, prefer the Cloudflare Worker recipe in [Mode 1](../modes/01-file-well-known.md) and skip the Velo dance.

## Verify

```bash
# Mode 2
curl -sSL https://your-wix-site.example/ \
  | grep -A 30 'application/agentic-profile+json'

# Mode 1 via Velo
curl -I https://your-wix-site.example/_functions/agenticProfile
# Expect: 200 + content-type: application/json
```

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| Custom Code panel is locked | Free plan or Combo plan | Upgrade to Unlimited or higher; or use the Cloudflare Worker route. |
| `<script>` body is HTML-entity-encoded in view-source | Wix sanitised the paste | Re-paste into the Custom Code panel exactly — don't use the WYSIWYG content editor. |
| Velo function returns 404 | Function name doesn't match the route prefix | Function must be named `get_<routeName>` to expose `/_functions/<routeName>`. |
| The well-known URL still 404s after Velo deploy | Wix doesn't proxy dotted paths to Velo | Front the domain with Cloudflare and add a Worker route, or accept submission against the `_functions` URL. |

## Cross-references

- [Mode 1](../modes/01-file-well-known.md), [Mode 2](../modes/02-script-embed.md).
- [Squarespace](./squarespace.md), [Webflow](./webflow.md) — sibling closed-CMS recipes.
