---
host: netlify
host_url: https://www.netlify.com
host_kind: static-host
modes_supported: [1]
modes_recommended: 1
status: stable
last_verified: 2026-04-21
gotchas:
  - explicit_headers_required_for_content_type
---

# Host recipe — Netlify

> **Mode 1.** Netlify needs an explicit `_headers` rule to set the right `Content-Type`; without it the file serves as `application/octet-stream` on some configurations.

## The recipe

1. Place the file:

   | Framework | Path |
   | --- | --- |
   | Plain static, Eleventy, Hugo (with `static/`) | `static/.well-known/agentic-profile.json` |
   | Astro, Next.js, Nuxt | `public/.well-known/agentic-profile.json` |
   | Jekyll | `.well-known/agentic-profile.json` (root) PLUS `include: [.well-known]` in `_config.yml` |
   | Gatsby | `static/.well-known/agentic-profile.json` |

2. Add a `_headers` file at the same level as your built `index.html`:

   ```
   /.well-known/agentic-profile.json
     Content-Type: application/json
     Cache-Control: public, max-age=300
     Access-Control-Allow-Origin: *
   ```

3. `git push`. Netlify rebuilds and serves.

## Verify

```bash
curl -I https://your-netlify-site.example/.well-known/agentic-profile.json
# Expect: 200 + content-type: application/json
```

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Content-Type: application/octet-stream` | Missing `_headers` rule | Add the `_headers` block above. Trigger a redeploy. |
| `404` after deploy | Build excluded the dot-prefixed directory | Check Netlify build logs; ensure your framework's static-passthrough is configured. For Jekyll, the `include:` line is mandatory. |
| `200` but file is empty | The build minified or stripped a JSON file | Disable any "asset optimisation" Netlify setting for `*.json`. |

## Cross-references

- [Mode 1](../modes/01-file-well-known.md).
- [Vercel](./vercel.md), [GitHub Pages](./github-pages.md) — sibling static-host recipes.
