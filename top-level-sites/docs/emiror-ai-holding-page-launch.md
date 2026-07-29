# Emiror AI holding-page launch

## Public change

The port `8216` top-level-site slot moves from `aiperations.com` to
`emirorai.com`. The new public page is a deliberately minimal holding page:

- Emiror AI wordmark and mark
- New Hope, Pennsylvania countryside artwork
- “We’re working on something.”
- “Come back soon.”

There is no public form, email address, advisory strip, or trading claim.
Matomo site ID `10` remains attached to the slot for aggregate page-view logs.

## Deployment

Build and package from the authoritative ROKY workspace:

```bash
cd /Users/tonywood/agentic-first/agentic-first
./top-level-sites/deploy/package-release.sh
```

The ANI app-scoped top-level-sites gate must be updated before invoking the
release because its allowlist, service name, profile validation, and generated
Caddy route all bind to the public hostname.

## Rollback

Before deployment, record the current release symlink and latest passing
receipt. The pre-launch rollback target captured on 2026-07-28 was:

```text
top-level-sites-20260714T094217Z
```

The old `aiperations.com.caddy` fragment may remain temporarily as a legacy
bridge to port `8216`; it is not part of the new release allowlist. Remove or
redirect it only in a separately reviewed Caddy change.

## Verification

Verify all of the following:

```bash
curl -fsS https://emirorai.com/healthz
curl -fsS https://emirorai.com/.well-known/agentic-profile.json
curl -fsS https://emirorai.com/matomo-config.json
curl -fsS https://emirorai.com/ | grep -F "We&rsquo;re working"
curl -fsS https://www.emirorai.com/healthz
```

Confirm the public page contains no email address, contact form, or TonyWood
advisory strip, and that the Matomo loader is present.

## Live deployment

The holding page went live on ANI on 2026-07-28 through the app-scoped
forced-command gate.

```text
release: top-level-sites-20260728T191406Z
digest: e28519c1c422da31ce58f68f4e8d9af00c231e912d496d36bf87af1fb3b7fdea
source commit: a757106
receipt: /srv/deploy-state/top-level-sites/receipts/top-level-sites-20260728T191406Z.yaml
result: pass
rollback release: top-level-sites-20260714T094217Z
```

Post-deploy checks confirmed the `site-emirorai_com` container on loopback port
`8216`, removal of `site-aiperations_com`, valid Caddy configuration, public
HTTPS health on the apex and `www` hostnames, and Matomo site ID `10` bound to
both hostnames.

## Matomo account registration

On 2026-07-29, the Matomo account entry for site ID `10` was updated from the
retired `aiperations.com` property to:

```text
name: Emiror AI
main URL: https://emirorai.com
alias URL: https://www.emirorai.com
```

The public page already contained the shared deferred cookieless loader and
served `/matomo-config.json` with site ID `10`, so no website release was
required for this account-side correction.

Verification:

- the public Matomo surface checker passed;
- the Matomo API returned both apex and `www` URLs for site ID `10`;
- one privacy-safe synthetic Emiror AI pageview was accepted by
  `matomo.php` with HTTP `204`;
- no token, visitor log, IP address, heatmap, or session recording was exposed.

Three historical AIPerations goal definitions remain attached to the reused
site ID. The current Emiror AI holding page has no matching calls to action, so
those goals cannot be triggered by the live page. They were retained to avoid
destructive alteration of historical analytics.
