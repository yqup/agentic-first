---
host: raw-html
host_url: null
host_kind: self-hosted
covers:
  - apache
  - nginx
  - caddy
  - raw-vps
  - docker-served-static
modes_supported: [1]
modes_recommended: 1
status: stable
last_verified: 2026-04-21
gotchas:
  - server_dot_path_blocking
  - missing_content_type_header
---

# Host recipe — Raw HTML / VPS (Apache, Nginx, Caddy)

> **Mode 1 with one line of server config.** If you control the web server, this is the simplest possible setup. The hardest part is convincing the server to serve a dotfile path.

## Place the file

Drop `agentic-profile.json` in your document root under `.well-known/`:

```
/var/www/html/.well-known/agentic-profile.json
```

(Or wherever your `DocumentRoot` / `root` points.)

## Apache

Most Apache installs serve `.well-known/` paths fine out of the box (the directory has been canonical for years thanks to Let's Encrypt and `security.txt`). If yours doesn't, add to `.htaccess` or your vhost config:

```apache
<Directory "/var/www/html/.well-known">
  Require all granted
</Directory>

<Files "agentic-profile.json">
  Header set Content-Type "application/json"
  Header set Cache-Control "public, max-age=300"
  Header set Access-Control-Allow-Origin "*"
</Files>
```

## Nginx

Add inside the `server` block:

```nginx
location = /.well-known/agentic-profile.json {
  default_type application/json;
  add_header Cache-Control "public, max-age=300";
  add_header Access-Control-Allow-Origin "*";
  try_files $uri =404;
}
```

The `=` (exact match) location is fastest and avoids nginx's URI normalisation rewriting the path.

## Caddy

```caddy
your-domain.example {
  root * /var/www/html
  @profile path /.well-known/agentic-profile.json
  header @profile Content-Type        "application/json"
  header @profile Cache-Control       "public, max-age=300"
  header @profile Access-Control-Allow-Origin "*"
  file_server
}
```

Caddy infers `application/json` from the `.json` extension automatically; the explicit `header` directive is belt-and-braces and adds the cache headers.

## Docker-served static (e.g. `nginx:alpine`)

Mount your document root and rely on the same Nginx config above. If you're using `caddy:latest`, see the Caddy snippet.

## Verify

```bash
curl -I https://your-domain.example/.well-known/agentic-profile.json
# Expect: 200 + content-type: application/json

curl -sS https://your-domain.example/.well-known/agentic-profile.json | jq .
```

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `403 Forbidden` from Apache | Default config blocks dot-prefixed directories | Add the `<Directory "/path/to/.well-known">` block above. |
| `404` from Nginx but file exists on disk | URI normalisation, or `try_files` not finding the file | Use the exact-match `location =` block; verify `root` is the directory above `.well-known/`. |
| `200` but `Content-Type: application/octet-stream` | Apache's `mime.types` doesn't map `.json` | Add `AddType application/json .json` to your config, or use the `Files` directive above. |
| TLS works for `/` but fails for the well-known path | HSTS / mixed-content | Use `https://` consistently and confirm your cert covers the apex (or wildcard if you're on a subdomain). |

## Cross-references

- [Mode 1](../modes/01-file-well-known.md).
- [Vercel](./vercel.md), [Netlify](./netlify.md), [GitHub Pages](./github-pages.md) — managed-host equivalents.
