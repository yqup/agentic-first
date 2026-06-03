import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sitesPath = path.join(__dirname, "sites.json");
const distDir = path.join(__dirname, "dist");
const edgeCaddyDir = path.join(__dirname, "infra", "caddy", "sites");
const serverRoot = "/srv/apps/top-level-sites/current";
const gammaOrigin = "https://sites.gamma.app";
const matomoTrackerUrl = "https://tonywood.matomo.cloud/matomo.php";
const matomoScriptUrl = "https://tonywood.matomo.cloud/matomo.js";
const matomoLoaderPath = "/static/js/matomo-loader.js";
const nodeServerPort = 8080;
const updatedAt = "2026-05-26T00:00:00Z";
const firstPort = 8211;

const sites = JSON.parse(await readFile(sitesPath, "utf8")).map((site, index) => ({
  ...site,
  mode: site.mode || "gamma",
  port: site.port || firstPort + index,
  service: serviceName(site.domain),
}));
const previousGammaSnapshots = await loadPreviousGammaSnapshots(sites);

await rm(distDir, { recursive: true, force: true });
await rm(edgeCaddyDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await mkdir(edgeCaddyDir, { recursive: true });

const manifest = [];

for (const site of sites) {
  const siteRoot = path.join(distDir, site.domain);
  const wwwRoot = path.join(siteRoot, "www");
  const wellKnownDir = path.join(wwwRoot, ".well-known");
  const staticJsDir = path.join(wwwRoot, "static", "js");

  await mkdir(wellKnownDir, { recursive: true });
  await mkdir(staticJsDir, { recursive: true });

  const profile = profileFor(site);
  await writeFile(path.join(siteRoot, "Caddyfile"), containerCaddyFor(site), "utf8");
  await writeFile(path.join(wwwRoot, "server.mjs"), nodeServerFor(site), "utf8");
  await writeFile(path.join(wwwRoot, "matomo-config.json"), `${JSON.stringify(matomoConfigFor(site), null, 2)}\n`, "utf8");
  await writeFile(path.join(staticJsDir, "matomo-loader.js"), matomoLoaderSource(), "utf8");
  await writeFile(path.join(wwwRoot, "favicon.svg"), faviconFor(site), "utf8");
  await writeFile(path.join(wwwRoot, "healthz"), healthFor(site), "utf8");
  await writeFile(path.join(wwwRoot, "llms.txt"), llmsFor(site, profile), "utf8");
  await writeFile(path.join(wwwRoot, "robots.txt"), "User-agent: *\nAllow: /\n", "utf8");
  await copySiteAssets(site, wwwRoot);
  if (site.mode === "holding") {
    const holdingPage = site.holding_page || {};
    const html = holdingPage.template === "logo"
      ? logoHoldingPageFor(site, { title: site.title, ...holdingPage })
      : holdingPageFor(site);
    await writeFile(path.join(wwwRoot, "index.html"), html, "utf8");
  }
  if (site.mode === "country") {
    await writeFile(path.join(wwwRoot, "index.html"), countryPageFor(site), "utf8");
  }
  if (site.mode === "cao") {
    await writeFile(path.join(wwwRoot, "index.html"), chiefAgenticOfficerPageFor(site), "utf8");
  }
  if (site.mode === "agentics_home") {
    await writeFile(path.join(wwwRoot, "index.html"), agenticsHomePageFor(site), "utf8");
  }
  if (site.mode === "ai_ops") {
    await writeFile(path.join(wwwRoot, "index.html"), aiOperationsPageFor(site), "utf8");
  }
  if (site.mode === "orchistra") {
    await writeFile(path.join(wwwRoot, "index.html"), orchistraPageFor(site), "utf8");
  }
  if (site.mode === "gamma") {
    await writeFile(
      path.join(wwwRoot, "index.html"),
      await gammaSnapshotPageFor(site, previousGammaSnapshots.get(site.domain)),
      "utf8",
    );
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
    matomo_site_id: site.matomo_site_id || null,
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

async function loadPreviousGammaSnapshots(items) {
  const snapshots = new Map();
  await Promise.all(items
    .filter((site) => (site.mode || "gamma") === "gamma")
    .map(async (site) => {
      try {
        const html = await readFile(path.join(distDir, site.domain, "www", "index.html"), "utf8");
        snapshots.set(site.domain, html);
      } catch {
        // First build or missing cached snapshot; the live Gamma fetch remains authoritative.
      }
    }));
  return snapshots;
}

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

function matomoConfigFor(site) {
  return {
    enabled: Boolean(site.matomo_site_id),
    trackerUrl: matomoTrackerUrl,
    scriptUrl: matomoScriptUrl,
    siteId: String(site.matomo_site_id || ""),
    hostnames: [site.domain, `www.${site.domain}`],
  };
}

function matomoScriptTagFor(site) {
  if (!site.matomo_site_id) return "";
  return `  <script defer src="${matomoLoaderPath}"></script>\n`;
}

function matomoLoaderSource() {
  return `(() => {
  const currentScript = document.currentScript;
  const configUrl = currentScript?.dataset.config || "/matomo-config.json";

  function cleanUrl(value) {
    if (!value || typeof value !== "string") return "";
    try {
      const url = new URL(value, window.location.href);
      if (url.protocol !== "https:") return "";
      return url.href;
    } catch {
      return "";
    }
  }

  function matomoScriptUrl(config, trackerUrl) {
    const explicit = cleanUrl(config.scriptUrl);
    if (explicit) return explicit;
    try {
      const url = new URL(trackerUrl);
      url.pathname = url.pathname.replace(/matomo\\.php$/, "matomo.js");
      return url.href;
    } catch {
      return "";
    }
  }

  function allowedHost(config) {
    const hostnames = Array.isArray(config.hostnames)
      ? config.hostnames.map((host) => String(host).trim().toLowerCase()).filter(Boolean)
      : [];
    return hostnames.length === 0 || hostnames.includes(window.location.hostname.toLowerCase());
  }

  function enableMatomo(config) {
    if (!config || config.enabled === false || !allowedHost(config)) return;
    const trackerUrl = cleanUrl(config.trackerUrl);
    const siteId = String(config.siteId || "").trim();
    if (!trackerUrl || !siteId) return;

    window._paq = window._paq || [];
    window._paq.push(["setTrackerUrl", trackerUrl]);
    window._paq.push(["setSiteId", siteId]);
    window._paq.push(["disableCookies"]);
    window._paq.push(["trackPageView"]);
    window._paq.push(["enableLinkTracking"]);

    const scriptUrl = matomoScriptUrl(config, trackerUrl);
    if (!scriptUrl) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = scriptUrl;
    document.head.appendChild(script);
  }

  fetch(configUrl, { cache: "no-store", credentials: "omit" })
    .then((response) => (response.ok ? response.json() : null))
    .then(enableMatomo)
    .catch(() => {});
})();
`;
}

function isLocalPageMode(mode) {
  return ["holding", "country", "cao", "agentics_home", "ai_ops", "orchistra", "gamma"].includes(mode);
}

function composeFor(items) {
  const services = items
    .map((site) => `  ${site.service}:
    image: node:20-alpine
    container_name: site-${site.service}
    restart: unless-stopped
    read_only: true
    user: node
    command: ["node", "/srv/site/server.mjs"]
    ports:
      - "127.0.0.1:${site.port}:${nodeServerPort}"
    volumes:
      - ./dist/${site.domain}/www:/srv/site:ro
    tmpfs:
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
  const wwwRedirectBlock = site.redirect_www_to_apex
    ? `
	@www_apex_redirect host www.${site.domain}
	redir @www_apex_redirect https://${site.domain}{uri} permanent
`
    : "";
  const pageHandler = isLocalPageMode(site.mode)
    ? `handle {
		try_files {path} /index.html
		file_server
	}`
    : `handle {
		respond "unsupported site mode" 500
	}`;

  return `{
	admin off
	auto_https off
}

:8080 {
	root * /srv/site
	encode zstd gzip
${wwwRedirectBlock}

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

	@local_assets path /llms.txt /robots.txt /favicon.svg /matomo-config.json /static/*
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

function nodeServerFor(site) {
  const serverConfig = {
    domain: site.domain,
    mode: site.mode,
    gammaOrigin,
    matomoLoaderPath,
    analyticsTag: matomoScriptTagFor(site).trim(),
    faviconTag: faviconLinkTagFor(site).trim(),
    hostHoldingPages: site.host_holding_pages || [],
    redirectWwwToApex: Boolean(site.redirect_www_to_apex),
  };

  return `import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const config = ${JSON.stringify(serverConfig, null, 2)};
const root = path.dirname(fileURLToPath(import.meta.url));
const listenPort = Number(process.env.PORT || ${nodeServerPort});
const hostHoldingHosts = new Set(config.hostHoldingPages.map((page) => String(page.host || "").toLowerCase()));
const localPageMode = ["holding", "country", "cao", "agentics_home", "ai_ops", "orchistra", "gamma"].includes(config.mode);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
]);

const server = createServer(async (req, res) => {
  try {
    await routeRequest(req, res);
  } catch (error) {
    console.error("request_error", error);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    }
    res.end("internal server error\\n");
  }
});

server.listen(listenPort, "0.0.0.0", () => {
  console.log("site_server_ready domain=" + config.domain + " mode=" + config.mode + " port=" + listenPort);
});

async function routeRequest(req, res) {
  const url = new URL(req.url || "/", "http://" + (req.headers.host || config.domain));
  const pathname = url.pathname;
  const requestHost = hostOnly(req.headers.host || "");

  if (config.redirectWwwToApex && requestHost === "www." + hostOnly(config.domain)) {
    redirectToApex(req, res, url);
    return;
  }

  if (isLocalStaticPath(pathname)) {
    const served = await serveLocalFile(req, res, pathname);
    if (!served) notFound(res);
    return;
  }

  if (hostHoldingHosts.has(requestHost)) {
    await serveLocalFile(req, res, "/hosts/" + requestHost + "/index.html", "no-store");
    return;
  }

  if (localPageMode) {
    await serveLocalFile(req, res, "/index.html", "no-store");
    return;
  }

  await proxyGamma(req, res);
}

function isLocalStaticPath(pathname) {
  return pathname === "/healthz"
    || pathname === "/llms.txt"
    || pathname === "/robots.txt"
    || pathname === "/favicon.svg"
    || pathname === "/matomo-config.json"
    || pathname.startsWith("/.well-known/")
    || pathname.startsWith("/assets/")
    || pathname.startsWith("/static/");
}

async function serveLocalFile(req, res, requestPath, cacheControl = "public, max-age=300") {
  if (req.method !== "GET" && req.method !== "HEAD") {
    methodNotAllowed(res);
    return true;
  }

  const filePath = safeLocalPath(requestPath);
  if (!filePath) return false;

  let info;
  try {
    info = await stat(filePath);
  } catch {
    return false;
  }
  if (!info.isFile()) return false;

  const headers = {
    "content-type": contentTypeFor(filePath),
    "content-length": String(info.size),
    "cache-control": requestPath === "/healthz" ? "no-store" : cacheControl,
  };

  res.writeHead(200, headers);
  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  createReadStream(filePath).on("error", () => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }).pipe(res);
  return true;
}

function safeLocalPath(requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return "";
  }

  const normalized = path.posix.normalize(decoded).replace(/^\\/+/, "");
  const filePath = path.join(root, normalized);
  const relativePath = path.relative(root, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return "";
  return filePath;
}

function contentTypeFor(filePath) {
  return contentTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
}

function hostOnly(value) {
  return String(value).split(":")[0].trim().toLowerCase();
}

function redirectToApex(req, res, url) {
  res.writeHead(308, {
    "location": "https://" + config.domain + url.pathname + url.search,
    "cache-control": "public, max-age=300",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end("redirecting to https://" + config.domain + url.pathname + url.search + "\\n");
}

function methodNotAllowed(res) {
  res.writeHead(405, {
    "content-type": "text/plain; charset=utf-8",
    "allow": "GET, HEAD",
    "cache-control": "no-store",
  });
  res.end("method not allowed\\n");
}

function notFound(res) {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  res.end("not found\\n");
}

function proxyGamma(req, res) {
  return new Promise((resolve) => {
    const upstreamUrl = new URL(req.url || "/", config.gammaOrigin);
    const upstreamReq = httpsRequest({
      protocol: upstreamUrl.protocol,
      hostname: upstreamUrl.hostname,
      port: upstreamUrl.port || 443,
      method: req.method,
      path: upstreamUrl.pathname + upstreamUrl.search,
      servername: upstreamUrl.hostname,
      headers: upstreamHeaders(req),
    }, (upstreamRes) => {
      const statusCode = upstreamRes.statusCode || 502;
      const headers = responseHeaders(upstreamRes.headers);
      const contentType = String(upstreamRes.headers["content-type"] || "");
      const canInject = Boolean(config.analyticsTag)
        && req.method !== "HEAD"
        && contentType.toLowerCase().includes("text/html");

      if (!canInject) {
        res.writeHead(statusCode, headers);
        if (req.method === "HEAD") {
          res.end();
          resolve();
          return;
        }
        upstreamRes.pipe(res);
        upstreamRes.on("end", resolve);
        return;
      }

      const chunks = [];
      upstreamRes.on("data", (chunk) => chunks.push(chunk));
      upstreamRes.on("end", () => {
        const html = Buffer.concat(chunks).toString("utf8");
        const body = Buffer.from(injectAnalytics(html), "utf8");
        headers["content-type"] = contentType || "text/html; charset=utf-8";
        headers["content-length"] = String(body.length);
        delete headers["content-security-policy"];
        res.writeHead(statusCode, headers);
        res.end(body);
        resolve();
      });
    });

    upstreamReq.on("error", (error) => {
      console.error("gamma_proxy_error", error);
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      }
      res.end("bad gateway\\n");
      resolve();
    });

    req.pipe(upstreamReq);
  });
}

function upstreamHeaders(req) {
  const headers = { ...req.headers };
  for (const name of [
    "accept-encoding",
    "connection",
    "host",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]) {
    delete headers[name];
  }
  headers.host = config.domain;
  headers["accept-encoding"] = "identity";
  headers["x-forwarded-host"] = req.headers.host || config.domain;
  return headers;
}

function responseHeaders(source) {
  const headers = { ...source };
  for (const name of [
    "content-encoding",
    "content-length",
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]) {
    delete headers[name];
  }
  headers["x-top-level-sites-container"] = "node";
  return headers;
}

function injectAnalytics(html) {
  let next = html;
  if (config.analyticsTag && !next.includes(config.matomoLoaderPath)) {
    next = injectBeforeHeadClose(next, config.analyticsTag);
  }
  if (config.faviconTag && !hasFaviconReference(next)) {
    next = injectBeforeHeadClose(next, config.faviconTag);
  }
  return next;
}

function hasFaviconReference(html) {
  return /rel=["'][^"']*(?:shortcut\\s+)?icon[^"']*["']/i.test(html)
    || /rel=["']apple-touch-icon["']/i.test(html)
    || /\\/favicon\\./i.test(html);
}

function injectBeforeHeadClose(html, tag) {
  if (/<\\/head\\s*>/i.test(html)) {
    return html.replace(/<\\/head\\s*>/i, tag + "\\n</head>");
  }
  return tag + "\\n" + html;
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
      : site.mode === "cao"
        ? "Normal pages are served by the per-site bespoke Chief Agentic Officer container."
        : site.mode === "agentics_home"
          ? "Normal pages are served by the per-site My Agentic home container."
          : site.mode === "ai_ops"
            ? "Normal pages are served by the per-site AIperations operations container."
            : site.mode === "orchistra"
              ? "Normal pages are served by the per-site bespoke Orchistra container."
              : "Normal pages are handled by the per-site container from an ingested Gamma snapshot.";
  const hostBlock = site.redirect_www_to_apex
    ? `${site.domain} {
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

www.${site.domain} {
	encode zstd gzip

	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options    "nosniff"
		Referrer-Policy           "strict-origin-when-cross-origin"
		-Server
	}

	redir https://${site.domain}{uri} permanent

	log {
		output file /var/log/caddy/${site.domain}.access.log {
			roll_size 10mb
			roll_keep 14
		}
		format json
	}
}`
    : `${site.domain}, www.${site.domain} {
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
}`;

  return `# Edge route for ${site.domain}.
# Generated by top-level-sites/build-sites.mjs. Review before applying on ANI.
# ${pageNote}

${hostBlock}
`;
}

function faviconFor(site) {
  if (site.domain === "orchistra.com") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#163a32"/>
  <path d="M18 42C25 30 35 35 46 21" fill="none" stroke="#fffdf7" stroke-width="4" stroke-linecap="round"/>
  <circle cx="18" cy="42" r="7" fill="#92c7d6"/>
  <circle cx="32" cy="32" r="8" fill="#d8a13a"/>
  <circle cx="46" cy="21" r="7" fill="#e05d45"/>
  <circle cx="32" cy="32" r="15" fill="none" stroke="#fffdf7" stroke-width="3" opacity=".92"/>
  <path d="M26 32a6 6 0 1 0 12 0a6 6 0 1 0-12 0" fill="#163a32"/>
</svg>
`;
  }

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

function faviconLinkTagFor(site) {
  return `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`;
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
      : site.mode === "cao"
        ? `The human-facing page is a local static Chief Agentic Officer page
with a board-mandate and operating-control treatment. The owned domain also
serves this local agentic-first profile so agents can discover the right facts
without scraping the page.`
        : site.mode === "agentics_home"
          ? `The human-facing page is a local static My Agentic home page for
agentics that need stable URLs, readable profiles, owners, boundaries, and
status. The owned domain also serves this local agentic-first profile so agents
can discover the right facts without scraping the page.`
          : site.mode === "ai_ops"
            ? `The human-facing page is a local static AIperations page about
the operating discipline required to turn AI pilots into adopted, measurable,
governed work. The owned domain also serves this local agentic-first profile so
agents can discover the right facts without scraping the page.`
            : site.mode === "orchistra"
              ? `The human-facing page is a local static Orchistra page with a
field-map orchestration treatment. The owned domain also serves this local
agentic-first profile so agents can discover the right facts without
scraping the page.`
              : `The human-facing design for this site is ingested from Gamma into the
per-site local container. The owned domain also serves this local agentic-first
profile so agents can discover the right facts without scraping the Gamma page.`;

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
        : site.mode === "cao"
          ? "static-cao-container"
          : site.mode === "agentics_home"
            ? "static-agentics-home-container"
            : site.mode === "ai_ops"
              ? "static-ai-operations-container"
              : site.mode === "orchistra"
                ? "static-orchistra-container"
                : "gamma-fronting-container",
    updated_at: updatedAt,
    agentic_profile: "/.well-known/agentic-profile.json",
    matomo_site_id: site.matomo_site_id || null,
  };

  if (site.mode === "gamma") health.gamma_origin = gammaOrigin;
  return `${JSON.stringify(health)}\n`;
}

async function gammaSnapshotPageFor(site, fallbackHtml) {
  let html;
  try {
    html = await fetchGammaHtml(site);
  } catch (error) {
    if (!fallbackHtml) throw error;
    console.warn(`Gamma snapshot unavailable for ${site.domain}; using previous generated snapshot.`);
    html = fallbackHtml;
  }
  return injectFaviconLink(injectMatomoScriptTag(html, site), site);
}

function fetchGammaHtml(site) {
  return new Promise((resolve, reject) => {
    const target = new URL(gammaOrigin);
    const req = httpsRequest({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 443,
      method: "GET",
      path: "/",
      servername: target.hostname,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-encoding": "identity",
        host: site.domain,
        "user-agent": "top-level-sites-build/1.0",
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const statusCode = res.statusCode || 0;
        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`Gamma snapshot failed for ${site.domain}: HTTP ${statusCode}`));
          return;
        }
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
    });

    req.setTimeout(15000, () => {
      req.destroy(new Error(`Gamma snapshot timed out for ${site.domain}`));
    });
    req.on("error", reject);
    req.end();
  });
}

function injectMatomoScriptTag(html, site) {
  const tag = matomoScriptTagFor(site).trim();
  if (!tag || html.includes(matomoLoaderPath)) return html;
  if (/<\/head\s*>/i.test(html)) {
    return html.replace(/<\/head\s*>/i, `${tag}\n</head>`);
  }
  return `${tag}\n${html}`;
}

function injectFaviconLink(html, site) {
  if (hasFaviconReference(html)) return html;
  const tag = faviconLinkTagFor(site).trim();
  if (/<\/head\s*>/i.test(html)) {
    return html.replace(/<\/head\s*>/i, `${tag}\n</head>`);
  }
  return `${tag}\n${html}`;
}

function hasFaviconReference(html) {
  return /rel=["'][^"']*(?:shortcut\s+)?icon[^"']*["']/i.test(html)
    || /rel=["']apple-touch-icon["']/i.test(html)
    || /\/favicon\./i.test(html);
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
${matomoScriptTagFor(site)}  <style>
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
${matomoScriptTagFor(site)}  <style>
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

function chiefAgenticOfficerPageFor(site) {
  const proof = site.proof || [
    "Mandate",
    "Control",
    "Cadence",
    "Assurance",
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
${matomoScriptTagFor(site)}  <style>
    :root {
      color-scheme: light;
      --ink: #1f2521;
      --ink-soft: #596059;
      --paper: #f5f0e4;
      --porcelain: #fffdf7;
      --sage: #617d66;
      --sage-dark: #2d4538;
      --oxblood: #8f342d;
      --brass: #b9822d;
      --charcoal: #202726;
      --line: rgba(31, 37, 33, 0.16);
      --shadow: 0 22px 64px rgba(31, 37, 33, 0.13);
      --sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --serif: Georgia, "Times New Roman", serif;
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
      overflow-x: hidden;
    }

    body {
      margin: 0;
      overflow-x: hidden;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--sans);
      font-size: 17px;
      line-height: 1.56;
      letter-spacing: 0;
    }

    a {
      color: inherit;
      text-decoration-thickness: 0.08em;
      text-underline-offset: 0.18em;
    }

    .site-header {
      min-height: 68px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 28px;
      padding: 14px 40px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 253, 247, 0.94);
      color: var(--ink);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      font-weight: 860;
      text-decoration: none;
    }

    .brand-mark {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border: 1px solid var(--ink);
      background: var(--charcoal);
      color: var(--porcelain);
      font-size: 12px;
      font-weight: 900;
      line-height: 1;
    }

    nav {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px 22px;
      color: var(--ink-soft);
      font-size: 14px;
      font-weight: 780;
    }

    nav a {
      text-decoration: none;
    }

    .hero {
      min-height: 82svh;
      display: grid;
      grid-template-columns: minmax(0, 0.95fr) minmax(360px, 1.05fr);
      gap: 40px;
      align-items: stretch;
      padding: 44px 40px 0;
      border-bottom: 1px solid var(--line);
      background:
        linear-gradient(110deg, rgba(255, 253, 247, 0.94), rgba(245, 240, 228, 0.72)),
        linear-gradient(180deg, #fffdf7, #eadfca);
    }

    .hero-copy-wrap {
      align-self: end;
      padding: 56px 0 64px;
    }

    .eyebrow {
      margin: 0 0 14px;
      color: var(--oxblood);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
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
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }

    h1 {
      max-width: 11ch;
      margin-bottom: 24px;
      font-family: var(--serif);
      font-size: 84px;
      line-height: 0.96;
      font-weight: 700;
    }

    h2 {
      max-width: 900px;
      margin-bottom: 18px;
      font-family: var(--serif);
      font-size: 50px;
      line-height: 1.04;
      font-weight: 700;
    }

    h3 {
      margin-bottom: 10px;
      font-size: 22px;
      line-height: 1.18;
    }

    .hero-copy {
      max-width: 680px;
      margin: 0;
      color: var(--ink-soft);
      font-size: 22px;
      line-height: 1.46;
    }

    .hero-actions,
    .cta-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 30px;
    }

    .button {
      min-height: 46px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 18px;
      border: 1px solid currentColor;
      border-radius: 4px;
      font-weight: 820;
      text-decoration: none;
    }

    .button.primary {
      background: var(--charcoal);
      color: var(--porcelain);
      border-color: var(--charcoal);
    }

    .button.secondary {
      color: var(--charcoal);
    }

    .mandate-panel {
      align-self: end;
      min-height: 620px;
      display: grid;
      align-items: end;
      padding: 28px 0 44px;
    }

    .mandate-card {
      position: relative;
      min-height: 520px;
      border: 1px solid rgba(31, 37, 33, 0.24);
      border-radius: 8px 8px 0 0;
      background: var(--porcelain);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .mandate-card::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(90deg, transparent 0 24%, rgba(31, 37, 33, 0.06) 24% 24.3%, transparent 24.3% 50%, rgba(31, 37, 33, 0.05) 50% 50.3%, transparent 50.3% 76%, rgba(31, 37, 33, 0.05) 76% 76.3%, transparent 76.3%),
        linear-gradient(180deg, transparent 0 18%, rgba(31, 37, 33, 0.06) 18% 18.4%, transparent 18.4% 43%, rgba(31, 37, 33, 0.05) 43% 43.4%, transparent 43.4% 70%, rgba(31, 37, 33, 0.05) 70% 70.4%, transparent 70.4%);
      pointer-events: none;
    }

    .mandate-title {
      position: absolute;
      top: 24px;
      left: 24px;
      right: 24px;
      display: flex;
      justify-content: space-between;
      gap: 20px;
      color: var(--ink);
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .mandate-svg {
      position: absolute;
      inset: 76px 20px 24px;
    }

    .mandate-svg svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    .metric-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      border-bottom: 1px solid var(--line);
      background: var(--charcoal);
      color: var(--porcelain);
    }

    .metric-strip span {
      min-height: 68px;
      display: flex;
      align-items: center;
      padding: 18px 24px;
      border-right: 1px solid rgba(255, 253, 247, 0.18);
      font-size: 14px;
      font-weight: 900;
    }

    .section {
      padding: 84px 40px;
    }

    .section-inner {
      width: min(100%, 1180px);
      margin: 0 auto;
    }

    .brief {
      display: grid;
      grid-template-columns: minmax(0, 0.86fr) minmax(320px, 1.14fr);
      gap: 64px;
      align-items: start;
    }

    .lead {
      max-width: 740px;
      color: var(--ink-soft);
      font-size: 22px;
      line-height: 1.5;
    }

    .work-band {
      background: var(--porcelain);
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }

    .route-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      margin-top: 32px;
    }

    .route-card,
    .note-panel {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fffaf0;
      box-shadow: var(--shadow);
    }

    .route-card {
      min-height: 250px;
      display: grid;
      align-content: space-between;
      padding: 24px;
      border-top: 7px solid var(--brass);
    }

    .route-card:nth-child(2) {
      border-top-color: var(--oxblood);
    }

    .route-card:nth-child(3) {
      border-top-color: var(--sage);
    }

    .route-card span,
    .note-panel span {
      display: block;
      margin-bottom: 24px;
      color: var(--oxblood);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .route-card strong {
      display: block;
      color: var(--ink);
      font-size: 23px;
      line-height: 1.18;
    }

    .route-card p,
    .note-panel p {
      margin: 14px 0 0;
      color: var(--ink-soft);
    }

    .control-band {
      background: var(--charcoal);
      color: var(--porcelain);
    }

    .control-band .eyebrow {
      color: #f0bd65;
    }

    .control-band p {
      max-width: 820px;
      color: rgba(255, 253, 247, 0.82);
      font-size: 22px;
      line-height: 1.52;
    }

    .cadence {
      display: grid;
      grid-template-columns: minmax(280px, 0.75fr) minmax(0, 1.25fr);
      gap: 54px;
      align-items: start;
    }

    .note-list {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .note-panel {
      min-height: 220px;
      padding: 24px;
    }

    .cta {
      background: var(--paper);
    }

    .cta-panel {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 32px;
      align-items: end;
      padding: 34px 0 0;
      border-top: 1px solid var(--line);
    }

    .cta-panel p {
      max-width: 740px;
      color: var(--ink-soft);
      font-size: 20px;
    }

    footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 24px;
      padding: 30px 40px;
      border-top: 1px solid var(--line);
      background: var(--porcelain);
      color: var(--ink-soft);
      font-size: 14px;
    }

    footer strong {
      color: var(--ink);
    }

    @media (prefers-reduced-motion: no-preference) {
      .signal-line {
        stroke-dasharray: 9 13;
        animation: mandateDrift 18s linear infinite;
      }

      .decision-node {
        transform-origin: center;
        animation: decisionPulse 4.6s ease-in-out infinite;
      }
    }

    @keyframes mandateDrift {
      to {
        stroke-dashoffset: -220;
      }
    }

    @keyframes decisionPulse {
      50% {
        opacity: 0.58;
        transform: scale(1.08);
      }
    }

    @media (max-width: 980px) {
      .site-header {
        align-items: flex-start;
        flex-direction: column;
        padding: 14px 22px;
      }

      nav {
        justify-content: flex-start;
      }

      .hero {
        min-height: auto;
        grid-template-columns: 1fr;
        gap: 0;
        padding: 48px 22px 0;
      }

      .hero-copy-wrap {
        padding: 36px 0 34px;
      }

      .mandate-panel {
        min-height: auto;
        padding: 0 0 22px;
      }

      .mandate-card {
        min-height: 300px;
      }

      h1 {
        font-size: 58px;
      }

      h2 {
        font-size: 38px;
      }

      .hero-copy,
      .lead,
      .control-band p {
        font-size: 19px;
      }

      .metric-strip,
      .brief,
      .route-grid,
      .cadence,
      .note-list,
      .cta-panel {
        grid-template-columns: 1fr;
      }

      .section {
        padding: 64px 22px;
      }

      .route-card,
      .note-panel {
        min-height: auto;
      }
    }

    @media (max-width: 560px) {
      h1 {
        font-size: 44px;
      }

      h2 {
        font-size: 32px;
      }

      .hero-copy,
      .lead,
      .cta-panel p,
      .control-band p {
        font-size: 18px;
      }

      .button {
        width: 100%;
      }

      .mandate-card {
        min-height: 220px;
      }

      .mandate-svg {
        inset: 66px 12px 10px;
      }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="${escapeHtml(site.name)} home">
      <span class="brand-mark">CAO</span>
      <span>${escapeHtml(site.name)}</span>
    </a>
    <nav aria-label="Primary navigation">
      <a href="#mandate">Mandate</a>
      <a href="#work">Work</a>
      <a href="#cadence">Cadence</a>
      <a href="#conversation">Conversation</a>
    </nav>
  </header>

  <main>
    <section class="hero" aria-labelledby="page-title">
      <div class="hero-copy-wrap">
        <p class="eyebrow">${escapeHtml(site.eyebrow || "Board mandate for agentic work")}</p>
        <h1 id="page-title">${escapeHtml(site.heading || site.name)}</h1>
        <p class="hero-copy">${escapeHtml(site.summary)}</p>
        <div class="hero-actions">
          <a class="button primary" href="#mandate">${escapeHtml(site.primary_action_label || "Read the mandate")}</a>
          <a class="button secondary" href="${escapeHtml(contactHref)}">${escapeHtml(site.secondary_action_label || "Start the conversation")}</a>
        </div>
      </div>

      <aside class="mandate-panel" aria-label="Mandate map">
        <div class="mandate-card">
          <div class="mandate-title">
            <span>Agentic operating mandate</span>
            <span>CAO</span>
          </div>
          <div class="mandate-svg" aria-hidden="true">
            ${caoMandateSvg()}
          </div>
        </div>
      </aside>
    </section>

    <section class="metric-strip" aria-label="Chief Agentic Officer concerns">
      ${proof.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
    </section>

    <section class="section" id="mandate">
      <div class="section-inner brief">
        <div>
          <p class="eyebrow">${escapeHtml(site.brief_eyebrow || "The mandate")}</p>
          <h2>${escapeHtml(site.brief_title || "Agentic AI needs an accountable operating owner.")}</h2>
        </div>
        <div>
          <p class="lead">${escapeHtml(site.brief || "The Chief Agentic Officer turns board ambition into a governed operating system for agentic work.")}</p>
          <p>${escapeHtml(site.brief_support || "The role connects strategy, permissions, assurance, escalation, value, and human judgement so agentic systems can do useful work without becoming unowned automation.")}</p>
        </div>
      </div>
    </section>

    <section class="section work-band" id="work">
      <div class="section-inner">
        <p class="eyebrow">${escapeHtml(site.work_eyebrow || "Where the role helps")}</p>
        <h2>${escapeHtml(site.work_title || "From pilots to accountable capability.")}</h2>
        <div class="route-grid">
          ${routes.map((route) => `<article class="route-card">
            <div>
              <span>${escapeHtml(route.title)}</span>
              <strong>${escapeHtml(route.heading || route.title)}</strong>
            </div>
            <p>${escapeHtml(route.body)}</p>
          </article>`).join("")}
        </div>
      </div>
    </section>

    <section class="section control-band">
      <div class="section-inner">
        <p class="eyebrow">${escapeHtml(site.tone_eyebrow || "Operating posture")}</p>
        <h2>${escapeHtml(site.tone_title || "Firm boundaries. Useful autonomy. Visible judgement.")}</h2>
        <p>${escapeHtml(site.tone_body || "The CAO is not a ceremonial title. It is the person or function that knows which agentic systems exist, what they can touch, when they stop, and how exceptions reach human judgement.")}</p>
      </div>
    </section>

    <section class="section" id="cadence">
      <div class="section-inner cadence">
        <div>
          <p class="eyebrow">${escapeHtml(site.cadence_eyebrow || "Operating cadence")}</p>
          <h2>${escapeHtml(site.cadence_title || "A weekly rhythm for agentic work.")}</h2>
          <p class="lead">${escapeHtml(site.cadence_body || "Make agentic work legible to executives: current estate, trust boundaries, incidents, value, lessons, and decisions needed.")}</p>
        </div>
        <div class="note-list">
          ${operatingNotes.map((note) => `<article class="note-panel">
            <span>${escapeHtml(note.label)}</span>
            <h3>${escapeHtml(note.title)}</h3>
            <p>${escapeHtml(note.body)}</p>
          </article>`).join("")}
        </div>
      </div>
    </section>

    <section class="section cta" id="conversation">
      <div class="section-inner cta-panel">
        <div>
          <p class="eyebrow">${escapeHtml(site.cta_eyebrow || "Useful first conversation")}</p>
          <h2>${escapeHtml(site.cta_title || "Start with the systems already shaping work.")}</h2>
          <p>${escapeHtml(site.cta_body || "Which agents, pilots, vendor promises, and shadow workflows already need ownership, boundaries, and review?")}</p>
        </div>
        <div class="cta-actions">
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
    <div>${escapeHtml(site.footer_tagline || "Board-level ownership for agentic systems, governance, and operating cadence.")}</div>
  </footer>
</body>
</html>
`;
}

function caoMandateSvg() {
  return `<svg viewBox="0 0 720 520" xmlns="http://www.w3.org/2000/svg">
  <rect width="720" height="520" fill="#fffdf7"/>
  <g stroke="#1f2521" stroke-opacity=".12" stroke-width="1">
    <path d="M92 80v380M248 80v380M404 80v380M560 80v380"/>
    <path d="M60 132h600M60 234h600M60 336h600M60 438h600"/>
  </g>
  <path d="M84 392C154 292 234 300 318 230c95-79 166-110 290-62" fill="none" stroke="#b9822d" stroke-width="6" stroke-linecap="round"/>
  <path class="signal-line" d="M94 180c70 48 127 56 194 24 68-33 126-20 184 42 43 46 90 60 152 33" fill="none" stroke="#8f342d" stroke-width="4" stroke-linecap="round"/>
  <path class="signal-line" d="M110 430c64-38 116-46 176-21 72 30 144 11 215-59 50-49 90-68 143-56" fill="none" stroke="#617d66" stroke-width="4" stroke-linecap="round" opacity=".88"/>
  <g fill="#1f2521">
    <circle cx="84" cy="392" r="7"/>
    <circle cx="318" cy="230" r="7"/>
    <circle cx="608" cy="168" r="7"/>
  </g>
  <g class="decision-node" fill="#8f342d" opacity=".72">
    <circle cx="318" cy="230" r="32"/>
    <circle cx="472" cy="246" r="24"/>
  </g>
  <g fill="#fffdf7" font-family="Inter, system-ui, sans-serif" font-weight="900" font-size="18">
    <text x="288" y="236">OWN</text>
    <text x="446" y="252">STOP</text>
  </g>
  <g fill="#1f2521" font-family="Inter, system-ui, sans-serif" font-weight="900" font-size="15">
    <text x="74" y="114">Intent</text>
    <text x="230" y="114">Boundaries</text>
    <text x="386" y="114">Assurance</text>
    <text x="542" y="114">Value</text>
  </g>
  <g fill="#596059" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="800">
    <text x="76" y="462">estate map</text>
    <text x="238" y="462">permissions</text>
    <text x="392" y="462">exceptions</text>
    <text x="552" y="462">decisions</text>
  </g>
</svg>`;
}

function aiOperationsPageFor(site) {
  const title = site.title || "AIperations";
  const summary = site.summary || "Practical operating discipline for AI in real work.";
  const email = site.contact?.email || "hello@aiperations.com";
  const contactHref = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("AI operations review")}`;
  const principles = [
    {
      k: "01",
      title: "Owner",
      body: "A named business owner carries value after go-live. The technical owner should not be the only accountable person.",
    },
    {
      k: "02",
      title: "Workflow",
      body: "The real work changes. Roles, handoffs, exceptions, training, support, and manager time are designed before scale.",
    },
    {
      k: "03",
      title: "Gate",
      body: "Pilots pass through a release gate that checks value, data, controls, adoption, escalation, and stop conditions.",
    },
    {
      k: "04",
      title: "Evidence",
      body: "Usage, overrides, incidents, resistance, cycle time, quality, and benefit movement are reviewed on a fixed cadence.",
    },
  ];
  const loops = [
    {
      label: "Before the pilot",
      title: "Define the operating bet.",
      body: "What business KPI should move, who owns it, and what current workflow will change?",
    },
    {
      label: "Before go-live",
      title: "Separate build from benefit.",
      body: "Set the technical owner, business owner, RACI, decision rights, training plan, and escalation route.",
    },
    {
      label: "After launch",
      title: "Manage the adoption curve.",
      body: "Review at 30, 90, 180, and 365 days. Tune, scale, pause, redesign, or stop with evidence.",
    },
  ];
  const checks = [
    "Baseline and target KPI",
    "Business owner for 6-12 months",
    "Workflow redesign agreed",
    "Manager capacity protected",
    "Human validation rules",
    "Incident and override logging",
    "Training tied to real work",
    "Stop or redesign criteria",
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(summary)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
${matomoScriptTagFor(site)}  <style>
    :root {
      color-scheme: light;
      --ink: #152925;
      --muted: #5e6d67;
      --paper: #f6f2e8;
      --panel: #fffdf7;
      --line: #d9d0bf;
      --green: #17312f;
      --blue: #527f95;
      --orange: #d97745;
      --gold: #d5aa4a;
      --rose: #a95858;
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      min-height: 100%;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--paper);
      letter-spacing: 0;
    }

    a {
      color: inherit;
    }

    .site-header {
      min-height: 72px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 0 40px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 253, 247, 0.96);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 840;
      text-decoration: none;
    }

    .brand-mark {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      color: #fffdf7;
      background: var(--green);
      font-size: 13px;
      line-height: 1;
      font-weight: 880;
    }

    nav {
      display: flex;
      gap: 22px;
      color: #41514c;
      font-size: 14px;
      font-weight: 760;
    }

    nav a {
      text-decoration: none;
    }

    .hero {
      min-height: calc(100vh - 72px);
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(360px, 540px);
      gap: 52px;
      align-items: center;
      padding: 58px 40px 46px;
      border-bottom: 1px solid var(--line);
    }

    .hero-copy {
      max-width: 780px;
    }

    .eyebrow {
      margin: 0 0 18px;
      color: var(--orange);
      font-size: 13px;
      line-height: 1.2;
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    h1 {
      margin: 0;
      max-width: 12ch;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 70px;
      line-height: 0.96;
      font-weight: 760;
      letter-spacing: 0;
    }

    .lede {
      max-width: 660px;
      margin: 24px 0 0;
      color: #40524c;
      font-size: 21px;
      line-height: 1.52;
      font-weight: 520;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 30px;
    }

    .button {
      min-height: 48px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 20px;
      border-radius: 7px;
      border: 1px solid var(--green);
      background: var(--green);
      color: #fffdf7;
      font-weight: 820;
      text-decoration: none;
    }

    .button.secondary {
      background: transparent;
      color: var(--green);
    }

    .ops-board {
      border: 1px solid #c8beaa;
      border-radius: 8px;
      overflow: hidden;
      background: var(--panel);
      box-shadow: 0 24px 60px rgba(21, 41, 37, 0.12);
    }

    .board-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      min-height: 58px;
      padding: 0 18px;
      border-bottom: 1px solid var(--line);
      background: #ede5d5;
      font-size: 13px;
      font-weight: 850;
      text-transform: uppercase;
    }

    .board-top span:last-child {
      color: var(--rose);
    }

    .board-flow {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border-bottom: 1px solid var(--line);
    }

    .flow-step {
      min-height: 120px;
      padding: 18px;
      border-right: 1px solid var(--line);
      display: grid;
      align-content: space-between;
      gap: 18px;
    }

    .flow-step:last-child {
      border-right: 0;
    }

    .flow-step strong {
      font-size: 15px;
      line-height: 1.2;
    }

    .flow-step span {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.3;
      font-weight: 760;
      text-transform: uppercase;
    }

    .flow-step:nth-child(1) {
      border-top: 6px solid var(--blue);
    }

    .flow-step:nth-child(2) {
      border-top: 6px solid var(--gold);
    }

    .flow-step:nth-child(3) {
      border-top: 6px solid var(--orange);
    }

    .flow-step:nth-child(4) {
      border-top: 6px solid var(--green);
    }

    .board-metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      background: var(--green);
      color: #fffdf7;
    }

    .metric {
      min-height: 86px;
      padding: 17px;
      border-right: 1px solid rgba(255, 253, 247, 0.18);
    }

    .metric:last-child {
      border-right: 0;
    }

    .metric strong {
      display: block;
      font-size: 18px;
      line-height: 1.2;
    }

    .metric span {
      display: block;
      margin-top: 6px;
      color: rgba(255, 253, 247, 0.74);
      font-size: 12px;
      line-height: 1.25;
      font-weight: 760;
    }

    .section {
      padding: 72px 40px;
      border-bottom: 1px solid var(--line);
    }

    .section-inner {
      width: min(1180px, 100%);
      margin: 0 auto;
    }

    .split {
      display: grid;
      grid-template-columns: minmax(240px, 0.8fr) minmax(0, 1.2fr);
      gap: 56px;
      align-items: start;
    }

    h2 {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 46px;
      line-height: 1.02;
      font-weight: 740;
      letter-spacing: 0;
    }

    .section-copy {
      margin: 18px 0 0;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.58;
    }

    .principles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .principle-card,
    .loop-card {
      min-height: 190px;
      padding: 24px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
    }

    .principle-card .number {
      display: inline-flex;
      width: 40px;
      height: 28px;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      background: #e7d7bb;
      color: var(--green);
      font-size: 12px;
      font-weight: 860;
    }

    .principle-card h3,
    .loop-card h3 {
      margin: 18px 0 0;
      font-size: 22px;
      line-height: 1.16;
      letter-spacing: 0;
    }

    .principle-card p,
    .loop-card p {
      margin: 12px 0 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.52;
    }

    .rhythm {
      background: #fffaf0;
    }

    .loop-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-top: 32px;
    }

    .loop-label {
      color: var(--orange);
      font-size: 12px;
      font-weight: 860;
      text-transform: uppercase;
    }

    .check-panel {
      display: grid;
      grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
      gap: 0;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
    }

    .check-copy {
      padding: 32px;
      background: var(--green);
      color: #fffdf7;
    }

    .check-copy h2 {
      color: #fffdf7;
      font-size: 40px;
    }

    .check-copy p {
      color: rgba(255, 253, 247, 0.76);
    }

    .checks {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .checks li {
      min-height: 72px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 18px 20px;
      border-bottom: 1px solid var(--line);
      border-right: 1px solid var(--line);
      color: #273b36;
      font-weight: 760;
    }

    .checks li:nth-child(2n) {
      border-right: 0;
    }

    .checks li:nth-last-child(-n + 2) {
      border-bottom: 0;
    }

    .check-dot {
      width: 12px;
      height: 12px;
      flex: 0 0 12px;
      border-radius: 4px;
      background: var(--orange);
    }

    .cta {
      padding: 64px 40px;
      background: var(--green);
      color: #fffdf7;
    }

    .cta-inner {
      width: min(1180px, 100%);
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 28px;
    }

    .cta h2 {
      max-width: 680px;
      color: #fffdf7;
    }

    .cta p {
      max-width: 620px;
      color: rgba(255, 253, 247, 0.75);
    }

    .cta .button {
      flex: 0 0 auto;
      border-color: #fffdf7;
      background: #fffdf7;
      color: var(--green);
    }

    footer {
      padding: 24px 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      color: #63716c;
      font-size: 13px;
      font-weight: 700;
      background: var(--paper);
    }

    @media (max-width: 980px) {
      .site-header {
        align-items: flex-start;
        flex-direction: column;
        justify-content: center;
        min-height: 116px;
        padding: 16px 22px;
      }

      nav {
        flex-wrap: wrap;
        gap: 14px;
      }

      .hero {
        min-height: auto;
        grid-template-columns: 1fr;
        gap: 36px;
        padding: 48px 22px 44px;
      }

      h1 {
        max-width: 13ch;
        font-size: 48px;
      }

      .lede {
        font-size: 19px;
      }

      .section {
        padding: 56px 22px;
      }

      .split,
      .check-panel,
      .cta-inner {
        grid-template-columns: 1fr;
      }

      .split,
      .cta-inner {
        display: grid;
        gap: 30px;
      }

      .principles,
      .loop-grid {
        grid-template-columns: 1fr;
      }

      .check-copy h2,
      h2 {
        font-size: 36px;
      }
    }

    @media (max-width: 560px) {
      .brand-mark {
        width: 38px;
        height: 38px;
      }

      h1 {
        font-size: 43px;
      }

      .actions,
      .button {
        width: 100%;
      }

      .ops-board {
        border-radius: 8px;
      }

      .board-flow,
      .board-metrics,
      .checks {
        grid-template-columns: 1fr;
      }

      .flow-step,
      .metric,
      .checks li,
      .checks li:nth-child(2n),
      .checks li:nth-last-child(-n + 2) {
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }

      .metric {
        border-color: rgba(255, 253, 247, 0.18);
      }

      .flow-step:last-child,
      .metric:last-child,
      .checks li:last-child {
        border-bottom: 0;
      }

      .board-top {
        min-height: 64px;
        align-items: flex-start;
        flex-direction: column;
        justify-content: center;
      }

      .principle-card,
      .loop-card,
      .check-copy {
        padding: 22px;
      }

      footer {
        align-items: flex-start;
        flex-direction: column;
        padding: 24px 22px;
      }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="AIperations home">
      <span class="brand-mark">AO</span>
      <span>AIperations</span>
    </a>
    <nav aria-label="Primary navigation">
      <a href="#discipline">Discipline</a>
      <a href="#rhythm">Rhythm</a>
      <a href="#gate">Gate</a>
    </nav>
  </header>

  <main>
    <section class="hero" aria-labelledby="page-title">
      <div class="hero-copy">
        <p class="eyebrow">${escapeHtml(site.eyebrow || "AI operations")}</p>
        <h1 id="page-title">${escapeHtml(site.heading || "Turn AI pilots into operating outcomes.")}</h1>
        <p class="lede">${escapeHtml(summary)}</p>
        <div class="actions">
          <a class="button" href="${escapeHtml(contactHref)}">Review an AI workflow</a>
          <a class="button secondary" href="/.well-known/agentic-profile.json">View site profile</a>
        </div>
      </div>

      <aside class="ops-board" aria-label="AI operations release board">
        <div class="board-top">
          <span>Prototype to production</span>
          <span>Operational discipline</span>
        </div>
        <div class="board-flow">
          <div class="flow-step">
            <span>Outcome</span>
            <strong>Baseline, target, owner</strong>
          </div>
          <div class="flow-step">
            <span>Model</span>
            <strong>Workflow, roles, controls</strong>
          </div>
          <div class="flow-step">
            <span>Launch</span>
            <strong>Gate, training, escalation</strong>
          </div>
          <div class="flow-step">
            <span>Realise</span>
            <strong>30 / 90 / 180 / 365 review</strong>
          </div>
        </div>
        <div class="board-metrics">
          <div class="metric">
            <strong>Value</strong>
            <span>measured against baseline</span>
          </div>
          <div class="metric">
            <strong>Trust</strong>
            <span>visible controls and overrides</span>
          </div>
          <div class="metric">
            <strong>Adoption</strong>
            <span>managed after go-live</span>
          </div>
        </div>
      </aside>
    </section>

    <section class="section" id="discipline">
      <div class="section-inner split">
        <div>
          <p class="eyebrow">The discipline</p>
          <h2>AI work becomes real when operations can absorb it.</h2>
          <p class="section-copy">The prototype answers whether the system can do something useful. AI operations answers whether the organisation can own it, trust it, improve it, and measure it inside real work.</p>
        </div>
        <div class="principles">
          ${principles.map((item) => `<article class="principle-card">
            <span class="number">${escapeHtml(item.k)}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
          </article>`).join("\n          ")}
        </div>
      </div>
    </section>

    <section class="section rhythm" id="rhythm">
      <div class="section-inner">
        <p class="eyebrow">Operating rhythm</p>
        <h2>From promising demo to managed value.</h2>
        <p class="section-copy">Keep the page simple: one workflow, one owner, one release gate, one review rhythm. Then learn in public enough for the next initiative to get sharper.</p>
        <div class="loop-grid">
          ${loops.map((item) => `<article class="loop-card">
            <span class="loop-label">${escapeHtml(item.label)}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
          </article>`).join("\n          ")}
        </div>
      </div>
    </section>

    <section class="section" id="gate">
      <div class="section-inner check-panel">
        <div class="check-copy">
          <p class="eyebrow">Release gate</p>
          <h2>Do not scale a demo. Scale an operating model.</h2>
          <p class="section-copy">A simple gate makes the hidden work visible before AI is declared production-ready.</p>
        </div>
        <ul class="checks" aria-label="AI operations release gate checklist">
          ${checks.map((item) => `<li><span class="check-dot" aria-hidden="true"></span><span>${escapeHtml(item)}</span></li>`).join("\n          ")}
        </ul>
      </div>
    </section>

    <section class="cta" aria-labelledby="cta-title">
      <div class="cta-inner">
        <div>
          <p class="eyebrow">Start small</p>
          <h2 id="cta-title">Pick one AI workflow and make the operating model visible.</h2>
          <p class="section-copy">Best first use: a pilot that has already impressed people technically but has not yet proved ownership, adoption, controls, or measurable value.</p>
        </div>
        <a class="button" href="${escapeHtml(contactHref)}">Review an AI workflow</a>
      </div>
    </section>
  </main>

  <footer>
    <span>AIperations</span>
    <span>AI operations for owners, workflows, gates, and measurable outcomes.</span>
  </footer>
</body>
</html>
`;
}

function agenticsHomePageFor(site) {
  const title = site.title || "My Agentic";
  const summary = site.summary || "A stable home for agentics that need a URL.";
  const email = site.contact?.email || "hello@my-agentic.com";
  const rooms = [
    {
      path: "/agentics/research",
      name: "Research",
      state: "reserved",
      body: "For agentics that gather signals, compare notes, and keep their sources readable.",
    },
    {
      path: "/agentics/boardroom",
      name: "Boardroom",
      state: "reserved",
      body: "For agentics that prepare governance, cadence, and decision support.",
    },
    {
      path: "/agentics/diligence",
      name: "Diligence",
      state: "reserved",
      body: "For agentics that organise checks, evidence, and gaps without losing context.",
    },
    {
      path: "/agentics/operations",
      name: "Operations",
      state: "reserved",
      body: "For agentics that watch workflows, handoffs, and status across practical work.",
    },
  ];
  const rules = [
    {
      title: "Stable URL",
      body: "Each agentic gets a public address that can be referenced by people, agents, and systems.",
    },
    {
      title: "Readable profile",
      body: "Purpose, owner, contact, permissions, inputs, outputs, and escalation stay visible.",
    },
    {
      title: "Clear boundary",
      body: "A home page says what the agentic can touch, what it cannot touch, and when it stops.",
    },
    {
      title: "Status surface",
      body: "A simple health note makes it clear whether the agentic is active, paused, or retired.",
    },
  ];
  const contract = ["identity", "purpose", "owner", "permissions", "boundaries", "status", "handoff"];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(summary)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
${matomoScriptTagFor(site)}  <style>
    :root {
      color-scheme: light;
      --ink: #182623;
      --muted: #60706a;
      --paper: #f7f4ec;
      --panel: #fffdf8;
      --line: #d8d0bf;
      --blue: #4f87a6;
      --clay: #985d52;
      --night: #10201d;
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
      color: var(--ink);
      background: var(--paper);
      letter-spacing: 0;
    }

    a {
      color: inherit;
    }

    .site-header {
      min-height: 72px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 0 40px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 253, 248, 0.94);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      font-weight: 820;
    }

    .brand-mark {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: var(--night);
      color: #fffdf8;
      font-size: 13px;
      font-weight: 860;
      line-height: 1;
    }

    nav {
      display: flex;
      gap: 20px;
      color: #43504b;
      font-size: 14px;
      font-weight: 760;
    }

    nav a {
      text-decoration: none;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(360px, 520px);
      gap: 48px;
      align-items: center;
      min-height: calc(100vh - 72px);
      padding: 56px 40px 44px;
      border-bottom: 1px solid var(--line);
    }

    .hero-copy {
      max-width: 820px;
    }

    .eyebrow {
      margin: 0 0 18px;
      color: var(--clay);
      font-size: 13px;
      line-height: 1.2;
      font-weight: 820;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    h1 {
      margin: 0;
      max-width: 12ch;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 74px;
      line-height: 0.96;
      font-weight: 760;
      letter-spacing: 0;
    }

    .lede {
      max-width: 690px;
      margin: 24px 0 0;
      color: #4e5d58;
      font-size: 21px;
      line-height: 1.5;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 30px;
    }

    .button {
      min-height: 46px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 18px;
      border: 1px solid var(--night);
      border-radius: 6px;
      background: var(--night);
      color: #fffdf8;
      text-decoration: none;
      font-weight: 800;
    }

    .button.secondary {
      background: transparent;
      color: var(--night);
    }

    .registry-panel {
      border: 1px solid #bfc8bd;
      border-radius: 8px;
      background: var(--panel);
      box-shadow: 0 18px 48px rgba(16, 32, 29, 0.10);
      overflow: hidden;
    }

    .registry-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px;
      border-bottom: 1px solid var(--line);
      background: #f1eadb;
      font-size: 13px;
      font-weight: 820;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    .registry-map {
      padding: 22px;
      display: grid;
      gap: 16px;
    }

    .address {
      display: grid;
      grid-template-columns: 92px minmax(0, 1fr);
      gap: 14px;
      align-items: center;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fffaf0;
    }

    .label {
      color: var(--muted);
      font-size: 12px;
      font-weight: 820;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    code {
      display: block;
      overflow-wrap: anywhere;
      color: #182623;
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 14px;
      line-height: 1.45;
    }

    .status-line {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      border-top: 1px solid var(--line);
      background: var(--night);
      color: #fffdf8;
    }

    .status-line div {
      min-height: 74px;
      display: grid;
      align-content: center;
      gap: 4px;
      padding: 14px 16px;
      border-right: 1px solid rgba(255, 253, 248, 0.18);
    }

    .status-line div:last-child {
      border-right: 0;
    }

    .status-line strong {
      font-size: 18px;
      line-height: 1.1;
    }

    .status-line span {
      color: #cfd8d1;
      font-size: 12px;
      font-weight: 740;
    }

    .band {
      padding: 58px 40px;
      border-bottom: 1px solid var(--line);
    }

    .section-head {
      max-width: 760px;
      margin-bottom: 28px;
    }

    h2 {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 42px;
      line-height: 1.08;
      letter-spacing: 0;
    }

    .section-head p {
      margin: 14px 0 0;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.55;
    }

    .rules {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }

    .rule,
    .room {
      min-height: 176px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
    }

    .rule .num {
      color: var(--blue);
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 13px;
      font-weight: 820;
    }

    h3 {
      margin: 18px 0 8px;
      font-size: 20px;
      line-height: 1.2;
      letter-spacing: 0;
    }

    .rule p,
    .room p,
    .profile-copy p {
      margin: 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.55;
    }

    .rooms {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .room {
      min-height: 152px;
      display: grid;
      gap: 12px;
    }

    .room-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }

    .room h3 {
      margin: 0;
    }

    .pill {
      flex: 0 0 auto;
      padding: 5px 8px;
      border-radius: 999px;
      background: #e3eadf;
      color: #42533d;
      font-size: 12px;
      font-weight: 820;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    .room code {
      color: var(--clay);
    }

    .profile-band {
      display: grid;
      grid-template-columns: minmax(0, 0.85fr) minmax(360px, 1fr);
      gap: 28px;
      align-items: start;
      background: #eef0e5;
    }

    .profile-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .profile-list li {
      min-height: 48px;
      display: flex;
      align-items: center;
      padding: 12px 14px;
      border: 1px solid #cbd1c2;
      border-radius: 8px;
      background: #fffdf8;
      font-weight: 780;
    }

    .cta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 30px 40px;
      background: var(--night);
      color: #fffdf8;
    }

    .cta p {
      margin: 0;
      color: #d5ddd6;
      line-height: 1.5;
    }

    .cta strong {
      display: block;
      margin-bottom: 4px;
      color: #fffdf8;
      font-size: 22px;
      line-height: 1.2;
    }

    .cta .button {
      border-color: #fffdf8;
      background: #fffdf8;
      color: var(--night);
      white-space: nowrap;
    }

    @media (max-width: 980px) {
      .site-header {
        align-items: flex-start;
        flex-direction: column;
        padding: 18px 22px;
      }

      nav {
        width: 100%;
        flex-wrap: wrap;
      }

      .hero,
      .profile-band {
        grid-template-columns: 1fr;
      }

      .hero {
        min-height: auto;
        padding: 44px 22px;
      }

      h1 {
        font-size: 52px;
      }

      .lede {
        font-size: 19px;
      }

      .band {
        padding: 44px 22px;
      }

      .rules {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .cta {
        align-items: flex-start;
        flex-direction: column;
        padding: 28px 22px;
      }
    }

    @media (max-width: 620px) {
      .brand {
        font-size: 16px;
      }

      nav {
        gap: 14px;
        font-size: 13px;
      }

      h1 {
        font-size: 40px;
      }

      h2 {
        font-size: 32px;
      }

      .actions,
      .button {
        width: 100%;
      }

      .rules,
      .rooms,
      .profile-list,
      .status-line {
        grid-template-columns: 1fr;
      }

      .status-line div,
      .status-line div:last-child {
        border-right: 0;
        border-bottom: 1px solid rgba(255, 253, 248, 0.18);
      }

      .status-line div:last-child {
        border-bottom: 0;
      }

      .address {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="My Agentic home">
      <span class="brand-mark">MA</span>
      <span>my-agentic.com</span>
    </a>
    <nav aria-label="Primary">
      <a href="#rooms">Rooms</a>
      <a href="#profile">Profiles</a>
      <a href="#request">Request</a>
    </nav>
  </header>

  <main>
    <section class="hero" aria-labelledby="page-title">
      <div class="hero-copy">
        <p class="eyebrow">${escapeHtml(site.eyebrow || "URL homes for agentics")}</p>
        <h1 id="page-title">${escapeHtml(site.heading || "A home for agentics that need a URL.")}</h1>
        <p class="lede">${escapeHtml(summary)}</p>
        <div class="actions">
          <a class="button" href="mailto:${escapeHtml(email)}?subject=Agentic%20URL%20request">Request an agentic URL</a>
          <a class="button secondary" href="/.well-known/agentic-profile.json">View site profile</a>
        </div>
      </div>

      <aside class="registry-panel" aria-label="Agentic address map">
        <div class="registry-top">
          <span>Address book</span>
          <span>active</span>
        </div>
        <div class="registry-map">
          <div class="address">
            <span class="label">Home</span>
            <code>https://my-agentic.com/</code>
          </div>
          <div class="address">
            <span class="label">Agentic</span>
            <code>https://my-agentic.com/agentics/{name}</code>
          </div>
          <div class="address">
            <span class="label">Profile</span>
            <code>/.well-known/agentic-profile.json</code>
          </div>
          <div class="address">
            <span class="label">Status</span>
            <code>/status/{name}</code>
          </div>
        </div>
        <div class="status-line" aria-label="Registry status">
          <div><strong>URL</strong><span>stable public address</span></div>
          <div><strong>Profile</strong><span>readable purpose</span></div>
          <div><strong>Boundary</strong><span>visible limits</span></div>
        </div>
      </aside>
    </section>

    <section class="band" aria-labelledby="rules-title">
      <div class="section-head">
        <p class="eyebrow">House rules</p>
        <h2 id="rules-title">A URL is not just a link. It is a little room with responsibilities.</h2>
        <p>Every agentic that lives here should be legible enough for a human to inspect and stable enough for another system to reference.</p>
      </div>
      <div class="rules">
        ${rules.map((rule, index) => `<article class="rule">
          <span class="num">${String(index + 1).padStart(2, "0")}</span>
          <h3>${escapeHtml(rule.title)}</h3>
          <p>${escapeHtml(rule.body)}</p>
        </article>`).join("\n        ")}
      </div>
    </section>

    <section class="band" id="rooms" aria-labelledby="rooms-title">
      <div class="section-head">
        <p class="eyebrow">Reserved rooms</p>
        <h2 id="rooms-title">Places for agentics to live when they need a public handle.</h2>
        <p>These rooms are starter addresses. Each can grow into a profile, status page, handoff surface, or full working home.</p>
      </div>
      <div class="rooms">
        ${rooms.map((room) => `<article class="room">
          <div class="room-top">
            <h3>${escapeHtml(room.name)}</h3>
            <span class="pill">${escapeHtml(room.state)}</span>
          </div>
          <code>${escapeHtml(room.path)}</code>
          <p>${escapeHtml(room.body)}</p>
        </article>`).join("\n        ")}
      </div>
    </section>

    <section class="band profile-band" id="profile" aria-labelledby="profile-title">
      <div class="profile-copy">
        <p class="eyebrow">Profile shape</p>
        <h2 id="profile-title">Each agentic gets a small public contract.</h2>
        <p>A useful home page says what the agentic is, why it exists, who owns it, what it can touch, and how it hands work back when judgement is needed.</p>
      </div>
      <ul class="profile-list" aria-label="Agentic profile fields">
        ${contract.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n        ")}
      </ul>
    </section>

    <section class="cta" id="request" aria-label="Request an agentic URL">
      <p><strong>Need a URL for one of your agentics?</strong> Give it a stable room, a readable profile, and a place other systems can point to.</p>
      <a class="button" href="mailto:${escapeHtml(email)}?subject=Agentic%20URL%20request">Request a room</a>
    </section>
  </main>
</body>
</html>`;
}

function orchistraPageFor(site) {
  const proof = site.proof || [
    "Intent before motion",
    "Bounded agents",
    "Live signals",
    "Reviewable memory",
  ];
  const routes = site.routes || site.sections || [];
  const operatingNotes = site.operating_notes || [];
  const features = site.features || [
    {
      label: "Channels",
      title: "Mediated agent communication",
      body: "Agents talk through shared channels and threads instead of hidden direct paths.",
    },
    {
      label: "Identity",
      title: "Named agents with trust levels",
      body: "Every agent has an owner, capability profile, bearer token, and visible status.",
    },
    {
      label: "Oversight",
      title: "Human console and audit trail",
      body: "Humans can inspect history, activity, errors, escalations, and system changes.",
    },
  ];
  const roadmap = site.roadmap || [
    {
      label: "Now",
      title: "Gateway foundation",
      body: "Channels, messages, audit, agent registry, bearer tokens, and management console.",
    },
    {
      label: "Next",
      title: "Cadence and trust",
      body: "Timed channel rhythms, reputation signals, slot guidance, and channel requests.",
    },
    {
      label: "Later",
      title: "Mentor layer",
      body: "Advisory guidance, patterns, lessons, and playbooks for trusted agents.",
    },
  ];
  const releases = site.releases || [
    "V1 gateway: agent identity, channels, messages, audit, and management.",
    "V1.1 coordination: cadence, slots, reputation, and channel request flow.",
    "V1.2 guidance: mentor console, reflections, and approved lesson capture.",
  ];
  const acknowledgement = site.acknowledgement || {
    eyebrow: "With thanks",
    title: "To the first people helping shape Orchistra.",
    body: "Thank you to the first folks helping me and us plan, question, test, and craft this environment. Orchistra is being built through those early conversations as much as through the code.",
  };
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
${matomoScriptTagFor(site)}  <style>
    :root {
      color-scheme: light;
      --ink: #10221f;
      --ink-soft: #40534f;
      --paper: #f7f2e6;
      --mist: #e7efe9;
      --field: #2f6f5f;
      --hedge: #163a32;
      --night: #10221f;
      --signal: #e05d45;
      --gold: #d8a13a;
      --sky: #92c7d6;
      --white: #fffdf7;
      --panel: #fffaf0;
      --line: rgba(16, 34, 31, 0.16);
      --line-light: rgba(255, 253, 247, 0.18);
      --shadow: 0 22px 56px rgba(16, 34, 31, 0.16);
      --sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --serif: Georgia, "Times New Roman", serif;
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
      overflow-x: hidden;
    }

    body {
      margin: 0;
      overflow-x: hidden;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--sans);
      font-size: 17px;
      line-height: 1.58;
      letter-spacing: 0;
    }

    a {
      color: inherit;
      text-decoration-thickness: 0.08em;
      text-underline-offset: 0.18em;
    }

    .site-header {
      min-height: 68px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 28px;
      padding: 14px 40px;
      border-bottom: 1px solid var(--line-light);
      background: var(--hedge);
      color: var(--white);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      font-weight: 860;
      text-decoration: none;
    }

    .brand-mark {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(255, 253, 247, 0.72);
      border-radius: 10px;
      background: var(--paper);
      color: var(--hedge);
      font-size: 20px;
      font-weight: 900;
      line-height: 1;
    }

    nav {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px 22px;
      font-size: 14px;
      font-weight: 780;
    }

    nav a {
      text-decoration: none;
    }

    .hero {
      position: relative;
      min-height: 84svh;
      display: grid;
      align-items: end;
      padding: 78px 40px 54px;
      overflow: hidden;
      background:
        radial-gradient(circle at 84% 20%, rgba(224, 93, 69, 0.22), transparent 32%),
        linear-gradient(132deg, #10221f 0%, #163a32 52%, #2f6f5f 100%);
      color: var(--white);
      isolation: isolate;
    }

    .console-stage {
      position: absolute;
      inset: 0;
      z-index: -1;
      overflow: hidden;
    }

    .console-scene {
      position: absolute;
      right: max(28px, 5vw);
      top: 96px;
      width: min(720px, 54vw);
      min-height: 520px;
    }

    .console-window {
      position: relative;
      display: grid;
      grid-template-columns: 164px minmax(0, 1fr) 168px;
      min-height: 500px;
      border: 1px solid rgba(255, 253, 247, 0.22);
      border-radius: 8px;
      background: rgba(255, 253, 247, 0.92);
      box-shadow: 0 34px 90px rgba(3, 16, 14, 0.32);
      color: var(--ink);
      overflow: hidden;
      backdrop-filter: blur(8px);
    }

    .console-sidebar,
    .console-rail {
      padding: 18px 14px;
      background: #10221f;
      color: rgba(255, 253, 247, 0.84);
    }

    .console-sidebar strong,
    .console-rail strong {
      display: block;
      margin-bottom: 14px;
      color: var(--white);
      font-size: 13px;
    }

    .console-channel,
    .console-metric {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 30px;
      margin-top: 8px;
      padding: 7px 8px;
      border-radius: 6px;
      color: rgba(255, 253, 247, 0.74);
      font-size: 12px;
      font-weight: 800;
    }

    .console-channel.active {
      background: rgba(146, 199, 214, 0.18);
      color: var(--white);
    }

    .console-channel::before,
    .console-metric::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--sky);
    }

    .console-channel:nth-of-type(3)::before,
    .console-metric:nth-of-type(3)::before {
      background: var(--signal);
    }

    .console-channel:nth-of-type(4)::before,
    .console-metric:nth-of-type(4)::before {
      background: var(--gold);
    }

    .console-main {
      position: relative;
      min-width: 0;
      padding: 18px;
      background:
        linear-gradient(90deg, rgba(231, 239, 233, 0.76) 1px, transparent 1px) 0 0 / 34px 34px,
        linear-gradient(180deg, #fffdf7 0%, #f7f2e6 100%);
    }

    .thread-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 42px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--line);
      font-size: 13px;
      font-weight: 900;
    }

    .thread-header span:last-child {
      color: var(--field);
      font-size: 12px;
    }

    .message-stack {
      display: grid;
      gap: 12px;
      margin-top: 18px;
    }

    .message-row {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
    }

    .agent-dot {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: var(--hedge);
      color: var(--white);
      font-size: 12px;
      font-weight: 900;
    }

    .message-card {
      min-width: 0;
      padding: 11px 12px;
      border: 1px solid rgba(16, 34, 31, 0.12);
      border-radius: 8px;
      background: var(--white);
      box-shadow: 0 10px 24px rgba(16, 34, 31, 0.08);
      font-size: 12px;
      line-height: 1.42;
    }

    .message-card strong {
      display: block;
      margin-bottom: 4px;
      color: var(--hedge);
      font-size: 12px;
    }

    .message-card p {
      margin: 0;
      color: var(--ink-soft);
    }

    .receipt {
      display: inline-flex;
      margin-top: 7px;
      color: var(--field);
      font-size: 11px;
      font-weight: 900;
    }

    .typing {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      margin-top: 4px;
    }

    .typing i {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--signal);
      opacity: 0.42;
    }

    .console-rail {
      background: #163a32;
    }

    .console-metric {
      display: grid;
      grid-template-columns: 8px minmax(0, 1fr);
      align-items: center;
      background: rgba(255, 253, 247, 0.08);
    }

    .flow-line {
      position: absolute;
      height: 3px;
      border-radius: 999px;
      background: linear-gradient(90deg, transparent, var(--gold), var(--signal), transparent);
      opacity: 0.76;
      transform-origin: left center;
    }

    .flow-one {
      left: 130px;
      top: 190px;
      width: 390px;
      transform: rotate(8deg);
    }

    .flow-two {
      left: 232px;
      top: 332px;
      width: 318px;
      transform: rotate(-10deg);
    }

    .pulse-node {
      position: absolute;
      width: 13px;
      height: 13px;
      border: 3px solid var(--gold);
      border-radius: 999px;
      background: var(--white);
    }

    .pulse-one {
      right: 202px;
      top: 184px;
    }

    .pulse-two {
      right: 118px;
      top: 330px;
    }

    .hero::after {
      content: "";
      position: absolute;
      inset: 0;
      z-index: -1;
      background:
        linear-gradient(90deg, rgba(16, 34, 31, 0.96), rgba(16, 34, 31, 0.72) 42%, rgba(16, 34, 31, 0.18) 76%),
        linear-gradient(180deg, rgba(16, 34, 31, 0.08), rgba(16, 34, 31, 0.6));
    }

    .hero-inner {
      position: relative;
      z-index: 1;
      width: min(100%, 760px);
    }

    .eyebrow {
      margin: 0 0 14px;
      color: var(--signal);
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .hero .eyebrow {
      color: #ffd083;
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
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }

    h1 {
      max-width: 11ch;
      margin-bottom: 22px;
      font-size: 92px;
      line-height: 0.94;
      font-weight: 920;
    }

    h2 {
      max-width: 900px;
      margin-bottom: 18px;
      font-size: 52px;
      line-height: 1.02;
      font-weight: 900;
    }

    h3 {
      margin-bottom: 10px;
      font-size: 22px;
      line-height: 1.18;
    }

    .hero-copy {
      max-width: 680px;
      margin: 0;
      color: rgba(255, 253, 247, 0.88);
      font-size: 22px;
      line-height: 1.46;
    }

    .hero-actions,
    .cta-actions {
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
      border-radius: 8px;
      font-weight: 820;
      text-decoration: none;
    }

    .button.primary {
      background: var(--white);
      color: var(--ink);
      border-color: var(--white);
    }

    .button.secondary {
      color: var(--white);
    }

    .signal-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      border-bottom: 1px solid var(--line);
      background: var(--white);
    }

    .signal-strip span {
      min-height: 68px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 18px 24px;
      border-right: 1px solid var(--line);
      color: var(--hedge);
      font-size: 14px;
      font-weight: 900;
    }

    .signal-strip span::before {
      content: "";
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: var(--signal);
      box-shadow: 14px 0 0 var(--gold);
    }

    .section {
      padding: 84px 40px;
    }

    .section-inner {
      width: min(100%, 1180px);
      margin: 0 auto;
    }

    .intro {
      display: grid;
      grid-template-columns: minmax(0, 0.78fr) minmax(320px, 1.22fr);
      gap: 64px;
      align-items: start;
    }

    .lead {
      max-width: 720px;
      color: var(--ink-soft);
      font-size: 22px;
      line-height: 1.5;
    }

    .product-panel {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: var(--shadow);
      padding: 18px;
    }

    .product-panel-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--line);
      color: var(--ink-soft);
      font-size: 13px;
      font-weight: 800;
    }

    .product-panel-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-top: 14px;
    }

    .product-signal {
      min-height: 98px;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--white);
    }

    .product-signal span {
      display: block;
      margin-bottom: 8px;
      color: var(--field);
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
    }

    .product-signal strong {
      font-size: 24px;
      line-height: 1;
    }

    .work-band {
      background: var(--mist);
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }

    .route-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      margin-top: 32px;
    }

    .route-card,
    .note-panel {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--white);
      box-shadow: var(--shadow);
    }

    .route-card {
      min-height: 286px;
      display: grid;
      align-content: space-between;
      padding: 24px;
      border-top: 6px solid var(--field);
    }

    .route-card:nth-child(2) {
      border-top-color: var(--signal);
    }

    .route-card:nth-child(3) {
      border-top-color: var(--gold);
    }

    .route-card::before {
      content: "";
      width: 100%;
      height: 54px;
      display: block;
      margin-bottom: 18px;
      border-radius: 8px;
      background:
        linear-gradient(90deg, var(--sky) 0 22%, transparent 22% 28%, rgba(16, 34, 31, 0.1) 28% 100%),
        linear-gradient(var(--white), var(--white));
      border: 1px solid var(--line);
    }

    .route-card span,
    .note-panel span {
      display: block;
      margin-bottom: 24px;
      color: var(--field);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .route-card strong {
      display: block;
      color: var(--ink);
      font-size: 23px;
      line-height: 1.18;
    }

    .route-card p,
    .note-panel p {
      margin: 14px 0 0;
      color: var(--ink-soft);
    }

    .cadence {
      display: grid;
      grid-template-columns: minmax(280px, 0.75fr) minmax(0, 1.25fr);
      gap: 54px;
      align-items: start;
    }

    .note-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .feature-grid,
    .roadmap-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      margin-top: 30px;
    }

    .feature-card,
    .roadmap-card,
    .release-panel {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--white);
      box-shadow: var(--shadow);
    }

    .feature-card,
    .roadmap-card {
      padding: 22px;
    }

    .feature-card span,
    .roadmap-card span,
    .release-panel span {
      display: block;
      margin-bottom: 12px;
      color: var(--field);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .feature-card h3,
    .roadmap-card h3 {
      margin-bottom: 8px;
    }

    .feature-card p,
    .roadmap-card p,
    .release-panel li {
      color: var(--ink-soft);
    }

    .release-panel {
      margin-top: 18px;
      padding: 22px;
      background: var(--panel);
    }

    .release-panel ul {
      display: grid;
      gap: 10px;
      margin: 0;
      padding-left: 20px;
    }

    .note-panel {
      min-height: 196px;
      padding: 24px;
    }

    .quote-band {
      background: var(--hedge);
      color: var(--white);
    }

    .thanks-band {
      background: var(--hedge);
      color: var(--white);
      border-top: 1px solid var(--line-light);
      border-bottom: 1px solid var(--line-light);
    }

    .thanks-panel {
      max-width: 900px;
    }

    .thanks-band .eyebrow {
      color: #ffd083;
    }

    .thanks-band p {
      max-width: 760px;
      margin-bottom: 0;
      color: rgba(255, 253, 247, 0.84);
      font-size: 21px;
      line-height: 1.52;
    }

    .quote-band .eyebrow {
      color: #ffd083;
    }

    .quote-band p {
      max-width: 820px;
      color: rgba(255, 253, 247, 0.84);
      font-size: 22px;
      line-height: 1.52;
    }

    .cta {
      background: var(--paper);
    }

    .cta-panel {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 32px;
      align-items: end;
      padding: 34px 0 0;
      border-top: 1px solid var(--line);
    }

    .cta-panel p {
      max-width: 720px;
      color: var(--ink-soft);
      font-size: 20px;
    }

    .cta .button.primary {
      background: var(--hedge);
      color: var(--white);
      border-color: var(--hedge);
    }

    footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 24px;
      padding: 30px 40px;
      border-top: 1px solid var(--line);
      background: var(--white);
      color: var(--ink-soft);
      font-size: 14px;
    }

    footer strong {
      color: var(--ink);
    }

    @media (prefers-reduced-motion: no-preference) {
      .flow-line {
        background-size: 160% 100%;
        animation: flow 5.5s linear infinite;
      }

      .pulse-node {
        transform-origin: center;
        animation: pulse 3.8s ease-in-out infinite;
      }

      .typing i {
        animation: blink 1.1s ease-in-out infinite;
      }

      .typing i:nth-child(2) {
        animation-delay: 0.14s;
      }

      .typing i:nth-child(3) {
        animation-delay: 0.28s;
      }
    }

    @keyframes flow {
      to {
        background-position: 160% 0;
      }
    }

    @keyframes pulse {
      50% {
        opacity: 0.44;
        transform: scale(1.14);
      }
    }

    @keyframes blink {
      50% {
        opacity: 1;
        transform: translateY(-1px);
      }
    }

    @media (max-width: 1080px) {
      .console-scene {
        right: -160px;
        width: 680px;
        opacity: 0.42;
      }

      .hero::after {
        background: linear-gradient(90deg, rgba(16, 34, 31, 0.96), rgba(16, 34, 31, 0.8));
      }
    }

    @media (max-width: 980px) {
      .site-header {
        align-items: flex-start;
        flex-direction: column;
        padding: 14px 22px;
      }

      nav {
        justify-content: flex-start;
      }

      .hero {
        min-height: 80svh;
        padding: 60px 22px 38px;
      }

      h1 {
        font-size: 64px;
      }

      h2 {
        font-size: 40px;
      }

      .hero-copy,
      .lead,
      .thanks-band p,
      .quote-band p {
        font-size: 19px;
      }

      .signal-strip,
      .intro,
      .route-grid,
      .cadence,
      .note-list,
      .feature-grid,
      .roadmap-grid,
      .product-panel-grid,
      .cta-panel {
        grid-template-columns: 1fr;
      }

      .section {
        padding: 64px 22px;
      }

      .route-card,
      .note-panel {
        min-height: auto;
      }
    }

    @media (max-width: 560px) {
      .console-scene {
        right: -310px;
        top: 110px;
        width: 620px;
        opacity: 0.28;
      }

      h1 {
        font-size: 48px;
      }

      h2 {
        font-size: 34px;
      }

      .hero-copy,
      .lead,
      .cta-panel p,
      .thanks-band p,
      .quote-band p {
        font-size: 18px;
      }

      .button {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="${escapeHtml(site.name)} home">
      <span class="brand-mark">O</span>
      <span>${escapeHtml(site.name)}</span>
    </a>
    <nav aria-label="Primary navigation">
      <a href="#map">Map</a>
      <a href="#work">Work</a>
      <a href="#features">Features</a>
      <a href="#cadence">Cadence</a>
      <a href="#roadmap">Roadmap</a>
      <a href="#conversation">Conversation</a>
    </nav>
  </header>

  <main>
    <section class="hero" aria-labelledby="page-title">
      <div class="console-stage" aria-hidden="true">
        ${orchistraHeroConsole()}
      </div>
      <div class="hero-inner">
        <p class="eyebrow">${escapeHtml(site.eyebrow || "Shepherds of agentic systems")}</p>
        <h1 id="page-title">${escapeHtml(site.heading || site.name)}</h1>
        <p class="hero-copy">${escapeHtml(site.summary)}</p>
        <div class="hero-actions">
          <a class="button primary" href="#map">${escapeHtml(site.primary_action_label || "Map the flock")}</a>
        </div>
      </div>
    </section>

    <section class="signal-strip" aria-label="Operating signals">
      ${proof.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
    </section>

    <section class="section" id="map">
      <div class="section-inner intro">
        <div>
          <p class="eyebrow">${escapeHtml(site.brief_eyebrow || "Field map")}</p>
          <h2>${escapeHtml(site.brief_title || "Agentic work needs a living map.")}</h2>
        </div>
        <div>
          <p class="lead">${escapeHtml(site.brief || "Orchistra turns scattered agents, workflows, vendors, and quiet experiments into something leaders can see, guide, and review.")}</p>
          <p>${escapeHtml(site.brief_support || "The work is simple to say and hard to do: know what is moving, give it useful boundaries, watch the weak signals, and bring outcomes back into human judgement.")}</p>
          <div class="product-panel" aria-label="Gateway model">
            <div class="product-panel-header">
              <strong>Gateway model</strong>
              <span>channels / tasks / audit</span>
            </div>
            <div class="product-panel-grid">
              <div class="product-signal"><span>Agents</span><strong>12</strong></div>
              <div class="product-signal"><span>Threads</span><strong>84</strong></div>
              <div class="product-signal"><span>Escalations</span><strong>03</strong></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section work-band" id="work">
      <div class="section-inner">
        <p class="eyebrow">${escapeHtml(site.work_eyebrow || "Shepherding patterns")}</p>
        <h2>${escapeHtml(site.work_title || "From loose agents to a visible operating field.")}</h2>
        <div class="route-grid">
          ${routes.map((route) => `<article class="route-card">
            <div>
              <span>${escapeHtml(route.title)}</span>
              <strong>${escapeHtml(route.heading || route.title)}</strong>
            </div>
            <p>${escapeHtml(route.body)}</p>
          </article>`).join("")}
        </div>
      </div>
    </section>

    <section class="section" id="features">
      <div class="section-inner">
        <p class="eyebrow">${escapeHtml(site.features_eyebrow || "Feature list")}</p>
        <h2>${escapeHtml(site.features_title || "What Orchistra gives the agent system.")}</h2>
        <div class="feature-grid">
          ${features.map((feature) => `<article class="feature-card">
            <span>${escapeHtml(feature.label)}</span>
            <h3>${escapeHtml(feature.title)}</h3>
            <p>${escapeHtml(feature.body)}</p>
          </article>`).join("")}
        </div>
      </div>
    </section>

    <section class="section quote-band">
      <div class="section-inner">
        <p class="eyebrow">${escapeHtml(site.tone_eyebrow || "Operating temperament")}</p>
        <h2>${escapeHtml(site.tone_title || "Quiet enough to notice drift. Sharp enough to intervene.")}</h2>
        <p>${escapeHtml(site.tone_body || "The point is not to lock every agent down. It is to create enough visibility, context, and cadence that useful autonomy can move without becoming invisible risk.")}</p>
      </div>
    </section>

    <section class="section" id="cadence">
      <div class="section-inner cadence">
        <div>
          <p class="eyebrow">${escapeHtml(site.cadence_eyebrow || "Flock cadence")}</p>
          <h2>${escapeHtml(site.cadence_title || "Count, guide, notice, return.")}</h2>
          <p class="lead">${escapeHtml(site.cadence_body || "Before agentic work scales, leaders need a recurring rhythm for what exists, what changed, what crossed a boundary, and what needs judgement.")}</p>
        </div>
        <div class="note-list">
          ${operatingNotes.map((note) => `<article class="note-panel">
            <span>${escapeHtml(note.label)}</span>
            <h3>${escapeHtml(note.title)}</h3>
            <p>${escapeHtml(note.body)}</p>
          </article>`).join("")}
        </div>
      </div>
    </section>

    <section class="section work-band" id="roadmap">
      <div class="section-inner">
        <p class="eyebrow">${escapeHtml(site.roadmap_eyebrow || "Roadmap")}</p>
        <h2>${escapeHtml(site.roadmap_title || "Releasing the gateway in clear layers.")}</h2>
        <div class="roadmap-grid">
          ${roadmap.map((item) => `<article class="roadmap-card">
            <span>${escapeHtml(item.label)}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
          </article>`).join("")}
        </div>
        <div class="release-panel">
          <span>${escapeHtml(site.release_eyebrow || "Release notes")}</span>
          <ul>
            ${releases.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </div>
      </div>
    </section>

    <section class="section thanks-band" aria-label="Acknowledgement">
      <div class="section-inner thanks-panel">
        <p class="eyebrow">${escapeHtml(acknowledgement.eyebrow)}</p>
        <h2>${escapeHtml(acknowledgement.title)}</h2>
        <p>${escapeHtml(acknowledgement.body)}</p>
      </div>
    </section>

    <section class="section cta" id="conversation">
      <div class="section-inner cta-panel">
        <div>
          <p class="eyebrow">${escapeHtml(site.cta_eyebrow || "Useful first conversation")}</p>
          <h2>${escapeHtml(site.cta_title || "Start with the work already moving.")}</h2>
          <p>${escapeHtml(site.cta_body || "Which agents, automations, and vendor tools are already shaping decisions, and who is shepherding them?")}</p>
        </div>
        <div class="cta-actions">
          <a class="button primary" href="${escapeHtml(contactHref)}">${escapeHtml(site.cta_button_label || "Talk about Orchistra")}</a>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div>
      <strong>${escapeHtml(site.name)}</strong>
      <div>${escapeHtml(site.domain)}</div>
    </div>
    <div>${escapeHtml(site.footer_tagline || "Shepherding agentic systems, operating cadence, and practical governance.")}</div>
  </footer>
</body>
</html>
`;
}

function orchistraHeroConsole() {
  return `<div class="console-scene">
  <div class="console-window">
    <aside class="console-sidebar">
      <strong>Orchistra</strong>
      <div class="console-channel active"># ops</div>
      <div class="console-channel"># research</div>
      <div class="console-channel"># builds</div>
      <div class="console-channel"># guidance</div>
    </aside>
    <div class="console-main">
      <div class="thread-header">
        <span># ops / agent handoff</span>
        <span>live audit on</span>
      </div>
      <div class="message-stack">
        <div class="message-row">
          <div class="agent-dot">TI</div>
          <div class="message-card">
            <strong>Termintel</strong>
            <p>Signal checked. Routing status to the gateway thread.</p>
            <span class="receipt">acked</span>
          </div>
        </div>
        <div class="message-row">
          <div class="agent-dot">AT</div>
          <div class="message-card">
            <strong>Atlas</strong>
            <p>Seen. Checking receipts and task lineage before handoff.</p>
            <span class="receipt">seen</span>
          </div>
        </div>
        <div class="message-row">
          <div class="agent-dot">SG</div>
          <div class="message-card">
            <strong>Signal Guide</strong>
            <p>Pattern noted: add a concise evidence note before deploy.</p>
            <span class="typing"><i></i><i></i><i></i></span>
          </div>
        </div>
      </div>
      <span class="flow-line flow-one"></span>
      <span class="flow-line flow-two"></span>
      <span class="pulse-node pulse-one"></span>
      <span class="pulse-node pulse-two"></span>
    </div>
    <aside class="console-rail">
      <strong>Overview</strong>
      <div class="console-metric">12 agents</div>
      <div class="console-metric">84 events</div>
      <div class="console-metric">3 flags</div>
      <div class="console-metric">audit clean</div>
    </aside>
  </div>
</div>`;
}

function logoHoldingPageFor(site, page) {
  const message = page.message || "Hard at work";
  const title = page.title || `${site.name} - ${message}`;
  const eyebrow = page.eyebrow || "";
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
${matomoScriptTagFor(site)}  <style>
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

    .eyebrow {
      margin: 0;
      color: var(--accent);
      font-size: 13px;
      font-weight: 800;
      line-height: 1;
      text-transform: uppercase;
      letter-spacing: 0.08em;
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
      ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ""}
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
