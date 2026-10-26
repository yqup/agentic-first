# Brand And Expanded Search: Source Ready

26 October 2026. Tony requested a new logo/favicon during the paired Directory
research integration. This is a local source/preview receipt, not deployment.

- Generated one transparent AF mark using built-in ImageGen; original retained
  in `brand-assets/agentic-first-mark-master.png` with prompt/export documentation.
- Updated the homepage header, self-contained SVG favicon, PNG/ICO fallback,
  app icons and manifest colours. The mark is mirrored into the Directory's
  own release root. Header text stays accessible live text, not raster text.
- Added a standard-library/macOS-sips export helper; no production dependency.
  Existing preview generation calls that helper instead of replacing the mark
  with the retired route-map icons. The release includes helper and master.
- Updated brand guidance to the current forest/sage/rose identity.
- Stylesheet and favicon references are versioned to avoid stale browser assets.
- Paired Directory source contains 145 low-information listings, including ten
  additions from private research `dd2b2ae`. Prices/assessments remain unpublished.
- Local desktop 1280x720 and phone 390x844 checks passed for the brand, homepage
  search, OpenAI alternatives, Hostinger and AWS; no app warnings or overflow.
- Homepage/artifact tests, four brand-export tests and local metadata checks
  passed. Detailed paired checks are in the private Directory admission review.
- Final paired totals: 383 app, 86 deployment/operator, eight CPU-search, eleven
  research and ten homepage/artifact/brand tests (498 passed). All 29 homepage
  links, including the new root favicon URLs, passed after restarting only the
  local preview to register new files. Ruff and both diff checks passed.

The loopback preview is `http://127.0.0.1:8094/`. No ANI/JENZ change, new runtime
path, Caddy/DNS/secret edit or production deployment occurred for this update.
