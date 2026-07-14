#!/usr/bin/env bash
# Build a portable top-level-sites release archive from AKAAR.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${APP_DIR}/.." && pwd)"
RELEASE_DIR="${APP_DIR}/deploy/releases"
RELEASE_ID="${1:-top-level-sites-$(date -u +%Y%m%dT%H%M%SZ)}"
ARCHIVE="${RELEASE_DIR}/${RELEASE_ID}.tar.gz"

mkdir -p "${RELEASE_DIR}"

cd "${REPO_ROOT}"
node --check top-level-sites/build-sites.mjs
node --check top-level-sites/scripts/check-social-previews.mjs
node --check top-level-sites/scripts/check-public-discovery.mjs
node top-level-sites/build-sites.mjs
node top-level-sites/scripts/check-social-previews.mjs
node top-level-sites/scripts/check-public-discovery.mjs
find top-level-sites/dist -path '*/www/server.mjs' -print0 | xargs -0 -n1 node --check

COPYFILE_DISABLE=1 tar --no-xattrs \
  --exclude='top-level-sites/deploy/releases' \
  -czf "${ARCHIVE}" \
  top-level-sites

SHA256="$(shasum -a 256 "${ARCHIVE}" | awk '{print $1}')"
printf '%s  %s\n' "${SHA256}" "$(basename "${ARCHIVE}")" > "${RELEASE_DIR}/${RELEASE_ID}.sha256"
printf '%s\n' "${RELEASE_ID}" > "${RELEASE_DIR}/latest-release-id.txt"

printf 'release_id=%s\narchive=%s\nsha256=%s\n' "${RELEASE_ID}" "${ARCHIVE}" "${SHA256}"
