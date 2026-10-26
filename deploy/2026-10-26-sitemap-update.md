# Root sitemap update, 26 October 2026

Tony requested publication alongside the 13-entry Directory integration in
`yqup/pitch-mcp`. The root site owns this sitemap and uses its own static gate.

`www/sitemap.xml` is now a standard sitemap index with two children:
`https://agentic-first.co/sitemap-pages.xml` and
`https://agentic-first.co/directory/sitemap.xml`. The local child retains the
homepage and Companies URLs. Their page lastmod dates are omitted because no
current page-change evidence was reviewed; index dates describe changed sitemap
files. The Directory generator preserves its catalogue and comparison dates.

The existing public-discovery check parses both root XML files and requires the
Directory sub-sitemap. The release manifest now checks the new local child.
Local public-discovery and all 13 homepage link checks passed. Homepage content,
canonical URL, previews, agent discovery, Caddy and DNS are unchanged.

Deployment is pending the JENZ static lifecycle rehearsal and normal root-site
gate. The terminal release identity and public checks will be appended after
verification; this preparation note is not a production receipt.
