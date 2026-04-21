---
host: vercel
host_url: https://vercel.com
host_kind: static-host
modes_supported: [1]
modes_recommended: 1
status: stable
last_verified: 2026-04-21
gotchas:
  - framework_specific_static_dir
---

# Host recipe — Vercel

> **Mode 1, full stop.** Vercel serves any file under `public/` (or `static/` depending on framework) verbatim. Drop the JSON in, redeploy, done.

## The recipe

1. Place the file at the right path for your framework:

   | Framework | Path |
   | --- | --- |
   | Next.js, Nuxt, SvelteKit, Astro, Docusaurus, Vite, Gatsby | `public/.well-known/agentic-profile.json` |
   | Remix | `public/.well-known/agentic-profile.json` |
   | Plain static / Hugo | `static/.well-known/agentic-profile.json` |
   | Eleventy | `src/.well-known/agentic-profile.json` PLUS `eleventyConfig.addPassthroughCopy(".well-known")` |

2. Optional: pin the content type and a sane cache policy in `vercel.json`:

   ```json
   {
     "headers": [
       {
         "source": "/.well-known/agentic-profile.json",
         "headers": [
           { "key": "Content-Type",  "value": "application/json" },
           { "key": "Cache-Control", "value": "public, max-age=300" }
         ]
       }
     ]
   }
   ```

3. `git push` (or `vercel deploy`). The well-known URL is live immediately.

## Verify

```bash
curl -I https://your-vercel-app.example/.well-known/agentic-profile.json
# Expect: 200 + content-type: application/json
```

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `404` on the well-known path | File is in `static/` but framework expects `public/` (or vice versa) | Move it to the framework's expected static-passthrough directory. |
| `200` but `text/html` | A catch-all route in your app handles `/.well-known/*` | Add an explicit route ahead of the catch-all that serves the file with the right header, or use the `vercel.json` headers block. |
| File missing from build output | `.well-known` excluded by `.vercelignore` | Remove the entry; redeploy. |

## Cross-references

- [Mode 1](../modes/01-file-well-known.md).
- [Netlify](./netlify.md), [GitHub Pages](./github-pages.md) — sibling static-host recipes.
