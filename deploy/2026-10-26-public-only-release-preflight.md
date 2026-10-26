# Search-First Homepage: Release Preflight

Historical preflight. The hold below was superseded by the approved installation,
JENZ qualification and [terminal public-only release](receipts/2026-10-26-public-only-deployed.md).

26 October 2026, AKAAR. Tony approved documenting, committing, pushing and
deploying the public directory experience. The reviewed homepage source is
`25017401883037b35d8e0d4b3418caba003c8673` on `yqup/agentic-first` main.

The homepage has eight European-tool category links and browser-only search.
Open Company Information is available only through More. There is no login,
member-access prompt or copied research catalogue. The release manifest now
checks the approved search heading and v2 machine index rather than retired text.
An unquoted colon in the robots smoke was also corrected so the YAML parses.

Local homepage/artifact tests: 6 passed. The paired Directory deployment suite
has 14 passing tests, including YAML parsing and every homepage smoke against
its packaged static file. The public metadata check and paired
Directory research-boundary scan pass. Both repositories were fetched and matched
origin before preparation. There are no open homepage PRs; Directory PRs 1 and 2
are merged and its branch has no open PRs.

## Deployment Order And Blocker

Do not deploy this homepage before the paired Directory. Its stylesheet,
countryside image and search module are served under `/directory/assets/`.
The Directory's old host gate checks public research and restores an older,
research-exposing image on failure. It needs an operator-reviewed public-only
smoke and sanitised-rollback migration before either paired release is promoted.
The detailed private handoff is in `yqup/pitch-mcp`,
`deploy/2026-10-26-public-only-release-preflight.md`.

Build with `python3 deploy/build-public-release.py --release RELEASE --output PATH`;
only the allowlisted public files enter the homepage archive. Check its extracted
web root against the research-boundary scanner before publishing. A source
archive/checksum alone is not a JENZ rehearsal or ANI deployment receipt.

Keep this repository's current visibility and static delivery unchanged for this
sanitised public-only release. No private delivery migration, Supabase, SMTP,
credentials, permissions, Caddy or DNS change is required here.

Status: local checks passed; no static deployment was started. After the Directory
gate migration, rehearse both sanitised releases on JENZ, promote the exact
qualified Directory image, verify its assets, then use the existing restricted
homepage static gate. Record both terminal receipts and independent public checks.

## Prepared Homepage Package

- Package: `agentic-first-20261026T113329Z.tar.gz`.
- Source commit: `70a3b197ebd8dd861ceb8893505e8734bb70fe71`.
- SHA256: `933db5acfb3fd8ee2ef1efd2e3f6f15b098c5554ef701355435cd73e0cbd2b1e`.
- Private temporary location: `/private/tmp/agentic-first-public-release.natzUk`.
- Built with the public-only builder. The extracted web root passed the paired
  research-boundary scan; its adjacent checksum sidecar verifies.
- Not uploaded, rehearsed or deployed. Temporary storage is not a durable release
  registry, and the current production site remains unchanged.
