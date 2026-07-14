# Public Page Discovery QA

Date: 2026-07-14

Scope: Agentic First top-level static homepage at `https://agentic-first.co/`.

## Change

Added a crawler and social-preview release contract for the homepage:

- canonical URL, Open Graph, Twitter card, and Article JSON-LD metadata rendered directly in `www/index.html`
- dedicated 1200 x 627 PNG social preview at `www/static/img/agentic-first-social.png`
- public discovery files: `robots.txt`, `sitemap.xml`, `feed.xml`, `site.webmanifest`, Apple touch icon, and PNG app icons
- explicit `llms.txt` safety note that public agent discovery does not grant authority
- local and optional live crawler QA in `deploy/check-public-page-discovery.py`

## QA Contract

Run before packaging homepage changes:

```bash
python3 deploy/check-public-page-discovery.py --root www
python3 deploy/check-homepage-links.py --root www
```

Run after deployment when network access is available:

```bash
python3 deploy/check-public-page-discovery.py --root www --live-url https://agentic-first.co/
```

Then test a new WhatsApp share and the LinkedIn Post Inspector. Existing social
posts and messages should be treated as stale because crawler previews are
usually cached.

## Boundary

This change does not grant authority through `llms.txt`, MCP, A2A, or other
agent-facing discovery. Public discovery is informational only.
