# Agentic First static site

This is the top-level Agentic First route map for:

```text
https://agentic-first.co/
```

It intentionally does not contain the product standards, schemas,
validators, examples, skills, MCP service, or product static pages. Those
live in the `pitch-mcp` repo and are exposed under:

```text
https://agentic-first.co/companies/
https://agentic-first.co/directory/
```

`/companies/` is Open Company Information: a way for companies and people to
put public information online so agents can find, verify, and use the right
facts. `/directory/` is the Open Tool Directory: the catalog of agentic tools,
standards, models, runtimes, protocols, and operating patterns.

The favicon is `favicon.svg` at the web root so browsers can load it from
`https://agentic-first.co/favicon.svg`.

Public crawler and preview assets are part of the release contract:

- `robots.txt`
- `sitemap.xml`
- `feed.xml`
- `site.webmanifest`
- `apple-touch-icon.png`
- `icon-192.png`
- `icon-512.png`
- `static/img/agentic-first-social.png`

The social preview image is a dedicated 1200 x 627 PNG and is referenced from
Open Graph, Twitter, and Article JSON-LD metadata in `index.html`. The metadata
is rendered directly in the HTML head, not by JavaScript.

`agent-first.co` is the memorable alternate domain and should redirect
to `agentic-first.co`.
# Analytics

`/static/js/matomo-loader.js` is the cookieless Matomo bootstrap for the public
homepage. The checked-in `/matomo-config.json` enables Matomo Cloud site ID `2`
using only public tracker settings. Keep Matomo API tokens outside git.

The loader calls `disableCookies` before `trackPageView` and does not apply to
MCP/API-only routes.
