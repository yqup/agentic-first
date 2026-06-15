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

`agent-first.co` is the memorable alternate domain and should redirect
to `agentic-first.co`.
# Analytics

`/static/js/matomo-loader.js` is the cookieless Matomo bootstrap for the public
homepage. The checked-in `/matomo-config.json` enables Matomo Cloud site ID `2`
using only public tracker settings. Keep Matomo API tokens outside git.

The loader calls `disableCookies` before `trackPageView` and does not apply to
MCP/API-only routes.
