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
