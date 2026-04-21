---
host: wordpress
host_url: https://wordpress.org
host_kind: cms
modes_supported: [1, 2]
modes_recommended: 2
status: stable
last_verified: 2026-04-21
gotchas:
  - dotfiles_blocked_on_some_managed_wp
  - rest_api_routes_collide_with_well_known
---

# Host recipe — WordPress

> **Default to Mode 2 (script embed) via the `wp_head` action.** It works on every WordPress install, managed or self-hosted. Move to Mode 1 only if you have SFTP access and your host doesn't rewrite `/.well-known/`.

## Decision

| If you have… | Use mode | How |
| --- | --- | --- |
| SFTP / SSH access to the document root | **1 (file)** | Drop `agentic-profile.json` at `/.well-known/agentic-profile.json` in the WordPress root. May need an `.htaccess` rule. |
| Only the WordPress admin UI | **2 (embed)** | Use the [Code Snippets](https://wordpress.org/plugins/code-snippets/) plugin to add a `wp_head` action. |
| A child theme you can edit | **2 (embed)** | Add the same `wp_head` action to `functions.php`. |

## Mode 2 recipe (recommended for non-devs)

1. Install the [Code Snippets](https://wordpress.org/plugins/code-snippets/) plugin (or a similar `functions.php`-injection plugin).
2. Add a new PHP snippet, scope "Run snippet everywhere":

   ```php
   <?php
   add_action('wp_head', function () {
       $profile = [
           'schema_version' => '0.1.0',
           'updated_at'     => '2026-04-19T12:00:00Z',
           'profile_kind'   => 'company',
           'tier'           => 'public',
           'company' => [
               'name'         => 'Acme Robotics',
               'website'      => 'https://acme-robotics.example',
               'jurisdiction' => 'GB',
           ],
       ];
       $json = wp_json_encode($profile, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
       echo "\n<script type=\"application/agentic-profile+json\">\n{$json}\n</script>\n";
       echo '<link rel="agentic-profile" type="application/json" href="/.well-known/agentic-profile.json">' . "\n";
   }, 9);
   ```

3. Save and activate. Visit your home page; view source; confirm the `<script>` tag and the `<link>` tag are both in the rendered `<head>`.

## Mode 1 recipe (if you have SFTP)

1. Place `agentic-profile.json` at `/path/to/wordpress-root/.well-known/agentic-profile.json`.
2. Add to `.htaccess` (Apache) **above** WordPress's existing rewrite rules:

   ```apache
   RewriteEngine On
   RewriteRule ^\.well-known/agentic-profile\.json$ - [L]
   <Files "agentic-profile.json">
     Header set Content-Type "application/json"
     Header set Cache-Control "public, max-age=300"
   </Files>
   ```

   The `[L]` flag stops WordPress from claiming the URL via its catch-all rewrite. Without it, WP serves its 404 page for the well-known path.

3. For Nginx, add inside the server block, **above** the WordPress `try_files` directive:

   ```nginx
   location = /.well-known/agentic-profile.json {
     default_type application/json;
     add_header Cache-Control "public, max-age=300";
   }
   ```

## Plugin shortcuts

If you prefer to delegate, two SEO plugins expose `/.well-known/` directly:

- **Yoast SEO** — Tools → File editor lets you add static files to the document root.
- **Rank Math** — same surface under General Settings.

Neither auto-generates an agentic-first profile (yet) — you still paste the JSON yourself, but they remove the SFTP dependency.

## Verify

```bash
# Mode 1
curl -I https://your-wp-site.example/.well-known/agentic-profile.json
# Expect: 200 + content-type: application/json

# Mode 2
curl -sSL https://your-wp-site.example/ \
  | grep -A 30 'application/agentic-profile+json'
```

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `404 Not Found` from WordPress on the well-known path | WP's catch-all rewrite is consuming the request | Add the `RewriteRule … [L]` (Apache) or explicit `location =` block (Nginx) above WP's rules. |
| The Code Snippets snippet runs but nothing appears in `<head>` | A caching plugin is serving a stale page | Purge the cache; verify by appending `?nocache=1` to the home-page URL. |
| `wp_json_encode` strips the `tier` field | A WP filter is sanitising the array | Build the JSON as a string instead, or call `JSON_UNESCAPED_SLASHES`. |
| Multiple agentic-profile script tags on the page | Snippet pasted twice, or theme also injects | Keep exactly one. Set the `wp_head` priority to `9` so it lands before plugin head injections. |

## Cross-references

- [Mode 1](../modes/01-file-well-known.md), [Mode 2](../modes/02-script-embed.md).
- [`SPEC.md`](../../../SPEC.md) for field reference.
