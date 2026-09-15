# Orchistra green orchestra deployment

Date: 2026-09-15

## Scope and authority

Tony approved deployment after local review, then clarified that the existing
previously used route should be used. Deployment remained in the Agentic First
top-level-sites public marketing bundle, not the Orchistra Gateway runtime.
No new JENZ route or host infrastructure was installed. No JENZ rehearsal is
claimed by this record.

## Immutable release

- Approved source commit: 0d88c95
- Release: top-level-sites-20260915T130003Z
- SHA-256: a2f1dc5bb8dad5926ad1e66c5a7249feee3f291e9c427a49b464aa899f57ce96
- Previous release: top-level-sites-20260816T152638Z
- Gate: top-level-sites-deploy-ani
- ANI receipt: /srv/deploy-state/top-level-sites/receipts/top-level-sites-20260915T130003Z.yaml
- Gate completion: 2026-09-15T13:01:07Z
- Receipt result: pass

Packaged with deploy/package-release.sh. Local checksum verification passed.
Uploaded only the archive and checksum to the existing staging directory.
Promoted using the root-owned forced-command gate, not a staged shell script.

The gate recreated its managed site containers, passed all loopback health and
profile checks, validated Caddy and wrote the receipt. ChiefAgenticOfficer
remains outside this gate's managed services. The receipt records no DNS or
secret changes. Existing Caddy deprecation/format warnings were non-fatal;
no unrelated Caddy cleanup was attempted.

## Verification

- Clean main checkout, in sync with origin before packaging.
- Build, JavaScript syntax, social-preview and public-discovery checks passed.
- Archive path check found no environment files, key files or Git directories.
- Other-site metadata matches the previously deployed source d4be644.
- Anonymous LinkedInBot-style requests returned 200 on apex and www homepages.
- Both expose the new control-panel title, country-orchestra hero and daylight.
- Public desktop/mobile hero, CSS and JS SHA-256 hashes match local release files.
- Canonical and og:url use https://orchistra.com/.
- Open Graph and Twitter metadata present; image URLs agree.
- Both public social PNGs return 200, measure 1200 x 627, and are 236877 bytes.
- Health, profile, llms.txt, sitemap, robots and feed endpoints return 200 on both hosts.

LinkedIn Post Inspector and a newly composed WhatsApp preview were not tested
in this deployment run. Existing cached posts/messages may retain older previews.
No social post or message was published.

## Rollback reference

Previous ANI release and receipt remain the rollback reference. Use the
existing app-specific gate and its documented supported rollback procedure;
do not manually move symlinks, alter permissions or run Docker as an operator.
