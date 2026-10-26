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

## Deployment: Passed

Rootless JENZ static rehearsal `agentic-first-static-039a545ef0d14f68bd0980bfeeb0ef6c`
passed at `2026-10-26T08:05:00Z`: baseline, candidate, restart, synthetic empty
release failure, rollback, re-promotion and data sentinel checks. Its loopback
test server stopped cleanly; no root, Docker or persistent service was used.

The exact archive was then deployed through the existing non-root
`agentic-first-deploy-ani` SSH gate, not a provider terminal:

- Release: `agentic-first-20261026T080000Z`.
- Source: `dfdb91595b05f0684f607b32f091a09330a692cd`.
- Archive SHA256: `5e78ac54788cc61d7253f77df0368a14304560267dc8ea7336b5599931c8ca77`.
- Previous release: `agentic-first-20260714T095359Z`, retained.
- Terminal receipt:
  `/srv/deploy-state/agentic-first/receipts/agentic-first-20261026T080000Z.yaml`.

The gate passed file and 13-homepage-link smokes. Independent crawler-style
verification at `2026-10-26T08:45:24Z` matched the deployed homepage and both
root sitemap files to source, parsed the sitemap index and both children, and
confirmed the anonymous 1200 x 627 PNG preview. The final 13-link rerun passed;
an earlier check during the separate Directory container replacement briefly
saw 502s on those app routes. Root content/metadata, Caddy and DNS did not change.

The Directory is a separate image release in `yqup/pitch-mcp`; this static
receipt does not stand in for its JENZ and ANI receipts. No fresh WhatsApp or
LinkedIn Inspector preview result is claimed.
