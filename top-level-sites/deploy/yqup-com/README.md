# yqup.com standalone lane (contact form)

yqup.com is built here with the other top-level sites (`build-sites.mjs`,
`sites.json`), but from the cutover onward it is deployed on its own ANI lane,
modelled on the snaxk.com lane of 19 October 2026:

- gate: `ani-deploy-gate-yqup` (server-admin-ani `operations/yqup-com-standalone-lane.md`)
- deploy identity: `yqup-com-deploy`, ROKY ssh alias `yqup-com-deploy-ani`
- compose project / container: `yqup-com` / `site-yqup_com`, loopback `127.0.0.1:8211`
- Matomo site 5, Caddy fragment `yqup.com.caddy` (apex and www both proxied, as before)

The shared top-level-sites gate ignores `dist/yqup.com` after the cutover.

## Contact form

`pages/yqup/contact/yqup-contact.mjs` (plus unchanged copies of the CAO
`contact-quarantine.mjs` and `contact-smtp.mjs`) is copied to
`dist/yqup.com/www/contact/` and loaded lazily by `server.mjs` for
`/api/contact/token` and `/api/contact`.

- Settings: container env from `/srv/apps/yqup.com/shared/yqup-contact.env`
  (root 0600 on ANI). The SMTP values are the existing CAO Hostinger outbound
  route, copied on the server by the root lane installer. Never in git or a release.
- Storage: `/srv/apps/yqup.com/state` mounted at `/srv/state`; messages are
  purged after 730 days (24 months), at start-up and daily.
- Delivery: one plain-text, defanged notification to `forms@yqup.com`. Never an auto-reply.
- Without settings or storage the token endpoint answers 503 and the page keeps
  showing the advisory-page fallback instead of the form.

## Release

```sh
node top-level-sites/build-sites.mjs        # then commit dist/yqup.com
top-level-sites/deploy/package-yqup-com-release.sh
scp deploy/releases/<id>.tar.gz deploy/releases/<id>.sha256 ani:/home/ani-cursor/yqup-com-staging/
ssh yqup-com-deploy-ani deploy <id> <sha256>
```

Compose, image, runtime or Caddy changes need a JENZ rehearsal first.
