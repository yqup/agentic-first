#!/usr/bin/env bash
# Install top-level site containers on ANI.
#
# Run as root from an ANI root/provider console or an approved root deploy
# gate. The script is idempotent: it creates a timestamped release, updates
# the current symlink, starts one loopback-only container per site, installs
# Caddy route fragments with backups, validates Caddy, reloads Caddy, and
# writes a receipt.
set -euo pipefail

APP_NAME="top-level-sites"
EXPECTED_HOSTNAME="srv1339660"
RELEASE_ID="${1:?usage: install-on-ani.sh <release-id> <archive-path>}"
ARCHIVE_PATH="${2:?usage: install-on-ani.sh <release-id> <archive-path>}"

APP_ROOT="/srv/apps/${APP_NAME}"
RELEASES_DIR="${APP_ROOT}/releases"
CURRENT_LINK="${APP_ROOT}/current"
RECEIPTS_DIR="/srv/deploy-state/${APP_NAME}/receipts"
CADDY_SITES_DIR="/etc/caddy/sites"
CADDY_BACKUP_DIR="/etc/caddy/sites.backups/${RELEASE_ID}"

DOMAINS=(
  yqup.com
  snaxk.com
  my-agentic.com
  chiefagenticofficer.com
  agenticleader.com
  aiperations.com
  agenticboard.com
  dilijenz.com
  syndesy.com
  orchistra.com
)

PORTS=(8211 8212 8213 8214 8215 8216 8217 8218 8219 8220)

say() { printf '==> %s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "must run as root"
[ "$(hostname)" = "${EXPECTED_HOSTNAME}" ] || fail "wrong host: expected ${EXPECTED_HOSTNAME}, got $(hostname)"
[ -f "${ARCHIVE_PATH}" ] || fail "archive not found: ${ARCHIVE_PATH}"
command -v docker >/dev/null 2>&1 || fail "docker is not installed"
docker compose version >/dev/null 2>&1 || fail "docker compose plugin is not available"
command -v caddy >/dev/null 2>&1 || fail "caddy is not installed"

RELEASE_DIR="${RELEASES_DIR}/${RELEASE_ID}"
WORK_DIR="$(mktemp -d)"
cleanup() { rm -rf "${WORK_DIR}"; }
trap cleanup EXIT

say "Create release directory"
mkdir -p "${RELEASES_DIR}" "${RECEIPTS_DIR}" "${CADDY_BACKUP_DIR}"
rm -rf "${RELEASE_DIR}"
mkdir -p "${RELEASE_DIR}"

say "Extract archive"
tar -xzf "${ARCHIVE_PATH}" -C "${WORK_DIR}"
if [ -d "${WORK_DIR}/top-level-sites" ]; then
  cp -a "${WORK_DIR}/top-level-sites/." "${RELEASE_DIR}/"
else
  cp -a "${WORK_DIR}/." "${RELEASE_DIR}/"
fi

[ -f "${RELEASE_DIR}/docker-compose.yml" ] || fail "release missing docker-compose.yml"
[ -d "${RELEASE_DIR}/dist" ] || fail "release missing dist/"
[ -d "${RELEASE_DIR}/infra/caddy/sites" ] || fail "release missing infra/caddy/sites/"

say "Update current symlink"
ln -sfn "${RELEASE_DIR}" "${CURRENT_LINK}"

say "Start per-site containers"
cd "${CURRENT_LINK}"
docker compose up -d --remove-orphans

say "Smoke loopback containers"
for i in "${!DOMAINS[@]}"; do
  domain="${DOMAINS[$i]}"
  port="${PORTS[$i]}"
  curl -fsS --max-time 5 "http://127.0.0.1:${port}/healthz" | grep -q '"status":"ok"' \
    || fail "${domain} healthz failed on port ${port}"
  curl -fsS --max-time 5 "http://127.0.0.1:${port}/.well-known/agentic-profile.json" | grep -q "\"website\": \"https://${domain}\"" \
    || fail "${domain} agentic profile failed on port ${port}"
done

say "Install Caddy route fragments with backups"
for domain in "${DOMAINS[@]}"; do
  src="${CURRENT_LINK}/infra/caddy/sites/${domain}.caddy"
  dest="${CADDY_SITES_DIR}/${domain}.caddy"
  [ -f "${src}" ] || fail "missing generated Caddy fragment: ${src}"
  if [ -f "${dest}" ]; then
    cp -a "${dest}" "${CADDY_BACKUP_DIR}/${domain}.caddy"
  fi
  install -o root -g caddy -m 0640 "${src}" "${dest}"
done

say "Prepare Caddy access logs"
mkdir -p /var/log/caddy
for domain in "${DOMAINS[@]}"; do
  touch "/var/log/caddy/${domain}.access.log"
  chown caddy:caddy "/var/log/caddy/${domain}.access.log"
  chmod 0644 "/var/log/caddy/${domain}.access.log"
done

say "Validate Caddy"
caddy validate --config /etc/caddy/Caddyfile

say "Reload Caddy"
if systemctl is-active --quiet caddy.service; then
  systemctl reload caddy.service
else
  caddy reload --config /etc/caddy/Caddyfile --force
fi

say "Write receipt"
{
  echo "release_id: ${RELEASE_ID}"
  echo "installed_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "host: $(hostname)"
  echo "archive: ${ARCHIVE_PATH}"
  echo "app_root: ${APP_ROOT}"
  echo "current: ${CURRENT_LINK}"
  echo "domains:"
  for i in "${!DOMAINS[@]}"; do
    echo "  - domain: ${DOMAINS[$i]}"
    echo "    port: ${PORTS[$i]}"
    echo "    healthz: http://127.0.0.1:${PORTS[$i]}/healthz"
  done
  echo "caddy_backup_dir: ${CADDY_BACKUP_DIR}"
} > "${RECEIPTS_DIR}/${RELEASE_ID}.yaml"

say "Done. Caddy routes and containers are ready. Point DNS A records at ANI, then run public HTTPS smokes."
