#!/usr/bin/env bash
# Package the yqup.com standalone release (contact form enabled) from a clean,
# committed tree. Output: deploy/releases/yqup-com-<UTC>.tar.gz + .sha256.
# Deploy only through the ANI lane: ssh yqup-com-deploy-ani deploy <id> <sha256>
# See deploy/yqup-com/README.md.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${APP_DIR}/.." && pwd)"
RELEASE_DIR="${APP_DIR}/deploy/releases"
RELEASE_ID="${1:-yqup-com-$(date -u +%Y%m%dT%H%M%SZ)}"
[[ "${RELEASE_ID}" =~ ^yqup-com-[0-9]{8}T[0-9]{6}Z$ ]] || { echo "bad release id: ${RELEASE_ID}" >&2; exit 64; }

cd "${REPO_ROOT}"
if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean. Commit the built dist/yqup.com first." >&2
  git status --short >&2
  exit 65
fi
COMMIT="$(git rev-parse HEAD)"

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT
STAGE="${WORK}/stage"
mkdir -p "${STAGE}/www" "${STAGE}/infra/caddy/sites"

# Exactly what is committed, nothing from the working tree.
git archive "${COMMIT}" top-level-sites/dist/yqup.com/www | tar -x -C "${WORK}"
cp -R "${WORK}/top-level-sites/dist/yqup.com/www/." "${STAGE}/www/"
git show "${COMMIT}:top-level-sites/deploy/yqup-com/docker-compose.yml" >"${STAGE}/docker-compose.yml"
git show "${COMMIT}:top-level-sites/deploy/yqup-com/yqup.com.caddy" >"${STAGE}/infra/caddy/sites/yqup.com.caddy"

for required in server.mjs index.html healthz matomo-config.json .well-known/agentic-profile.json \
  privacy/index.html contact/yqup-contact.mjs contact/contact-quarantine.mjs contact/contact-smtp.mjs; do
  [ -f "${STAGE}/www/${required}" ] || { echo "missing www/${required}" >&2; exit 65; }
done
grep -F '"contactForm"' "${STAGE}/www/server.mjs" >/dev/null || { echo "server.mjs has no contact route; rebuild" >&2; exit 65; }
grep -F 'id="book-form"' "${STAGE}/www/index.html" >/dev/null || { echo "index.html has no contact form" >&2; exit 65; }
grep -F '"siteId": "5"' "${STAGE}/www/matomo-config.json" >/dev/null || { echo "Matomo site id must be 5" >&2; exit 65; }
for f in "${STAGE}/www/server.mjs" "${STAGE}"/www/contact/*.mjs; do node --check "$f"; done
if grep -RIlE 'SMTP_PASSWORD=.|HASH_SALT=.' "${STAGE}" >/dev/null; then echo "release contains setting values" >&2; exit 65; fi

cat >"${STAGE}/release-manifest.json" <<JSON
{
  "app": "yqup.com",
  "release_id": "${RELEASE_ID}",
  "source_repo": "yqup/agentic-first",
  "source_path": "top-level-sites/dist/yqup.com/www",
  "source_commit": "${COMMIT}",
  "source_dirty": false,
  "packaged_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "lane": "ani-deploy-gate-yqup"
}
JSON

(cd "${STAGE}" && find . -type f ! -name SHA256SUMS | sed 's#^\./##' | LC_ALL=C sort | while IFS= read -r f; do
  printf '%s  %s\n' "$(shasum -a 256 "$f" | awk '{print $1}')" "$f"
done >SHA256SUMS)

mkdir -p "${RELEASE_DIR}"
ARCHIVE="${RELEASE_DIR}/${RELEASE_ID}.tar.gz"
(cd "${STAGE}" && COPYFILE_DISABLE=1 tar --no-xattrs -czf "${ARCHIVE}" docker-compose.yml release-manifest.json SHA256SUMS www infra)
SHA256="$(shasum -a 256 "${ARCHIVE}" | awk '{print $1}')"
printf '%s  %s\n' "${SHA256}" "${RELEASE_ID}.tar.gz" >"${RELEASE_DIR}/${RELEASE_ID}.sha256"
printf 'release_id=%s\narchive=%s\nsha256=%s\nsource_commit=%s\n' "${RELEASE_ID}" "${ARCHIVE}" "${SHA256}" "${COMMIT}"
