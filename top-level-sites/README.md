# Top-Level Sites

One local container per public domain. Gamma-fronting containers keep the
current Gamma design by proxying normal page requests to Gamma. Holding-page
containers serve a local static launch page. Every container serves local
machine-readable files from the owned domain:

- `/.well-known/agentic-profile.json`
- `/healthz`
- `/llms.txt`
- `/robots.txt`
- `/sitemap.xml`
- `/feed.xml`
- `/site.webmanifest`
- `/favicon.svg`
- `/apple-touch-icon.png`

This is the intended deployment shape when DNS A records point these
domains at the server.

## Sites

| Domain | Local port | Service |
| --- | ---: | --- |
| `yqup.com` | `8211` | `yqup_com` |
| `snaxk.com` | `8212` | `snaxk_com` |
| `my-agentic.com` | `8213` | `my_agentic_com` |
| `chiefagenticofficer.com` | `8214` | `chiefagenticofficer_com` |
| `agenticleader.com` | `8215` | `agenticleader_com` |
| `aiperations.com` | `8216` | `aiperations_com` |
| `agenticboard.com` | `8217` | `agenticboard_com` |
| `dilijenz.com` | `8218` | `dilijenz_com` |
| `syndesy.com` | `8219` | `syndesy_com` |
| `orchistra.com` | `8220` | `orchistra_com` |

## Build

Run on AKAAR:

```bash
cd /Users/tonywood/agentic-first/agentic-first
node top-level-sites/build-sites.mjs
node top-level-sites/scripts/check-social-previews.mjs
node top-level-sites/scripts/check-public-discovery.mjs
```

This regenerates:

- `top-level-sites/dist/`
- `top-level-sites/docker-compose.yml`
- `top-level-sites/infra/caddy/sites/*.caddy`

## Change Notes

- [Public page discovery and preview contract](docs/public-page-discovery.md)
- [LinkedIn Open Graph previews](docs/linkedin-open-graph-previews.md)
- [SNAXK country-map refresh](docs/snaxk-country-map-refresh.md)
- [YQUP consulting refresh](docs/yqup-consulting-refresh.md)
- [Orchistra CAO feeder refresh](docs/orchistra-cao-feeder-refresh.md)
- [Chief Agentic Officer briefing signup](docs/chief-agentic-officer-briefing-signup.md)

## Local Container Preview

Run on AKAAR:

```bash
cd /Users/tonywood/agentic-first/agentic-first/top-level-sites
docker compose up -d
```

Preview links:

- <http://127.0.0.1:8211/>
- <http://127.0.0.1:8212/>
- <http://127.0.0.1:8213/>
- <http://127.0.0.1:8214/>
- <http://127.0.0.1:8215/>
- <http://127.0.0.1:8216/>
- <http://127.0.0.1:8217/>
- <http://127.0.0.1:8218/>
- <http://127.0.0.1:8219/>
- <http://127.0.0.1:8220/>

Gamma containers pin the upstream Gamma `Host` header to their own domain,
so those local port previews show the current Gamma design directly. Holding
containers serve their local static launch page.

Stop local preview:

```bash
docker compose down
```

## Server Deployment Shape

Recommended server path:

```text
/srv/apps/top-level-sites/current
```

That directory should contain:

```text
dist/
docker-compose.yml
```

Start the containers on the server:

```bash
cd /srv/apps/top-level-sites/current
docker compose up -d
```

Then apply the generated edge Caddy snippets from:

```text
top-level-sites/infra/caddy/sites/
```

Each public hostname proxies to its own loopback container port.

## DNS Cutover

For each domain:

1. Start the matching container.
2. Apply the matching Caddy snippet.
3. Point the domain's A record at the server.
4. Smoke:

```bash
curl -sS https://yqup.com/healthz
curl -sS https://yqup.com/.well-known/agentic-profile.json
curl -sS https://yqup.com/ | grep -i gamma
```

Once live, submit or queue the domains through the Companies MCP using:

```text
top-level-sites/dist/queue-scan.curl.txt
```
