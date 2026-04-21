# Embed recipes

> **Publish on any host. In ten minutes.** An `agentic-first` profile is one small JSON file. The hardest part is wrangling whatever CMS you happen to use into serving it at the canonical URL with the right `Content-Type`. This page is the copy-paste recipe for every common host.

---

## Pick the right mode

Three modes, in order of preference. Use the highest one your host supports. The directory tries them in this order on submission and uses the first one it finds.

| Mode | Where the profile lives | Use it if | Trade-off |
| --- | --- | --- | --- |
| **1. File** (canonical) | `https://yourdomain/.well-known/agentic-profile.json` | Your host lets you upload an arbitrary file to a path beginning with a dot, OR you control a build pipeline that does. | None. This is the spec. Maximum compatibility. |
| **2. Embed** (data island) | `<script type="application/agentic-profile+json">` on your home page | Your host lets you inject HTML into `<head>` or a code block, but won't let you upload a file at `/.well-known/`. | Adds a few KB to your home page weight. Pair with a `<link rel="agentic-profile">` for explicit discovery. |
| **3. Inline XML** (last resort) | Hidden `<div hidden id="agentic-profile" data-format="xml">` block | Your host strips `<script>` tags or re-encodes JSON, AND you can still inject *any* raw HTML. | Directory parses it but flags a soft warning. JSON is the canonical wire format; this exists so no host is left out. |

### Worked example — same profile, three ways

**Mode 1: file at `/.well-known/agentic-profile.json`**

```jsonc
{
  "schema_version": "0.1.0",
  "updated_at": "2026-04-19T12:00:00Z",
  "profile_kind": "company",
  "tier": "public",
  "company": {
    "name": "Acme Robotics",
    "website": "https://acme-robotics.example",
    "jurisdiction": "GB"
  }
}
```

**Mode 2: embed inside `<head>` or just before `</body>`**

```html
<script type="application/agentic-profile+json">
{
  "schema_version": "0.1.0",
  "updated_at": "2026-04-19T12:00:00Z",
  "profile_kind": "company",
  "tier": "public",
  "company": {
    "name": "Acme Robotics",
    "website": "https://acme-robotics.example",
    "jurisdiction": "GB"
  }
}
</script>
<link rel="agentic-profile"
      type="application/json"
      href="/.well-known/agentic-profile.json">
```

**Mode 3: inline XML, anywhere on the page**

```html
<div hidden id="agentic-profile" data-format="xml">
  <agentic-profile version="0.1.0" kind="company" tier="public">
    <company>
      <name>Acme Robotics</name>
      <website>https://acme-robotics.example</website>
      <jurisdiction>GB</jurisdiction>
    </company>
    <updated_at>2026-04-19T12:00:00Z</updated_at>
  </agentic-profile>
</div>
```

---

## File-host recipes (mode 1)

### Raw HTML / VPS

Drop the file in your document root under `/.well-known/agentic-profile.json`. That's the whole recipe. Most servers infer `application/json` from the `.json` extension.

### Apache

```apache
# /var/www/html/.well-known/agentic-profile.json  (the file)

# /var/www/html/.htaccess  (only needed if your host blocks dotfiles)
<Files "agentic-profile.json">
  Header set Content-Type "application/json"
  Header set Cache-Control "public, max-age=300"
</Files>
```

### Nginx

```nginx
server {
  # ... existing server block ...

  location = /.well-known/agentic-profile.json {
    default_type application/json;
    add_header Cache-Control "public, max-age=300";
    add_header Access-Control-Allow-Origin *;
  }
}
```

### Caddy

```caddy
yourdomain.example {
  @profile path /.well-known/agentic-profile.json
  header @profile Content-Type        "application/json"
  header @profile Cache-Control       "public, max-age=300"
  header @profile Access-Control-Allow-Origin "*"
  file_server
}
```

### Vercel, Netlify, Cloudflare Pages, GitHub Pages, Fly, Railway, Render

Place the file at:

| Framework / host | Path |
| --- | --- |
| Next.js, Vite, Nuxt, Vercel | `public/.well-known/agentic-profile.json` |
| SvelteKit, Astro, Eleventy | `static/.well-known/agentic-profile.json` |
| Hugo, Jekyll, Gatsby, Docusaurus | `static/.well-known/agentic-profile.json` (or the framework's equivalent) |
| GitHub Pages | `.well-known/agentic-profile.json` at the repo root |
| Cloudflare Pages | `public/.well-known/agentic-profile.json` (any framework) |
| Netlify | `static/.well-known/agentic-profile.json` plus `_headers` (see below) |
| Fly / Railway / Render | mount on the container at `/.well-known/agentic-profile.json` |

For Netlify add to `_headers`:

```
/.well-known/agentic-profile.json
  Content-Type: application/json
  Cache-Control: public, max-age=300
```

For Vercel add to `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/.well-known/agentic-profile.json",
      "headers": [
        { "key": "Content-Type",  "value": "application/json" },
        { "key": "Cache-Control", "value": "public, max-age=300" }
      ]
    }
  ]
}
```

### AWS S3 + CloudFront

1. Upload `agentic-profile.json` to your bucket under the key `.well-known/agentic-profile.json`.
2. Set its `Content-Type` to `application/json` (S3 console: Properties → Edit Metadata).
3. In CloudFront, add a Cache Policy that respects `Cache-Control` from the origin.

### Cloudflare Worker (universal escape hatch)

Sits in front of any host, serves the well-known path, falls through for everything else. Use this when nothing else works (Squarespace, custom CMS, locked-down corporate intranet).

```js
const PROFILE = JSON.stringify({
  /* paste your profile here */
});

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/.well-known/agentic-profile.json") {
      return new Response(PROFILE, {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=300",
          "access-control-allow-origin": "*",
        },
      });
    }
    return fetch(request);
  },
};
```

---

## CMS-embed recipes (mode 2)

The pattern: paste a `<script type="application/agentic-profile+json">` block + a `<link rel="agentic-profile">` tag into your site's site-wide `<head>` or footer code-block.

### WordPress

`Appearance → Customize → Custom HTML`, or via a child-theme `functions.php`:

```php
add_action('wp_head', function () {
  $profile = json_encode([/* your profile */]);
  echo '<script type="application/agentic-profile+json">' . $profile . '</script>';
  echo '<link rel="agentic-profile" type="application/json" href="/.well-known/agentic-profile.json">';
});
```

If you prefer mode 1, the `Yoast SEO` and `Rank Math` plugins both expose `/.well-known/` directly.

### Squarespace

`Settings → Advanced → Code Injection → Header`. Paste the embed block. The `<link>` tag may not survive Squarespace's serializer — check with view-source.

For mode 1 on Squarespace, use one of:

- **Cloudflare Worker** (recommended). Put your domain behind Cloudflare, deploy the worker above. You get the canonical URL with no Squarespace surgery.
- **URL Mapping** (`Settings → Advanced → URL Mappings`): `301`-redirect `/.well-known/agentic-profile.json` to a normal page that contains a Code Block holding the JSON. Some validators tolerate the wrong content type; the directory accepts it but warns.
- **Subdomain on a static host**: CNAME `profile.your-domain.com` to GitHub Pages / Cloudflare Pages, serve the file from there, set `company.website` to your real Squarespace URL.

### Wix

`Settings → Custom Code → Add Custom Code → Head` (Premium plan required). Paste the embed block. Wix sites with the SEO add-on can also serve `/.well-known/` files via the SEO panel.

### Webflow

`Project Settings → Custom Code → Head Code`. Paste the embed block. Webflow does not allow `/.well-known/` files directly; use the Cloudflare Worker route for mode 1.

### Ghost

`Code Injection → Site Header`. Paste the embed block. Ghost lets you serve static files via `content/files/` but they are not at `/.well-known/`; use the Worker for mode 1.

### Shopify

`Online Store → Themes → Edit Code → theme.liquid`. Add the embed inside `<head>`. Shopify rewrites `/.well-known/` paths; Worker is the only mode-1 option.

### Notion (Super.so / Potion / Fruition)

These wrappers all let you inject `<head>` content. Paste the embed block in their custom-head field.

### Carrd, Substack, Linktree, Beacons

These are constrained hosts. Use mode 3 (inline XML) — they almost always allow a `<div>` + text. Otherwise put a free profile page on `profile.your-domain.com` and CNAME it to GitHub Pages.

---

## Constrained-host recipes (mode 3)

### Google Sites, Medium, Linktree

Paste the inline-XML block into any text/HTML widget. The `<div hidden>` keeps it invisible to humans; the directory's discovery flow finds it.

```html
<div hidden id="agentic-profile" data-format="xml">
  <agentic-profile version="0.1.0" kind="company" tier="public">
    <company>
      <name>Your Company</name>
      <website>https://yourdomain.example</website>
      <jurisdiction>GB</jurisdiction>
    </company>
    <updated_at>2026-04-19T12:00:00Z</updated_at>
  </agentic-profile>
</div>
```

### Genuinely no-code-allowed hosts

If you literally cannot inject HTML, your option is a separate static-host subdomain:

1. Pick a free static host: GitHub Pages, Cloudflare Pages, Netlify.
2. Publish `https://profile.yourdomain.example/.well-known/agentic-profile.json`.
3. In your profile, set `company.website` to your real homepage.
4. Submit `profile.yourdomain.example` to the directory.

---

## Verify your profile is reachable

```bash
# Mode 1
curl -I https://yourdomain.example/.well-known/agentic-profile.json
# Expect: 200, Content-Type: application/json

# Mode 2
curl -sSL https://yourdomain.example/ \
  | grep -A 30 'application/agentic-profile+json'

# Validate the file
curl -sS https://yourdomain.example/.well-known/agentic-profile.json \
  | agentic-first-validate -
# Expect: PASS
```

---

## Submit to the directory

Once your profile validates, register it with the public directory:

```bash
curl -sS -X POST https://directory.agentic-first.co/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"submit_website",
                 "arguments":{"domain":"yourdomain.example"}}}'
```

Or call `submit_website` from any MCP-aware client (Claude Desktop, Cursor, ChatGPT desktop) pointed at `https://directory.agentic-first.co/mcp`.

---

## Common problems

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `404` on `/.well-known/agentic-profile.json` | Host blocks dotfiles, or framework strips `/.well-known/` from the build output | Switch to mode 2 (embed) or use the Cloudflare Worker recipe |
| `200` but `Content-Type: text/html` | Host returns the file but with the wrong header (common on Squarespace URL-mapping) | Use the Worker, or accept the directory's soft warning |
| `submit_website` returns "no profile found" but the file is there | The directory's HTTPS request was rejected (HSTS issue, redirect to non-HTTPS, expired cert) | Run `curl -v` and fix the certificate / redirect |
| `submit_website` returns "schema validation failed" | A required field is missing or a banded value is non-canonical | Run `agentic-first-validate` locally; the error path is the field to fix |
| `submit_website` returns "rejected pattern in field" | Your prose field tripped one of the [security rules](./security-policy.md#rejected-pattern-list) | Rewrite the offending field to remove the imperative addressed at the reader |
