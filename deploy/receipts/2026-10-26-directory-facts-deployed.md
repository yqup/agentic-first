# Public Directory Categories And Brand: Deployed

Tony approved the paired public-only release, including company logos and
compact product facts in the Directory. The homepage keeps company information
in its secondary menu and uses eight matching category filters and local Lucide
icons. The AF brand/favicons are included. No login or private research is added.

- Repository: `https://github.com/yqup/agentic-first`, `main`.
- Release: `agentic-first-20261026T172441Z`.
- Source: `ed7502159c39c8ee666782508472304e2040fe7a`.
- Archive SHA256: `cf82ebe512c2be907adff6d073ee6ff3c26cd0e23ff76050cd1751c7f4342a8f`.
- Release: https://github.com/yqup/agentic-first/releases/tag/agentic-first-20261026T172441Z

JENZ rootless static run `agentic-first-static-f958f34f754f436bbd36e73135d8d3da`
passed at `2026-10-26T17:26:22Z`: baseline, candidate, restart, synthetic 404,
sanitised rollback and re-promotion. All 26 candidate files were hash-checked;
the data sentinel was preserved and the loopback fixture stopped. The reviewed
qualifier SHA256 was
`ebfd7ece3a48b49340222e2e58d5f77d7eba27f05de25335aff33c8303fed6dd`;
only its two package identities were pinned by a small wrapper.

Safe fallback: `agentic-first-20261026T152108Z`, SHA256
`9359df943d785795e16b9392e69fedc07d98792c490e03fdafd882e43c25dd68`.
Never restore a historical research-exposing catalogue.

The existing app-specific ANI gate passed at `2026-10-26T17:28:09Z`, including
file smoke and 37 homepage links. Live points to
`/srv/apps/agentic-first/releases/agentic-first-20261026T172441Z`.
Terminal server receipt:
`/srv/deploy-state/agentic-first/receipts/agentic-first-20261026T172441Z.yaml`.
No services restarted; Caddy, DNS, secrets and Directory were unchanged by this
static gate. The Directory was promoted separately through its image gate.

Independent full-site verification passed at `2026-10-26T17:29:34Z`: all 25
served homepage hashes matched and packaged `/README.md` correctly returned
404. The empty v2 catalogue pointer remains empty. Public page-discovery checks
passed locally and live. Eleven homepage/brand/artifact tests passed, as did
`git diff --check`. Mobile category icons loaded without horizontal overflow.

The paired Directory has 145 listings, 117 locally cached official marks and
28 initials fallbacks. Public facts and panels are separate from private
research. Search is deterministic and CPU-only; accounts/research stay disabled.
Both product source commits were pushed before qualification. Closeout
documentation commits are not a new deployment.

Local terminal receipts, immutable archives and the independent public result:
`/private/tmp/agentic-first-facts-20261026T172441Z/`. Live desktop/mobile screenshots:
`/private/tmp/agentic-first-deploy-20261026-evidence/`.
