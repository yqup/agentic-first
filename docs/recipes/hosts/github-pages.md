---
host: github-pages
host_url: https://pages.github.com
host_kind: static-host
modes_supported: [1]
modes_recommended: 1
status: stable
last_verified: 2026-04-21
gotchas:
  - jekyll_excludes_dotfiles_by_default
  - actions_publish_path_for_user_pages
---

# Host recipe — GitHub Pages

> **Mode 1.** Drop the file at the repo root. If you're on Jekyll (the default GitHub Pages builder), you must explicitly tell it to copy the dot-prefixed directory.

## The recipe (no Jekyll, plain static)

1. Place the file at the repo root:

   ```
   .well-known/agentic-profile.json
   ```

2. If your repo has a `.nojekyll` file at the root, skip step 3 — `.nojekyll` disables the Jekyll build and GitHub Pages serves files verbatim.

3. Otherwise (Jekyll active), add to `_config.yml`:

   ```yaml
   include:
     - .well-known
   ```

   Without this line Jekyll silently excludes any directory starting with `.` from the build output. Symptom: 404 on the well-known URL even though the file is in the repo.

4. `git push`. GitHub Pages serves the file at `https://<user>.github.io/<repo>/.well-known/agentic-profile.json`, or at your custom domain if configured.

## The recipe (GitHub Actions custom build)

If you use a GitHub Actions workflow to build and deploy (Hugo, Eleventy, Astro, etc.), make sure your build copies `static/.well-known/` (or framework equivalent) into the artifact directory uploaded by `actions/upload-pages-artifact`. Most frameworks' static-passthrough does this automatically.

## Custom domain

If you've configured a custom domain (`CNAME` file at the repo root), the well-known URL is `https://your-domain.example/.well-known/agentic-profile.json`. Submit your custom domain to the directory, not the `*.github.io` URL — the directory binds the profile to whatever domain you submit.

## Verify

```bash
# Custom domain
curl -I https://your-domain.example/.well-known/agentic-profile.json

# *.github.io path
curl -I https://your-username.github.io/your-repo/.well-known/agentic-profile.json
```

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `404` even though the file is in the repo | Jekyll excluded `.well-known/` from the build | Add `include: [.well-known]` to `_config.yml`, or add an empty `.nojekyll` file at the root. |
| `Content-Type: text/html` instead of `application/json` | GitHub Pages misidentifies the file | Confirm the file extension is exactly `.json`. GH Pages infers the type from the extension. |
| Working at `username.github.io/repo` but `404` at custom domain | DNS or `CNAME` file misconfigured | `dig CNAME your-domain.example` should point at `<user>.github.io.`. Wait for DNS propagation. |
| User-Pages site (`<user>.github.io`) doesn't serve the dot-folder | Jekyll-on-by-default + missing include | Same fix: `include: [.well-known]` or `.nojekyll`. |

## Cross-references

- [Mode 1](../modes/01-file-well-known.md).
- [Vercel](./vercel.md), [Netlify](./netlify.md), [Cloudflare Pages](./vercel.md) — sibling static-host recipes.
- [Raw HTML / VPS](./raw-html.md) for Apache, Nginx, Caddy.
