# ANI Deploy

This directory contains the privileged installer for the top-level site
containers, including Gamma-fronting sites and static holding pages.

The normal Codex SSH identity on ANI cannot run Docker or write Caddy
routes. Use a root/provider console or an approved root deploy gate.

## Staged Layout

Upload these to ANI:

```text
/home/ani-cursor/top-level-sites-staging/
  top-level-sites-<timestamp>.tar.gz
  top-level-sites-<timestamp>.sha256
  install-on-ani.sh
```

## Run On ANI As Root

```bash
cd /home/ani-cursor/top-level-sites-staging
sha256sum -c top-level-sites-<timestamp>.sha256
bash install-on-ani.sh top-level-sites-<timestamp> "$PWD/top-level-sites-<timestamp>.tar.gz"
```

The installer:

- host-checks ANI (`srv1339660`)
- extracts to `/srv/apps/top-level-sites/releases/<release-id>`
- updates `/srv/apps/top-level-sites/current`
- starts one container per site on `127.0.0.1:8211` through `8220`
- installs `/etc/caddy/sites/<domain>.caddy` with backups
- validates and reloads Caddy
- writes a receipt under `/srv/deploy-state/top-level-sites/receipts/`

## DNS

Do not change DNS until the installer finishes successfully.

After it succeeds, point each domain's A record at ANI. If `www` hostnames are
kept in the generated Caddy snippets, point each `www` hostname at ANI too, or
make it a CNAME to the apex hostname.
