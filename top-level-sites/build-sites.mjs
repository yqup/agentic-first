import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sitesPath = path.join(__dirname, "sites.json");
const distDir = path.join(__dirname, "dist");
const edgeCaddyDir = path.join(__dirname, "infra", "caddy", "sites");
const serverRoot = "/srv/apps/top-level-sites/current";
const gammaOrigin = "https://sites.gamma.app";
const updatedAt = "2026-05-26T00:00:00Z";
const firstPort = 8211;

const sites = JSON.parse(await readFile(sitesPath, "utf8")).map((site, index) => ({
  ...site,
  mode: site.mode || "gamma",
  port: site.port || firstPort + index,
  service: serviceName(site.domain),
}));

await rm(distDir, { recursive: true, force: true });
await rm(edgeCaddyDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await mkdir(edgeCaddyDir, { recursive: true });

const manifest = [];

for (const site of sites) {
  const siteRoot = path.join(distDir, site.domain);
  const wwwRoot = path.join(siteRoot, "www");
  const wellKnownDir = path.join(wwwRoot, ".well-known");

  await mkdir(wellKnownDir, { recursive: true });

  const profile = profileFor(site);
  await writeFile(path.join(siteRoot, "Caddyfile"), containerCaddyFor(site), "utf8");
  await writeFile(path.join(wwwRoot, "favicon.svg"), faviconFor(site), "utf8");
  await writeFile(path.join(wwwRoot, "healthz"), healthFor(site), "utf8");
  await writeFile(path.join(wwwRoot, "llms.txt"), llmsFor(site, profile), "utf8");
  await writeFile(path.join(wwwRoot, "robots.txt"), "User-agent: *\nAllow: /\n", "utf8");
  await copySiteAssets(site, wwwRoot);
  if (site.mode === "holding") {
    await writeFile(path.join(wwwRoot, "index.html"), holdingPageFor(site), "utf8");
  }
  if (site.mode === "country") {
    await writeFile(path.join(wwwRoot, "index.html"), countryPageFor(site), "utf8");
  }
  for (const hostPage of site.host_holding_pages || []) {
    const hostRoot = path.join(wwwRoot, "hosts", hostPage.host);
    await mkdir(hostRoot, { recursive: true });
    await writeFile(
      path.join(hostRoot, "index.html"),
      logoHoldingPageFor(site, hostPage),
      "utf8",
    );
  }
  await writeFile(
    path.join(wellKnownDir, "agentic-profile.json"),
    `${JSON.stringify(profile, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(edgeCaddyDir, `${site.domain}.caddy`),
    edgeCaddyFor(site),
    "utf8",
  );

  manifest.push({
    domain: site.domain,
    service: site.service,
    mode: site.mode,
    local_port: site.port,
    local_preview: `http://127.0.0.1:${site.port}/`,
    gamma_origin: site.mode === "gamma" ? gammaOrigin : null,
    document_root: `${serverRoot}/dist/${site.domain}/www`,
    container_caddyfile: `${serverRoot}/dist/${site.domain}/Caddyfile`,
    profile: `https://${site.domain}/.well-known/agentic-profile.json`,
    healthz: `https://${site.domain}/healthz`,
  });
}

await writeFile(path.join(__dirname, "docker-compose.yml"), composeFor(sites), "utf8");
await writeFile(path.join(distDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(path.join(distDir, "queue-scan.json"), `${JSON.stringify(queuePayloadFor(sites), null, 2)}\n`, "utf8");
await writeFile(path.join(distDir, "queue-scan.curl.txt"), queueCurl(queuePayloadFor(sites)), "utf8");
await writeFile(path.join(edgeCaddyDir, "README.md"), edgeCaddyReadme(sites), "utf8");

console.log(`Built ${sites.length} site containers into ${relative(distDir)}`);

function profileFor(site) {
  const profile = {
    schema_version: "0.2.0",
    updated_at: updatedAt,
    profile_kind: "company",
    tier: "public",
    company: {
      name: site.name,
      website: `https://${site.domain}`,
      jurisdiction: site.jurisdiction,
      industry: site.industry,
      tagline: site.heading,
      summary: site.summary,
    },
    links: {
      website: `https://${site.domain}`,
    },
    contact: {
      preferred_channel: site.contact?.preferred_channel || "none",
    },
  };

  if (site.contact?.form_url) profile.contact.form_url = site.contact.form_url;
  if (site.contact?.email) profile.contact.email = site.contact.email;
  if (site.contact?.private_mcp) profile.contact.private_mcp = site.contact.private_mcp;
  return profile;
}

async function copySiteAssets(site, wwwRoot) {
  for (const asset of site.assets || []) {
    const source = path.join(__dirname, asset.source);
    const target = path.join(wwwRoot, asset.target);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
  }
}

function composeFor(items) {
  const services = items
    .map((site) => `  ${site.service}:
    image: caddy:2.8.4-alpine
    container_name: site-${site.service}
    restart: unless-stopped
    read_only: true
    ports:
      - "127.0.0.1:${site.port}:8080"
    volumes:
      - ./dist/${site.domain}/www:/srv/site:ro
      - ./dist/${site.domain}/Caddyfile:/etc/caddy/Caddyfile:ro
    tmpfs:
      - /config
      - /data
      - /tmp
`)
    .join("\n");

  return `name: top-level-sites

services:
${services}`;
}

function containerCaddyFor(site) {
  const hostHandlers = hostHoldingHandlersFor(site);
  const hostHandlerBlock = hostHandlers ? `\n\t${hostHandlers}\n` : "";
  const pageHandler = site.mode === "holding" || site.mode === "country"
    ? `handle {
		try_files {path} /index.html
		file_server
	}`
    : `handle {
		reverse_proxy ${gammaOrigin} {
			header_up Host ${site.domain}
			header_up X-Forwarded-Host {http.request.host}
			header_up X-Real-IP {http.request.remote.host}
			transport http {
				tls_server_name sites.gamma.app
			}
		}
	}`;

  return `{
	admin off
	auto_https off
}

:8080 {
	root * /srv/site
	encode zstd gzip

	@agentic_profile path /.well-known/agentic-profile.json
	handle @agentic_profile {
		header Content-Type "application/json; charset=utf-8"
		header Cache-Control "public, max-age=300"
		file_server
	}

	@health path /healthz
	handle @health {
		header Content-Type "application/json; charset=utf-8"
		header Cache-Control "no-store"
		file_server
	}

	@local_assets path /llms.txt /robots.txt /favicon.svg
	handle @local_assets {
		file_server
	}

	@site_assets path /assets/*
	handle @site_assets {
		file_server
	}

${hostHandlerBlock}
	${pageHandler}
}
`;
}

function hostHoldingHandlersFor(site) {
  return (site.host_holding_pages || [])
    .map((page, index) => {
      const matcher = `host_holding_${index}`;
      return `@${matcher} host ${page.host}
	handle @${matcher} {
		root * /srv/site/hosts/${page.host}
		try_files {path} /index.html
		file_server
	}`;
    })
    .join("\n\n\t");
}

function edgeCaddyFor(site) {
  const pageNote = site.mode === "holding"
    ? "Normal pages are served by the per-site static holding-page container."
    : site.mode === "country"
      ? "Normal pages are served by the per-site English-country static container."
    : "Normal pages are handled by the per-site container, which proxies to Gamma.";

  return `# Edge route for ${site.domain}.
# Generated by top-level-sites/build-sites.mjs. Review before applying on ANI.
# ${pageNote}

${site.domain}, www.${site.domain} {
	encode zstd gzip

	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options    "nosniff"
		Referrer-Policy           "strict-origin-when-cross-origin"
		-Server
	}

	reverse_proxy 127.0.0.1:${site.port} {
		header_up Host {host}
		header_up X-Forwarded-Host {host}
		header_up X-Real-IP {http.request.remote.host}
	}

	log {
		output file /var/log/caddy/${site.domain}.access.log {
			roll_size 10mb
			roll_keep 14
		}
		format json
	}
}
`;
}

function faviconFor(site) {
  const initials = site.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toLowerCase())
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="${site.theme}"/>
  <circle cx="48" cy="16" r="7" fill="${site.accent}"/>
  <text x="32" y="42" font-family="Inter, ui-sans-serif, system-ui" font-size="24" font-weight="800" fill="#fff" text-anchor="middle">${escapeHtml(initials)}</text>
</svg>
`;
}

function llmsFor(site, profile) {
  const servingNote = site.mode === "holding"
    ? `The human-facing page is a local static holding page for ${site.name}.
The owned domain also serves this local agentic-first profile so agents
can discover the right facts before the full public site is launched.`
    : site.mode === "country"
      ? `The human-facing page is a local static page with an English country
board-and-operations feel. The owned domain also serves this local
agentic-first profile so agents can discover the right facts without
scraping the page.`
    : `The human-facing design for this site is still served from Gamma through
the per-site local container. The owned domain also serves this local
agentic-first profile so agents can discover the right facts without
scraping the Gamma page.`;

  return `# ${site.name}

Canonical website: https://${site.domain}/
Agentic profile: https://${site.domain}/.well-known/agentic-profile.json
Health check: https://${site.domain}/healthz

${servingNote}

\`\`\`json
${JSON.stringify(profile, null, 2)}
\`\`\`
`;
}

function healthFor(site) {
  const health = {
    status: "ok",
    site: site.domain,
    service: site.service,
    mode: site.mode === "holding"
      ? "static-holding-container"
      : site.mode === "country"
        ? "static-country-container"
        : "gamma-fronting-container",
    updated_at: updatedAt,
    agentic_profile: "/.well-known/agentic-profile.json",
  };

  if (site.mode === "gamma") health.gamma_origin = gammaOrigin;
  return `${JSON.stringify(health)}\n`;
}

function holdingPageFor(site) {
  const secondary = site.secondary || "#f3c77a";
  const text = site.text || "#101828";
  const surface = site.surface || "#fbfbf8";
  const muted = site.muted || "#667085";
  const actionLabel = site.action_label || "Private preview";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(site.title || site.name)}</title>
  <meta name="description" content="${escapeHtml(site.summary)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <style>
    :root {
      color-scheme: light;
      --ink: ${text};
      --muted: ${muted};
      --paper: ${surface};
      --panel: #ffffff;
      --line: rgba(16, 24, 40, 0.12);
      --theme: ${site.theme};
      --accent: ${site.accent};
      --secondary: ${secondary};
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      min-height: 100%;
    }

    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--paper);
      color: var(--ink);
      letter-spacing: 0;
    }

    main {
      min-height: 100vh;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 480px);
      align-items: stretch;
    }

    .content {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: clamp(28px, 5vw, 72px);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      font-size: 15px;
      font-weight: 760;
    }

    .mark {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: var(--theme);
      color: #fff;
      font-weight: 820;
      line-height: 1;
    }

    .hero {
      max-width: 760px;
      padding: 84px 0;
    }

    .eyebrow {
      margin: 0 0 20px;
      color: var(--theme);
      font-size: 13px;
      font-weight: 780;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    h1 {
      margin: 0;
      max-width: 12ch;
      font-size: clamp(48px, 7vw, 92px);
      line-height: 0.94;
      letter-spacing: 0;
    }

    .summary {
      max-width: 660px;
      margin: 28px 0 0;
      color: var(--muted);
      font-size: clamp(18px, 2vw, 23px);
      line-height: 1.46;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      margin-top: 34px;
    }

    .button {
      min-height: 46px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 0 18px;
      border: 1px solid var(--theme);
      border-radius: 6px;
      background: var(--theme);
      color: #fff;
      font-size: 15px;
      font-weight: 720;
      text-decoration: none;
      white-space: nowrap;
    }

    .button svg {
      width: 17px;
      height: 17px;
      flex: 0 0 auto;
    }

    .note {
      color: var(--muted);
      font-size: 14px;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      color: var(--muted);
      font-size: 14px;
    }

    .meta span {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .meta span::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--accent);
    }

    .visual {
      min-height: 100vh;
      padding: clamp(20px, 4vw, 48px);
      display: flex;
      align-items: center;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.36)),
        linear-gradient(145deg, color-mix(in srgb, var(--theme) 14%, #ffffff), color-mix(in srgb, var(--secondary) 28%, #ffffff));
      border-left: 1px solid var(--line);
    }

    .signal {
      width: 100%;
      aspect-ratio: 0.82;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.72);
      box-shadow: 0 22px 60px rgba(16, 24, 40, 0.13);
      overflow: hidden;
    }

    .signal svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    @media (max-width: 860px) {
      main {
        grid-template-columns: 1fr;
      }

      .content {
        min-height: auto;
        padding: 28px 24px 36px;
      }

      .hero {
        padding: 68px 0 54px;
      }

      h1 {
        max-width: 11ch;
        font-size: clamp(42px, 15vw, 68px);
      }

      .visual {
        min-height: auto;
        padding: 0 24px 28px;
        border-left: 0;
        background: var(--paper);
      }

      .signal {
        aspect-ratio: 1.45;
      }
    }
  </style>
</head>
<body>
  <main>
    <section class="content" aria-labelledby="page-title">
      <div class="brand">
        <span class="mark">${escapeHtml(initialsFor(site.name))}</span>
        <span>${escapeHtml(site.name)}</span>
      </div>

      <div class="hero">
        <p class="eyebrow">${escapeHtml(site.eyebrow || "Launching soon")}</p>
        <h1 id="page-title">${escapeHtml(site.heading)}</h1>
        <p class="summary">${escapeHtml(site.summary)}</p>
        <div class="actions">
          <a class="button" href="mailto:${escapeHtml(site.contact?.email || "hello@my-agentic.com")}">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6.8h16v10.4H4V6.8Z" stroke="currentColor" stroke-width="1.8"/>
              <path d="m5 8 7 5 7-5" stroke="currentColor" stroke-width="1.8"/>
            </svg>
            ${escapeHtml(actionLabel)}
          </a>
          <span class="note">${escapeHtml(site.note || "A fuller site is being prepared.")}</span>
        </div>
      </div>

      <div class="meta" aria-label="Site status">
        <span>Holding page live</span>
        <span>Agentic profile ready</span>
      </div>
    </section>

    <aside class="visual" aria-label="Structured signal preview">
      <div class="signal">
        ${signalSvgFor(site)}
      </div>
    </aside>
  </main>
</body>
</html>
`;
}

function countryPageFor(site) {
  const heroImage = site.hero_image || "https://www.tonywood.org/assets/countryside-hero.jpg";
  const brandMark = site.brand_mark || initialsFor(site.name);
  const proof = site.proof || [
    "Board intent",
    "Operating cadence",
    "Agentic systems",
    "Risk and assurance",
    "Useful adoption",
  ];
  const routes = site.routes || site.sections || [];
  const operatingNotes = site.operating_notes || [];
  const contactHref = site.contact?.email
    ? `mailto:${site.contact.email}`
    : site.contact?.form_url || `https://${site.domain}/`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(site.title || site.name)}</title>
  <meta name="description" content="${escapeHtml(site.summary)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preload" as="image" href="${escapeHtml(heroImage)}">
  <style>
    :root {
      color-scheme: light;
      --ink: #09152b;
      --ink-soft: #34405a;
      --chalk: #fbfaf4;
      --paper: #f3efe2;
      --stone: #d8cfb8;
      --field: #31583f;
      --hedge: #163d2c;
      --gold: #b88a32;
      --earth: #6f4d23;
      --plum: #653a56;
      --line: rgba(9, 21, 43, 0.16);
      --shadow: 0 18px 48px rgba(9, 21, 43, 0.12);
      --sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --serif: Georgia, "Times New Roman", serif;
    }

    * {
      box-sizing: border-box;
    }

    html {
      overflow-x: hidden;
    }

    body {
      margin: 0;
      overflow-x: hidden;
      background: var(--chalk);
      color: var(--ink);
      font-family: var(--sans);
      font-size: 17px;
      line-height: 1.62;
      letter-spacing: 0;
    }

    a {
      color: inherit;
      text-decoration-thickness: 0.08em;
      text-underline-offset: 0.18em;
    }

    .site-header {
      position: sticky;
      top: 0;
      z-index: 20;
      min-height: 72px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 14px clamp(18px, 4vw, 52px);
      background: rgba(251, 250, 244, 0.94);
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(12px);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--ink);
      font-weight: 840;
      text-decoration: none;
    }

    .brand-mark {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border: 1px solid var(--ink);
      background: var(--ink);
      color: var(--chalk);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0;
    }

    nav {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 4px 18px;
      max-width: 100%;
      color: var(--ink-soft);
      font-size: 14px;
      font-weight: 760;
    }

    nav a {
      text-decoration: none;
    }

    .hero {
      min-height: 78vh;
      display: flex;
      align-items: end;
      padding: clamp(72px, 10vw, 132px) clamp(20px, 6vw, 88px);
      color: var(--chalk);
      background-image:
        linear-gradient(90deg, rgba(9, 21, 43, 0.92), rgba(9, 21, 43, 0.58), rgba(9, 21, 43, 0.16)),
        url("${escapeHtml(heroImage)}");
      background-size: cover;
      background-position: center;
    }

    .hero-inner {
      max-width: 950px;
    }

    .eyebrow {
      margin: 0 0 12px;
      color: var(--plum);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .hero .eyebrow {
      color: #f4dba8;
    }

    h1,
    h2,
    h3,
    p {
      margin-top: 0;
    }

    h1,
    h2,
    h3 {
      line-height: 1.05;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }

    h1 {
      max-width: 980px;
      margin-bottom: 24px;
      font-family: var(--serif);
      font-size: clamp(46px, 7vw, 92px);
      font-weight: 700;
    }

    h2 {
      max-width: 920px;
      margin-bottom: 18px;
      font-family: var(--serif);
      font-size: clamp(32px, 4vw, 54px);
      font-weight: 700;
    }

    h3 {
      margin-bottom: 12px;
      font-size: 22px;
      line-height: 1.18;
    }

    .hero-copy {
      max-width: 740px;
      margin: 0;
      color: rgba(251, 250, 244, 0.9);
      font-size: clamp(19px, 2vw, 24px);
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 28px;
    }

    .button {
      min-height: 46px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 18px;
      border: 1px solid currentColor;
      color: inherit;
      font-weight: 820;
      text-decoration: none;
    }

    .button.primary {
      background: var(--chalk);
      color: var(--ink);
    }

    .button.secondary {
      color: var(--chalk);
    }

    .proof-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      border-bottom: 1px solid var(--line);
      background: var(--paper);
    }

    .proof-strip span {
      min-height: 60px;
      display: flex;
      align-items: center;
      padding: 18px 22px;
      border-right: 1px solid var(--line);
      color: var(--hedge);
      font-size: 14px;
      font-weight: 900;
    }

    .section {
      padding: clamp(56px, 8vw, 104px) clamp(20px, 6vw, 88px);
    }

    .section.paper {
      background: var(--paper);
    }

    .split {
      display: grid;
      grid-template-columns: minmax(0, 0.92fr) minmax(280px, 1.08fr);
      gap: clamp(30px, 6vw, 84px);
      align-items: start;
    }

    .lead {
      max-width: 700px;
      color: var(--ink-soft);
      font-size: clamp(18px, 2vw, 22px);
      line-height: 1.52;
    }

    .route-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-top: 30px;
    }

    .route-card,
    .note-panel {
      min-width: 0;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.78);
      box-shadow: var(--shadow);
    }

    .route-card {
      min-height: 234px;
      padding: 22px;
      border-top: 6px solid var(--field);
    }

    .route-card:nth-child(2) {
      border-top-color: var(--gold);
    }

    .route-card:nth-child(3) {
      border-top-color: var(--plum);
    }

    .route-card span,
    .note-panel span {
      display: block;
      margin-bottom: 28px;
      color: var(--hedge);
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .route-card strong {
      display: block;
      color: var(--ink);
      font-size: 21px;
      line-height: 1.24;
    }

    .route-card p,
    .note-panel p {
      margin: 14px 0 0;
      color: var(--ink-soft);
    }

    .note-list {
      display: grid;
      gap: 14px;
    }

    .note-panel {
      padding: 24px;
    }

    .tone-band {
      background: var(--hedge);
      color: var(--chalk);
    }

    .tone-band .eyebrow {
      color: #f4dba8;
    }

    .tone-band p {
      max-width: 780px;
      color: rgba(251, 250, 244, 0.84);
    }

    .cta {
      background: var(--ink);
      color: var(--chalk);
    }

    .cta-inner {
      max-width: 880px;
    }

    .cta p {
      max-width: 720px;
      color: rgba(251, 250, 244, 0.84);
      font-size: 20px;
    }

    footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 24px;
      padding: 32px clamp(20px, 6vw, 88px);
      border-top: 1px solid var(--line);
      background: var(--chalk);
      color: var(--ink-soft);
      font-size: 14px;
    }

    footer strong {
      color: var(--ink);
    }

    @media (max-width: 900px) {
      .site-header {
        position: static;
        align-items: flex-start;
        flex-direction: column;
      }

      nav {
        justify-content: flex-start;
      }

      .hero {
        min-height: 72vh;
        background-image:
          linear-gradient(180deg, rgba(9, 21, 43, 0.9), rgba(9, 21, 43, 0.56)),
          url("${escapeHtml(heroImage)}");
      }

      .split,
      .route-grid {
        grid-template-columns: 1fr;
      }

      .route-card {
        min-height: auto;
      }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="${escapeHtml(site.name)} home">
      <span class="brand-mark">${escapeHtml(brandMark)}</span>
      <span>${escapeHtml(site.name)}</span>
    </a>
    <nav aria-label="Primary navigation">
      <a href="#brief">Brief</a>
      <a href="#work">Work</a>
      <a href="#cadence">Cadence</a>
      <a href="#conversation">Conversation</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="hero-inner">
        <p class="eyebrow">${escapeHtml(site.eyebrow || "Board & Operations")}</p>
        <h1>${escapeHtml(site.heading)}</h1>
        <p class="hero-copy">${escapeHtml(site.summary)}</p>
        <div class="hero-actions">
          <a class="button primary" href="#brief">${escapeHtml(site.primary_action_label || "Read the brief")}</a>
          <a class="button secondary" href="${escapeHtml(contactHref)}">${escapeHtml(site.secondary_action_label || "Start a conversation")}</a>
        </div>
      </div>
    </section>

    <section class="proof-strip" aria-label="Current work">
      ${proof.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
    </section>

    <section class="section split" id="brief">
      <div>
        <p class="eyebrow">The CAO brief</p>
        <h2>${escapeHtml(site.brief_title || "Agentic work needs ownership after the pilot.")}</h2>
      </div>
      <div>
        <p class="lead">${escapeHtml(site.brief || "The Chief Agentic Officer connects board intent, operational reality, governance, and AI-enabled delivery. The role exists to stop agentic work becoming a loose collection of demos, dashboards, and unowned automation.")}</p>
        <p>${escapeHtml(site.brief_support || "The work is practical: choose the right problems, set the trust boundaries, make ownership visible, and build an operating rhythm that lets people inspect what the agents are doing.")}</p>
      </div>
    </section>

    <section class="section paper" id="work">
      <p class="eyebrow">${escapeHtml(site.work_eyebrow || "Where the role helps")}</p>
      <h2>${escapeHtml(site.work_title || "From scattered experiments to accountable capability.")}</h2>
      <div class="route-grid">
        ${routes.map((route) => `<article class="route-card">
          <span>${escapeHtml(route.title)}</span>
          <strong>${escapeHtml(route.heading || route.title)}</strong>
          <p>${escapeHtml(route.body)}</p>
        </article>`).join("")}
      </div>
    </section>

    <section class="section tone-band">
      <p class="eyebrow">${escapeHtml(site.tone_eyebrow || "English country, boardroom discipline")}</p>
      <h2>${escapeHtml(site.tone_title || "Calm enough for judgement. Structured enough for action.")}</h2>
      <p>${escapeHtml(site.tone_body || "Agentic systems will not be led well by theatre or panic. They need the same virtues that make good board work useful: clear intent, known constraints, sober risk appetite, proper records, and a cadence that survives the week after the workshop.")}</p>
    </section>

    <section class="section split" id="cadence">
      <div>
        <p class="eyebrow">${escapeHtml(site.cadence_eyebrow || "Operating cadence")}</p>
        <h2>${escapeHtml(site.cadence_title || "The first job is to make the work legible.")}</h2>
        <p class="lead">${escapeHtml(site.cadence_body || "Before a company scales agentic systems, leaders need to know who owns them, what they can touch, when they stop, and how exceptions reach human judgement.")}</p>
      </div>
      <div class="note-list">
        ${operatingNotes.map((note) => `<article class="note-panel">
          <span>${escapeHtml(note.label)}</span>
          <h3>${escapeHtml(note.title)}</h3>
          <p>${escapeHtml(note.body)}</p>
        </article>`).join("")}
      </div>
    </section>

    <section class="section cta" id="conversation">
      <div class="cta-inner">
        <p class="eyebrow">${escapeHtml(site.cta_eyebrow || "Useful first conversation")}</p>
        <h2>${escapeHtml(site.cta_title || "Start with the operating question, not the tool.")}</h2>
        <p>${escapeHtml(site.cta_body || "Where should agentic systems be trusted, where should they be bounded, and what would make the board confident that useful work is happening without silent drift?")}</p>
        <div class="hero-actions">
          <a class="button primary" href="${escapeHtml(contactHref)}">${escapeHtml(site.cta_button_label || "Talk about the CAO role")}</a>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div>
      <strong>${escapeHtml(site.name)}</strong>
      <div>${escapeHtml(site.domain)}</div>
    </div>
    <div>${escapeHtml(site.footer_tagline || "Agentic systems, governance, operations, and practical leadership.")}</div>
  </footer>
</body>
</html>
`;
}

function logoHoldingPageFor(site, page) {
  const message = page.message || "Hard a work";
  const title = page.title || `${site.name} - ${message}`;
  const logoText = page.logo_text || site.name.toUpperCase();
  const logoImage = page.logo_image;
  const logoAlt = page.logo_alt || `${site.name} logo`;
  const surface = page.surface || "#f6f8ff";
  const ink = page.text || "#151733";
  const muted = page.muted || "#697087";
  const accent = page.accent || site.accent;
  const theme = page.theme || site.theme;
  const logoElement = logoImage
    ? `<img src="${escapeHtml(logoImage)}" alt="${escapeHtml(logoAlt)}">`
    : dilijenzMarkSvg(theme, accent);
  const wordmarkElement = page.show_logo_text === false
    ? ""
    : `\n        <div class="wordmark">${escapeHtml(logoText)}</div>`;
  const noteElement = page.show_note === false
    ? ""
    : `\n      <p class="small">${escapeHtml(page.note || "The public page is being prepared.")}</p>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="robots" content="noindex, follow">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <style>
    :root {
      color-scheme: light;
      --ink: ${ink};
      --muted: ${muted};
      --surface: ${surface};
      --theme: ${theme};
      --accent: ${accent};
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      min-height: 100%;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 32px;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.32)),
        radial-gradient(circle at 76% 18%, rgba(108, 124, 255, 0.16), transparent 34%),
        var(--surface);
      letter-spacing: 0;
    }

    main {
      width: min(100%, 460px);
      display: grid;
      place-items: center;
    }

    .lockup {
      display: grid;
      justify-items: center;
      gap: 18px;
      padding: 20px 0;
      text-align: center;
    }

    .logo {
      display: grid;
      justify-items: center;
      gap: 18px;
    }

    .logo-mark {
      width: clamp(104px, 18vw, 148px);
      aspect-ratio: 1;
    }

    .logo-mark.has-image {
      width: min(62vw, 220px);
      height: auto;
      aspect-ratio: auto;
    }

    .logo-mark svg,
    .logo-mark img {
      width: 100%;
      height: auto;
      display: block;
    }

    .wordmark {
      color: var(--theme);
      font-size: clamp(32px, 8vw, 56px);
      line-height: 0.94;
      font-weight: 840;
      letter-spacing: 0;
    }

    .message {
      margin: 6px 0 0;
      color: var(--ink);
      font-size: clamp(24px, 4vw, 34px);
      line-height: 1.1;
      font-weight: 780;
      letter-spacing: 0;
    }

    .small {
      margin: 0;
      max-width: 34ch;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <main aria-labelledby="holding-message">
    <section class="lockup">
      <div class="logo" aria-label="${escapeHtml(site.name)}">
        <div class="logo-mark${logoImage ? " has-image" : ""}">
          ${logoElement}
        </div>${wordmarkElement}
      </div>
      <p class="message" id="holding-message">${escapeHtml(message)}</p>${noteElement}
    </section>
  </main>
</body>
</html>
`;
}

function queuePayloadFor(items) {
  return {
    jsonrpc: "2.0",
    id: "top-level-sites-2026-05-26",
    method: "tools/call",
    params: {
      name: "queue_scan",
      arguments: {
        targets: items.map((site) => ({ domain: site.domain })),
      },
    },
  };
}

function queueCurl(payload) {
  return `curl -sS -X POST https://agentic-first.co/companies/mcp \\
  -H 'content-type: application/json' \\
  -H 'accept: application/json, text/event-stream' \\
  -d '${JSON.stringify(payload).replace(/'/g, "'\"'\"'")}'
`;
}

function edgeCaddyReadme(items) {
  const rows = items
    .map((site) => `127.0.0.1:${site.port}  ${site.domain}`)
    .join("\n");

  return `# Generated Edge Caddy Routes

These snippets route each public hostname to its own local container:

\`\`\`text
${rows}
\`\`\`

Do not apply these until the containers are running and the DNS A records
are ready to point at the server.
`;
}

function serviceName(domain) {
  return domain.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function initialsFor(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function signalSvgFor(site) {
  const name = escapeHtml(site.name);
  return `<svg viewBox="0 0 420 520" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${name} holding-page visual">
  <rect width="420" height="520" fill="#ffffff" opacity="0.18"/>
  <path d="M60 92h300M60 166h300M60 240h300M60 314h300M60 388h300" stroke="${site.theme}" stroke-opacity=".16" stroke-width="1"/>
  <path d="M106 72v376M184 72v376M262 72v376M340 72v376" stroke="${site.theme}" stroke-opacity=".12" stroke-width="1"/>
  <rect x="58" y="70" width="304" height="378" rx="18" fill="#fff" fill-opacity=".62" stroke="${site.theme}" stroke-opacity=".18"/>
  <path d="M95 364c51-74 89-89 135-46 39 36 65 12 101-63" fill="none" stroke="${site.accent}" stroke-width="9" stroke-linecap="round"/>
  <path d="M95 282c43-26 72-28 109-4 48 31 72 6 127-72" fill="none" stroke="${site.secondary || "#f3c77a"}" stroke-width="7" stroke-linecap="round" opacity=".86"/>
  <circle cx="95" cy="364" r="11" fill="${site.theme}"/>
  <circle cx="230" cy="318" r="11" fill="${site.theme}"/>
  <circle cx="331" cy="255" r="11" fill="${site.theme}"/>
  <rect x="86" y="112" width="92" height="12" rx="6" fill="${site.theme}" opacity=".84"/>
  <rect x="86" y="136" width="178" height="8" rx="4" fill="${site.theme}" opacity=".18"/>
  <rect x="86" y="154" width="132" height="8" rx="4" fill="${site.theme}" opacity=".14"/>
  <rect x="248" y="106" width="74" height="34" rx="8" fill="${site.accent}" opacity=".9"/>
  <rect x="102" y="414" width="52" height="10" rx="5" fill="${site.theme}" opacity=".22"/>
  <rect x="174" y="414" width="52" height="10" rx="5" fill="${site.theme}" opacity=".22"/>
  <rect x="246" y="414" width="52" height="10" rx="5" fill="${site.theme}" opacity=".22"/>
</svg>`;
}

function dilijenzMarkSvg(theme, accent) {
  return `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
  <path d="M80 18 145 128H92L80 108 68 128H15L80 18Z" fill="${theme}"/>
  <path d="M80 18 145 128H108L80 80 52 128H15L80 18Z" fill="${accent}" opacity=".72"/>
  <path d="M80 58 112 112H93L80 90 67 112H48L80 58Z" fill="#fff" opacity=".82"/>
</svg>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function relative(target) {
  return path.relative(process.cwd(), target) || ".";
}
