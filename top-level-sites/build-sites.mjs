import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);
const sitesPath = path.join(__dirname, "sites.json");
const distDir = path.join(__dirname, "dist");
const edgeCaddyDir = path.join(__dirname, "infra", "caddy", "sites");
const serverRoot = "/srv/apps/top-level-sites/current";
const gammaOrigin = "https://sites.gamma.app";
const matomoTrackerUrl = "https://tonywood.matomo.cloud/matomo.php";
const matomoScriptUrl = "https://tonywood.matomo.cloud/matomo.js";
const matomoLoaderPath = "/static/js/matomo-loader.js";
const defaultTonywoodAdvisoryUrl = "https://www.tonywood.org/advisory/";
const defaultAnalyticsNorthStar = "Move qualified visitors from Tony Wood's owned topical sites to Tonywood.org advisory so public ideas turn into useful advisory conversations.";
const nodeServerPort = 8080;
const publishedAt = "2026-05-26T00:00:00Z";
const updatedAt = "2026-07-14T00:00:00Z";
const firstPort = 8211;

const sites = JSON.parse(await readFile(sitesPath, "utf8")).map((site, index) => {
  const enriched = {
    ...site,
    mode: site.mode || "gamma",
    port: site.port || firstPort + index,
    service: serviceName(site.domain),
  };
  enriched.tonywood_funnel = enriched.tonywood_funnel || defaultTonywoodFunnelFor(enriched);
  enriched.analytics = analyticsFor(enriched);
  return enriched;
});
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
  await generateAppIcons(site, wwwRoot);
  await writeFile(path.join(wwwRoot, "healthz"), healthFor(site), "utf8");
  await writeFile(path.join(wwwRoot, "llms.txt"), llmsFor(site, profile), "utf8");
  await writeFile(path.join(wwwRoot, "robots.txt"), robotsFor(site), "utf8");
  await writeFile(path.join(wwwRoot, "sitemap.xml"), sitemapFor(site), "utf8");
  await writeFile(path.join(wwwRoot, "feed.xml"), atomFeedFor(site), "utf8");
  await writeFile(path.join(wwwRoot, "site.webmanifest"), webManifestFor(site), "utf8");
  await copySiteAssets(site, wwwRoot);
  await generateSocialPreviewImage(site, wwwRoot);
  if (site.mode === "yqup") {
    await writeFile(path.join(wwwRoot, "index.html"), yqupPageFor(site), "utf8");
  }
  if (site.mode === "holding") {
    const holdingPage = site.holding_page || {};
    let html;
    if (holdingPage.template === "source") {
      const sourceHtml = await readFile(path.join(__dirname, holdingPage.source), "utf8");
      html = injectFaviconLink(
        injectSocialMetaTags(injectMatomoScriptTag(sourceHtml, site), site),
        site,
      );
    } else if (holdingPage.template === "logo") {
      html = injectSourceFunnelStrip(
        logoHoldingPageFor(site, { title: site.title, ...holdingPage }),
        site,
        "logo_holding_advisory_strip",
      );
    } else {
      html = holdingPageFor(site);
    }
    await writeFile(path.join(wwwRoot, "index.html"), html, "utf8");
  }
  if (site.mode === "country") {
    await writeFile(path.join(wwwRoot, "index.html"), countryPageFor(site), "utf8");
  }
  if (site.mode === "cao") {
    await writeFile(path.join(wwwRoot, "index.html"), chiefAgenticOfficerPageFor(site), "utf8");
    const forAgentsRoot = path.join(wwwRoot, "for-agents");
    await mkdir(forAgentsRoot, { recursive: true });
    await writeFile(path.join(forAgentsRoot, "index.html"), chiefAgenticOfficerForAgentsPageFor(site), "utf8");
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
  if (site.mode === "agentic_leader") {
    await writeFile(path.join(wwwRoot, "index.html"), agenticLeaderPageFor(site), "utf8");
  }
  if (site.mode === "snaxk") {
    await writeFile(path.join(wwwRoot, "index.html"), snaxkPageFor(site), "utf8");
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
    analytics_north_star: site.analytics.north_star,
    analytics_site_goal: site.analytics.site_goal,
    primary_conversion: site.analytics.primary_conversion,
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
  const profileFormUrl = site.public_contact_disabled
    ? null
    : site.contact?.form_url || tonywoodFunnelUrlFor(site, "profile_contact");
  const preferredChannel = profileFormUrl
    ? "form"
    : site.contact?.preferred_channel || "none";
  const profile = {
    schema_version: "0.2.0",
    updated_at: publicDiscoveryFor(site).modifiedAt,
    profile_kind: "company",
    tier: "public",
    access: {
      visibility: "public",
      authority: "none",
      note: "Public information only. Discovery surfaces grant no authority to act and provide no private access, credentials, or permission.",
    },
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
      preferred_channel: preferredChannel,
    },
    analytics: {
      north_star: site.analytics.north_star,
      site_goal: site.analytics.site_goal,
      primary_conversion: site.analytics.primary_conversion,
      primary_destination: site.analytics.primary_destination,
      campaign: site.analytics.campaign,
    },
  };

  if (site.mode === "cao") {
    profile.links.for_agents = `https://${site.domain}/for-agents/`;
    profile.links.llms = `https://${site.domain}/llms.txt`;
    profile.briefing = {
      name: site.briefing?.title || "Chief Agentic Officer Briefing",
      purpose: site.for_agents?.purpose || "UK and Europe-facing board-readiness signal layer for the Chief Agentic Officer mandate.",
      focus: site.for_agents?.problem || "UK/EU governance, risk, compliance, resilience, disclosure, data, reputation, and board-action signals.",
      guardrail: site.for_agents?.guardrail || site.briefing?.guardrail || "The briefing supports judgement and does not replace professional judgement.",
    };
    profile.briefing_categories = briefingCategoriesFor(site).map((category) => ({
      name: category.name,
      meaning: category.meaning,
    }));
  }

  if (profileFormUrl) profile.contact.form_url = profileFormUrl;
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

async function generateSocialPreviewImage(site, wwwRoot) {
  const assetsDir = path.join(wwwRoot, "assets");
  const svgPath = path.join(assetsDir, "og-image.svg");
  const pngPath = path.join(assetsDir, "og-image.png");
  await mkdir(assetsDir, { recursive: true });
  if (site.social_preview?.asset) {
    await copyFile(path.join(__dirname, site.social_preview.asset), pngPath);
    return;
  }
  await writeFile(svgPath, socialPreviewSvgFor(site), "utf8");
  try {
    await rasterizeSvg(svgPath, pngPath);
  } catch (error) {
    throw new Error(`Could not generate Open Graph PNG for ${site.domain}: ${error.message}`);
  } finally {
    await rm(svgPath, { force: true });
  }
}

async function generateAppIcons(site, wwwRoot) {
  const sourcePath = path.join(wwwRoot, ".app-icon-source.svg");
  const icons = [
    ["apple-touch-icon.png", 180],
    ["app-icon-192.png", 192],
    ["app-icon-512.png", 512],
  ];
  await writeFile(sourcePath, faviconFor(site), "utf8");
  try {
    for (const [filename, size] of icons) {
      await rasterizeSvg(sourcePath, path.join(wwwRoot, filename), size);
    }
  } catch (error) {
    throw new Error(`Could not generate app icons for ${site.domain}: ${error.message}`);
  } finally {
    await rm(sourcePath, { force: true });
  }
}

async function rasterizeSvg(sourcePath, targetPath, size = null) {
  const sipsArgs = ["-s", "format", "png"];
  if (size) sipsArgs.push("-z", String(size), String(size));
  sipsArgs.push(sourcePath, "--out", targetPath);
  try {
    await execFileAsync("sips", sipsArgs, { timeout: 15000 });
    return;
  } catch (sipsError) {
    const magickArgs = [
      "-font",
      "/System/Library/Fonts/Supplemental/Verdana.ttf",
      "-background",
      "none",
      sourcePath,
    ];
    if (size) magickArgs.push("-resize", `${size}x${size}!`);
    magickArgs.push(targetPath);
    try {
      await execFileAsync("magick", magickArgs, { timeout: 15000 });
      return;
    } catch (magickError) {
      throw new Error(`sips failed (${sipsError.message}); ImageMagick failed (${magickError.message})`);
    }
  }
}

function publicDiscoveryFor(site) {
  const discovery = site.public_discovery || {};
  return {
    authorName: discovery.author_name || "Tony Wood",
    authorUrl: discovery.author_url || "https://www.tonywood.org/",
    publisherName: discovery.publisher_name || "YQUP Ltd",
    publisherUrl: discovery.publisher_url || "https://yqup.com/",
    publishedAt: discovery.published_at || publishedAt,
    modifiedAt: discovery.modified_at || discovery.published_at || updatedAt,
  };
}

function publicPageEntriesFor(site) {
  const discovery = publicDiscoveryFor(site);
  const pages = [{
    path: "/",
    title: site.title || site.name,
    description: site.summary || site.heading || site.name,
    publishedAt: discovery.publishedAt,
    modifiedAt: discovery.modifiedAt,
  }];
  if (site.mode === "cao") {
    const title = site.for_agents?.title || "For agents";
    pages.push({
      path: "/for-agents/",
      title: `${title} | ${site.name}`,
      description: site.for_agents?.summary || "Public source context for agents reading the Chief Agentic Officer Briefing.",
      publishedAt: discovery.publishedAt,
      modifiedAt: discovery.modifiedAt,
    });
  }
  return pages;
}

function robotsFor(site) {
  return `User-agent: *\nAllow: /\n\nSitemap: https://${site.domain}/sitemap.xml\n`;
}

function sitemapFor(site) {
  const urls = publicPageEntriesFor(site)
    .map((page) => `  <url>\n    <loc>${xmlEscape(absoluteSiteUrl(site, page.path))}</loc>\n    <lastmod>${xmlEscape(page.modifiedAt.slice(0, 10))}</lastmod>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function atomFeedFor(site) {
  const pages = publicPageEntriesFor(site);
  const discovery = publicDiscoveryFor(site);
  const canonical = absoluteSiteUrl(site, "/");
  const feedUrl = absoluteSiteUrl(site, "/feed.xml");
  const entries = pages.map((page) => {
    const pageUrl = absoluteSiteUrl(site, page.path);
    return `  <entry>\n    <title>${xmlEscape(page.title)}</title>\n    <id>${xmlEscape(pageUrl)}</id>\n    <link rel="alternate" href="${xmlEscape(pageUrl)}"/>\n    <published>${xmlEscape(page.publishedAt)}</published>\n    <updated>${xmlEscape(page.modifiedAt)}</updated>\n    <author><name>${xmlEscape(discovery.authorName)}</name></author>\n    <summary>${xmlEscape(page.description)}</summary>\n  </entry>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n  <title>${xmlEscape(site.name)} updates</title>\n  <id>${xmlEscape(canonical)}</id>\n  <link rel="alternate" href="${xmlEscape(canonical)}"/>\n  <link rel="self" type="application/atom+xml" href="${xmlEscape(feedUrl)}"/>\n  <updated>${xmlEscape(discovery.modifiedAt)}</updated>\n${entries}\n</feed>\n`;
}

function webManifestFor(site) {
  return `${JSON.stringify({
    id: "/",
    name: site.name,
    short_name: site.name,
    description: site.summary || site.heading || site.name,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fffaf2",
    theme_color: normalizeHex(site.theme, "#16201b"),
    icons: [
      { src: "/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  }, null, 2)}\n`;
}

function socialMetaTagsFor(site, options = {}) {
  const title = options.title || site.title || site.ogTitle || site.social_preview?.title || site.name;
  const description = options.description || site.summary || site.ogDescription || site.social_preview?.description || site.heading || site.name;
  const url = options.url || absoluteSiteUrl(site, options.path || "/");
  const image = absoluteSiteUrl(site, options.image || site.ogImage || site.social_preview?.image || "/assets/og-image.png");
  const imageAlt = options.imageAlt || site.social_preview?.image_alt || `${site.name || site.domain} preview card`;
  return [
    `  <link rel="canonical" href="${escapeHtml(url)}">`,
    `  <link rel="alternate" type="application/atom+xml" title="${escapeHtml(site.name)} updates" href="${escapeHtml(absoluteSiteUrl(site, "/feed.xml"))}">`,
    `  <link rel="manifest" href="/site.webmanifest">`,
    `  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`,
    `  <meta name="theme-color" content="${escapeHtml(normalizeHex(site.theme, "#16201b"))}">`,
    `  <meta property="og:type" content="${escapeHtml(options.ogType || "website")}">`,
    `  <meta property="og:locale" content="en_GB">`,
    `  <meta property="og:title" content="${escapeHtml(title)}">`,
    `  <meta property="og:description" content="${escapeHtml(description)}">`,
    `  <meta property="og:url" content="${escapeHtml(url)}">`,
    `  <meta property="og:image" content="${escapeHtml(image)}">`,
    `  <meta property="og:image:secure_url" content="${escapeHtml(image)}">`,
    `  <meta property="og:image:type" content="image/png">`,
    `  <meta property="og:image:width" content="1200">`,
    `  <meta property="og:image:height" content="627">`,
    `  <meta property="og:image:alt" content="${escapeHtml(imageAlt)}">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <meta name="twitter:title" content="${escapeHtml(title)}">`,
    `  <meta name="twitter:description" content="${escapeHtml(description)}">`,
    `  <meta name="twitter:image" content="${escapeHtml(image)}">`,
    `  <meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}">`,
    `  <script id="public-page-jsonld" type="application/ld+json">${publicPageJsonLdFor(site, { ...options, title, description, url, image })}</script>`,
  ].join("\n") + "\n";
}

function publicPageJsonLdFor(site, options = {}) {
  const discovery = publicDiscoveryFor(site);
  const canonical = options.url || absoluteSiteUrl(site, options.path || "/");
  const image = options.image || absoluteSiteUrl(site, "/assets/og-image.png");
  const title = options.title || site.title || site.name;
  const description = options.description || site.summary || site.heading || site.name;
  const author = {
    "@type": discovery.authorName === discovery.publisherName ? "Organization" : "Person",
    name: discovery.authorName,
    url: discovery.authorUrl,
  };
  const publisher = {
    "@type": "Organization",
    "@id": `${discovery.publisherUrl}#organization`,
    name: discovery.publisherName,
    url: discovery.publisherUrl,
  };
  const payload = {
    "@context": "https://schema.org",
    "@graph": [
      publisher,
      {
        "@type": "WebSite",
        "@id": `${absoluteSiteUrl(site, "/")}#website`,
        name: site.name,
        url: absoluteSiteUrl(site, "/"),
        description: site.summary || description,
        inLanguage: "en-GB",
        publisher: { "@id": publisher["@id"] },
      },
      {
        "@type": options.schemaType || "Article",
        "@id": `${canonical}#webpage`,
        headline: title,
        name: title,
        description,
        url: canonical,
        mainEntityOfPage: canonical,
        inLanguage: "en-GB",
        datePublished: discovery.publishedAt,
        dateModified: discovery.modifiedAt,
        author,
        publisher: { "@id": publisher["@id"] },
        isPartOf: { "@id": `${absoluteSiteUrl(site, "/")}#website` },
        image: {
          "@type": "ImageObject",
          url: image,
          width: 1200,
          height: 627,
        },
      },
    ],
  };
  return JSON.stringify(payload).replace(/</g, "\\u003c");
}

function injectSocialMetaTags(html, site, options = {}) {
  const cleanHtml = stripSocialMetaTags(html);
  const tags = socialMetaTagsFor(site, options).trim();
  if (/<\/head\s*>/i.test(cleanHtml)) {
    return cleanHtml.replace(/<\/head\s*>/i, `${tags}\n</head>`);
  }
  return `${tags}\n${cleanHtml}`;
}

function stripSocialMetaTags(html) {
  return html
    .replace(/^[ \t]*<link\b[^>]*rel=["']canonical["'][^>]*>\s*$/gim, "")
    .replace(/^[ \t]*<link\b[^>]*rel=["'](?:manifest|apple-touch-icon)["'][^>]*>\s*$/gim, "")
    .replace(/^[ \t]*<link\b[^>]*rel=["']alternate["'][^>]*type=["']application\/(?:atom\+xml|rss\+xml)["'][^>]*>\s*$/gim, "")
    .replace(/^[ \t]*<meta\b[^>]*name=["']theme-color["'][^>]*>\s*$/gim, "")
    .replace(/^[ \t]*<meta\b[^>]*(?:property=["']og:[^"']+["']|name=["']twitter:[^"']+["'])[^>]*>\s*$/gim, "")
    .replace(/^[ \t]*<script\b[^>]*id=["']public-page-jsonld["'][^>]*>[\s\S]*?<\/script>\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n");
}

function absoluteSiteUrl(site, value) {
  if (!value) return `https://${site.domain}/`;
  if (/^https?:\/\//i.test(value)) return value;
  const pathValue = value.startsWith("/") ? value : `/${value}`;
  return `https://${site.domain}${pathValue}`;
}

function socialPreviewSvgFor(site) {
  const title = site.social_preview?.image_title || site.heading || site.ogTitle || site.social_preview?.title || site.title || site.name;
  const description = site.ogDescription || site.social_preview?.description || site.summary || site.heading || "";
  const theme = normalizeHex(site.theme, "#16201b");
  const accent = normalizeHex(site.accent, "#b98222");
  const bg = socialBackgroundFor(site);
  const titleLines = wrapForSvg(title, 24, 2);
  const descriptionLines = wrapForSvg(description, 58, 3);
  const domain = site.domain;
  const initials = initialsFor(site.name || domain);
  const nodeLabels = site.social_preview?.node_labels || ["Profile", "llms.txt", "Health", "Matomo"];
  const nodeStatus = site.social_preview?.node_status || "ready";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="627" viewBox="0 0 1200 627">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${bg.start}"/>
      <stop offset="1" stop-color="${bg.end}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000000" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect width="1200" height="627" fill="url(#bg)"/>
  <g opacity="0.22" fill="none" stroke="${escapeHtml(accent)}" stroke-width="2">
    <path d="M718 96 C790 62 887 72 1008 48"/>
    <path d="M692 158 C804 103 912 139 1118 84"/>
    <path d="M738 248 C840 200 948 226 1160 158"/>
    <path d="M684 413 C811 358 950 378 1158 303"/>
    <path d="M754 497 C862 454 985 460 1138 397"/>
  </g>
  <rect x="54" y="54" width="1092" height="519" rx="30" fill="rgba(255,255,255,0.78)" stroke="rgba(0,0,0,0.10)" filter="url(#shadow)"/>
  <g transform="translate(96 92)">
    <rect width="112" height="112" rx="28" fill="${escapeHtml(theme)}"/>
    <text x="56" y="69" text-anchor="middle" font-size="38" font-weight="800" fill="#ffffff">${escapeHtml(initials)}</text>
  </g>
  <text x="232" y="122" font-size="28" font-weight="800" fill="${escapeHtml(theme)}">${escapeHtml(site.name || domain)}</text>
  <text x="232" y="160" font-size="24" fill="#4b514a">${escapeHtml(domain)}</text>
  <g transform="translate(96 282)">
    ${titleLines.map((line, index) => `<text x="0" y="${index * 64}" font-size="58" font-weight="700" fill="#111713">${escapeHtml(line)}</text>`).join("\n    ")}
  </g>
  <rect x="98" y="${260 + (titleLines.length * 64)}" width="70" height="5" fill="${escapeHtml(accent)}"/>
  <g transform="translate(96 ${310 + (titleLines.length * 64)})">
    ${descriptionLines.map((line, index) => `<text x="0" y="${index * 33}" font-size="26" fill="#232923">${escapeHtml(line)}</text>`).join("\n    ")}
  </g>
  <g transform="translate(746 214)">
    ${nodeLabels.map((label, index) => {
      const x = (index % 2) * 172;
      const y = Math.floor(index / 2) * 138;
      return `<g transform="translate(${x} ${y})">
        <circle cx="38" cy="38" r="34" fill="${escapeHtml(theme)}" opacity="0.94"/>
        <circle cx="38" cy="38" r="18" fill="none" stroke="${escapeHtml(accent)}" stroke-width="4"/>
        <text x="84" y="32" font-size="22" font-weight="800" fill="#171b17">${escapeHtml(label)}</text>
        <text x="84" y="62" font-size="18" fill="#4b514a">${escapeHtml(nodeStatus)}</text>
      </g>`;
    }).join("\n    ")}
  </g>
  <text x="96" y="535" font-size="21" font-weight="800" fill="${escapeHtml(theme)}">Agent-readable. Human-visible. LinkedIn-ready.</text>
  <text x="1104" y="535" text-anchor="end" font-size="21" fill="#4b514a">https://${escapeHtml(domain)}/</text>
</svg>`;
}

function socialBackgroundFor(site) {
  const mode = site.mode || "gamma";
  if (mode === "snaxk") return { start: "#fffaf0", end: "#f2dfb5" };
  if (mode === "yqup") return { start: "#f8f8f6", end: "#e6ebe3" };
  if (mode === "orchistra") return { start: "#f8f4e9", end: "#dce6d5" };
  if (mode === "holding") return { start: "#f7f8ff", end: "#e9ecff" };
  if (mode === "ai_ops") return { start: "#f3f7f3", end: "#dfe8ef" };
  return { start: "#fbfaf4", end: "#e6ecdf" };
}

function normalizeHex(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;
}

function wrapForSvg(text, maxChars, maxLines) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:!?]+$/, "")}...`;
  }
  return lines.length ? lines : ["Agent-readable system site"];
}

function matomoConfigFor(site) {
  return {
    enabled: Boolean(site.matomo_site_id),
    trackerUrl: matomoTrackerUrl,
    scriptUrl: matomoScriptUrl,
    siteId: String(site.matomo_site_id || ""),
    hostnames: [site.domain, `www.${site.domain}`],
    northStar: {
      objective: site.analytics.north_star,
      siteGoal: site.analytics.site_goal,
      primaryConversion: site.analytics.primary_conversion,
      primaryDestination: site.analytics.primary_destination,
      source: site.analytics.source,
      campaign: site.analytics.campaign,
      measurementNote: site.analytics.measurement_note,
    },
  };
}

function matomoScriptTagFor(site) {
  if (!site.matomo_site_id) return "";
  return `  <script defer src="${matomoLoaderPath}"></script>\n`;
}

function defaultTonywoodFunnelFor(site) {
  return {
    target_url: defaultTonywoodAdvisoryUrl,
    source: site.domain,
    campaign: campaignForDestination(site.domain, "tonywood_advisory"),
    medium: "owned-referral",
  };
}

function analyticsFor(site) {
  const funnel = site.tonywood_funnel || defaultTonywoodFunnelFor(site);
  const goal = site.analytics_goal || {};
  const source = funnel.source || site.domain;
  return {
    north_star: goal.north_star || defaultAnalyticsNorthStar,
    site_goal: goal.site_goal || site.summary,
    primary_conversion: goal.primary_conversion || "qualified_tonywood_advisory_conversation",
    primary_destination: goal.primary_destination || funnel.target_url || defaultTonywoodAdvisoryUrl,
    measurement_note: goal.measurement_note || "Review source-site visits, tracked Tonywood outbound clicks, Tonywood campaign landings, and manually qualified advisory conversations.",
    source,
    campaign: goal.campaign || funnel.campaign || campaignForDestination(source, "tonywood_advisory"),
  };
}

function trackedTonywoodUrlFor(site, target, content = "cta", campaignOverride = "") {
  const funnel = site.tonywood_funnel || defaultTonywoodFunnelFor(site);
  try {
    const url = new URL(target);
    const source = funnel.source || site.domain;
    const campaign = campaignOverride || funnel.campaign || campaignForDestination(source, "tonywood_advisory");
    url.searchParams.set("mtm_campaign", campaign);
    url.searchParams.set("mtm_source", source);
    url.searchParams.set("mtm_medium", funnel.medium || "owned-referral");
    if (content) url.searchParams.set("mtm_content", content);
    return url.href;
  } catch {
    return "";
  }
}

function tonywoodFunnelUrlFor(site, content = "cta") {
  const funnel = site.tonywood_funnel || defaultTonywoodFunnelFor(site);
  return trackedTonywoodUrlFor(site, funnel.target_url || defaultTonywoodAdvisoryUrl, content);
}

function tonywoodWritingUrlFor(site, target, content = "writing_link") {
  const funnel = site.tonywood_funnel || defaultTonywoodFunnelFor(site);
  const source = funnel.source || site.domain;
  return trackedTonywoodUrlFor(site, target, content, campaignForDestination(source, "tonywood_writing"));
}

function trackedOutboundUrlFor(site, target, content = "cta", campaign = "", medium = "owned-referral") {
  const funnel = site.tonywood_funnel || defaultTonywoodFunnelFor(site);
  try {
    const url = new URL(target);
    const source = funnel.source || site.domain;
    url.searchParams.set("mtm_campaign", campaign || campaignForDestination(source, "outbound"));
    url.searchParams.set("mtm_source", source);
    url.searchParams.set("mtm_medium", medium);
    if (content) url.searchParams.set("mtm_content", content);
    return url.href;
  } catch {
    return "";
  }
}

function funnelAttrsFor(site, content, stage = "source_to_tonywood_advisory") {
  const funnel = site.tonywood_funnel || defaultTonywoodFunnelFor(site);
  const source = funnel.source || site.domain;
  const destination = stage === "source_to_tonywood_writing" ? "tonywood_writing" : "tonywood_advisory";
  const campaign = stage === "source_to_tonywood_writing"
    ? campaignForDestination(source, destination)
    : funnel.campaign || campaignForDestination(source, destination);
  return [
    ["data-funnel-category", "Source site funnel"],
    ["data-funnel-stage", stage],
    ["data-funnel-source", source],
    ["data-funnel-campaign", campaign],
    ["data-funnel-content", content],
  ].map(([name, value]) => ` ${name}="${escapeHtml(value)}"`).join("");
}

function outboundAttrsFor(site, content, stage, campaign) {
  const funnel = site.tonywood_funnel || defaultTonywoodFunnelFor(site);
  const source = funnel.source || site.domain;
  return [
    ["data-funnel-category", "Source site funnel"],
    ["data-funnel-stage", stage],
    ["data-funnel-source", source],
    ["data-funnel-campaign", campaign || campaignForDestination(source, "outbound")],
    ["data-funnel-content", content],
  ].map(([name, value]) => ` ${name}="${escapeHtml(value)}"`).join("");
}

function campaignForDestination(source, destination) {
  return `${sourceSlugForCampaign(source)}_to_${destination}`;
}

function sourceSlugForCampaign(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\.[a-z0-9-]+$/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function slugForCampaign(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "source_site";
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

  function shouldDelayNavigation(event, link) {
    if (event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (link.target && link.target.toLowerCase() !== "_self") return false;
    if (link.hasAttribute("download")) return false;
    try {
      const url = new URL(link.href, window.location.href);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
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

    document.addEventListener("click", (event) => {
      const link = event.target?.closest?.("a[data-funnel-stage]");
      if (!link) return;
      const href = cleanUrl(link.href);
      const source = link.dataset.funnelSource || window.location.hostname;
      const campaign = link.dataset.funnelCampaign || "";
      const content = link.dataset.funnelContent || link.textContent?.trim() || link.href;
      const category = link.dataset.funnelCategory || "Source site funnel";
      window._paq.push([
        "trackEvent",
        category,
        link.dataset.funnelStage || "source_to_tonywood_advisory",
        [source, campaign, content].filter(Boolean).join(" | "),
      ]);
      if (href) window._paq.push(["trackLink", href, "link"]);
      if (!shouldDelayNavigation(event, link)) return;
      event.preventDefault();
      window.setTimeout(() => {
        window.location.href = link.href;
      }, 180);
    });

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
  return ["yqup", "holding", "country", "cao", "agentics_home", "ai_ops", "orchistra", "agentic_leader", "snaxk", "gamma"].includes(mode);
}

function composeFor(items) {
  const services = items
    .map((site) => {
      const envBlock = site.briefing?.mailerlite
        ? `    environment:
      MAILERLITE_API_TOKEN: \${CHIEFAGENTICOFFICER_MAILERLITE_API_TOKEN:-}
`
        : "";
      return `  ${site.service}:
    image: node:20-alpine
    container_name: site-${site.service}
    restart: unless-stopped
    read_only: true
    user: node
    command: ["node", "/srv/site/server.mjs"]
${envBlock}    ports:
      - "127.0.0.1:${site.port}:${nodeServerPort}"
    volumes:
      - ./dist/${site.domain}/www:/srv/site:ro
    tmpfs:
      - /tmp
`;
    })
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

	@local_assets path /llms.txt /robots.txt /sitemap.xml /feed.xml /site.webmanifest /favicon.svg /apple-touch-icon.png /app-icon-192.png /app-icon-512.png /matomo-config.json /static/*
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
  if (site.mode === "cao") serverConfig.forAgentsPage = true;
  if (site.briefing?.mailerlite) {
    serverConfig.mailerlite = {
      signupEndpoint: site.briefing.mailerlite.endpoint || "/api/briefing-signup",
      groupId: site.briefing.mailerlite.group_id,
      source: site.domain,
    };
  }
  const mailerLiteRouteBlock = serverConfig.mailerlite ? `
  if (config.mailerlite?.signupEndpoint && pathname === config.mailerlite.signupEndpoint) {
    await handleMailerLiteSignup(req, res);
    return;
  }
` : "";
  const forAgentsRouteBlock = site.mode === "cao" ? `
  if (pathname === "/for-agents" || pathname === "/for-agents/") {
    await serveLocalFile(req, res, "/for-agents/index.html", "no-store");
    return;
  }
` : "";
  const mailerLiteHandlerBlock = serverConfig.mailerlite ? `
async function handleMailerLiteSignup(req, res) {
  if (req.method !== "POST") {
    res.writeHead(405, {
      "content-type": "application/json; charset=utf-8",
      "allow": "POST",
      "cache-control": "no-store",
    });
    res.end(JSON.stringify({ ok: false, message: "Signup endpoint accepts POST only." }));
    return;
  }

  if (!config.mailerlite?.groupId) {
    sendJson(res, 503, { ok: false, message: "MailerLite group is not configured for this site." });
    return;
  }

  const token = process.env.MAILERLITE_API_TOKEN || process.env.MAILERLITE_API_KEY;
  if (!token) {
    sendJson(res, 503, {
      ok: false,
      code: "missing_mailerlite_token",
      message: "MailerLite is not configured on this preview server yet.",
    });
    return;
  }

  const fields = await readSignupFields(req);
  if (fields.website) {
    sendJson(res, 200, { ok: true, message: "Thank you." });
    return;
  }

  const email = cleanField(fields.work_email || fields.email).toLowerCase();
  if (!isValidEmail(email)) {
    sendJson(res, 422, { ok: false, message: "Please enter a valid work email address." });
    return;
  }
  if (fields.consent !== "yes") {
    sendJson(res, 422, { ok: false, message: "Please confirm consent to receive the briefing." });
    return;
  }

  const fullFields = {
    name: cleanField(fields.name),
    country: cleanField(fields.country_market),
    role: cleanField(fields.role),
    board_issue: cleanField(fields.board_issue),
    signup_source: config.mailerlite.source || config.domain,
  };
  const safeFields = {
    name: fullFields.name,
    country: fullFields.country,
  };

  const basePayload = {
    email,
    status: "active",
    resubscribe: true,
    groups: [String(config.mailerlite.groupId)],
    fields: pruneEmpty(fullFields),
  };

  let result = await postMailerLiteSubscriber(token, basePayload);
  if (!result.ok && result.status === 422 && Object.keys(basePayload.fields || {}).some((field) => !["name", "country"].includes(field))) {
    result = await postMailerLiteSubscriber(token, {
      ...basePayload,
      fields: pruneEmpty(safeFields),
    });
    result.fieldWarning = "Some site-only fields were not sent because matching MailerLite custom fields may not exist yet.";
  }

  if (!result.ok) {
    console.error("mailerlite_signup_error", {
      status: result.status,
      code: result.body?.message || result.error || "unknown",
    });
    sendJson(res, result.status >= 400 && result.status < 500 ? 422 : 502, {
      ok: false,
      message: "MailerLite could not accept this signup yet.",
    });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    message: "Thank you. Your Chief Agentic Officer Briefing signup has been received.",
    subscriber_id: result.body?.data?.id || null,
    warning: result.fieldWarning || null,
  });
}

function readSignupFields(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 32768) {
        reject(new Error("signup_body_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const contentType = String(req.headers["content-type"] || "").toLowerCase();
      if (contentType.includes("application/json")) {
        try {
          resolve(JSON.parse(body || "{}"));
        } catch {
          resolve({});
        }
        return;
      }
      const params = new URLSearchParams(body);
      const fields = {};
      for (const [key, value] of params.entries()) fields[key] = value;
      resolve(fields);
    });
  });
}

function postMailerLiteSubscriber(token, payload) {
  return new Promise((resolve) => {
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    const apiReq = httpsRequest({
      protocol: "https:",
      hostname: "connect.mailerlite.com",
      method: "POST",
      path: "/api/subscribers",
      headers: {
        "authorization": "Bearer " + token,
        "accept": "application/json",
        "content-type": "application/json",
        "content-length": String(body.length),
      },
    }, (apiRes) => {
      const chunks = [];
      apiRes.on("data", (chunk) => chunks.push(chunk));
      apiRes.on("end", () => {
        const responseText = Buffer.concat(chunks).toString("utf8");
        let parsed = null;
        try {
          parsed = responseText ? JSON.parse(responseText) : null;
        } catch {
          parsed = { message: responseText.slice(0, 200) };
        }
        const status = apiRes.statusCode || 502;
        resolve({ ok: status >= 200 && status < 300, status, body: parsed });
      });
    });
    apiReq.on("error", (error) => resolve({ ok: false, status: 502, error: error.message }));
    apiReq.end(body);
  });
}

function cleanField(value) {
  return String(value || "").trim().slice(0, 240);
}

function pruneEmpty(fields) {
  const output = {};
  for (const [key, value] of Object.entries(fields)) {
    const cleaned = cleanField(value);
    if (cleaned) output[key] = cleaned;
  }
  return output;
}

function isValidEmail(value) {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(value || ""));
}

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(body.length),
    "cache-control": "no-store",
  });
  res.end(body);
}
` : "";

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
const localPageMode = ["yqup", "holding", "country", "cao", "agentics_home", "ai_ops", "orchistra", "agentic_leader", "snaxk", "gamma"].includes(config.mode);

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
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".xml", "application/xml; charset=utf-8"],
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
${mailerLiteRouteBlock}${forAgentsRouteBlock}
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
    || pathname === "/sitemap.xml"
    || pathname === "/feed.xml"
    || pathname === "/site.webmanifest"
    || pathname === "/favicon.svg"
    || pathname === "/apple-touch-icon.png"
    || pathname === "/app-icon-192.png"
    || pathname === "/app-icon-512.png"
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
${mailerLiteHandlerBlock}
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
    : site.mode === "yqup"
      ? "Normal pages are served by the per-site bespoke YQUP consulting and system-sites container."
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
                : site.mode === "agentic_leader"
                  ? "Normal pages are served by the per-site bespoke Agentic Leader field-guide container."
                  : site.mode === "snaxk"
                    ? "Normal pages are served by the per-site bespoke SNAXK judgement container."
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
  if (site.domain === "agenticleader.com") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#24372f"/>
  <path d="M10 46c10-12 22-12 34-24" fill="none" stroke="#f4efe2" stroke-width="4" stroke-linecap="round"/>
  <path d="M10 46c10-5 20-4 31-1c5 2 9 1 13-3" fill="none" stroke="#8fa787" stroke-width="4" stroke-linecap="round"/>
  <circle cx="45" cy="20" r="7" fill="#b45f3c"/>
  <path d="M22 19h16v16H22z" fill="#f4efe2"/>
  <path d="M26 24h8M26 30h6" stroke="#24372f" stroke-width="2" stroke-linecap="round"/>
</svg>
`;
  }
  if (site.domain === "snaxk.com") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#4b2f1b"/>
  <rect x="10" y="13" width="44" height="38" rx="14" fill="#f5cf75"/>
  <path d="M20 37c3-10 9-16 18-18c5 3 8 8 9 15" fill="none" stroke="#4b2f1b" stroke-width="4" stroke-linecap="round"/>
  <path d="M20 37c7 3 15 3 24 0" fill="none" stroke="#9b5b25" stroke-width="4" stroke-linecap="round"/>
  <circle cx="42" cy="27" r="2.5" fill="#4b2f1b"/>
  <path d="M17 44h30" stroke="#4b2f1b" stroke-width="4" stroke-linecap="round"/>
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
  const servingNote = site.mode === "yqup"
    ? `The human-facing page is a local static YQUP consulting page for
agent-readable system sites, human-visible governance surfaces, board advisory,
operations, and agentic-systems consulting. YQUP builds the public or controlled
information surfaces that agents need to read while keeping the same work clear
to humans. It links the YQUP ecosystem and routes qualified consulting enquiries
to Tonywood.org advisory. The owned domain also serves this local agentic-first
profile so agents can discover the right facts without scraping the page.`
    : site.mode === "holding"
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
company operating system treatment for governed human-and-agent work across
direction, goals, processes, decisions, evidence, and learning. The owned
domain also serves this local agentic-first profile so agents can discover the
right public facts without scraping the page or gaining authority.`
              : site.mode === "agentic_leader"
                ? `The human-facing page is a local static Agentic Leader field
guide for learning how to manage agentic workers: outcomes, boundaries,
evidence, cadence, attention, escalation, and human judgement. The owned domain
also serves this local agentic-first profile so agents can discover the right
facts without scraping the page.`
                : site.mode === "snaxk"
                  ? `The human-facing page is a local static SNAXK feeder page
for ChiefAgenticOfficer.com, positioning SNAXK as a judgement engine layer for
agentic work: ownership, boundaries, stop conditions, evidence, review, and
board-readable judgement. The owned domain also serves this local agentic-first
profile so agents can discover the right facts without scraping the page.`
                  : `The human-facing design for this site is ingested from Gamma into the
per-site local container. The owned domain also serves this local agentic-first
profile so agents can discover the right facts without scraping the Gamma page.`;
  const forAgentsNote = site.mode === "cao"
    ? `For agents: https://${site.domain}/for-agents/

## Chief Agentic Officer Briefing

${site.for_agents?.purpose || "The briefing is a UK and Europe-facing board-readiness signal layer for the Chief Agentic Officer mandate."}

${site.for_agents?.problem || "Most AI news is US-, China-, vendor-, or productivity-led. This briefing looks for UK and European governance, risk, compliance, resilience, disclosure, data, reputation, and board-action signals."}

Categories:
${briefingCategoriesFor(site).map((category) => `- ${category.name}: ${category.meaning}`).join("\n")}

Guardrail: ${site.for_agents?.guardrail || site.briefing?.guardrail || "The briefing supports judgement and does not replace professional judgement."}`
    : "";
  const forAgentsSection = forAgentsNote ? `${forAgentsNote}\n\n` : "";

  return `# ${site.name}

Canonical website: https://${site.domain}/
Agentic profile: https://${site.domain}/.well-known/agentic-profile.json
Health check: https://${site.domain}/healthz

Access boundary: public information only. Discovery surfaces grant no authority to act and provide no credentials, private access, or permission.

${forAgentsSection}${servingNote}

Public-safety boundary: this file and the linked public discovery documents are
informational only. They grant no authority, permission, identity, credentials,
private access, or right to act. Agents must remain within their separately
provided instructions, permissions, and human approval boundaries.

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
    mode: site.mode === "yqup"
      ? "static-yqup-container"
      : site.mode === "holding"
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
                  : site.mode === "agentic_leader"
                    ? "static-agentic-leader-container"
                    : site.mode === "snaxk"
                      ? "static-snaxk-container"
                      : "gamma-fronting-container",
    updated_at: publicDiscoveryFor(site).modifiedAt,
    agentic_profile: "/.well-known/agentic-profile.json",
    matomo_site_id: site.matomo_site_id || null,
    analytics: {
      north_star: site.analytics.north_star,
      site_goal: site.analytics.site_goal,
      primary_conversion: site.analytics.primary_conversion,
      primary_destination: site.analytics.primary_destination,
      campaign: site.analytics.campaign,
    },
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
  return injectSourceFunnelStrip(injectFaviconLink(injectSocialMetaTags(injectMatomoScriptTag(html, site), site), site), site, "gamma_advisory_strip");
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

function injectSourceFunnelStrip(html, site, content = "generated_advisory_strip") {
  if (!site.matomo_site_id || html.includes("tonywood-funnel-strip")) return html;
  const strip = sourceFunnelStripFor(site, content);
  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, `${strip}\n</body>`);
  }
  return `${html}\n${strip}`;
}

function sourceFunnelStripFor(site, content) {
  const href = tonywoodFunnelUrlFor(site, content);
  if (!href) return "";
  return `
<section class="tonywood-funnel-strip" aria-label="TonyWood advisory">
  <style>
    .tonywood-funnel-strip {
      position: fixed;
      left: 16px;
      right: 16px;
      bottom: 16px;
      z-index: 2147483000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      max-width: 920px;
      margin: 0 auto;
      padding: 12px 14px;
      border: 1px solid rgba(15, 23, 42, 0.14);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 14px 46px rgba(15, 23, 42, 0.16);
      color: #111827;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }

    .tonywood-funnel-strip strong {
      display: block;
      font-size: 14px;
      line-height: 1.2;
    }

    .tonywood-funnel-strip span {
      display: block;
      margin-top: 3px;
      color: #4b5563;
      font-size: 13px;
      line-height: 1.35;
    }

    .tonywood-funnel-strip a {
      min-height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      padding: 0 13px;
      border-radius: 6px;
      background: #111827;
      color: #ffffff;
      font-size: 13px;
      font-weight: 760;
      text-decoration: none;
    }

    @media (max-width: 680px) {
      .tonywood-funnel-strip {
        align-items: stretch;
        flex-direction: column;
      }

      .tonywood-funnel-strip a {
        width: 100%;
      }
    }
  </style>
  <div>
    <strong>Make this practical with Tony Wood</strong>
    <span>Bring the live AI, board, governance, or operating question into an advisory conversation.</span>
  </div>
  <a href="${escapeHtml(href)}"${funnelAttrsFor(site, content)}>Discuss advisory</a>
</section>`;
}

function hasFaviconReference(html) {
  return /rel=["'][^"']*(?:shortcut\s+)?icon[^"']*["']/i.test(html)
    || /rel=["']apple-touch-icon["']/i.test(html)
    || /\/favicon\./i.test(html);
}

function yqupPageFor(site) {
  const offers = site.offers || [];
  const featured = site.ecosystem_featured || [];
  const secondary = site.ecosystem_secondary || [];
  const thinkingLinks = site.thinking_links || [];
  const logo = site.brand_assets?.logo || "/assets/yqup-logo.svg";
  const heroImage = site.hero_background_image || "/assets/yqup/hero-boardroom.webp";
  const heroImageMobile = site.hero_background_image_mobile || heroImage;
  const decisionImage = site.decision_brief_image || "/assets/yqup/decision-brief.webp";
  const contactImage = site.contact_background_image || "/assets/yqup/contact-boardroom.webp";
  const heroHref = tonywoodFunnelUrlFor(site, "hero_discuss_advisory") || defaultTonywoodAdvisoryUrl;
  const navHref = tonywoodFunnelUrlFor(site, "nav_advisory") || defaultTonywoodAdvisoryUrl;
  const systemHref = tonywoodFunnelUrlFor(site, "system_site_build") || defaultTonywoodAdvisoryUrl;
  const finalHref = tonywoodFunnelUrlFor(site, "final_consulting_enquiry") || defaultTonywoodAdvisoryUrl;
  const tonywoodHomeHref = trackedOutboundUrlFor(site, "https://www.tonywood.org/", "final_tonywood_home", "yqup_to_tonywood") || "https://www.tonywood.org/";
  const decisionQuestions = [
    "What are you trying to decide?",
    "What evidence would change the decision?",
    "Who owns the outcome after the meeting?",
    "Where must human judgement stay visible?",
  ];
  const systemNotes = [
    {
      title: "Know what is being approved",
      body: "Name the outcome, risk, owner, cost and evidence before the work drifts through the organisation."
    },
    {
      title: "Keep ownership visible",
      body: "Make it clear who can proceed, who can stop, who reviews the result and where judgement belongs."
    },
    {
      title: "Leave evidence behind",
      body: "Create a practical record that the board and operating team can return to when the next decision arrives."
    },
  ];
  const arrowIcon = `<svg aria-hidden="true" viewBox="0 0 20 20"><path d="M4 10h11M11 6l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(site.title || site.name)}</title>
  <meta name="description" content="${escapeHtml(site.summary)}">
${socialMetaTagsFor(site)}  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="${escapeHtml(heroImage)}" as="image" fetchpriority="high">
  <link rel="preload" href="/assets/yqup/instrument-sans-latin-variable.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/yqup/newsreader-latin-variable.woff2" as="font" type="font/woff2" crossorigin>
${matomoScriptTagFor(site)}  <style>
    @font-face {
      font-family: "Instrument Sans";
      src: url("/assets/yqup/instrument-sans-latin-variable.woff2") format("woff2");
      font-style: normal;
      font-weight: 400 700;
      font-display: swap;
    }

    @font-face {
      font-family: "Newsreader";
      src: url("/assets/yqup/newsreader-latin-variable.woff2") format("woff2");
      font-style: normal;
      font-weight: 300 700;
      font-display: swap;
    }

    :root {
      color-scheme: dark light;
      --ink: #11120f;
      --ink-soft: #4f514b;
      --paper: #fbfaf6;
      --paper-warm: #f4f0e8;
      --night: #080b0a;
      --hedge: #1c2821;
      --brass: #c7a35b;
      --brass-soft: #dfc98f;
      --line: rgba(17, 18, 15, 0.15);
      --line-light: rgba(255, 253, 247, 0.18);
      --white: #fffdf7;
      --sans: "Instrument Sans", ui-sans-serif, system-ui, sans-serif;
      --serif: "Newsreader", Georgia, serif;
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
      background: var(--night);
    }

    body {
      margin: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--sans);
      font-size: 17px;
      line-height: 1.55;
      letter-spacing: 0;
    }

    a {
      color: inherit;
      text-underline-offset: 0.2em;
    }

    p,
    h1,
    h2,
    h3,
    blockquote {
      margin-top: 0;
    }

    h1,
    h2,
    h3 {
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }

    .site-header {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10;
      min-height: 82px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 16px clamp(22px, 4vw, 68px);
      border-bottom: 1px solid rgba(255, 253, 247, 0.14);
      background: rgba(8, 11, 10, 0.74);
      -webkit-backdrop-filter: blur(14px);
      backdrop-filter: blur(14px);
      color: var(--white);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      text-decoration: none;
    }

    .brand-logo {
      width: 100px;
      height: auto;
      display: block;
    }

    nav {
      display: flex;
      justify-content: flex-end;
      gap: 28px;
      align-items: center;
      color: var(--white);
      font-size: 15px;
      font-weight: 620;
    }

    nav a {
      text-decoration: none;
    }

    nav a:not(.nav-contact) {
      opacity: 1;
      text-shadow: 0 1px 12px rgba(0, 0, 0, 0.45);
    }

    nav a:hover,
    nav a:focus-visible {
      opacity: 1;
    }

    .nav-contact {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      padding: 0 18px;
      border: 1px solid var(--white);
      border-radius: 6px;
      background: var(--white);
      color: var(--ink);
      font-weight: 700;
    }

    .mobile-menu {
      display: none;
      position: relative;
    }

    .mobile-menu summary {
      list-style: none;
      cursor: pointer;
      font-weight: 700;
    }

    .mobile-menu summary::-webkit-details-marker {
      display: none;
    }

    .mobile-menu-panel {
      position: absolute;
      top: calc(100% + 14px);
      right: 0;
      width: min(270px, calc(100vw - 36px));
      display: grid;
      padding: 10px;
      border: 1px solid var(--line-light);
      border-radius: 6px;
      background: rgba(8, 11, 10, 0.98);
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.42);
    }

    .mobile-menu-panel a {
      padding: 12px;
      color: var(--white);
      text-decoration: none;
    }

    .hero {
      position: relative;
      min-height: min(820px, 92vh);
      display: flex;
      align-items: center;
      overflow: hidden;
      padding: 132px clamp(24px, 5.5vw, 90px) 78px;
      background: var(--night);
      color: var(--white);
    }

    .hero-media {
      position: absolute;
      inset: 0;
      z-index: 0;
    }

    .hero-media img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
      object-position: center;
      transform: scale(1.015);
    }

    .hero-inner {
      position: relative;
      z-index: 1;
      width: min(100%, 650px);
    }

    h1,
    h2,
    h3 {
      font-family: var(--serif);
    }

    h1 {
      max-width: 650px;
      margin-bottom: 24px;
      color: var(--white);
      font-size: clamp(58px, 6.2vw, 96px);
      font-weight: 540;
      line-height: 0.93;
    }

    h2 {
      margin-bottom: 18px;
      font-size: clamp(42px, 4vw, 66px);
      font-weight: 480;
      line-height: 0.98;
    }

    h3 {
      margin-bottom: 12px;
      font-size: 29px;
      font-weight: 480;
      line-height: 1.04;
    }

    .hero-copy {
      max-width: 610px;
      margin-bottom: 0;
      color: rgba(255, 253, 247, 0.84);
      font-size: 22px;
      line-height: 1.5;
    }

    .section {
      padding: 84px clamp(24px, 5.5vw, 90px);
      border-bottom: 1px solid var(--line);
    }

    .section-inner {
      width: min(100%, 1420px);
      margin: 0 auto;
    }

    .hero-actions,
    .action-row {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      align-items: center;
      margin-top: 30px;
    }

    .button {
      min-height: 52px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 0 22px;
      border: 1px solid currentColor;
      border-radius: 6px;
      background: transparent;
      color: inherit;
      font-family: var(--sans);
      font-size: 16px;
      font-weight: 680;
      text-decoration: none;
      white-space: nowrap;
      transition: background-color 180ms ease, color 180ms ease, transform 180ms ease;
    }

    .button svg {
      width: 18px;
      height: 18px;
      flex: 0 0 auto;
    }

    .button:hover,
    .button:focus-visible {
      transform: translateY(-2px);
    }

    .hero .button.primary,
    .contact-band .button.primary {
      border-color: var(--white);
      background: var(--white);
      color: var(--ink);
    }

    .hero .button.secondary,
    .contact-band .button.secondary {
      border-color: rgba(255, 253, 247, 0.76);
      color: var(--white);
    }

    .decision-band {
      background: var(--paper);
    }

    .decision-layout {
      display: grid;
      grid-template-columns: minmax(280px, 0.82fr) minmax(440px, 1.25fr);
      gap: clamp(46px, 8vw, 130px);
      align-items: start;
    }

    .decision-layout h2 {
      max-width: 460px;
      margin-bottom: 0;
    }

    .decision-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .decision-list li {
      position: relative;
      padding: 16px 0 16px 30px;
      border-bottom: 1px solid var(--line);
      color: var(--ink);
      font-size: 17px;
    }

    .decision-list li {
      font-weight: 520;
    }

    .decision-list li::before {
      content: "";
      position: absolute;
      left: 0;
      top: 24px;
      width: 8px;
      height: 8px;
      border: 1.5px solid var(--brass);
      border-radius: 50%;
    }

    .clarity-band {
      position: relative;
      overflow: hidden;
      padding-top: 96px;
      padding-bottom: 96px;
      background: var(--paper);
    }

    .clarity-layout {
      display: grid;
      grid-template-columns: minmax(280px, 0.88fr) minmax(520px, 1.42fr) minmax(300px, 0.9fr);
      gap: 0;
      align-items: stretch;
    }

    .clarity-intro {
      padding-right: clamp(30px, 4vw, 64px);
    }

    .clarity-intro h2 {
      max-width: 380px;
      font-size: clamp(44px, 3.5vw, 58px);
    }

    .clarity-intro p {
      max-width: 410px;
      color: var(--ink-soft);
      font-size: 18px;
    }

    .clarity-intro .button {
      margin-top: 18px;
      background: var(--night);
      color: var(--white);
    }

    .principles {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .principle {
      min-width: 0;
      padding: 8px 28px;
      border-left: 1px solid var(--line);
    }

    .principle-number,
    .ecosystem-number,
    .article-number {
      display: block;
      margin-bottom: 26px;
      color: #a37a2f;
      font-family: var(--serif);
      font-size: 16px;
    }

    .principle p {
      margin-bottom: 0;
      color: var(--ink-soft);
    }

    .clarity-media {
      min-height: 390px;
      margin-left: 18px;
      overflow: hidden;
    }

    .clarity-media img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
      object-position: 60% center;
    }

    .ways-band {
      position: relative;
      overflow: hidden;
      border-bottom: 1px solid var(--line-light);
      background: var(--night);
      color: var(--white);
    }

    .ways-band::after {
      content: "";
      position: absolute;
      inset: 0 0 0 55%;
      background: url("${escapeHtml(contactImage)}") center / cover no-repeat;
      opacity: 0.28;
      mask-image: linear-gradient(90deg, transparent, #000 32%);
      pointer-events: none;
    }

    .ways-band .section-inner {
      position: relative;
      z-index: 1;
    }

    .ways-intro {
      max-width: 520px;
    }

    .ways-intro p {
      color: rgba(255, 253, 247, 0.72);
      font-size: 19px;
    }

    .offer-list {
      position: relative;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 0;
      margin: 52px 0 0;
      padding: 0;
      list-style: none;
    }

    .offer-list::before {
      content: "";
      position: absolute;
      top: 39px;
      left: 8px;
      right: 8px;
      height: 1px;
      background: rgba(255, 253, 247, 0.4);
    }

    .offer-item {
      position: relative;
      min-width: 0;
      padding: 0 28px 0 0;
    }

    .offer-number {
      display: block;
      height: 54px;
      color: var(--brass-soft);
      font-family: var(--serif);
      font-size: 21px;
    }

    .offer-number::after {
      content: "";
      position: absolute;
      top: 33px;
      left: 0;
      width: 11px;
      height: 11px;
      border-radius: 50%;
      background: var(--brass);
    }

    .offer-item h3 {
      min-height: 62px;
      color: var(--white);
      font-size: 25px;
    }

    .offer-item p {
      margin-bottom: 0;
      color: rgba(255, 253, 247, 0.68);
      font-size: 15px;
    }

    .ways-band .button {
      margin-top: 42px;
      border-color: rgba(255, 253, 247, 0.7);
      color: var(--white);
    }

    .ecosystem-band {
      background: var(--paper);
    }

    .section-kicker {
      margin: 0 0 14px;
      color: #916f32;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .section-lead {
      max-width: 680px;
      margin-bottom: 0;
      color: var(--ink-soft);
      font-size: 19px;
    }

    .ecosystem-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      margin-top: 54px;
    }

    .ecosystem-item {
      min-width: 0;
      padding: 0 26px;
      border-left: 1px solid var(--line);
    }

    .ecosystem-item:first-child {
      padding-left: 0;
      border-left: 0;
    }

    .ecosystem-mark {
      min-height: 70px;
      display: flex;
      align-items: flex-end;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--line);
      color: var(--hedge);
      font-family: var(--serif);
      font-size: clamp(34px, 3.2vw, 52px);
      line-height: 0.9;
    }

    .ecosystem-item h3 {
      margin: 16px 0 5px;
      font-size: 26px;
    }

    .ecosystem-item h3 a {
      text-decoration: none;
    }

    .ecosystem-item p {
      margin-bottom: 0;
      color: var(--ink-soft);
      font-size: 15px;
    }

    .directory-strip {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      margin-top: 38px;
      padding-top: 18px;
      border-top: 1px solid var(--line);
    }

    .directory-strip a {
      min-width: 0;
      padding: 0 18px;
      border-left: 1px solid var(--line);
      color: var(--ink);
      font-size: 14px;
      font-weight: 620;
      text-align: center;
      text-decoration: none;
    }

    .directory-strip a:first-child {
      border-left: 0;
    }

    .thinking-band {
      border-color: var(--line-light);
      background: #0a0d0c;
      color: var(--white);
    }

    .thinking-layout {
      display: grid;
      grid-template-columns: minmax(260px, 0.68fr) minmax(0, 1.55fr) auto;
      gap: clamp(38px, 6vw, 92px);
      align-items: start;
    }

    .thinking-layout h2 {
      margin-bottom: 0;
      color: var(--white);
    }

    .article-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .article-item {
      min-width: 0;
      padding: 0 26px;
      border-left: 1px solid var(--line-light);
    }

    .article-item:first-child {
      padding-left: 0;
      border-left: 0;
    }

    .article-item h3 {
      padding-top: 14px;
      border-top: 1px solid rgba(255, 253, 247, 0.42);
      color: var(--white);
      font-size: 25px;
    }

    .article-item h3 a {
      text-decoration: none;
    }

    .article-item p {
      margin-bottom: 0;
      color: rgba(255, 253, 247, 0.68);
      font-size: 15px;
    }

    .thinking-link {
      align-self: center;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--brass-soft);
      font-weight: 650;
      text-decoration: none;
      white-space: nowrap;
    }

    .thinking-link svg {
      width: 18px;
      height: 18px;
    }

    .contact-band {
      position: relative;
      min-height: 560px;
      display: flex;
      align-items: center;
      overflow: hidden;
      padding: 92px clamp(24px, 5.5vw, 90px);
      background: var(--night);
      color: var(--white);
    }

    .contact-media {
      position: absolute;
      inset: 0;
    }

    .contact-media img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
      object-position: center;
    }

    .contact-inner {
      position: relative;
      z-index: 1;
      width: min(100%, 1420px);
      margin: 0 auto;
    }

    .contact-copy {
      width: min(100%, 620px);
    }

    .contact-copy h2 {
      color: var(--white);
    }

    .contact-copy p {
      color: rgba(255, 253, 247, 0.84);
      font-size: 20px;
    }

    footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 24px;
      padding: 24px clamp(24px, 5.5vw, 90px);
      border-top: 1px solid var(--line-light);
      background: var(--night);
      color: rgba(255, 253, 247, 0.66);
      font-size: 14px;
    }

    .footer-brand {
      display: flex;
      align-items: center;
      gap: 22px;
    }

    .footer-logo {
      width: 108px;
      height: auto;
      display: block;
    }

    @media (prefers-reduced-motion: no-preference) {
      .hero-inner {
        animation: hero-copy-in 720ms ease-out both;
      }

      .hero-media img {
        animation: hero-breathe 16s 1s ease-in-out infinite;
      }
    }

    @keyframes hero-copy-in {
      from {
        opacity: 0;
        transform: translateY(18px);
      }
    }

    @keyframes hero-breathe {
      50% {
        transform: scale(1.025);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      html {
        scroll-behavior: auto;
      }

      *,
      *::before,
      *::after {
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
      }
    }

    @media (max-width: 1180px) {
      nav {
        gap: 18px;
      }

      .clarity-layout {
        grid-template-columns: minmax(280px, 0.72fr) minmax(0, 1.28fr);
      }

      .clarity-media {
        grid-column: 1 / -1;
        min-height: 340px;
        margin: 46px 0 0;
      }

      .ecosystem-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        row-gap: 46px;
      }

      .ecosystem-item:nth-child(4) {
        border-left: 0;
      }

      .thinking-layout {
        grid-template-columns: 1fr;
      }

      .thinking-link {
        align-self: start;
      }
    }

    @media (max-width: 900px) {
      .desktop-nav {
        display: none;
      }

      .mobile-menu {
        display: block;
      }

      .hero {
        min-height: 760px;
        align-items: flex-start;
        padding-top: 138px;
      }

      .hero-inner {
        width: min(100%, 560px);
      }

      h1 {
        font-size: clamp(56px, 10vw, 78px);
      }

      .decision-layout,
      .clarity-layout {
        grid-template-columns: 1fr;
      }

      .decision-layout {
        gap: 34px;
      }

      .principles {
        margin-top: 44px;
      }

      .offer-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        row-gap: 44px;
      }

      .offer-list::before {
        display: none;
      }

      .offer-item {
        padding: 0 26px 0 0;
        border-top: 1px solid var(--line-light);
        padding-top: 18px;
      }

      .offer-number {
        height: auto;
        margin-bottom: 12px;
      }

      .offer-number::after {
        display: none;
      }

      .offer-item h3 {
        min-height: 0;
      }

      .directory-strip {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        row-gap: 18px;
      }

      .directory-strip a:nth-child(4) {
        border-left: 0;
      }

      .article-grid {
        grid-template-columns: 1fr;
        gap: 34px;
      }

      .article-item,
      .article-item:first-child {
        padding: 0;
        border-left: 0;
      }
    }

    @media (max-width: 620px) {
      body {
        font-size: 16px;
      }

      .site-header {
        min-height: 70px;
        padding: 12px 18px;
      }

      .brand-logo {
        width: 82px;
      }

      .hero {
        min-height: 790px;
        padding: 118px 18px 48px;
      }

      .hero-media img {
        object-position: center bottom;
      }

      h1 {
        max-width: 360px;
        font-size: 58px;
      }

      h2 {
        font-size: 44px;
      }

      .hero-copy {
        max-width: 350px;
        font-size: 18px;
      }

      .section {
        padding: 66px 18px;
      }

      .button {
        width: 100%;
      }

      .hero-actions,
      .action-row {
        align-items: stretch;
        flex-direction: column;
      }

      .principles,
      .offer-list,
      .ecosystem-grid,
      .directory-strip {
        grid-template-columns: 1fr;
      }

      .principle,
      .principle:first-child,
      .ecosystem-item,
      .ecosystem-item:first-child,
      .ecosystem-item:nth-child(4) {
        padding: 28px 0;
        border-left: 0;
        border-top: 1px solid var(--line);
      }

      .principle:first-child,
      .ecosystem-item:first-child {
        border-top: 0;
      }

      .clarity-media {
        min-height: 280px;
      }

      .ways-band::after {
        inset: 0;
        opacity: 0.16;
        mask-image: linear-gradient(180deg, transparent 0, #000 45%);
      }

      .offer-item {
        padding-right: 0;
      }

      .directory-strip a,
      .directory-strip a:nth-child(4) {
        padding: 10px 0;
        border-left: 0;
        border-top: 1px solid var(--line);
        text-align: left;
      }

      .contact-band {
        min-height: 620px;
        align-items: flex-start;
        padding: 72px 18px;
      }

      .contact-media img {
        object-position: 58% center;
      }

      .contact-copy {
        width: min(100%, 360px);
      }

      footer,
      .footer-brand {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="${escapeHtml(site.name)} home">
      <img class="brand-logo" src="${escapeHtml(logo)}" alt="${escapeHtml(site.name)}">
    </a>
    <nav class="desktop-nav" aria-label="Primary navigation">
      <a href="#system-sites">Board work</a>
      <a href="#consulting">Ways to work</a>
      <a href="#ecosystem">YQUP world</a>
      <a href="#thinking">Thinking</a>
      <a class="nav-contact" href="${escapeHtml(navHref)}"${funnelAttrsFor(site, "nav_advisory")}>Contact</a>
    </nav>
    <details class="mobile-menu">
      <summary>Menu</summary>
      <nav class="mobile-menu-panel" aria-label="Mobile navigation">
        <a href="#system-sites">Board work</a>
        <a href="#consulting">Ways to work</a>
        <a href="#ecosystem">YQUP world</a>
        <a href="#thinking">Thinking</a>
        <a href="${escapeHtml(navHref)}"${funnelAttrsFor(site, "nav_advisory")}>Contact</a>
      </nav>
    </details>
  </header>

  <main>
    <section class="hero" aria-labelledby="page-title">
      <picture class="hero-media" aria-hidden="true">
        <source media="(max-width: 620px)" srcset="${escapeHtml(heroImageMobile)}">
        <img src="${escapeHtml(heroImage)}" alt="" width="1672" height="941" fetchpriority="high">
      </picture>
      <div class="hero-inner">
        <h1 id="page-title">${escapeHtml(site.heading)}</h1>
        <p class="hero-copy">${escapeHtml(site.summary)}</p>
        <div class="hero-actions">
          <a class="button primary" href="${escapeHtml(heroHref)}"${funnelAttrsFor(site, "hero_discuss_advisory")}>${escapeHtml(site.primary_action_label || "Discuss advisory")}</a>
          <a class="button secondary" href="#consulting">See ways to work</a>
        </div>
      </div>
    </section>

    <section class="section decision-band" id="system-sites">
      <div class="section-inner decision-layout">
        <h2>Bring the decision that is stuck.</h2>
        <ul class="decision-list">
          ${decisionQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}
        </ul>
      </div>
    </section>

    <section class="section clarity-band">
      <div class="section-inner clarity-layout">
        <div class="clarity-intro">
          <h2>Make AI work visible enough to decide on.</h2>
          <p>The useful work is the clarity around ownership, risk, evidence, cost, cadence and what happens after the meeting.</p>
          <a class="button" href="${escapeHtml(systemHref)}"${funnelAttrsFor(site, "system_site_build")}>Talk through a live decision ${arrowIcon}</a>
        </div>
        <div class="principles">
          ${systemNotes.map((item, index) => `<article class="principle">
            <span class="principle-number">${String(index + 1).padStart(2, "0")}.</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
          </article>`).join("")}
        </div>
        <div class="clarity-media">
          <img src="${escapeHtml(decisionImage)}" alt="An ivory decision brief with a hedgerow branch beside an English-country view." width="1536" height="1024" loading="lazy" decoding="async">
        </div>
      </div>
    </section>

    <section class="section ways-band" id="consulting">
      <div class="section-inner">
        <div class="ways-intro">
          <h2>Ways to work.</h2>
          <p>YQUP is practical advisory for boards, CEOs and operators who need a clearer decision, a more honest operating picture or a calm outside view.</p>
        </div>
        <ol class="offer-list">
          ${offers.map((item, index) => `<li class="offer-item">
            <span class="offer-number">${String(index + 1).padStart(2, "0")}.</span>
            <h3>${escapeHtml(item.label)}</h3>
            <p>${escapeHtml(item.body)}</p>
          </li>`).join("")}
        </ol>
        <a class="button" href="${escapeHtml(heroHref)}"${funnelAttrsFor(site, "hero_discuss_advisory")}>Discuss advisory ${arrowIcon}</a>
      </div>
    </section>

    <section class="section ecosystem-band" id="ecosystem">
      <div class="section-inner">
        <p class="section-kicker">YQUP world</p>
        <h2>A connected body of work.</h2>
        <p class="section-lead">Each YQUP site explores one part of making agentic work useful, governed and visible.</p>
        <div class="ecosystem-grid">
          ${featured.map((item, index) => {
            const href = trackedOutboundUrlFor(site, item.url, item.content, item.campaign) || item.url;
            const mark = ["TW", "CAO", "O", "S", "SAS"][index] || item.name.slice(0, 2).toUpperCase();
            return `<article class="ecosystem-item">
              <span class="ecosystem-number">${String(index + 1).padStart(2, "0")}.</span>
              <div class="ecosystem-mark" aria-hidden="true">${escapeHtml(mark)}</div>
              <h3><a href="${escapeHtml(href)}"${outboundAttrsFor(site, item.content, "source_to_yqup_ecosystem", item.campaign)}>${escapeHtml(item.name)}</a></h3>
              <p>${escapeHtml(item.label)}</p>
            </article>`;
          }).join("")}
        </div>
        <div class="directory-strip" aria-label="Additional YQUP sites">
          ${secondary.map((item) => {
            const href = trackedOutboundUrlFor(site, item.url, item.content, item.campaign) || item.url;
            return `<a href="${escapeHtml(href)}"${outboundAttrsFor(site, item.content, "source_to_yqup_directory", item.campaign)}>${escapeHtml(item.name)}</a>`;
          }).join("")}
        </div>
      </div>
    </section>

    <section class="section thinking-band" id="thinking">
      <div class="section-inner thinking-layout">
        <h2>Thinking behind the work.</h2>
        <div class="article-grid">
          ${thinkingLinks.slice(0, 3).map((item, index) => {
            const href = tonywoodWritingUrlFor(site, item.url, item.content) || item.url;
            return `<article class="article-item">
              <span class="article-number">${String(index + 1).padStart(2, "0")}.</span>
              <h3><a href="${escapeHtml(href)}"${funnelAttrsFor(site, item.content, "source_to_tonywood_writing")}>${escapeHtml(item.title)}</a></h3>
              <p>${escapeHtml(item.body)}</p>
            </article>`;
          }).join("")}
        </div>
        <a class="thinking-link" href="${escapeHtml(tonywoodHomeHref)}"${outboundAttrsFor(site, "thinking_tonywood_home", "source_to_tonywood_home", "yqup_to_tonywood")}>Read more on Tonywood.org ${arrowIcon}</a>
      </div>
    </section>

    <section class="contact-band" id="contact">
      <picture class="contact-media" aria-hidden="true">
        <img src="${escapeHtml(contactImage)}" alt="" width="1672" height="941" loading="lazy" decoding="async">
      </picture>
      <div class="contact-inner">
        <div class="contact-copy">
          <h2>Bring the live question.</h2>
          <p>Start with the decision that needs to be understood, owned, governed, stopped, funded or turned into an operating rhythm.</p>
        </div>
        <div class="action-row">
          <a class="button primary" href="${escapeHtml(finalHref)}"${funnelAttrsFor(site, "final_consulting_enquiry")}>Contact Tony ${arrowIcon}</a>
          <a class="button secondary" href="${escapeHtml(tonywoodHomeHref)}"${outboundAttrsFor(site, "final_tonywood_home", "source_to_tonywood_home", "yqup_to_tonywood")}>Read Tonywood.org ${arrowIcon}</a>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="footer-brand">
      <img class="footer-logo" src="${escapeHtml(logo)}" alt="${escapeHtml(site.name)}">
      <span>YQUP Ltd &middot; London and the English countryside</span>
    </div>
    <div>Copyright (c) 2026 YQUP Ltd</div>
  </footer>
</body>
</html>
`;
}

function holdingPageFor(site) {
  const secondary = site.secondary || "#f3c77a";
  const text = site.text || "#101828";
  const surface = site.surface || "#fbfbf8";
  const muted = site.muted || "#667085";
  const actionLabel = site.action_label || "Private preview";
  const fallbackActionHref = site.contact?.email
    ? `mailto:${site.contact.email}`
    : site.contact?.form_url || `mailto:hello@my-agentic.com`;
  const actionHref = tonywoodFunnelUrlFor(site, "holding_action") || fallbackActionHref;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(site.title || site.name)}</title>
  <meta name="description" content="${escapeHtml(site.summary)}">
${socialMetaTagsFor(site)}  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
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
          <a class="button" href="${escapeHtml(actionHref)}"${funnelAttrsFor(site, "holding_action")}>
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
  const fallbackContactHref = site.contact?.email
    ? `mailto:${site.contact.email}`
    : site.contact?.form_url || `https://${site.domain}/`;
  const contactHref = tonywoodFunnelUrlFor(site, "country_start_conversation") || fallbackContactHref;
  const finalContactHref = tonywoodFunnelUrlFor(site, "country_final_conversation") || fallbackContactHref;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(site.title || site.name)}</title>
  <meta name="description" content="${escapeHtml(site.summary)}">
${socialMetaTagsFor(site)}  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
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
          <a class="button secondary" href="${escapeHtml(contactHref)}"${funnelAttrsFor(site, "country_start_conversation")}>${escapeHtml(site.secondary_action_label || "Start a conversation")}</a>
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

    <section class="section cta" id="engine-interest">
      <div class="cta-inner">
        <p class="eyebrow">${escapeHtml(site.cta_eyebrow || "Useful first conversation")}</p>
        <h2>${escapeHtml(site.cta_title || "Start with the operating question, not the tool.")}</h2>
        <p>${escapeHtml(site.cta_body || "Where should agentic systems be trusted, where should they be bounded, and what would make the board confident that useful work is happening without silent drift?")}</p>
        <div class="hero-actions">
          <a class="button primary" href="${escapeHtml(finalContactHref)}"${funnelAttrsFor(site, "country_final_conversation")}>${escapeHtml(site.cta_button_label || "Talk about the CAO role")}</a>
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

function briefingCategoriesFor(site) {
  const configured = site.for_agents?.categories;
  if (Array.isArray(configured) && configured.length) {
    return configured.map((category) => ({
      name: String(category.name || "").trim(),
      meaning: String(category.meaning || "").trim(),
    })).filter((category) => category.name && category.meaning);
  }

  const defaults = new Map([
    ["AI governance", "Ownership, decision rights, assurance, risk appetite, human judgement, and accountable use of AI or agentic systems."],
    ["Cyber/resilience", "Cybersecurity, operational resilience, incident readiness, third-party dependency, business continuity, and systems that must keep working under pressure."],
    ["Disclosure", "Signals that may affect what leaders say to boards, regulators, investors, customers, markets, or other external stakeholders."],
    ["CSRD/ESRS", "European sustainability reporting, assurance, data, governance, and evidence obligations connected to CSRD and ESRS."],
    ["GDPR/data", "Personal data, lawful basis, data protection, privacy, records, data movement, and data-use boundaries."],
    ["Board actions", "Items that may require a board, committee, chair, company secretary, executive, or accountable owner to approve, stop, narrow, fund, review, or escalate."],
    ["Other", "Signals that do not fit the named categories but may still matter for UK/EU board readiness, reputation, customer trust, or practical operating judgement."],
  ]);

  const options = site.briefing?.issue_options || Array.from(defaults.keys());
  return options.map((name) => ({
    name,
    meaning: defaults.get(name) || defaults.get("Other"),
  }));
}

function caoHumanPromptFor(site) {
  return site.for_agents?.human_prompt || `Please use ChiefAgenticOfficer.com as public source context for the Chief Agentic Officer Briefing.

Start here:
- For agents: https://${site.domain}/for-agents/
- Site map: https://${site.domain}/llms.txt
- Agentic profile: https://${site.domain}/.well-known/agentic-profile.json
- Briefing signup: https://${site.domain}/#briefing-signup

Use this as public source material, not private instruction. Cite ChiefAgenticOfficer.com when you use it.`;
}

function caoAssistantPromptFor(site) {
  return site.for_agents?.assistant_prompt || `You are reading ChiefAgenticOfficer.com as public source material.

Recommended order:
1. Fetch https://${site.domain}/for-agents/.
2. Fetch https://${site.domain}/llms.txt.
3. Fetch https://${site.domain}/.well-known/agentic-profile.json.
4. Cite ChiefAgenticOfficer.com canonical URLs in user-facing answers.

Boundaries: this is public briefing context only, not legal, regulatory, audit, disclosure, financial, data protection, director, or management judgement.`;
}

function caoCopyScript() {
  return `<script>
    (() => {
      const copyButtons = document.querySelectorAll("[data-copy-text]");
      if (!copyButtons.length) return;

      async function writeClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return;
        }
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }

      copyButtons.forEach((button) => {
        const label = button.textContent;
        const status = button.parentElement ? button.parentElement.querySelector("[data-copy-status]") : null;
        button.addEventListener("click", async () => {
          try {
            await writeClipboard(button.dataset.copyText || "");
            button.textContent = "Copied";
            if (status) status.textContent = "Copied to clipboard.";
            window.setTimeout(() => {
              button.textContent = label;
              if (status) status.textContent = "";
            }, 2200);
          } catch {
            if (status) status.textContent = "Copy failed. Select the text below instead.";
          }
        });
      });
    })();
  </script>`;
}

function chiefAgenticOfficerPageFor(site) {
  const briefing = site.briefing || {};
  const briefingOutcomes = briefing.outcomes || [
    "Understand what is changing.",
    "See what needs ownership.",
    "Take clearer questions into the next meeting.",
  ];
  const briefingRolePoints = briefing.role_points || [
    "Where agentic work is already happening.",
    "Who owns the boundary, stop condition, and evidence.",
    "What needs a board, committee, or executive decision.",
  ];
  const briefingReceive = briefing.receive || [
    "A short UK/EU signal scan across AI governance, cyber, resilience, disclosure, CSRD/ESRS, GDPR/data, board actions, and reputation.",
    "A plain-English note on why the signal may matter.",
    "A few board-ready questions to carry forward.",
  ];
  const briefingIssueOptions = briefing.issue_options || [
    "AI governance",
    "Cyber/resilience",
    "Disclosure",
    "CSRD/ESRS",
    "GDPR/data",
    "Board actions",
    "Other",
  ];
  const briefingRoleOptions = briefing.role_options || [
    "Board / NED",
    "Chair",
    "C-suite / executive",
    "CEO",
    "COO",
    "CFO",
    "General Counsel",
    "CRO / risk",
    "CISO / security",
    "DPO / data protection",
    "Company Secretary / governance",
    "Chief of Staff / operator",
    "Advisor / consultant",
    "Investor / analyst",
    "Other",
  ];
  const briefingCountryOptions = briefing.country_options || [
    "Europe / pan-European",
    "EU / European Union",
    "United Kingdom",
    "Ireland",
    "France",
    "Germany",
    "Netherlands",
    "Belgium",
    "Luxembourg",
    "Switzerland",
    "Austria",
    "Denmark",
    "Finland",
    "Norway",
    "Sweden",
    "Iceland",
    "Spain",
    "Portugal",
    "Italy",
    "Greece",
    "Poland",
    "Czechia",
    "Slovakia",
    "Hungary",
    "Romania",
    "Bulgaria",
    "Croatia",
    "Slovenia",
    "Estonia",
    "Latvia",
    "Lithuania",
    "Cyprus",
    "Malta",
    "Other Europe",
    "United States",
    "Canada",
    "Other / global",
  ];
  const briefingSample = briefing.sample || {
    eyebrow: "Example question",
    title: "Which agentic workflows already need an owner?",
    date: "Board readiness watch",
    items: [
      "What is already touching customers, data, disclosure, resilience, or external commitments?",
      "Who can approve, stop, narrow, or escalate it?",
      "What evidence would let leaders see the judgement afterwards?",
    ],
  };
  const contactEmail = site.contact?.email || "hello@my-agentic.com";
  const briefingMailerLite = briefing.mailerlite || {};
  const briefingSignupEndpoint = briefingMailerLite.endpoint || "";
  const briefingHostedFormHref = briefingMailerLite.share_url || "";
  const briefingMailtoHref = `mailto:${contactEmail}?subject=${encodeURIComponent(briefing.form_subject || "Chief Agentic Officer Briefing signup")}`;
  const briefingSignupHref = briefingSignupEndpoint || briefingMailtoHref;
  const briefingExampleHref = `mailto:${contactEmail}?subject=${encodeURIComponent(briefing.example_subject || "Example Chief Agentic Officer Briefing")}`;
  const briefingSuccessMessage = briefing.success_message || "Thank you. Your Chief Agentic Officer Briefing signup has been received.";
  const briefingErrorMessage = briefing.error_message || "Sorry, the briefing signup could not be completed. Please try again or use the example briefing link.";
  const forAgents = site.for_agents || {};
  const caoAgentPrompt = caoHumanPromptFor(site);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(site.title || site.name)}</title>
  <meta name="description" content="${escapeHtml(site.summary)}">
${socialMetaTagsFor(site)}  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
${matomoScriptTagFor(site)}  <style>
    :root {
      color-scheme: light;
      --ink: #1f2521;
      --ink-soft: #596059;
      --paper: #f5f0e4;
      --porcelain: #fffdf7;
      --sage: #617d66;
      --sage-dark: #2d4538;
      --teal: #1f6f68;
      --teal-dark: #174c49;
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

    .briefing-hero {
      min-height: auto;
      grid-template-columns: minmax(0, 0.9fr) minmax(340px, 0.68fr);
      align-items: start;
      padding: 64px 40px;
      background: var(--paper);
    }

    .hero-copy-wrap {
      align-self: end;
      padding: 56px 0 64px;
    }

    .briefing-hero .hero-copy-wrap {
      align-self: start;
      padding: 0;
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

    .briefing-hero h1 {
      max-width: 760px;
      margin-bottom: 20px;
      font-size: 64px;
      line-height: 1.02;
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

    .briefing-hero .hero-copy {
      max-width: 720px;
      font-size: 21px;
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

    .role-explainer {
      display: grid;
      grid-template-columns: minmax(0, 0.9fr) minmax(320px, 0.72fr);
      gap: 54px;
      align-items: start;
    }

    .simple-panel {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--porcelain);
      padding: 24px;
    }

    .simple-panel h3 {
      font-family: var(--serif);
      font-size: 27px;
      line-height: 1.16;
    }

    .simple-list {
      display: grid;
      gap: 12px;
      margin: 18px 0 0;
      padding: 0;
      list-style: none;
    }

    .simple-list li {
      padding-top: 12px;
      border-top: 1px solid rgba(31, 37, 33, 0.12);
      color: var(--ink-soft);
    }

    .briefing-details-grid {
      display: grid;
      grid-template-columns: minmax(0, 0.9fr) minmax(320px, 0.72fr);
      gap: 24px;
      align-items: start;
    }

    .agent-readable-panel {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: minmax(0, 0.9fr) minmax(280px, 0.58fr);
      gap: 24px;
      align-items: start;
      margin-top: 24px;
      padding: 24px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--porcelain);
    }

    .agent-readable-panel h3 {
      margin-bottom: 10px;
      font-family: var(--serif);
      font-size: 27px;
      line-height: 1.16;
    }

    .agent-readable-panel p {
      margin-bottom: 0;
      color: var(--ink-soft);
    }

    .agent-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: flex-start;
    }

    .agent-actions .button {
      min-height: 42px;
      padding: 10px 14px;
      font: inherit;
      font-size: 15px;
      cursor: pointer;
    }

    .copy-status {
      min-height: 22px;
      display: block;
      flex-basis: 100%;
      color: var(--teal-dark);
      font-size: 14px;
      font-weight: 760;
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

    .implementation-band {
      background:
        linear-gradient(180deg, rgba(245, 240, 228, 0.98), rgba(234, 223, 202, 0.72));
      border-bottom: 1px solid var(--line);
    }

    .implementation-head {
      display: grid;
      grid-template-columns: minmax(0, 0.82fr) minmax(320px, 1.18fr);
      gap: 54px;
      align-items: start;
    }

    .implementation-copy p:last-child {
      max-width: 720px;
      margin-bottom: 0;
      color: var(--ink-soft);
    }

    .implementation-copy a {
      color: var(--oxblood);
      font-weight: 820;
    }

    .implementation-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 14px;
      margin-top: 34px;
    }

    .implementation-card {
      min-width: 0;
      min-height: 260px;
      padding: 22px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 253, 247, 0.74);
    }

    .implementation-card span {
      display: block;
      margin-bottom: 20px;
      color: var(--brass);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .implementation-card h3 {
      font-size: 20px;
    }

    .implementation-card p {
      margin-bottom: 0;
      color: var(--ink-soft);
      font-size: 16px;
      line-height: 1.5;
    }

    .briefing-band {
      background: #fbf8ef;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }

    .briefing-band .eyebrow {
      color: var(--teal-dark);
    }

    .briefing-band h2 {
      max-width: 760px;
      font-size: 42px;
    }

    .briefing-layout {
      display: grid;
      grid-template-columns: minmax(0, 0.94fr) minmax(320px, 1.06fr);
      gap: 48px;
      align-items: start;
    }

    .briefing-summary {
      max-width: 780px;
      color: var(--ink-soft);
      font-size: 20px;
      line-height: 1.52;
    }

    .briefing-explainer {
      margin-top: 28px;
      padding-top: 22px;
      border-top: 1px solid var(--line);
    }

    .briefing-explainer h3,
    .briefing-panel h3,
    .sample-briefing h3,
    .briefing-form h3 {
      margin-bottom: 10px;
      font-family: var(--serif);
      font-size: 27px;
      line-height: 1.16;
    }

    .briefing-explainer p,
    .briefing-panel p,
    .sample-briefing p {
      color: var(--ink-soft);
    }

    .briefing-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 28px;
    }

    .briefing-actions .secondary {
      color: var(--teal-dark);
    }

    .briefing-side {
      display: grid;
      gap: 20px;
    }

    .briefing-panel,
    .sample-briefing,
    .briefing-form {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--porcelain);
    }

    .briefing-panel,
    .sample-briefing {
      padding: 24px;
    }

    .briefing-outcomes,
    .briefing-receive,
    .sample-briefing ul {
      display: grid;
      gap: 12px;
      margin: 18px 0 0;
      padding: 0;
      list-style: none;
    }

    .briefing-outcomes li,
    .briefing-receive li,
    .sample-briefing li {
      padding-top: 12px;
      border-top: 1px solid rgba(31, 37, 33, 0.12);
      color: var(--ink-soft);
    }

    .briefing-outcomes li::before,
    .briefing-receive li::before {
      content: "";
      width: 7px;
      height: 7px;
      display: inline-block;
      margin-right: 10px;
      border-radius: 50%;
      background: var(--teal);
      vertical-align: 0.08em;
    }

    .sample-meta {
      margin-bottom: 12px;
      color: var(--teal-dark);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .briefing-guardrail {
      grid-column: 1 / -1;
      margin: 10px 0 0;
      padding: 18px 0 0;
      border-top: 1px solid var(--line);
      color: var(--ink-soft);
      font-size: 15px;
    }

    .briefing-form {
      grid-column: 1 / -1;
      margin-top: 18px;
      padding: 26px;
    }

    .briefing-hero .briefing-form {
      grid-column: auto;
      margin-top: 0;
      padding: 24px;
      box-shadow: 0 18px 48px rgba(31, 37, 33, 0.1);
    }

    .briefing-form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-top: 18px;
    }

    .briefing-hero .briefing-form-grid {
      grid-template-columns: 1fr;
      gap: 14px;
    }

    .briefing-form label {
      min-width: 0;
      display: grid;
      gap: 8px;
      color: var(--ink);
      font-size: 14px;
      font-weight: 800;
    }

    .briefing-form input,
    .briefing-form select {
      width: 100%;
      min-height: 44px;
      border: 1px solid rgba(31, 37, 33, 0.24);
      border-radius: 4px;
      background: #fffdf7;
      color: var(--ink);
      font: inherit;
      font-size: 16px;
      padding: 9px 11px;
    }

    .briefing-form input:focus,
    .briefing-form select:focus {
      outline: 2px solid rgba(31, 111, 104, 0.32);
      outline-offset: 2px;
      border-color: var(--teal);
    }

    .briefing-span-2 {
      grid-column: 1 / -1;
    }

    .briefing-consent {
      grid-template-columns: 18px minmax(0, 1fr);
      align-items: start;
      gap: 10px;
      padding-top: 8px;
      color: var(--ink-soft);
      font-weight: 650;
      line-height: 1.45;
    }

    .briefing-consent input {
      width: 18px;
      min-height: 18px;
      height: 18px;
      margin: 2px 0 0;
      accent-color: var(--teal);
    }

    .briefing-form .button {
      margin-top: 22px;
      cursor: pointer;
      font-family: inherit;
      font-size: 16px;
    }

    .briefing-form .button[disabled] {
      cursor: wait;
      opacity: 0.72;
    }

    .briefing-form-status {
      min-height: 24px;
      margin: 16px 0 0;
      color: var(--ink-soft);
      font-size: 15px;
    }

    .briefing-form-status[data-state="success"] {
      color: var(--teal-dark);
      font-weight: 760;
    }

    .briefing-form-status[data-state="error"] {
      color: var(--oxblood);
      font-weight: 760;
    }

    .briefing-honeypot {
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    }

    .briefing-hero .briefing-outcomes {
      max-width: 640px;
      margin-top: 28px;
    }

    .simple-guardrail {
      margin: 24px 0 0;
      padding-top: 18px;
      border-top: 1px solid var(--line);
      color: var(--ink-soft);
      font-size: 15px;
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

      .briefing-hero {
        gap: 24px;
        padding: 48px 22px;
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

      .briefing-hero h1 {
        font-size: 48px;
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
      .role-explainer,
      .route-grid,
      .implementation-head,
      .implementation-grid,
      .briefing-layout,
      .briefing-details-grid,
      .agent-readable-panel,
      .briefing-form-grid,
      .cadence,
      .note-list,
      .cta-panel {
        grid-template-columns: 1fr;
      }

      .section {
        padding: 64px 22px;
      }

      .route-card,
      .implementation-card,
      .briefing-panel,
      .note-panel {
        min-height: auto;
      }
    }

    @media (max-width: 560px) {
      h1 {
        font-size: 44px;
      }

      .briefing-hero h1 {
        font-size: 40px;
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
      <span>CAO Briefing</span>
    </a>
    <nav aria-label="Primary navigation">
      <a href="#briefing">Briefing</a>
      <a href="#cao-role">What is CAO?</a>
      <a href="#what-you-receive">What you receive</a>
      <a href="/for-agents/">For agents</a>
      <a href="#briefing-signup">Sign up</a>
    </nav>
  </header>

  <main>
    <section class="hero briefing-hero" id="briefing" aria-labelledby="page-title">
      <div class="hero-copy-wrap">
        <p class="eyebrow">${escapeHtml(briefing.eyebrow || "Briefing for board-facing leaders")}</p>
        <h1 id="page-title">${escapeHtml(briefing.title || "Chief Agentic Officer Briefing")}</h1>
        <p class="hero-copy">${escapeHtml(briefing.summary || "A short UK and Europe-facing briefing for leaders who need clearer questions about agentic work before the next board, committee, regulator, investor, customer, or executive decision.")}</p>
        <ul class="briefing-outcomes" aria-label="Briefing outcomes">
          ${briefingOutcomes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
        <div class="hero-actions">
          <a class="button primary" href="#briefing-signup">${escapeHtml(briefing.primary_label || "Join the briefing list")}</a>
          <a class="button secondary" href="${escapeHtml(briefingExampleHref)}">${escapeHtml(briefing.secondary_label || "Send me an example briefing")}</a>
        </div>
      </div>

      <aside aria-label="Join the briefing list">
        <form class="briefing-form" id="briefing-signup" action="${escapeHtml(briefingSignupHref)}" method="post"${briefingSignupEndpoint ? ` data-mailerlite-form data-success-message="${escapeHtml(briefingSuccessMessage)}" data-error-message="${escapeHtml(briefingErrorMessage)}" data-hosted-form="${escapeHtml(briefingHostedFormHref)}"` : ` enctype="text/plain"`}>
          <div>
            <p class="eyebrow">Briefing list</p>
            <h3>${escapeHtml(briefing.primary_label || "Join the briefing list")}</h3>
          </div>
          <input type="hidden" name="source" value="${escapeHtml(site.domain)}">
          <label class="briefing-honeypot">
            <span>Website</span>
            <input name="website" autocomplete="off" tabindex="-1">
          </label>
          <div class="briefing-form-grid">
            <label>
              <span>Name</span>
              <input name="name" autocomplete="name" required>
            </label>
            <label>
              <span>Work email</span>
              <input name="work_email" type="email" autocomplete="email" required>
            </label>
            <label>
              <span>Role type (optional)</span>
              <select name="role">
                <option value="">Select role type</option>
                ${briefingRoleOptions.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}
              </select>
            </label>
            <label>
              <span>Country / market (optional)</span>
              <select name="country_market">
                <option value="">Select country or market</option>
                ${briefingCountryOptions.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}
              </select>
            </label>
            <label class="briefing-span-2">
              <span>Which board issue are you watching? (optional)</span>
              <select name="board_issue">
                <option value="">Select issue</option>
                ${briefingIssueOptions.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}
              </select>
            </label>
            <label class="briefing-consent briefing-span-2">
              <input name="consent" type="checkbox" value="yes" required>
              <span>I consent to receive the Chief Agentic Officer Briefing and related board-readiness notes.</span>
            </label>
          </div>
          <button class="button primary" type="submit">${escapeHtml(briefing.primary_label || "Join the briefing list")}</button>
          <div class="briefing-form-status" data-form-status role="status" aria-live="polite"></div>
        </form>
      </aside>
    </section>

    <section class="section" id="cao-role">
      <div class="section-inner role-explainer">
        <div>
          <p class="eyebrow">What it is</p>
          <h2>${escapeHtml(briefing.explainer_title || "What is a Chief Agentic Officer?")}</h2>
          <p class="lead">${escapeHtml(briefing.explainer_body || "A Chief Agentic Officer is the person or mandate that makes agentic work owned: what exists, what it may do, who can stop it, and what leaders can inspect afterwards.")}</p>
          <p>The point is not another title for the sake of it. It is a simple way to make agentic work easier to own, govern, narrow, stop, evidence, and discuss.</p>
        </div>
        <div class="simple-panel">
          <h3>What they look for</h3>
          <ul class="simple-list">
            ${briefingRolePoints.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </div>
      </div>
    </section>

    <section class="section briefing-band" id="what-you-receive">
      <div class="section-inner">
        <div class="briefing-details-grid">
          <article class="briefing-panel">
            <h3>What you receive</h3>
            <ul class="briefing-receive">
              ${briefingReceive.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </article>

          <article class="sample-briefing">
            <div class="sample-meta">${escapeHtml(briefingSample.eyebrow || "Sample briefing card")} / ${escapeHtml(briefingSample.date || "Board readiness watch")}</div>
            <h3>${escapeHtml(briefingSample.title || "Agentic workflow ownership before the next risk committee")}</h3>
            <ul>
              ${(briefingSample.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </article>

          <article class="agent-readable-panel" aria-labelledby="agent-readable-title">
            <div>
              <p class="eyebrow">${escapeHtml(forAgents.eyebrow || "Agent-readable briefing context")}</p>
              <h3 id="agent-readable-title">${escapeHtml(forAgents.main_panel_title || "A version your agent can read")}</h3>
              <p>${escapeHtml(forAgents.main_panel_body || "Pass this to your agent so it can understand the briefing, the categories, and why this is UK/EU board-focused.")}</p>
            </div>
            <div class="agent-actions">
              <button class="button primary" type="button" data-copy-text="${escapeAttribute(caoAgentPrompt)}">Copy agent prompt</button>
              <a class="button secondary" href="/for-agents/">For agents</a>
              <a class="button secondary" href="/llms.txt">Open llms.txt</a>
              <span class="copy-status" data-copy-status aria-live="polite"></span>
            </div>
          </article>
        </div>

        <p class="simple-guardrail">${escapeHtml(briefing.guardrail || "The briefing supports judgement. It does not replace legal, regulatory, audit, disclosure, financial, data protection, director, or management judgement.")}</p>
      </div>
    </section>
  </main>

  <footer>
    <div>
      <strong>${escapeHtml(site.name)}</strong>
      <div>${escapeHtml(site.domain)}</div>
    </div>
    <div>${escapeHtml(site.footer_tagline || "A short briefing on board-level ownership for agentic work.")}</div>
  </footer>
  <script>
    (() => {
      const form = document.querySelector("[data-mailerlite-form]");
      if (!form) return;

      const status = form.querySelector("[data-form-status]");
      const button = form.querySelector("button[type='submit']");
      const defaultButtonText = button ? button.textContent : "";
      const defaultError = form.dataset.errorMessage || "Sorry, the briefing signup could not be completed.";

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;

        const body = new URLSearchParams();
        const formData = new FormData(form);
        for (const [key, value] of formData.entries()) body.append(key, value);

        if (status) {
          status.dataset.state = "";
          status.textContent = "Joining...";
        }
        if (button) {
          button.disabled = true;
          button.textContent = "Joining...";
        }

        try {
          const response = await fetch(form.action, {
            method: "POST",
            headers: {
              "accept": "application/json",
              "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
            },
            body,
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload.ok) {
            throw new Error(payload.message || defaultError);
          }

          if (status) {
            status.dataset.state = "success";
            status.textContent = payload.message || form.dataset.successMessage || "Thank you.";
          }
          form.reset();
        } catch (error) {
          if (status) {
            status.dataset.state = "error";
            status.textContent = error.message || defaultError;
          }
        } finally {
          if (button) {
            button.disabled = false;
            button.textContent = defaultButtonText;
          }
        }
      });
    })();
  </script>
  ${caoCopyScript()}
</body>
</html>
`;
}

function chiefAgenticOfficerForAgentsPageFor(site) {
  const forAgents = site.for_agents || {};
  const categories = briefingCategoriesFor(site);
  const humanPrompt = caoHumanPromptFor(site);
  const assistantPrompt = caoAssistantPromptFor(site);
  const title = forAgents.title || "For agents";
  const summary = forAgents.summary || "Use this page to understand the Chief Agentic Officer Briefing as public source context: what it covers, why it is UK/EU board-focused, and what the briefing categories mean.";
  const purpose = forAgents.purpose || "The Chief Agentic Officer Briefing helps board-facing leaders notice the UK/EU signals that may affect how agentic work is owned, governed, evidenced, narrowed, stopped, funded, or escalated.";
  const problem = forAgents.problem || "Most AI news is US-, China-, vendor-, or productivity-led. This briefing looks instead for UK and European governance, risk, compliance, resilience, disclosure, data, reputation, and board-action signals that a board-facing leader may need to understand.";
  const guardrail = forAgents.guardrail || site.briefing?.guardrail || "The briefing supports judgement. It does not replace legal, regulatory, audit, disclosure, financial, data protection, director, or management judgement.";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | ${escapeHtml(site.name)}</title>
  <meta name="description" content="${escapeHtml(summary)}">
${socialMetaTagsFor(site, {
    title: `${title} | ${site.name}`,
    description: summary,
    path: "/for-agents/",
  })}  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
${matomoScriptTagFor(site)}  <style>
    :root {
      color-scheme: light;
      --ink: #1f2521;
      --ink-soft: #596059;
      --paper: #f5f0e4;
      --porcelain: #fffdf7;
      --teal: #1f6f68;
      --teal-dark: #174c49;
      --oxblood: #8f342d;
      --brass: #b9822d;
      --charcoal: #202726;
      --line: rgba(31, 37, 33, 0.16);
      --shadow: 0 18px 48px rgba(31, 37, 33, 0.1);
      --sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --serif: Georgia, "Times New Roman", serif;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--sans);
      font-size: 17px;
      line-height: 1.56;
      letter-spacing: 0;
    }

    a { color: inherit; text-underline-offset: 0.18em; }

    .site-header {
      min-height: 68px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 28px;
      padding: 14px 40px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 253, 247, 0.94);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      color: var(--ink);
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

    nav a { text-decoration: none; }

    .section {
      padding: 72px 40px;
      border-bottom: 1px solid var(--line);
    }

    .section-inner {
      width: min(100%, 1120px);
      margin: 0 auto;
    }

    .hero {
      padding-top: 78px;
      background: var(--paper);
    }

    .eyebrow {
      margin: 0 0 14px;
      color: var(--teal-dark);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1,
    h2,
    h3,
    p { margin-top: 0; }

    h1,
    h2,
    h3 {
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }

    h1 {
      max-width: 820px;
      margin-bottom: 22px;
      font-family: var(--serif);
      font-size: 62px;
      line-height: 1.02;
      font-weight: 700;
    }

    h2 {
      max-width: 780px;
      margin-bottom: 16px;
      font-family: var(--serif);
      font-size: 40px;
      line-height: 1.08;
      font-weight: 700;
    }

    h3 {
      margin-bottom: 10px;
      font-size: 22px;
      line-height: 1.18;
    }

    .lead {
      max-width: 820px;
      color: var(--ink-soft);
      font-size: 21px;
      line-height: 1.5;
    }

    .button {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 11px 16px;
      border: 1px solid currentColor;
      border-radius: 4px;
      background: transparent;
      color: var(--charcoal);
      font: inherit;
      font-size: 15px;
      font-weight: 820;
      text-decoration: none;
      cursor: pointer;
    }

    .button.primary {
      background: var(--charcoal);
      color: var(--porcelain);
      border-color: var(--charcoal);
    }

    .copy-grid,
    .two-column,
    .category-grid {
      display: grid;
      gap: 20px;
    }

    .copy-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 28px;
    }

    .two-column {
      grid-template-columns: minmax(0, 0.92fr) minmax(320px, 0.68fr);
      align-items: start;
    }

    .category-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 26px;
    }

    .panel,
    .category-card {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--porcelain);
      box-shadow: var(--shadow);
    }

    .panel {
      padding: 24px;
    }

    .panel p,
    .category-card p {
      color: var(--ink-soft);
    }

    .category-card {
      padding: 22px;
    }

    .category-card h3 {
      font-family: var(--serif);
      font-size: 26px;
    }

    .action-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-top: 20px;
    }

    .copy-status {
      min-height: 22px;
      display: block;
      flex-basis: 100%;
      color: var(--teal-dark);
      font-size: 14px;
      font-weight: 760;
    }

    .prompt-preview {
      margin-top: 18px;
    }

    .prompt-preview summary {
      cursor: pointer;
      color: var(--teal-dark);
      font-weight: 820;
    }

    pre {
      max-height: 340px;
      overflow: auto;
      white-space: pre-wrap;
      margin: 14px 0 0;
      padding: 16px;
      border: 1px solid rgba(31, 37, 33, 0.14);
      border-radius: 4px;
      background: #f7f2e6;
      color: var(--ink);
      font-size: 14px;
      line-height: 1.48;
    }

    .code-list {
      display: grid;
      gap: 10px;
      margin-top: 18px;
    }

    .code-list a,
    .code-list code {
      display: block;
      padding: 10px 12px;
      border: 1px solid rgba(31, 37, 33, 0.14);
      border-radius: 4px;
      background: #f7f2e6;
      color: var(--ink);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 14px;
      text-decoration: none;
      overflow-wrap: anywhere;
    }

    .guardrail {
      padding-top: 20px;
      border-top: 1px solid var(--line);
      color: var(--ink-soft);
      font-size: 15px;
    }

    footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 24px;
      padding: 30px 40px;
      background: var(--porcelain);
      color: var(--ink-soft);
      font-size: 14px;
    }

    footer strong { color: var(--ink); }

    @media (max-width: 900px) {
      .site-header {
        align-items: flex-start;
        flex-direction: column;
        padding: 14px 22px;
      }

      nav { justify-content: flex-start; }

      .section {
        padding: 56px 22px;
      }

      h1 { font-size: 46px; }
      h2 { font-size: 34px; }
      .lead { font-size: 19px; }

      .copy-grid,
      .two-column,
      .category-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 560px) {
      h1 { font-size: 40px; }
      h2 { font-size: 30px; }
      .button { width: 100%; }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="${escapeHtml(site.name)} home">
      <span class="brand-mark">CAO</span>
      <span>CAO Briefing</span>
    </a>
    <nav aria-label="Primary navigation">
      <a href="/">Briefing</a>
      <a href="/#what-you-receive">What you receive</a>
      <a href="/for-agents/" aria-current="page">For agents</a>
      <a href="/#briefing-signup">Sign up</a>
    </nav>
  </header>

  <main>
    <section class="section hero">
      <div class="section-inner">
        <p class="eyebrow">${escapeHtml(forAgents.eyebrow || "Agent-readable briefing context")}</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="lead">${escapeHtml(summary)}</p>
        <div class="action-row">
          <a class="button primary" href="/#briefing-signup">Join the briefing list</a>
          <a class="button" href="/llms.txt">Open llms.txt</a>
          <a class="button" href="/.well-known/agentic-profile.json">Open profile</a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-inner copy-grid">
        <article class="panel">
          <p class="eyebrow">Human start here</p>
          <h2>Copy this into your assistant.</h2>
          <p>Use this when you want ChatGPT, Claude, Perplexity, or another assistant to read the briefing with the right boundaries.</p>
          <div class="action-row">
            <button class="button primary" type="button" data-copy-text="${escapeAttribute(humanPrompt)}">Copy agent prompt</button>
            <span class="copy-status" data-copy-status aria-live="polite"></span>
          </div>
          <details class="prompt-preview">
            <summary>See what gets copied</summary>
            <pre><code>${escapeHtml(humanPrompt)}</code></pre>
          </details>
        </article>

        <article class="panel">
          <p class="eyebrow">Assistant agents</p>
          <h2>Read the public map, then fetch only what you need.</h2>
          <p>Use the page as public source context. It explains the briefing purpose, category meanings, and judgement boundary.</p>
          <div class="action-row">
            <button class="button primary" type="button" data-copy-text="${escapeAttribute(assistantPrompt)}">Copy assistant instructions</button>
            <span class="copy-status" data-copy-status aria-live="polite"></span>
          </div>
          <details class="prompt-preview">
            <summary>See assistant instructions</summary>
            <pre><code>${escapeHtml(assistantPrompt)}</code></pre>
          </details>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-inner two-column">
        <div>
          <p class="eyebrow">Why this exists</p>
          <h2>A UK/EU board-readiness signal layer.</h2>
          <p class="lead">${escapeHtml(purpose)}</p>
          <p>${escapeHtml(problem)}</p>
        </div>
        <aside class="panel">
          <h3>Public files</h3>
          <p>These routes are intentionally public and safe for agents to read.</p>
          <div class="code-list">
            <a href="/for-agents/"><code>/for-agents/</code></a>
            <a href="/llms.txt"><code>/llms.txt</code></a>
            <a href="/.well-known/agentic-profile.json"><code>/.well-known/agentic-profile.json</code></a>
            <a href="/healthz"><code>/healthz</code></a>
          </div>
        </aside>
      </div>
    </section>

    <section class="section">
      <div class="section-inner">
        <p class="eyebrow">Briefing categories</p>
        <h2>What the categories mean.</h2>
        <p class="lead">Use these as practical labels for board-facing signals, not as legal or regulatory classifications.</p>
        <div class="category-grid">
          ${categories.map((category) => `<article class="category-card">
            <h3>${escapeHtml(category.name)}</h3>
            <p>${escapeHtml(category.meaning)}</p>
          </article>`).join("")}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-inner">
        <p class="eyebrow">Boundary</p>
        <h2>Public context, not authority to act.</h2>
        <p class="guardrail">${escapeHtml(guardrail)}</p>
      </div>
    </section>
  </main>

  <footer>
    <div>
      <strong>${escapeHtml(site.name)}</strong>
      <div>${escapeHtml(site.domain)}</div>
    </div>
    <div>${escapeHtml(site.footer_tagline || "A short briefing on board-level ownership for agentic work.")}</div>
  </footer>
  ${caoCopyScript()}
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

function snaxkConceptPageFor(site) {
  const title = site.title || "SNAXK | Judgement engine for agentic work";
  const summary = site.summary || "SNAXK helps teams and leaders set boundaries, demand evidence, define stop conditions, and produce board-readable judgement.";
  const lozenge = site.brand_assets?.lozenge || "/assets/snaxk-lozenge.png";
  const badge = site.brand_assets?.badge || lozenge;
  const logo = site.brand_assets?.logo || "/assets/snaxk-logo.png";
  const milestone = site.research_milestone || "SNAXK 0.10.8";
  const footerProductLine = site.footer_product_line || "A YQUP product";
  const footerLegal = site.footer_legal || "Copyright (c) 2026 YQUP Ltd";
  const caoFeeder = site.cao_feeder || {};
  const caoUrl = caoFeeder.primary_url || "https://chiefagenticofficer.com/";
  const caoCampaign = caoFeeder.primary_campaign || "snaxk_to_chiefagenticofficer";
  const caoStage = caoFeeder.primary_stage || "source_to_chiefagenticofficer";
  const advisoryUrl = caoFeeder.secondary_url || defaultTonywoodAdvisoryUrl;
  const advisoryCampaign = caoFeeder.secondary_campaign || "snaxk_to_tonywood_advisory";
  const advisoryStage = caoFeeder.secondary_stage || "source_to_tonywood_advisory";
  const heroCaoHref = trackedOutboundUrlFor(site, caoUrl, caoFeeder.primary_content || "hero_cao_briefing", caoCampaign) || caoUrl;
  const panelCaoHref = trackedOutboundUrlFor(site, caoUrl, "cao_briefing_panel", caoCampaign) || caoUrl;
  const engineInterestHref = trackedOutboundUrlFor(site, advisoryUrl, caoFeeder.engine_content || "snaxk_engine_interest", advisoryCampaign) || advisoryUrl;
  const advisoryHref = trackedOutboundUrlFor(site, advisoryUrl, "footer_tonywood_advisory", advisoryCampaign) || advisoryUrl;
  const loopSteps = [
    {
      number: "1",
      label: "Sense",
      title: "Sense",
      body: "Collect signals from people, agents, systems and context.",
      tone: "sage",
      icon: "M11 14c4-4 8 4 12 0M11 22c4-4 8 4 12 0M11 30c4-4 8 4 12 0",
    },
    {
      number: "2",
      label: "Assess",
      title: "Assess",
      body: "Test evidence against intent, boundaries and risk.",
      tone: "sage",
      icon: "M12 12h20v20H12zM16 16h12M16 22h7",
    },
    {
      number: "3",
      label: "Judge",
      title: "Judge",
      body: "Decide: proceed, adjust, escalate, or stop.",
      tone: "gold",
      icon: "M22 9l13 13-13 13L9 22zM22 15l7 7-7 7-7-7z",
    },
    {
      number: "4",
      label: "Act",
      title: "Act",
      body: "Execute within boundaries with measurements.",
      tone: "red",
      icon: "M22 10l10 6v12l-10 6-10-6V16z",
    },
    {
      number: "5",
      label: "Review",
      title: "Review",
      body: "Compare outcomes, capture learning, tighten the loop.",
      tone: "outline",
      icon: "M15 18a8 8 0 0114-2M29 16h-5v-5M29 26a8 8 0 01-14 2M15 28h5v5",
    },
  ];
  const boundaryCards = [
    {
      title: "Ownership",
      body: "Clear accountable owner for the outcome and the call.",
      icon: "M13 20h18v14H13zM17 20v-4a5 5 0 0110 0v4M22 25v4",
    },
    {
      title: "Scope",
      body: "What's in, what's out, and what needs human judgement.",
      icon: "M12 15h20M12 22h20M12 29h20M16 12v6M27 19v6M20 26v6",
    },
    {
      title: "Evidence",
      body: "Minimum evidence required to justify the next step.",
      icon: "M22 10l11 5v8c0 7-5 11-11 13-6-2-11-6-11-13v-8z",
    },
    {
      title: "Stop Conditions",
      body: "Trigger points that pause or stop automated work.",
      icon: "M22 10l10 6v12l-10 6-10-6V16zM22 21v5",
    },
    {
      title: "Review Cadence",
      body: "How often we renew, revalidate, and recalibrate.",
      icon: "M22 11a11 11 0 1011 11A11 11 0 0022 11zM22 15v8l6 3",
    },
  ];
  const engineRows = [
    ["Signals", "Live"],
    ["Evidence", "Strong"],
    ["Boundaries", "Within limits"],
    ["Stop Condition", "Not met"],
    ["Judgement", "Proceed"],
  ];
  const featureCards = [
    {
      title: "Clarity",
      body: "See the real state of the work.",
      icon: "M15 30l5-18M29 30l-5-18M12 30h20M14 14a3 3 0 106 0 3 3 0 00-6 0zM26 14a3 3 0 106 0 3 3 0 00-6 0z",
    },
    {
      title: "Control",
      body: "Define boundaries and stop conditions.",
      icon: "M22 10l11 5v8c0 7-5 11-11 13-6-2-11-6-11-13v-8z",
    },
    {
      title: "Confidence",
      body: "Make decisions you can stand behind.",
      icon: "M14 30c0-5 4-8 8-8s8 3 8 8M16 17a6 6 0 1012 0M8 31c0-4 3-7 7-7M30 24c4 0 7 3 7 7",
    },
  ];
  const arrowSvg = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const fieldSketch = `<svg class="field-sketch" viewBox="0 0 760 520" role="img" aria-label="Line sketch of fields used as a judgement map">
    <defs>
      <linearGradient id="snaxk-paper-fade" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#fffaf0" stop-opacity=".1"/>
        <stop offset="1" stop-color="#d8cfb7" stop-opacity=".34"/>
      </linearGradient>
    </defs>
    <rect width="760" height="520" fill="url(#snaxk-paper-fade)"/>
    <g fill="none" stroke="#9c9a83" stroke-linecap="round" stroke-linejoin="round" opacity=".42">
      <path d="M52 366C164 300 246 296 330 230c78-61 159-96 266-99"/>
      <path d="M40 398c111-65 218-66 318-140 74-55 151-91 330-104"/>
      <path d="M74 424c117-64 232-74 330-139 96-64 167-95 297-107"/>
      <path d="M92 454c150-61 222-73 336-139 99-57 180-88 296-96"/>
      <path d="M126 188c93-46 186-54 278-40 80 12 155 4 254-40"/>
      <path d="M94 154c96-32 197-42 296-32 83 9 166-2 278-46"/>
      <path d="M166 90c88-18 181-17 280 4 95 20 168 10 249-28"/>
      <path d="M86 292c96-33 195-42 292-28 87 13 168 2 284-41"/>
      <path d="M132 252c75-28 157-32 251-18 102 15 188 3 292-42"/>
    </g>
    <g fill="none" stroke="#72765b" stroke-width="7" stroke-linecap="round" opacity=".42">
      <path d="M46 386c68-36 136-55 210-55 61 0 112-17 154-49 69-52 153-78 270-89"/>
      <path d="M104 184c105-43 202-44 294-27 92 18 179 1 265-45"/>
      <path d="M83 300c90-28 188-27 286-12 82 13 160 1 282-44"/>
      <path d="M188 83c102-16 190-9 264 7 93 20 170 9 244-27"/>
    </g>
    <g fill="none" stroke="#b9ad8b" stroke-width="1.4" opacity=".55">
      <path d="M190 70c70 38 130 81 187 149 57 67 117 117 201 159"/>
      <path d="M304 64c30 70 63 132 101 190 46 70 105 123 177 166"/>
      <path d="M76 240c111 15 214 28 307 40 112 15 214 22 314 15"/>
      <path d="M130 118c90 45 170 92 239 144 77 58 163 98 258 119"/>
    </g>
    <g fill="none" stroke="#a6a891" stroke-width="1" opacity=".5">
      <path d="M562 88c37 6 70 15 100 29"/>
      <path d="M582 72c28 8 58 19 89 34"/>
      <path d="M600 58c24 9 49 21 74 37"/>
      <path d="M72 438c33-10 73-17 119-21"/>
      <path d="M96 460c45-12 88-18 130-18"/>
    </g>
  </svg>`;
  const lowerSketch = `<svg class="lower-sketch" viewBox="0 0 310 185" aria-hidden="true">
    <g fill="none" stroke="#9b9981" stroke-linecap="round" opacity=".52">
      <path d="M12 126c40-36 88-44 142-37 48 6 88-3 139-35"/>
      <path d="M3 150c54-35 107-42 159-34 49 7 91-1 139-28"/>
      <path d="M39 83c42-20 84-24 126-14 52 12 94 4 133-23"/>
      <path d="M85 35c36-8 75-4 116 10 39 14 72 9 104-8"/>
      <path d="M23 171c73-26 121-33 173-23 42 8 76 0 103-16"/>
    </g>
  </svg>`;
  const iconSvg = (path, className = "") => `<svg class="${className}" viewBox="0 0 44 44" fill="none" aria-hidden="true"><path d="${path}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const brandMark = (variant = "") => `<span class="snaxk-brandmark ${variant}" aria-label="SNAXK">
    <span class="snaxk-emblem"><img src="${escapeHtml(logo)}" alt=""></span>
    <span class="snaxk-word">SNAXK</span>
  </span>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(summary)}">
${socialMetaTagsFor(site, { title, description: summary })}  <link rel="preload" as="image" href="${escapeHtml(badge)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
${matomoScriptTagFor(site)}  <style>
    :root {
      color-scheme: light;
      --ink: #171613;
      --muted: #504b43;
      --paper: #fffaf0;
      --paper-2: #f7efe0;
      --line: #d7cbb7;
      --line-soft: rgba(112, 90, 55, 0.18);
      --sage: #727c48;
      --gold: #b77a18;
      --gold-soft: #e4b658;
      --red: #9b2d2c;
      --dark: #151715;
      --dark-2: #20221f;
      --serif: Georgia, "Times New Roman", serif;
      --sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }

    html { scroll-behavior: smooth; overflow-x: hidden; }

    body {
      margin: 0;
      overflow-x: hidden;
      background:
        radial-gradient(circle at 68% 10%, rgba(228, 182, 88, 0.08), transparent 32%),
        var(--paper);
      color: var(--ink);
      font-family: var(--sans);
      font-size: 16px;
      line-height: 1.55;
      letter-spacing: 0;
    }

    a { color: inherit; }

    .site-header {
      min-height: 76px;
      display: grid;
      grid-template-columns: minmax(220px, 1fr) auto minmax(170px, 1fr);
      align-items: center;
      gap: 24px;
      padding: 12px 40px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 250, 240, 0.94);
    }

    .brand {
      justify-self: start;
      display: inline-flex;
      align-items: center;
      min-width: 0;
      text-decoration: none;
    }

    .snaxk-brandmark {
      width: 176px;
      min-height: 56px;
      display: inline-flex;
      align-items: center;
      gap: 9px;
      padding: 5px 14px 5px 7px;
      border: 1px solid #dda12e;
      border-radius: 999px;
      background: linear-gradient(180deg, #fff6cc 0%, #ffd968 58%, #f0a52d 100%);
      color: #9b4f0c;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82), 0 6px 18px rgba(146, 93, 21, 0.08);
      overflow: hidden;
    }

    .snaxk-emblem {
      position: relative;
      width: 48px;
      height: 44px;
      flex: 0 0 48px;
      overflow: hidden;
      border-radius: 999px;
    }

    .snaxk-emblem img {
      position: absolute;
      width: 80px;
      max-width: none;
      height: auto;
      left: -16px;
      top: -7px;
      display: block;
    }

    .snaxk-word {
      display: block;
      color: #9d4e0b;
      font-family: var(--sans);
      font-size: 30px;
      font-weight: 860;
      line-height: 1;
      letter-spacing: 0.02em;
    }

    nav {
      justify-self: center;
      display: flex;
      align-items: center;
      gap: 34px;
      color: #161410;
      font-family: var(--serif);
      font-size: 17px;
      line-height: 1;
      white-space: nowrap;
    }

    nav a { text-decoration: none; }

    .version-pill {
      justify-self: end;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-height: 38px;
      padding: 0 15px;
      border: 1px solid #c9b99d;
      border-radius: 999px;
      background: rgba(255, 250, 240, 0.72);
      color: #3b3020;
      font-size: 13px;
      font-weight: 760;
      white-space: nowrap;
    }

    .version-pill::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--gold);
      box-shadow: 0 0 0 4px rgba(183, 122, 24, 0.12);
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(430px, 0.9fr) minmax(0, 1.1fr);
      gap: 30px;
      align-items: center;
      min-height: 575px;
      padding: 58px 48px 46px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(180deg, #fffdf7, var(--paper));
    }

    .hero-copy { max-width: 560px; }

    h1,
    h2,
    h3 {
      margin: 0;
      letter-spacing: 0;
    }

    h1 {
      max-width: 19ch;
      font-family: var(--serif);
      font-size: clamp(38px, 3.8vw, 64px);
      line-height: 0.98;
      font-weight: 760;
    }

    h2 {
      font-family: var(--serif);
      font-size: clamp(31px, 3.2vw, 44px);
      line-height: 1.08;
      font-weight: 720;
    }

    h3 {
      font-family: var(--serif);
      font-size: 21px;
      line-height: 1.2;
      font-weight: 720;
    }

    .rule {
      width: 44px;
      height: 3px;
      margin: 24px 0 24px;
      background: var(--gold);
    }

    .hero-copy p {
      max-width: 390px;
      margin: 0 0 22px;
      color: #24221d;
      font-size: 18px;
      line-height: 1.58;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 24px;
      margin-top: 28px;
    }

    .button {
      min-height: 46px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 0 19px;
      border: 1px solid var(--gold);
      border-radius: 4px;
      background: var(--gold);
      color: #fffaf0;
      text-decoration: none;
      font-family: var(--serif);
      font-weight: 720;
      white-space: nowrap;
    }

    .button svg,
    .text-link svg {
      width: 18px;
      height: 18px;
      flex: 0 0 auto;
    }

    .text-link {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--red);
      text-decoration: none;
      font-family: var(--serif);
      font-weight: 720;
      white-space: nowrap;
    }

    .hero-art {
      position: relative;
      min-height: 455px;
      overflow: hidden;
    }

    .field-sketch {
      position: absolute;
      inset: -22px -14px auto 0;
      width: 100%;
      height: 490px;
      opacity: 0.98;
    }

    .path-line {
      position: absolute;
      border: 0;
      border-top: 3px dashed currentColor;
      border-radius: 999px;
      opacity: 0.82;
    }

    .path-one {
      color: #6f7b44;
      width: 260px;
      left: 170px;
      top: 170px;
      transform: rotate(28deg);
    }

    .path-two {
      color: var(--red);
      width: 218px;
      left: 230px;
      top: 280px;
      transform: rotate(68deg);
    }

    .path-three {
      color: #bd821d;
      width: 260px;
      right: 160px;
      top: 245px;
      transform: rotate(78deg);
    }

    .map-marker {
      position: absolute;
      display: grid;
      justify-items: center;
      gap: 8px;
      color: #25231e;
      font-family: var(--serif);
      font-size: 13px;
      font-weight: 760;
      text-align: center;
      z-index: 2;
    }

    .marker-dot {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border: 3px solid currentColor;
      border-radius: 999px;
      background: #fffaf0;
      box-shadow: 0 2px 10px rgba(23, 22, 19, 0.12);
    }

    .marker-dot svg {
      width: 18px;
      height: 18px;
    }

    .m-signal { left: 210px; top: 78px; color: var(--sage); }
    .m-boundary { left: 352px; top: 202px; color: var(--sage); }
    .m-evidence { right: 176px; top: 86px; color: var(--sage); }
    .m-stop { left: 226px; top: 310px; color: var(--red); }
    .m-judge { right: 285px; top: 410px; color: var(--gold); }
    .m-judge .marker-dot { border-radius: 6px; transform: rotate(45deg); }
    .m-judge .marker-dot svg { transform: rotate(-45deg); }

    .console-panel {
      position: absolute;
      right: 16px;
      top: 132px;
      width: min(268px, 49%);
      padding: 16px;
      border: 1px solid rgba(255, 250, 240, 0.12);
      border-radius: 8px;
      background: linear-gradient(180deg, #151715, #20221f);
      color: rgba(255, 250, 240, 0.88);
      box-shadow: 0 28px 54px rgba(23, 22, 19, 0.32);
      z-index: 3;
    }

    .console-head,
    .console-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
    }

    .console-head {
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 250, 240, 0.12);
      color: var(--gold-soft);
      font-size: 12px;
      font-weight: 820;
      text-transform: uppercase;
    }

    .console-head span:last-child {
      color: rgba(255, 250, 240, 0.78);
      font-weight: 680;
      text-transform: none;
    }

    .console-row {
      min-height: 44px;
      border-bottom: 1px solid rgba(255, 250, 240, 0.08);
      font-size: 13px;
    }

    .console-row strong {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      font-weight: 680;
    }

    .console-row i {
      width: 26px;
      height: 26px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(255, 250, 240, 0.18);
      border-radius: 999px;
      color: var(--gold-soft);
      font-style: normal;
    }

    .console-row small {
      color: rgba(255, 250, 240, 0.84);
      font-size: 12px;
      white-space: nowrap;
    }

    .console-row small::after,
    .console-head span:last-child::after {
      content: "";
      display: inline-block;
      width: 7px;
      height: 7px;
      margin-left: 7px;
      border-radius: 999px;
      background: #8ea35d;
      vertical-align: middle;
    }

    .console-summary {
      margin-top: 14px;
      padding: 12px;
      border: 1px solid rgba(255, 250, 240, 0.14);
      border-radius: 6px;
      color: rgba(255, 250, 240, 0.76);
      font-size: 12px;
      line-height: 1.45;
    }

    .console-summary strong {
      display: block;
      margin-bottom: 5px;
      color: rgba(255, 250, 240, 0.9);
      font-weight: 680;
    }

    .signal-band {
      display: grid;
      grid-template-columns: minmax(330px, 1fr) repeat(3, minmax(116px, 0.82fr));
      gap: 16px;
      align-items: center;
      padding: 38px 48px 40px;
      border-bottom: 1px solid var(--line);
    }

    .signal-intro {
      display: grid;
      grid-template-columns: 74px minmax(0, 1fr);
      gap: 24px;
      align-items: center;
    }

    .leaf-icon {
      width: 72px;
      height: 72px;
      color: var(--sage);
    }

    .signal-intro p,
    .feature p,
    .loop-step p,
    .boundary-card p,
    .panel p,
    footer p {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.55;
    }

    .feature {
      min-height: 96px;
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr);
      gap: 12px;
      align-items: start;
      padding-left: 14px;
      border-left: 1px dotted #c8baa4;
    }

    .feature svg {
      width: 36px;
      height: 36px;
      color: var(--sage);
    }

    .section {
      padding: 38px 48px 50px;
      border-bottom: 1px solid var(--line);
    }

    .loop-row {
      display: grid;
      grid-template-columns: repeat(9, minmax(0, 1fr));
      align-items: start;
      gap: 12px;
      margin-top: 30px;
    }

    .loop-step {
      display: grid;
      justify-items: center;
      text-align: center;
    }

    .loop-step .step-number {
      margin-bottom: 10px;
      color: #6e5d36;
      font-family: var(--serif);
      font-size: 16px;
    }

    .step-icon {
      width: 56px;
      height: 56px;
      display: grid;
      place-items: center;
      margin-bottom: 14px;
      border-radius: 999px;
      color: #fffaf0;
      background: var(--sage);
    }

    .step-icon.gold { background: var(--gold); border-radius: 9px; transform: rotate(45deg); }
    .step-icon.gold svg { transform: rotate(-45deg); }
    .step-icon.red { background: var(--red); }
    .step-icon.outline { background: transparent; color: var(--sage); border: 3px solid var(--sage); }

    .step-icon svg {
      width: 34px;
      height: 34px;
    }

    .loop-step strong {
      display: block;
      color: #161410;
      font-family: var(--serif);
      font-size: 14px;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .loop-arrow {
      align-self: center;
      justify-self: center;
      color: #a7782c;
      font-family: var(--serif);
      font-size: 34px;
      line-height: 1;
    }

    .boundary-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 22px;
      margin-top: 26px;
    }

    .boundary-card,
    .panel {
      border: 1px solid #cab99f;
      border-radius: 7px;
      background: rgba(255, 253, 247, 0.62);
      box-shadow: 0 14px 34px rgba(58, 44, 24, 0.05);
    }

    .boundary-card {
      min-height: 156px;
      padding: 20px;
    }

    .boundary-card svg {
      width: 34px;
      height: 34px;
      margin-bottom: 14px;
      color: var(--sage);
    }

    .boundary-card:nth-child(4) svg { color: var(--red); }
    .boundary-card:nth-child(5) svg { color: var(--gold); }

    .panel-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
      gap: 22px;
      margin-top: 22px;
    }

    .panel {
      position: relative;
      min-height: 260px;
      display: grid;
      grid-template-columns: 190px minmax(0, 1fr);
      gap: 26px;
      align-items: center;
      padding: 22px;
      overflow: hidden;
    }

    .panel.interest {
      grid-template-columns: minmax(0, 1fr);
    }

    .panel.interest > div {
      position: relative;
      z-index: 1;
      max-width: 330px;
    }

    .panel.interest .lower-sketch {
      position: absolute;
      right: 18px;
      bottom: 18px;
      width: 210px;
      opacity: 0.72;
    }

    .panel h3 {
      font-size: 27px;
    }

    .panel ul {
      display: grid;
      gap: 7px;
      margin: 14px 0 0;
      padding: 0;
      list-style: none;
      color: #2f2b24;
      font-size: 14px;
    }

    .panel li::before {
      content: "✓";
      margin-right: 9px;
      color: var(--gold);
      font-weight: 900;
    }

    .panel .text-link {
      margin-top: 18px;
      max-width: 100%;
      white-space: normal;
      justify-content: flex-start;
    }

    .panel .button {
      margin-top: 18px;
      min-height: 42px;
    }

    .lower-sketch {
      width: 100%;
      max-width: 230px;
      height: auto;
      opacity: 0.88;
    }

    footer {
      display: grid;
      grid-template-columns: minmax(250px, 1fr) repeat(3, minmax(120px, 0.55fr)) minmax(190px, 0.8fr);
      gap: 30px;
      align-items: start;
      padding: 34px 42px;
      background: linear-gradient(90deg, #151715, #1e211f);
      color: rgba(255, 250, 240, 0.82);
    }

    footer img {
      display: block;
    }

    footer p {
      color: rgba(255, 250, 240, 0.72);
    }

    footer .snaxk-brandmark {
      width: 158px;
      min-height: 48px;
      margin-bottom: 18px;
      padding: 4px 12px 4px 6px;
    }

    footer .snaxk-emblem {
      width: 42px;
      height: 38px;
      flex-basis: 42px;
    }

    footer .snaxk-emblem img {
      width: 70px;
      left: -14px;
      top: -6px;
    }

    footer .snaxk-word {
      font-size: 25px;
    }

    footer strong {
      display: block;
      margin-bottom: 10px;
      color: var(--gold-soft);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    footer a {
      display: block;
      margin-top: 5px;
      color: rgba(255, 250, 240, 0.82);
      text-decoration: none;
      font-size: 13px;
    }

    .footer-product {
      justify-self: end;
      align-self: center;
      color: #fffaf0;
      font-family: var(--serif);
      font-size: 18px;
      line-height: 1.8;
      text-align: right;
    }

    .footer-product div:first-child {
      color: rgba(255, 250, 240, 0.9);
    }

    @media (max-width: 860px) {
      .site-header,
      .hero,
      .signal-band,
      .panel-grid,
      footer {
        grid-template-columns: 1fr;
      }

      nav,
      .version-pill,
      .brand,
      .footer-product {
        justify-self: start;
      }

      .hero-art {
        min-height: 520px;
      }

      .boundary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .loop-row {
        grid-template-columns: 1fr;
      }

      .loop-arrow {
        transform: rotate(90deg);
      }
    }

    @media (max-width: 720px) {
      .site-header,
      .hero,
      .signal-band,
      .section,
      footer {
        padding-left: 22px;
        padding-right: 22px;
      }

      nav {
        gap: 14px;
        font-size: 15px;
      }

      h1 {
        font-size: 48px;
      }

      .hero {
        min-height: auto;
      }

      .hero-art {
        min-height: 560px;
      }

      .console-panel {
        position: relative;
        inset: auto;
        width: 100%;
        margin-top: 280px;
      }

      .map-marker {
        font-size: 12px;
      }

      .m-signal { left: 26%; top: 66px; }
      .m-boundary { left: 45%; top: 168px; }
      .m-evidence { right: 14%; top: 76px; }
      .m-stop { left: 24%; top: 278px; }
      .m-judge { right: 24%; top: 366px; }

      .signal-intro,
      .feature,
      .panel,
      .panel.interest {
        grid-template-columns: 1fr;
      }

      .boundary-grid {
        grid-template-columns: 1fr;
      }

      .button,
      .text-link {
        width: 100%;
        justify-content: center;
      }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="${escapeHtml(site.name)} home">
      ${brandMark()}
    </a>
    <nav aria-label="Primary">
      <a href="#engine">Engine</a>
      <a href="#boundaries">Boundaries</a>
      <a href="#cao-briefing">CAO Briefing</a>
      <a href="#conversation">Interest</a>
    </nav>
    <div class="version-pill">${escapeHtml(milestone)}</div>
  </header>

  <main>
    <section class="hero" aria-labelledby="page-title">
      <div class="hero-copy">
        <h1 id="page-title">${escapeHtml(site.heading || "A judgement engine for agentic work.")}</h1>
        <div class="rule"></div>
        <p>SNAXK helps teams and leaders set boundaries, demand evidence, define stop conditions, and produce board-readable judgement.</p>
        <p>From signals to decisions, in a loop you can trust: people and agents.</p>
        <div class="hero-actions">
          <a class="button" href="#engine">See the engine ${arrowSvg}</a>
          <a class="text-link" href="${escapeHtml(heroCaoHref)}"${outboundAttrsFor(site, caoFeeder.primary_content || "hero_cao_briefing", caoStage, caoCampaign)}>Read the CAO briefing ${arrowSvg}</a>
        </div>
      </div>

      <div class="hero-art" aria-label="SNAXK judgement map">
        ${fieldSketch}
        <div class="path-line path-one"></div>
        <div class="path-line path-two"></div>
        <div class="path-line path-three"></div>
        <div class="map-marker m-signal"><span class="marker-dot">${iconSvg("M22 13v18M13 22h18M16 16l12 12M28 16L16 28")}</span><span>Signals</span></div>
        <div class="map-marker m-boundary"><span class="marker-dot">${iconSvg("M16 16h12v12H16zM22 11v5M22 28v5M11 22h5M28 22h5")}</span><span>Boundaries</span></div>
        <div class="map-marker m-evidence"><span class="marker-dot">${iconSvg("M22 12l3 7 7 3-7 3-3 7-3-7-7-3 7-3z")}</span><span>Evidence</span></div>
        <div class="map-marker m-stop"><span class="marker-dot">${iconSvg("M22 14l8 5v8l-8 5-8-5v-8z")}</span><span>Stop Condition</span></div>
        <div class="map-marker m-judge"><span class="marker-dot">${iconSvg("M22 14l8 8-8 8-8-8z")}</span><span>Judgement</span></div>
        <aside class="console-panel" aria-label="SNAXK engine status">
          <div class="console-head"><span>SNAXK Engine</span><span>All quiet</span></div>
          ${engineRows.map(([name, value]) => `<div class="console-row"><strong><i>${escapeHtml(name.slice(0, 1))}</i>${escapeHtml(name)}</strong><small>${escapeHtml(value)}</small></div>`).join("")}
          <div class="console-summary"><strong>Judgement Summary</strong>Proceed within boundaries. Review at next cadence.</div>
        </aside>
      </div>
    </section>

    <section class="signal-band" id="signal">
      <div class="signal-intro">
        <svg class="leaf-icon" viewBox="0 0 80 80" fill="none" aria-hidden="true">
          <path d="M16 66c15-24 29-39 49-51M24 54c-6-7-10-16-8-27 12 2 20 9 25 18M35 41c-2-10 2-21 13-31 9 12 8 23 2 33M30 61c11 0 20 4 27 13-14 4-25 2-34-7" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div>
          <h2>Signal before action.</h2>
          <p>SNAXK surfaces what matters before work runs: risk, context, constraints, intent, and evidence.</p>
        </div>
      </div>
      ${featureCards.map((feature) => `<article class="feature">
        ${iconSvg(feature.icon)}
        <div>
          <h3>${escapeHtml(feature.title)}</h3>
          <p>${escapeHtml(feature.body)}</p>
        </div>
      </article>`).join("")}
    </section>

    <section class="section" id="engine">
      <h2>The SNAXK judgement loop.</h2>
      <div class="loop-row">
        ${loopSteps.map((step, index) => `<article class="loop-step">
          <div class="step-number">${escapeHtml(step.number)}</div>
          <div class="step-icon ${escapeHtml(step.tone)}">${iconSvg(step.icon)}</div>
          <strong>${escapeHtml(step.label)}</strong>
          <p>${escapeHtml(step.body)}</p>
        </article>${index < loopSteps.length - 1 ? `<div class="loop-arrow" aria-hidden="true">→</div>` : ""}`).join("")}
      </div>
    </section>

    <section class="section" id="boundaries">
      <h2>Boundaries make it safe to move fast.</h2>
      <div class="boundary-grid">
        ${boundaryCards.map((card) => `<article class="boundary-card">
          ${iconSvg(card.icon)}
          <h3>${escapeHtml(card.title)}</h3>
          <p>${escapeHtml(card.body)}</p>
        </article>`).join("")}
      </div>
      <div class="panel-grid">
        <article class="panel" id="cao-briefing">
          ${lowerSketch}
          <div>
            <h3>Built for the Chief Agentic Officer.</h3>
            <div class="rule"></div>
            <p>SNAXK gives CAOs and boards a judgement layer they can read and rely on.</p>
            <ul>
              <li>Board-readable judgement summaries</li>
              <li>Decision trails people and agents can both read</li>
              <li>Bounded autonomy with clear escalation paths</li>
              <li>Signals that surface risk before it becomes cost</li>
              <li>Operational cadence that sustains performance</li>
            </ul>
            <a class="text-link" href="${escapeHtml(panelCaoHref)}"${outboundAttrsFor(site, "cao_briefing_panel", caoStage, caoCampaign)}>Read the Chief Agentic Officer briefing ${arrowSvg}</a>
          </div>
        </article>
        <article class="panel interest" id="conversation">
          <div>
            <h3>Register interest in the SNAXK engine.</h3>
            <div class="rule"></div>
            <p>Want to explore how SNAXK could support your organisation's agentic work and governance?</p>
            <ul>
              <li>Discuss use cases and fit</li>
              <li>Understand deployment and integration</li>
              <li>See roadmaps and governance approach</li>
              <li>Join early collaboration conversations</li>
            </ul>
            <a class="button" href="${escapeHtml(engineInterestHref)}"${outboundAttrsFor(site, caoFeeder.engine_content || "snaxk_engine_interest", advisoryStage, advisoryCampaign)}>Register interest ${arrowSvg}</a>
          </div>
          ${lowerSketch}
        </article>
      </div>
    </section>
  </main>

  <footer>
    <div>
      ${brandMark("footer-mark")}
      <p>A judgement engine for agentic work.</p>
      <p>Signal before action.<br>Boundaries make it safe.<br>Judgement you can stand behind.</p>
    </div>
    <div>
      <strong>Engine</strong>
      <a href="#engine">How it works</a>
      <a href="#boundaries">Boundaries</a>
      <a href="#engine">Loop</a>
      <a href="/healthz">Status</a>
    </div>
    <div>
      <strong>CAO Briefing</strong>
      <a href="${escapeHtml(panelCaoHref)}"${outboundAttrsFor(site, "footer_cao_briefing", caoStage, caoCampaign)}>Why it matters</a>
      <a href="${escapeHtml(caoUrl)}">Using SNAXK</a>
      <a href="${escapeHtml(caoUrl)}">Board view</a>
      <a href="${escapeHtml(caoUrl)}">Case notes</a>
    </div>
    <div>
      <strong>Connect</strong>
      <a href="${escapeHtml(engineInterestHref)}"${outboundAttrsFor(site, caoFeeder.engine_content || "snaxk_engine_interest", advisoryStage, advisoryCampaign)}>Register interest</a>
      <a href="${escapeHtml(advisoryHref)}"${outboundAttrsFor(site, "footer_tonywood_advisory", advisoryStage, advisoryCampaign)}>Talk to Tony</a>
      <a href="${escapeHtml(advisoryHref)}"${outboundAttrsFor(site, "footer_tonywood_advisory", advisoryStage, advisoryCampaign)}>Tonywood Advisory →</a>
    </div>
    <div class="footer-product">
      <div>${escapeHtml(footerProductLine)}</div>
      <div>${escapeHtml(footerLegal)}</div>
    </div>
  </footer>
</body>
</html>
`;
}

function siblingProductSharedStyles() {
  return `
    @font-face {
      font-family: "Instrument Sans";
      src: url("/assets/system/instrument-sans-latin-variable.woff2") format("woff2");
      font-style: normal;
      font-weight: 400 700;
      font-display: swap;
    }

    @font-face {
      font-family: "Newsreader";
      src: url("/assets/system/newsreader-latin-variable.woff2") format("woff2");
      font-style: normal;
      font-weight: 300 700;
      font-display: swap;
    }

    :root {
      --sp-sans: "Instrument Sans", ui-sans-serif, system-ui, sans-serif;
      --sp-serif: "Newsreader", Georgia, serif;
      --sp-paper: #f8f6ef;
      --sp-white: #fffdf7;
      --sp-ink: #11130f;
      --sp-muted: #5a5d55;
      --sp-night: #080b09;
      --sp-line: rgba(17, 19, 15, 0.16);
      --sp-light-line: rgba(255, 253, 247, 0.2);
      --sp-gutter: clamp(22px, 5vw, 76px);
      --sp-max: 1240px;
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
      background: var(--sp-night);
      overflow-x: hidden;
    }

    body {
      margin: 0;
      background: var(--sp-paper);
      color: var(--sp-ink);
      font-family: var(--sp-sans);
      font-size: 17px;
      line-height: 1.58;
      letter-spacing: 0;
      overflow-x: hidden;
    }

    a {
      color: inherit;
      text-underline-offset: 0.2em;
    }

    h1,
    h2,
    h3,
    p,
    figure,
    blockquote {
      margin-top: 0;
    }

    h1,
    h2,
    h3 {
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }

    img {
      max-width: 100%;
    }

    .sp-header {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 20;
      min-height: 84px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 28px;
      padding: 14px var(--sp-gutter);
      border-bottom: 1px solid var(--sp-light-line);
      background: rgba(6, 9, 7, 0.8);
      -webkit-backdrop-filter: blur(18px) saturate(125%);
      backdrop-filter: blur(18px) saturate(125%);
      color: var(--sp-white);
    }

    .sp-brand {
      min-width: 0;
      display: inline-flex;
      align-items: center;
      gap: 13px;
      color: var(--sp-white);
      text-decoration: none;
    }

    .sp-brand-copy {
      display: grid;
      gap: 1px;
    }

    .sp-brand-copy strong {
      font-size: 16px;
      line-height: 1.1;
    }

    .sp-brand-copy span {
      color: rgba(255, 253, 247, 0.67);
      font-size: 11px;
      font-weight: 650;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .sp-nav {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: clamp(16px, 2.2vw, 30px);
      font-size: 14px;
      font-weight: 650;
    }

    .sp-nav a {
      color: var(--sp-white);
      text-decoration: none;
      text-shadow: 0 1px 14px rgba(0, 0, 0, 0.7);
    }

    .sp-nav a:hover,
    .sp-nav a:focus-visible {
      text-decoration: underline;
    }

    .sp-nav .sp-nav-cta {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      padding: 0 18px;
      border: 1px solid var(--sp-white);
      border-radius: 5px;
      background: var(--sp-white);
      color: var(--sp-ink);
      text-shadow: none;
    }

    .sp-mobile-nav {
      display: none;
      position: relative;
    }

    .sp-mobile-nav summary {
      min-width: 44px;
      min-height: 44px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(255, 253, 247, 0.5);
      border-radius: 5px;
      cursor: pointer;
      list-style: none;
      font-size: 14px;
      font-weight: 700;
    }

    .sp-mobile-nav summary::-webkit-details-marker {
      display: none;
    }

    .sp-mobile-nav-menu {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      width: min(270px, calc(100vw - 44px));
      display: grid;
      padding: 10px;
      border: 1px solid var(--sp-light-line);
      border-radius: 6px;
      background: rgba(8, 11, 9, 0.98);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
    }

    .sp-mobile-nav-menu a {
      padding: 12px;
      color: var(--sp-white);
      text-decoration: none;
    }

    .sp-hero {
      position: relative;
      min-height: clamp(650px, 88svh, 840px);
      display: grid;
      align-items: end;
      isolation: isolate;
      color: var(--sp-white);
      background-color: var(--sp-night);
      background-image: var(--sp-hero-image);
      background-position: center;
      background-size: cover;
      overflow: hidden;
    }

    .sp-hero::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: -1;
      background:
        linear-gradient(90deg, rgba(5, 8, 6, 0.88) 0%, rgba(5, 8, 6, 0.62) 45%, rgba(5, 8, 6, 0.12) 76%),
        linear-gradient(0deg, rgba(5, 8, 6, 0.72) 0%, transparent 48%),
        linear-gradient(180deg, rgba(5, 8, 6, 0.4) 0%, transparent 28%);
    }

    .sp-hero::after {
      content: "";
      position: absolute;
      inset: 0;
      z-index: -1;
      background: linear-gradient(112deg, transparent 35%, rgba(255, 255, 255, 0.1) 48%, transparent 58%);
      transform: translateX(-90%);
      animation: sp-reflection 12s ease-in-out 1.4s infinite;
      pointer-events: none;
    }

    .sp-hero-inner {
      width: min(100%, var(--sp-max));
      display: grid;
      gap: 20px;
      padding: 152px var(--sp-gutter) clamp(68px, 8vw, 96px);
    }

    .sp-eyebrow {
      margin: 0;
      color: var(--sp-accent);
      font-size: 12px;
      font-weight: 750;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .sp-hero h1 {
      max-width: 790px;
      margin-bottom: 0;
      font-family: var(--sp-serif);
      font-size: clamp(58px, 7vw, 104px);
      font-weight: 430;
      line-height: 0.91;
    }

    .sp-hero-lede {
      max-width: 680px;
      margin-bottom: 4px;
      color: rgba(255, 253, 247, 0.86);
      font-size: clamp(19px, 2vw, 25px);
      line-height: 1.46;
    }

    .sp-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
    }

    .sp-button {
      min-height: 50px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 0 20px;
      border: 1px solid currentColor;
      border-radius: 5px;
      text-decoration: none;
      font-size: 15px;
      font-weight: 720;
      transition: transform 180ms ease, background 180ms ease, color 180ms ease;
    }

    .sp-button:hover,
    .sp-button:focus-visible {
      transform: translateY(-2px);
    }

    .sp-button svg {
      width: 18px;
      height: 18px;
      flex: 0 0 auto;
    }

    .sp-button-light {
      border-color: var(--sp-white);
      background: var(--sp-white);
      color: var(--sp-ink);
    }

    .sp-button-ghost {
      border-color: rgba(255, 253, 247, 0.62);
      color: var(--sp-white);
    }

    .sp-button-dark {
      border-color: var(--sp-ink);
      background: var(--sp-ink);
      color: var(--sp-white);
    }

    .sp-intro-rail {
      min-height: 118px;
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) repeat(3, minmax(0, 0.72fr));
      align-items: stretch;
      border-bottom: 1px solid var(--sp-line);
      background: var(--sp-paper);
    }

    .sp-intro-rail > div {
      display: flex;
      align-items: center;
      padding: 24px clamp(22px, 3vw, 44px);
      border-right: 1px solid var(--sp-line);
    }

    .sp-intro-rail > div:last-child {
      border-right: 0;
    }

    .sp-intro-rail strong {
      display: block;
      font-family: var(--sp-serif);
      font-size: clamp(25px, 2.5vw, 38px);
      font-weight: 450;
      line-height: 1.05;
    }

    .sp-intro-rail span {
      color: var(--sp-muted);
      font-size: 14px;
      font-weight: 650;
    }

    .sp-section {
      padding: clamp(74px, 10vw, 138px) var(--sp-gutter);
    }

    .sp-section-inner {
      width: min(100%, var(--sp-max));
      margin: 0 auto;
    }

    .sp-section-heading {
      max-width: 800px;
      margin-bottom: clamp(44px, 6vw, 78px);
    }

    .sp-section-heading h2 {
      margin: 12px 0 18px;
      font-family: var(--sp-serif);
      font-size: clamp(42px, 5.8vw, 78px);
      font-weight: 430;
      line-height: 0.98;
    }

    .sp-section-heading > p:last-child {
      max-width: 680px;
      margin-bottom: 0;
      color: var(--sp-muted);
      font-size: clamp(18px, 2vw, 22px);
    }

    .sp-numbered-list {
      border-top: 1px solid var(--sp-line);
    }

    .sp-numbered-item {
      display: grid;
      grid-template-columns: 72px minmax(220px, 0.7fr) minmax(0, 1.2fr);
      gap: 28px;
      padding: 28px 0;
      border-bottom: 1px solid var(--sp-line);
      align-items: start;
    }

    .sp-numbered-item .sp-number {
      color: var(--sp-accent-dark);
      font-size: 13px;
      font-weight: 760;
    }

    .sp-numbered-item h3 {
      margin: 0;
      font-family: var(--sp-serif);
      font-size: clamp(26px, 3vw, 37px);
      font-weight: 470;
      line-height: 1.05;
    }

    .sp-numbered-item p {
      margin: 0;
      color: var(--sp-muted);
    }

    .sp-dark {
      background: var(--sp-night);
      color: var(--sp-white);
    }

    .sp-dark .sp-eyebrow {
      color: var(--sp-accent);
    }

    .sp-dark .sp-section-heading > p:last-child,
    .sp-dark .sp-muted {
      color: rgba(255, 253, 247, 0.68);
    }

    .sp-product-relationship {
      display: grid;
      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
      gap: clamp(44px, 8vw, 110px);
      align-items: center;
    }

    .sp-product-relationship h2 {
      margin: 12px 0 18px;
      font-family: var(--sp-serif);
      font-size: clamp(43px, 5.6vw, 76px);
      font-weight: 430;
      line-height: 0.98;
    }

    .sp-product-relationship p {
      color: rgba(255, 253, 247, 0.72);
      font-size: clamp(18px, 2vw, 22px);
    }

    .sp-relationship-rule {
      min-height: 320px;
      display: grid;
      align-content: center;
      gap: 22px;
      padding: clamp(28px, 5vw, 54px);
      border: 1px solid rgba(255, 253, 247, 0.2);
      background:
        linear-gradient(135deg, rgba(255, 253, 247, 0.08), transparent 55%),
        rgba(255, 253, 247, 0.03);
      box-shadow: inset 0 1px rgba(255, 255, 255, 0.09);
    }

    .sp-relationship-rule strong {
      font-family: var(--sp-serif);
      font-size: clamp(26px, 3.5vw, 44px);
      font-weight: 450;
      line-height: 1.06;
    }

    .sp-footer {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(130px, 0.55fr));
      gap: 38px;
      padding: 54px var(--sp-gutter);
      border-top: 1px solid var(--sp-light-line);
      background: #060806;
      color: var(--sp-white);
    }

    .sp-footer p,
    .sp-footer small {
      color: rgba(255, 253, 247, 0.6);
    }

    .sp-footer p {
      max-width: 340px;
      margin: 10px 0 0;
    }

    .sp-footer-col {
      display: grid;
      align-content: start;
      gap: 9px;
    }

    .sp-footer-col strong {
      margin-bottom: 4px;
      color: rgba(255, 253, 247, 0.48);
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .sp-footer-col a {
      color: var(--sp-white);
      text-decoration: none;
    }

    .sp-footer-legal {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 12px 26px;
      padding-top: 28px;
      border-top: 1px solid rgba(255, 253, 247, 0.12);
      color: rgba(255, 253, 247, 0.56);
      font-size: 13px;
    }

    .sp-reveal {
      animation: sp-enter 760ms cubic-bezier(.2, .7, .25, 1) both;
    }

    @keyframes sp-enter {
      from {
        opacity: 0;
        transform: translateY(18px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes sp-reflection {
      0%, 58%, 100% {
        transform: translateX(-90%);
        opacity: 0;
      }
      72% {
        opacity: 0.5;
      }
      88% {
        transform: translateX(90%);
        opacity: 0;
      }
    }

    @media (max-width: 920px) {
      .sp-nav {
        display: none;
      }

      .sp-mobile-nav {
        display: block;
      }

      .sp-intro-rail {
        grid-template-columns: 1fr 1fr;
      }

      .sp-intro-rail > div:nth-child(2) {
        border-right: 0;
      }

      .sp-intro-rail > div:nth-child(-n + 2) {
        border-bottom: 1px solid var(--sp-line);
      }

      .sp-product-relationship {
        grid-template-columns: 1fr;
      }

      .sp-footer {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 680px) {
      body {
        font-size: 16px;
      }

      .sp-header {
        min-height: 74px;
        padding-top: 10px;
        padding-bottom: 10px;
      }

      .sp-brand-copy span {
        display: none;
      }

      .sp-hero {
        min-height: 86svh;
        background-image: var(--sp-hero-mobile-image, var(--sp-hero-image));
        background-position: center;
      }

      .sp-hero::before {
        background:
          linear-gradient(90deg, rgba(5, 8, 6, 0.83), rgba(5, 8, 6, 0.25)),
          linear-gradient(0deg, rgba(5, 8, 6, 0.84) 0%, rgba(5, 8, 6, 0.2) 72%),
          linear-gradient(180deg, rgba(5, 8, 6, 0.45), transparent 32%);
      }

      .sp-hero-inner {
        gap: 16px;
        padding-top: 128px;
        padding-bottom: 54px;
      }

      .sp-hero h1 {
        font-size: clamp(48px, 14.5vw, 68px);
      }

      .sp-actions {
        align-items: stretch;
      }

      .sp-actions .sp-button {
        flex: 1 1 100%;
      }

      .sp-intro-rail {
        grid-template-columns: 1fr;
      }

      .sp-intro-rail > div {
        min-height: 86px;
        border-right: 0;
        border-bottom: 1px solid var(--sp-line);
      }

      .sp-intro-rail > div:last-child {
        border-bottom: 0;
      }

      .sp-numbered-item {
        grid-template-columns: 44px minmax(0, 1fr);
        gap: 12px 16px;
      }

      .sp-numbered-item p {
        grid-column: 2;
      }

      .sp-footer {
        grid-template-columns: 1fr;
      }

      .sp-footer-legal {
        grid-column: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      html {
        scroll-behavior: auto;
      }

      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;
}

function siblingArrowIcon() {
  return `<svg aria-hidden="true" viewBox="0 0 20 20"><path d="M4 10h11M11 6l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function snaxkSiblingPageFor(site) {
  const title = site.title || "SNAXK | Judgement engine for agentic work";
  const summary = site.summary || "SNAXK surfaces ownership, boundaries, stop conditions, evidence, review, and measurable trust for agentic work.";
  const badge = site.brand_assets?.badge || "/assets/snaxk-badge.png";
  const heroImage = site.hero_background_image || "/assets/snaxk/hero-judgement-room.webp";
  const heroImageMobile = site.hero_background_image_mobile || heroImage;
  const evidenceImage = site.evidence_image || "/assets/snaxk/evidence-table.webp";
  const milestone = site.research_milestone || "SNAXK 0.10.8";
  const loop = site.judgement_loop || [];
  const boundaries = site.boundary_checks || [];
  const checks = [
    ["Signal", "What changed?"],
    ["Boundary", "What may happen?"],
    ["Evidence", "What can be inspected?"],
  ];
  const caoFeeder = site.cao_feeder || {};
  const caoUrl = caoFeeder.primary_url || "https://chiefagenticofficer.com/";
  const caoCampaign = caoFeeder.primary_campaign || "snaxk_to_chiefagenticofficer";
  const caoStage = caoFeeder.primary_stage || "source_to_chiefagenticofficer";
  const caoHref = trackedOutboundUrlFor(site, caoUrl, caoFeeder.primary_content || "hero_cao_briefing", caoCampaign) || caoUrl;
  const caoPanelHref = trackedOutboundUrlFor(site, caoUrl, "cao_judgement_briefing", caoCampaign) || caoUrl;
  const advisoryUrl = caoFeeder.secondary_url || defaultTonywoodAdvisoryUrl;
  const advisoryCampaign = caoFeeder.secondary_campaign || "snaxk_to_tonywood_advisory";
  const advisoryStage = caoFeeder.secondary_stage || "source_to_tonywood_advisory";
  const advisoryHref = trackedOutboundUrlFor(site, advisoryUrl, caoFeeder.engine_content || "snaxk_engine_interest", advisoryCampaign) || advisoryUrl;
  const sibling = site.sibling_product || {
    name: "Orchistra",
    url: "https://orchistra.com/",
    campaign: "snaxk_to_orchistra",
    content: "sibling_orchistra",
    title: "Visible work and visible judgement belong beside one another.",
    body: "Orchistra keeps agent work visible and coordinated. SNAXK helps decide what may proceed, what should stop, and where human judgement is required.",
  };
  const siblingHref = trackedOutboundUrlFor(site, sibling.url, sibling.content, sibling.campaign) || sibling.url;
  const arrow = siblingArrowIcon();
  const loopMarkup = loop.map((item, index) => `
            <article class="sp-numbered-item">
              <span class="sp-number">${escapeHtml(item.label || String(index + 1).padStart(2, "0"))}</span>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.body)}</p>
            </article>`).join("");
  const boundaryMarkup = boundaries.map((item, index) => `
              <li>
                <span>${String(index + 1).padStart(2, "0")}</span>
                <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p></div>
              </li>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(summary)}">
${socialMetaTagsFor(site, { title, description: summary })}  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="${escapeHtml(heroImage)}" as="image" fetchpriority="high">
  <link rel="preload" href="/assets/system/instrument-sans-latin-variable.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/system/newsreader-latin-variable.woff2" as="font" type="font/woff2" crossorigin>
${matomoScriptTagFor(site)}  <style>
${siblingProductSharedStyles().trim()}
    :root {
      --sp-accent: #f2bd59;
      --sp-accent-dark: #9a5d20;
      --snaxk-oxblood: #7b3029;
      --snaxk-brown: #4b2f1b;
      --snaxk-cream: #f6e9c9;
    }

    .snaxk-brand-badge {
      width: 70px;
      height: 46px;
      display: block;
      object-fit: cover;
      border-radius: 9px;
      box-shadow: 0 0 0 1px rgba(255, 253, 247, 0.3);
    }

    .snaxk-hero {
      --sp-hero-image: url("${escapeHtml(heroImage)}");
      --sp-hero-mobile-image: url("${escapeHtml(heroImageMobile)}");
    }

    .snaxk-hero .sp-hero-inner {
      max-width: 900px;
    }

    .snaxk-hero .sp-eyebrow {
      color: #ffd985;
    }

    .snaxk-milestone {
      width: fit-content;
      margin: 0;
      padding-top: 14px;
      border-top: 1px solid rgba(255, 253, 247, 0.4);
      color: rgba(255, 253, 247, 0.66);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .snaxk-thresholds {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border-top: 1px solid var(--sp-line);
      border-bottom: 1px solid var(--sp-line);
    }

    .snaxk-threshold {
      min-height: 260px;
      display: grid;
      align-content: space-between;
      gap: 34px;
      padding: clamp(28px, 4vw, 48px);
      border-right: 1px solid var(--sp-line);
    }

    .snaxk-threshold:last-child {
      border-right: 0;
    }

    .snaxk-threshold span {
      color: var(--sp-accent-dark);
      font-size: 12px;
      font-weight: 760;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .snaxk-threshold h3 {
      max-width: 310px;
      margin: 0;
      font-family: var(--sp-serif);
      font-size: clamp(31px, 3.3vw, 45px);
      font-weight: 450;
      line-height: 1.04;
    }

    .snaxk-console-layout {
      display: grid;
      grid-template-columns: minmax(0, 0.82fr) minmax(430px, 1.18fr);
      gap: clamp(48px, 8vw, 110px);
      align-items: center;
    }

    .snaxk-console-copy h2 {
      margin: 12px 0 18px;
      font-family: var(--sp-serif);
      font-size: clamp(43px, 5.5vw, 72px);
      font-weight: 430;
      line-height: 0.97;
    }

    .snaxk-console-copy > p:last-of-type {
      color: rgba(255, 253, 247, 0.7);
      font-size: 19px;
    }

    .snaxk-console {
      position: relative;
      min-height: 520px;
      display: grid;
      align-content: center;
      gap: 12px;
      padding: clamp(28px, 5vw, 52px);
      border: 1px solid rgba(255, 253, 247, 0.2);
      background:
        radial-gradient(ellipse at 88% 15%, transparent 0 14%, rgba(242, 189, 89, 0.16) 14.4% 14.8%, transparent 15.2%),
        radial-gradient(ellipse at 84% 18%, transparent 0 25%, rgba(242, 189, 89, 0.11) 25.4% 25.8%, transparent 26.2%),
        linear-gradient(145deg, rgba(255, 253, 247, 0.08), transparent 52%),
        #10130f;
      box-shadow: 0 34px 80px rgba(0, 0, 0, 0.34), inset 0 1px rgba(255, 255, 255, 0.08);
      overflow: hidden;
    }

    .snaxk-console::after {
      content: "CONCEPT MODEL";
      position: absolute;
      right: 20px;
      bottom: 16px;
      color: rgba(255, 253, 247, 0.38);
      font-size: 10px;
      font-weight: 730;
      letter-spacing: 0.12em;
    }

    .snaxk-console-step {
      position: relative;
      display: grid;
      grid-template-columns: 38px 1fr auto;
      gap: 14px;
      align-items: center;
      padding: 15px 16px;
      border: 1px solid rgba(255, 253, 247, 0.12);
      background: rgba(255, 253, 247, 0.045);
    }

    .snaxk-console-step span:first-child {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(242, 189, 89, 0.52);
      color: #f7d58e;
      font-size: 11px;
      font-weight: 760;
    }

    .snaxk-console-step strong {
      font-family: var(--sp-serif);
      font-size: 22px;
      font-weight: 470;
    }

    .snaxk-console-step em {
      color: rgba(255, 253, 247, 0.52);
      font-size: 11px;
      font-style: normal;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .snaxk-evidence-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.08fr) minmax(360px, 0.92fr);
      gap: clamp(42px, 7vw, 92px);
      align-items: center;
    }

    .snaxk-evidence-image {
      position: relative;
      min-height: 660px;
      margin: 0;
      overflow: hidden;
    }

    .snaxk-evidence-image img {
      width: 100%;
      height: 100%;
      min-height: 660px;
      display: block;
      object-fit: cover;
    }

    .snaxk-evidence-image figcaption {
      position: absolute;
      left: 18px;
      bottom: 18px;
      padding: 9px 12px;
      background: rgba(8, 11, 9, 0.82);
      color: var(--sp-white);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .snaxk-boundaries h2 {
      margin: 12px 0 22px;
      font-family: var(--sp-serif);
      font-size: clamp(42px, 5.3vw, 70px);
      font-weight: 430;
      line-height: 0.98;
    }

    .snaxk-boundaries > p {
      color: var(--sp-muted);
      font-size: 19px;
    }

    .snaxk-boundary-list {
      margin: 34px 0 0;
      padding: 0;
      border-top: 1px solid var(--sp-line);
      list-style: none;
    }

    .snaxk-boundary-list li {
      display: grid;
      grid-template-columns: 42px 1fr;
      gap: 12px;
      padding: 20px 0;
      border-bottom: 1px solid var(--sp-line);
    }

    .snaxk-boundary-list li > span {
      color: var(--sp-accent-dark);
      font-size: 11px;
      font-weight: 760;
    }

    .snaxk-boundary-list strong {
      display: block;
      margin-bottom: 4px;
      font-family: var(--sp-serif);
      font-size: 24px;
      font-weight: 480;
    }

    .snaxk-boundary-list p {
      margin: 0;
      color: var(--sp-muted);
      font-size: 15px;
    }

    .snaxk-cao {
      background: #e8d5a6;
    }

    .snaxk-cao-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(360px, 0.78fr);
      gap: clamp(42px, 8vw, 110px);
      align-items: start;
    }

    .snaxk-cao h2 {
      margin: 12px 0 18px;
      font-family: var(--sp-serif);
      font-size: clamp(43px, 5.7vw, 76px);
      font-weight: 430;
      line-height: 0.98;
    }

    .snaxk-cao-copy > p {
      max-width: 720px;
      color: #4d4537;
      font-size: 20px;
    }

    .snaxk-cao-ledger {
      border-top: 1px solid rgba(17, 19, 15, 0.25);
    }

    .snaxk-cao-ledger div {
      display: grid;
      grid-template-columns: 34px 1fr;
      gap: 14px;
      padding: 18px 0;
      border-bottom: 1px solid rgba(17, 19, 15, 0.25);
    }

    .snaxk-cao-ledger span {
      color: var(--snaxk-oxblood);
      font-size: 11px;
      font-weight: 800;
    }

    .snaxk-cao-ledger strong {
      font-family: var(--sp-serif);
      font-size: 25px;
      font-weight: 480;
    }

    .snaxk-footer-logo {
      width: 96px;
      height: 62px;
      display: block;
      object-fit: cover;
      border-radius: 9px;
    }

    @media (max-width: 920px) {
      .snaxk-console-layout,
      .snaxk-evidence-layout,
      .snaxk-cao-layout {
        grid-template-columns: 1fr;
      }

      .snaxk-thresholds {
        grid-template-columns: 1fr;
      }

      .snaxk-threshold {
        min-height: 200px;
        border-right: 0;
        border-bottom: 1px solid var(--sp-line);
      }
    }

    @media (max-width: 680px) {
      .snaxk-brand-badge {
        width: 58px;
        height: 38px;
      }

      .snaxk-console-layout {
        gap: 36px;
      }

      .snaxk-console {
        min-height: 0;
        padding: 20px;
      }

      .snaxk-console-step {
        grid-template-columns: 34px 1fr;
      }

      .snaxk-console-step em {
        grid-column: 2;
      }

      .snaxk-evidence-image,
      .snaxk-evidence-image img {
        min-height: 440px;
      }
    }
  </style>
</head>
<body class="snaxk-sibling">
  <header class="sp-header">
    <a class="sp-brand" href="/" aria-label="SNAXK home">
      <img class="snaxk-brand-badge" src="${escapeHtml(badge)}" alt="SNAXK">
      <span class="sp-brand-copy"><strong>SNAXK</strong><span>Judgement engine</span></span>
    </a>
    <nav class="sp-nav" aria-label="Primary navigation">
      <a href="#approach">Approach</a>
      <a href="#loop">Judgement loop</a>
      <a href="#boundaries">Stop lines</a>
      <a href="#relationship">Orchistra</a>
      <a class="sp-nav-cta" href="${escapeHtml(caoHref)}"${outboundAttrsFor(site, caoFeeder.primary_content || "hero_cao_briefing", caoStage, caoCampaign)}>CAO briefing</a>
    </nav>
    <details class="sp-mobile-nav">
      <summary aria-label="Open navigation">Menu</summary>
      <div class="sp-mobile-nav-menu">
        <a href="#approach">Approach</a>
        <a href="#loop">Judgement loop</a>
        <a href="#boundaries">Stop lines</a>
        <a href="#relationship">Orchistra</a>
        <a href="${escapeHtml(caoHref)}"${outboundAttrsFor(site, caoFeeder.primary_content || "hero_cao_briefing", caoStage, caoCampaign)}>CAO briefing</a>
      </div>
    </details>
  </header>

  <main>
    <section class="sp-hero snaxk-hero" aria-labelledby="snaxk-title">
      <div class="sp-hero-inner sp-reveal">
        <p class="sp-eyebrow">SNAXK · judgement before action</p>
        <h1 id="snaxk-title">A judgement engine for agentic work.</h1>
        <p class="sp-hero-lede">Surface the ownership, boundaries, stop conditions, evidence and review a person needs before long-running agentic work moves.</p>
        <div class="sp-actions">
          <a class="sp-button sp-button-light" href="${escapeHtml(caoHref)}"${outboundAttrsFor(site, caoFeeder.primary_content || "hero_cao_briefing", caoStage, caoCampaign)}>Open the CAO briefing ${arrow}</a>
          <a class="sp-button sp-button-ghost" href="#loop">See the judgement loop</a>
        </div>
        <p class="snaxk-milestone">${escapeHtml(milestone)}</p>
      </div>
    </section>

    <section class="sp-intro-rail" aria-label="SNAXK judgement questions">
      <div><strong>Before the work moves.</strong></div>
      ${checks.map(([label, text]) => `<div><span>${escapeHtml(label)}<br>${escapeHtml(text)}</span></div>`).join("")}
    </section>

    <section class="sp-section" id="approach">
      <div class="sp-section-inner">
        <div class="sp-section-heading">
          <p class="sp-eyebrow">The judgement layer</p>
          <h2>Fast output is useful. Accountable judgement is what makes it operational.</h2>
          <p>SNAXK asks a quieter set of questions before an agent continues: what changed, how much confidence is justified, which boundary applies, and what evidence must remain visible afterwards?</p>
        </div>
        <div class="snaxk-thresholds">
          <article class="snaxk-threshold"><span>01 · signal</span><h3>Notice meaning before momentum.</h3></article>
          <article class="snaxk-threshold"><span>02 · consequence</span><h3>Understand what this action could change.</h3></article>
          <article class="snaxk-threshold"><span>03 · uncertainty</span><h3>Slow down when confidence and consequence do not match.</h3></article>
        </div>
      </div>
    </section>

    <section class="sp-section sp-dark" id="loop">
      <div class="sp-section-inner snaxk-console-layout">
        <div class="snaxk-console-copy">
          <p class="sp-eyebrow">Concept model</p>
          <h2>A loop that can pause itself.</h2>
          <p>Each move leaves a trail. Routine work can continue. Meaningful uncertainty reaches a boundary, and consequential work returns to review.</p>
          <div class="sp-actions">
            <a class="sp-button sp-button-ghost" href="#boundaries">Inspect the stop lines ${arrow}</a>
          </div>
        </div>
        <div class="snaxk-console" aria-label="Conceptual SNAXK judgement model">
          <div class="snaxk-console-step"><span>01</span><strong>Signal arrives</strong><em>notice</em></div>
          <div class="snaxk-console-step"><span>02</span><strong>Meaning is checked</strong><em>interpret</em></div>
          <div class="snaxk-console-step"><span>03</span><strong>Boundary is applied</strong><em>slow · stop · ask</em></div>
          <div class="snaxk-console-step"><span>04</span><strong>Evidence is carried</strong><em>record</em></div>
          <div class="snaxk-console-step"><span>05</span><strong>Review changes the next move</strong><em>learn</em></div>
        </div>
      </div>
    </section>

    <section class="sp-section" aria-labelledby="loop-detail-title">
      <div class="sp-section-inner">
        <div class="sp-section-heading">
          <p class="sp-eyebrow">Five deliberate moves</p>
          <h2 id="loop-detail-title">Signal, meaning, boundary, reflection, review.</h2>
          <p>The loop is intentionally smaller than the systems around it. Its job is to help people inspect why an agent continued, paused, escalated, or changed course.</p>
        </div>
        <div class="sp-numbered-list">
${loopMarkup}
        </div>
      </div>
    </section>

    <section class="sp-section" id="boundaries">
      <div class="sp-section-inner snaxk-evidence-layout">
        <figure class="snaxk-evidence-image">
          <img src="${escapeHtml(evidenceImage)}" alt="An evidence folio, field map, brass boundary rule, and review markers on a dark table." loading="lazy">
          <figcaption>Evidence before carry-forward</figcaption>
        </figure>
        <div class="snaxk-boundaries">
          <p class="sp-eyebrow">Stop lines</p>
          <h2>A boundary should be visible before it is crossed.</h2>
          <p>Permissions, privacy, safety, spending, publishing and accountability are not exceptions to tidy up later. They are part of the route.</p>
          <ul class="snaxk-boundary-list">
${boundaryMarkup}
          </ul>
        </div>
      </div>
    </section>

    <section class="sp-section snaxk-cao" id="cao">
      <div class="sp-section-inner snaxk-cao-layout">
        <div class="snaxk-cao-copy">
          <p class="sp-eyebrow">Chief Agentic Officer</p>
          <h2>The board needs to inspect the judgement, not just the output.</h2>
          <p>A Chief Agentic Officer needs a clear view of what agentic work exists, who owns it, which boundaries apply, how uncertainty escalates, and what evidence survives after the work is done.</p>
          <div class="sp-actions">
            <a class="sp-button sp-button-dark" href="${escapeHtml(caoPanelHref)}"${outboundAttrsFor(site, "cao_judgement_briefing", caoStage, caoCampaign)}>Read the CAO briefing ${arrow}</a>
            <a class="sp-button" href="${escapeHtml(advisoryHref)}"${outboundAttrsFor(site, caoFeeder.engine_content || "snaxk_engine_interest", advisoryStage, advisoryCampaign)}>Register interest</a>
          </div>
        </div>
        <div class="snaxk-cao-ledger" aria-label="Chief Agentic Officer inspection areas">
          <div><span>01</span><strong>Ownership</strong></div>
          <div><span>02</span><strong>Boundaries</strong></div>
          <div><span>03</span><strong>Evidence</strong></div>
          <div><span>04</span><strong>Escalation</strong></div>
          <div><span>05</span><strong>Measurable trust</strong></div>
        </div>
      </div>
    </section>

    <section class="sp-section sp-dark" id="relationship">
      <div class="sp-section-inner sp-product-relationship">
        <div>
          <p class="sp-eyebrow">Sibling systems</p>
          <h2>${escapeHtml(sibling.title)}</h2>
          <p>${escapeHtml(sibling.body)}</p>
        </div>
        <div class="sp-relationship-rule">
          <span class="sp-eyebrow">Orchistra</span>
          <strong>Keep the work visible. Let judgement decide what happens next.</strong>
          <div class="sp-actions">
            <a class="sp-button sp-button-light" href="${escapeHtml(siblingHref)}"${outboundAttrsFor(site, sibling.content, "source_to_sibling_product", sibling.campaign)}>Visit Orchistra ${arrow}</a>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="sp-footer">
    <div>
      <img class="snaxk-footer-logo" src="${escapeHtml(badge)}" alt="SNAXK">
      <p>A judgement engine for agentic work: signal before action, visible boundaries, and evidence people can inspect.</p>
    </div>
    <div class="sp-footer-col">
      <strong>SNAXK</strong>
      <a href="#approach">Approach</a>
      <a href="#loop">Judgement loop</a>
      <a href="#boundaries">Stop lines</a>
    </div>
    <div class="sp-footer-col">
      <strong>Sibling product</strong>
      <a href="${escapeHtml(siblingHref)}"${outboundAttrsFor(site, "footer_orchistra", "source_to_sibling_product", sibling.campaign)}>Orchistra</a>
      <a href="${escapeHtml(caoPanelHref)}"${outboundAttrsFor(site, "footer_cao_briefing", caoStage, caoCampaign)}>CAO briefing</a>
    </div>
    <div class="sp-footer-col">
      <strong>Contact</strong>
      <a href="${escapeHtml(advisoryHref)}"${outboundAttrsFor(site, "footer_engine_interest", advisoryStage, advisoryCampaign)}>Discuss SNAXK</a>
      <a href="/healthz">Status</a>
    </div>
    <div class="sp-footer-legal">
      <span>${escapeHtml(site.footer_product_line || "A YQUP product")}</span>
      <span>${escapeHtml(site.footer_legal || "Copyright (c) 2026 YQUP Ltd")}</span>
    </div>
  </footer>
</body>
</html>`;
}

function snaxkPageFor(site) {
  return snaxkSiblingPageFor(site);
}

function agenticLeaderPageFor(site) {
  const title = site.title || "Agentic Leader | Learn to lead agentics";
  const summary = site.summary || "A practical field guide for learning how to manage agentic workers.";
  const heroImage = site.hero_image || "https://www.tonywood.org/assets/countryside-hero.jpg";
  const essayUrl = site.secondary_action_url || "https://www.tonywood.org/writing/management-is-the-missing-literacy/";
  const heroEssayUrl = tonywoodWritingUrlFor(site, essayUrl, "hero_read_essay");
  const essayNoteUrl = tonywoodWritingUrlFor(site, essayUrl, "essay_note_read_essay");
  const fieldGuide = site.field_guide || [
    { label: "01", title: "Outcome", body: "Name the north star before asking an agent to move." },
    { label: "02", title: "Role", body: "Say what the agentic is doing and what the human owns." },
    { label: "03", title: "Boundary", body: "Define what it can read, change, publish, spend, remember, or escalate." },
    { label: "04", title: "Evidence", body: "Ask what changed, what is uncertain, and what would make you reject the answer." },
    { label: "05", title: "Cadence", body: "Create a rhythm for exceptions, drift, lessons, and human judgement." },
    { label: "06", title: "Attention", body: "Decide where attention belongs before tools and feeds spend it for you." },
    { label: "07", title: "Escalation", body: "Pause when stakes rise, signals conflict, or authority is unclear." },
  ];
  const firstSteps = site.first_steps || [];
  const harnessCards = site.harness_cards || [
    { title: "See the work", body: "Local files, repos, documents, data, and context are available instead of pasted fragments." },
    { title: "Use real tools", body: "Code, scripts, browsers, checks, data tools, and plugins can be used inside the workflow." },
    { title: "Change the artifact", body: "The agent can update code, reports, pages, documents, and other working outputs." },
    { title: "Verify as you go", body: "Diffs, tests, previews, screenshots, logs, and smoke checks make quality inspectable." },
    { title: "Keep the trail", body: "Prompts, decisions, edits, evidence, and results become reviewable management records." },
  ];
  const harnessLinks = site.harness_links || [
    {
      name: "OpenAI Codex",
      region: "US / global",
      audience: "Coding agent for real engineering work: repos, edits, reviews, parallel tasks, and shipping workflows.",
      url: "https://openai.com/codex/",
    },
    {
      name: "Anthropic Claude Code",
      region: "US / global",
      audience: "Agentic coding system that reads codebases, changes files, uses CLI tools, runs tests, and returns code for review.",
      url: "https://www.anthropic.com/product/claude-code",
    },
    {
      name: "JetBrains Junie",
      region: "Europe / Czech Republic",
      audience: "JetBrains coding agent for IDE and terminal workflows, with project edits, command execution, tests, and approvals.",
      url: "https://www.jetbrains.com/help/ai-assistant/junie-agent.html",
    },
    {
      name: "Mistral Vibe",
      region: "Europe / France",
      audience: "European work and code agent for long-horizon tasks, company knowledge, tools, coding, deployment, and data residency options.",
      url: "https://mistral.ai/products/vibe/",
    },
  ];
  const judgementLoop = site.judgement_loop || [
    { title: "Head", body: "What is the evidence, how strong is it, and what would change our mind?" },
    { title: "Heart", body: "Who is affected, who has not been heard, and where does fairness matter most?" },
    { title: "Gut", body: "What feels off, which weak signals are present, and what could fail?" },
    { title: "Spine", body: "Which rules, rights, thresholds, and accountabilities must hold?" },
    { title: "Core purpose", body: "What human value, organisational purpose, or public good does this serve?" },
  ];
  const scrutinyChecks = site.scrutiny_checks || [
    { title: "Confidence is not certainty", body: "Treat evidence as decision support, not proof." },
    { title: "Power creates blind spots", body: "Use dissent and premortems to reveal what senior instinct may miss." },
    { title: "Fair process keeps respect", body: "People can dislike a decision and still respect how it was made." },
    { title: "Oversight needs authority", body: "A human in the loop needs time, context, and permission to intervene." },
  ];
  const resources = site.resources || [];
  const writingLinks = site.writing_links || [];
  const mapLines = fieldGuide.slice(0, 6);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(summary)}">
${socialMetaTagsFor(site, { title, description: summary })}  <link rel="preload" as="image" href="${escapeHtml(heroImage)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
${matomoScriptTagFor(site)}  <style>
    :root {
      color-scheme: light;
      --ink: #17231e;
      --muted: #5c6a62;
      --paper: #f6f2e8;
      --cream: #fffaf0;
      --field: #24372f;
      --field-2: #3f5b4d;
      --hedge: #8fa787;
      --clay: #b45f3c;
      --sky: #d8e5e4;
      --line: rgba(36, 55, 47, 0.18);
      --white: #fffdf7;
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
      color: var(--ink);
      background: var(--paper);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
      padding: 0 42px;
      color: var(--white);
      background: var(--field);
      border-bottom: 1px solid rgba(255, 253, 247, 0.18);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      font-weight: 860;
    }

    .brand-mark {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(255, 253, 247, 0.32);
      border-radius: 8px;
      background: rgba(255, 253, 247, 0.10);
      font-size: 13px;
      line-height: 1;
    }

    nav {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 22px;
      font-size: 14px;
      font-weight: 780;
    }

    nav a {
      color: rgba(255, 253, 247, 0.86);
      text-decoration: none;
    }

    .hero {
      position: relative;
      min-height: clamp(620px, 82vh, 760px);
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(360px, 520px);
      gap: 42px;
      align-items: center;
      padding: 58px 42px 54px;
      overflow: hidden;
      color: var(--white);
      background:
        linear-gradient(90deg, rgba(23, 35, 30, 0.92) 0%, rgba(23, 35, 30, 0.74) 43%, rgba(23, 35, 30, 0.30) 100%),
        url("${escapeHtml(heroImage)}") center/cover no-repeat,
        linear-gradient(135deg, var(--field), var(--sky));
    }

    .hero::after {
      content: "";
      position: absolute;
      inset: auto 0 0;
      height: 120px;
      background: linear-gradient(0deg, rgba(246, 242, 232, 0.88), transparent);
      pointer-events: none;
    }

    .hero-copy,
    .field-map {
      position: relative;
      z-index: 1;
    }

    .eyebrow {
      margin: 0 0 16px;
      color: var(--clay);
      font-size: 13px;
      line-height: 1.2;
      font-weight: 860;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    .hero .eyebrow {
      color: #f0c9aa;
    }

    h1,
    h2 {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      font-weight: 760;
      letter-spacing: 0;
    }

    h1 {
      max-width: 11ch;
      font-size: clamp(48px, 7vw, 84px);
      line-height: 0.96;
    }

    h2 {
      font-size: clamp(34px, 4vw, 54px);
      line-height: 1.06;
    }

    h3 {
      margin: 0;
      font-size: 20px;
      line-height: 1.2;
      letter-spacing: 0;
    }

    .lede {
      max-width: 720px;
      margin: 24px 0 0;
      color: rgba(255, 253, 247, 0.86);
      font-size: clamp(18px, 2vw, 22px);
      line-height: 1.52;
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
      border: 1px solid var(--white);
      border-radius: 6px;
      background: var(--white);
      color: var(--field);
      text-decoration: none;
      font-weight: 840;
    }

    .button.secondary {
      background: rgba(255, 253, 247, 0.10);
      color: var(--white);
    }

    .field-map {
      min-height: 430px;
      padding: 22px;
      border: 1px solid rgba(255, 253, 247, 0.28);
      border-radius: 8px;
      background: linear-gradient(135deg, rgba(255, 253, 247, 0.94), rgba(232, 238, 224, 0.92));
      color: var(--ink);
      box-shadow: 0 24px 70px rgba(11, 21, 18, 0.28);
    }

    .map-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--line);
      font-size: 13px;
      font-weight: 860;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    .map-grid {
      position: relative;
      min-height: 310px;
      margin-top: 18px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .map-grid::before {
      content: "";
      position: absolute;
      inset: 34px 24px 38px;
      border: 2px solid rgba(143, 167, 135, 0.72);
      border-radius: 50%;
      transform: rotate(-10deg);
      pointer-events: none;
    }

    .map-node {
      position: relative;
      min-height: 94px;
      display: grid;
      align-content: start;
      gap: 7px;
      padding: 14px;
      border: 1px solid rgba(36, 55, 47, 0.16);
      border-radius: 8px;
      background: rgba(255, 250, 240, 0.88);
    }

    .map-node span,
    .loop-card span,
    .scrutiny-card span,
    .harness-card span,
    .resource span,
    .writing span {
      color: var(--clay);
      font-size: 12px;
      font-weight: 860;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    .map-node strong {
      font-size: 17px;
      line-height: 1.2;
    }

    .map-node p {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.45;
    }

    .section {
      padding: 66px 42px;
      border-bottom: 1px solid var(--line);
    }

    .section-inner {
      width: min(1180px, 100%);
      margin: 0 auto;
    }

    .split {
      display: grid;
      grid-template-columns: minmax(0, 0.85fr) minmax(420px, 1fr);
      gap: 42px;
      align-items: start;
    }

    .lead {
      margin: 18px 0 0;
      color: var(--muted);
      font-size: 19px;
      line-height: 1.58;
    }

    .guide-grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 10px;
      margin-top: 30px;
    }

    .guide-card,
    .loop-card,
    .scrutiny-card,
    .harness-card,
    .step,
    .resource,
    .writing {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--cream);
    }

    .guide-card {
      min-height: 196px;
      padding: 16px;
    }

    .loop-grid,
    .scrutiny-grid,
    .harness-grid {
      display: grid;
      gap: 12px;
      margin-top: 30px;
    }

    .loop-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .scrutiny-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .harness-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .loop-card,
    .scrutiny-card,
    .harness-card {
      min-height: 188px;
      padding: 18px;
    }

    .loop-card {
      background: #fbf7ea;
    }

    .scrutiny-card {
      background: #eef3ed;
    }

    .harness-card {
      background: var(--white);
    }

    .harness-links {
      margin-top: 42px;
    }

    .harness-links h3 {
      margin-top: 0;
    }

    .guide-card span {
      display: block;
      margin-bottom: 34px;
      color: var(--field-2);
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 13px;
      font-weight: 840;
    }

    .loop-card span,
    .scrutiny-card span,
    .harness-card span {
      display: block;
      margin-bottom: 24px;
    }

    .guide-card p,
    .loop-card p,
    .scrutiny-card p,
    .harness-card p,
    .step p,
    .resource p,
    .writing p,
    .essay-note p {
      margin: 10px 0 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.55;
    }

    .steps {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
      margin-top: 30px;
    }

    .step {
      min-height: 160px;
      padding: 18px;
      background: #fbf7ea;
    }

    .quote-band {
      background: var(--field);
      color: var(--white);
    }

    .quote-panel {
      max-width: 920px;
    }

    .quote-panel h2 {
      color: var(--white);
    }

    .quote-panel p {
      color: rgba(255, 253, 247, 0.82);
    }

    .resources-grid,
    .writing-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-top: 30px;
    }

    .resource,
    .writing {
      min-height: 180px;
      display: grid;
      align-content: start;
      padding: 18px;
      text-decoration: none;
      transition: border-color 160ms ease, transform 160ms ease;
    }

    .resource:hover,
    .writing:hover {
      border-color: rgba(180, 95, 60, 0.72);
      transform: translateY(-2px);
    }

    .resource h3,
    .writing h3 {
      margin-top: 16px;
    }

    .resource small {
      display: block;
      margin-top: 10px;
      color: #66756d;
      font-size: 13px;
      line-height: 1.4;
    }

    .essay-note {
      padding: 24px;
      border-left: 4px solid var(--clay);
      background: #efe7d4;
    }

    .essay-note h2 {
      font-size: clamp(30px, 3.5vw, 44px);
    }

    .footer {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      padding: 30px 42px;
      background: #17231e;
      color: rgba(255, 253, 247, 0.78);
      font-size: 14px;
      line-height: 1.5;
    }

    .footer strong {
      display: block;
      color: var(--white);
    }

    @media (max-width: 1100px) {
      .hero,
      .split {
        grid-template-columns: 1fr;
      }

      .field-map {
        min-height: auto;
      }

      .guide-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .loop-grid,
      .scrutiny-grid,
      .harness-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .steps,
      .resources-grid,
      .writing-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 720px) {
      .site-header {
        min-height: auto;
        align-items: flex-start;
        flex-direction: column;
        padding: 18px 22px;
      }

      nav {
        width: 100%;
        flex-wrap: wrap;
        gap: 14px;
      }

      .hero {
        min-height: auto;
        padding: 48px 22px 42px;
      }

      .field-map {
        display: none;
      }

      .section {
        padding: 48px 22px;
      }

      .actions,
      .button {
        width: 100%;
      }

      .map-grid,
      .guide-grid,
      .loop-grid,
      .scrutiny-grid,
      .harness-grid,
      .steps,
      .resources-grid,
      .writing-grid {
        grid-template-columns: 1fr;
      }

      .map-grid::before {
        display: none;
      }

      .footer {
        flex-direction: column;
        padding: 26px 22px;
      }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="${escapeHtml(site.name)} home">
      <span class="brand-mark">AL</span>
      <span>${escapeHtml(site.name)}</span>
    </a>
    <nav aria-label="Primary">
      <a href="#field-guide">Field guide</a>
      <a href="#judgement">Judgement</a>
      <a href="#scrutiny">Scrutiny</a>
      <a href="#first-steps">First steps</a>
      <a href="#harnesses">Harnesses</a>
      <a href="#resources">Resources</a>
    </nav>
  </header>

  <main>
    <section class="hero" aria-labelledby="page-title">
      <div class="hero-copy">
        <p class="eyebrow">${escapeHtml(site.eyebrow || "Field guide for agentic leadership")}</p>
        <h1 id="page-title">${escapeHtml(site.heading || "Learn to lead agentics.")}</h1>
        <p class="lede">${escapeHtml(summary)}</p>
        <div class="actions">
          <a class="button" href="#field-guide">${escapeHtml(site.primary_action_label || "Start with the field guide")}</a>
          <a class="button secondary" href="${escapeHtml(heroEssayUrl)}"${funnelAttrsFor(site, "hero_read_essay", "source_to_tonywood_writing")}>${escapeHtml(site.secondary_action_label || "Read the essay")}</a>
        </div>
      </div>

      <aside class="field-map" aria-label="Agentic leadership field map">
        <div class="map-top">
          <span>Leadership map</span>
          <span>human judgement on</span>
        </div>
        <div class="map-grid">
          ${mapLines.map((item) => `<article class="map-node">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.body)}</p>
          </article>`).join("\n          ")}
        </div>
      </aside>
    </section>

    <section class="section" aria-labelledby="shift-title">
      <div class="section-inner split">
        <div>
          <p class="eyebrow">${escapeHtml(site.brief_eyebrow || "The shift")}</p>
          <h2 id="shift-title">${escapeHtml(site.brief_title || "AI changes work from doing to directing.")}</h2>
        </div>
        <div>
          <p class="lead">${escapeHtml(site.brief || "When people use AI well, they set intent, shape tasks, judge quality, check evidence, protect attention, and stay responsible for what goes out into the world.")}</p>
          <p class="lead">${escapeHtml(site.brief_support || "That is management. Not management as hierarchy, but management as a human literacy.")}</p>
        </div>
      </div>
    </section>

    <section class="section" id="field-guide" aria-labelledby="guide-title">
      <div class="section-inner">
        <p class="eyebrow">Field guide</p>
        <h2 id="guide-title">The seven moves of an agentic leader.</h2>
        <p class="lead">Use these as a practical check before giving an agentic worker more autonomy, more context, or more trust.</p>
        <div class="guide-grid">
          ${fieldGuide.map((item) => `<article class="guide-card">
            <span>${escapeHtml(item.label)}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
          </article>`).join("\n          ")}
        </div>
      </div>
    </section>

    <section class="section" id="judgement" aria-labelledby="judgement-title">
      <div class="section-inner">
        <p class="eyebrow">Judgement loop</p>
        <h2 id="judgement-title">Evidence is decision support, not certainty.</h2>
        <p class="lead">Use this loop before widening autonomy, accepting high-confidence output, or moving from recommendation to decision.</p>
        <div class="loop-grid">
          ${judgementLoop.map((item, index) => `<article class="loop-card">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
          </article>`).join("\n          ")}
        </div>
      </div>
    </section>

    <section class="section" id="scrutiny" aria-labelledby="scrutiny-title">
      <div class="section-inner">
        <p class="eyebrow">Decisions under scrutiny</p>
        <h2 id="scrutiny-title">The larger the consequence, the stronger the evidence and process should be.</h2>
        <p class="lead">Agentic work speeds up decisions. Leadership is making the uncertainty, accountability, blind spots, and review path visible before speed amplifies weak judgement.</p>
        <div class="scrutiny-grid">
          ${scrutinyChecks.map((item) => `<article class="scrutiny-card">
            <span>Check</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
          </article>`).join("\n          ")}
        </div>
      </div>
    </section>

    <section class="section quote-band" aria-labelledby="thinking-title">
      <div class="section-inner quote-panel">
        <p class="eyebrow">Attention and agency</p>
        <h2 id="thinking-title">The work has to contain you.</h2>
        <p class="lead">If all a person does is click the button and accept what comes back, they are not in the loop. The value is in the judgement: what they asked, what they rejected, what evidence changed their mind, and where they chose to put attention.</p>
      </div>
    </section>

    <section class="section" id="first-steps" aria-labelledby="steps-title">
      <div class="section-inner">
        <p class="eyebrow">First steps</p>
        <h2 id="steps-title">Start small, but manage the work properly.</h2>
        <p class="lead">This is not about banning AI or pretending it is magic. It is about showing people how to use it well enough that their own thinking becomes more visible.</p>
        <div class="steps">
          ${firstSteps.map((step) => `<article class="step">
            <h3>${escapeHtml(step.title)}</h3>
            <p>${escapeHtml(step.body)}</p>
          </article>`).join("\n          ")}
        </div>
      </div>
    </section>

    <section class="section" id="harnesses" aria-labelledby="harness-title">
      <div class="section-inner">
        <p class="eyebrow">Work harnesses</p>
        <h2 id="harness-title">Move out of chat and into the harness.</h2>
        <p class="lead">A chat can produce words. A harness lets an agentic worker see the work, use tools, change files, run checks, create reports, and bring evidence back for review.</p>
        <div class="harness-grid">
          ${harnessCards.map((card, index) => `<article class="harness-card">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <h3>${escapeHtml(card.title)}</h3>
            <p>${escapeHtml(card.body)}</p>
          </article>`).join("\n          ")}
        </div>
        <div class="harness-links" aria-labelledby="harness-links-title">
          <p class="eyebrow">Starter harness links</p>
          <h3 id="harness-links-title">Places to inspect the pattern.</h3>
          <p class="lead">The important question is not which logo wins. Ask what work it can see, what tools it can use, what it can change, how it verifies, and what evidence it leaves behind.</p>
          <div class="resources-grid">
            ${harnessLinks.map((link) => `<a class="resource" href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">
              <span>${escapeHtml(link.region)}</span>
              <h3>${escapeHtml(link.name)}</h3>
              <p>${escapeHtml(link.audience)}</p>
              <small>Open official page</small>
            </a>`).join("\n            ")}
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="resources" aria-labelledby="resources-title">
      <div class="section-inner">
        <p class="eyebrow">Curated starter resources</p>
        <h2 id="resources-title">Useful places to begin in your country, organisation, school, or team.</h2>
        <p class="lead">This is a starter map, not a giant database. The point is to help leaders and managers find credible first routes into AI literacy, education guidance, and management literacy.</p>
        <div class="resources-grid">
          ${resources.map((resource) => `<a class="resource" href="${escapeHtml(resource.url)}" target="_blank" rel="noreferrer">
            <span>${escapeHtml(resource.region)}</span>
            <h3>${escapeHtml(resource.name)}</h3>
            <p>${escapeHtml(resource.audience)}</p>
            <small>Open resource</small>
          </a>`).join("\n          ")}
        </div>
      </div>
    </section>

    <section class="section" id="writing" aria-labelledby="writing-title">
      <div class="section-inner split">
        <div class="essay-note">
          <p class="eyebrow">Follow-on essay</p>
          <h2 id="writing-title">Management is the missing literacy.</h2>
          <p>The canonical essay lives on Tonywood.org and makes the deeper argument: we should teach people how to manage themselves, tools, tasks, attention, risk, evidence, and outcomes.</p>
          <div class="actions">
            <a class="button" href="${escapeHtml(essayNoteUrl)}"${funnelAttrsFor(site, "essay_note_read_essay", "source_to_tonywood_writing")}>Read the essay</a>
          </div>
        </div>
        <div>
          <p class="eyebrow">Tony's writing</p>
          <h2>Four pieces behind the field guide.</h2>
          <div class="writing-grid">
            ${writingLinks.map((link) => `<a class="writing" href="${escapeHtml(tonywoodWritingUrlFor(site, link.url, slugForCampaign(link.title)))}"${funnelAttrsFor(site, slugForCampaign(link.title), "source_to_tonywood_writing")}>
              <span>Tonywood.org</span>
              <h3>${escapeHtml(link.title)}</h3>
              <p>${escapeHtml(link.body)}</p>
            </a>`).join("\n            ")}
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div>
      <strong>${escapeHtml(site.name)}</strong>
      <div>${escapeHtml(site.domain)}</div>
    </div>
    <div>Outcomes, boundaries, evidence, cadence, attention, escalation, and human judgement.</div>
  </footer>
</body>
</html>
`;
}

function aiOperationsPageFor(site) {
  const title = site.title || "AIperations";
  const summary = site.summary || "Practical operating discipline for AI in real work.";
  const email = site.contact?.email || "hello@aiperations.com";
  const fallbackContactHref = site.contact?.form_url
    || `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("AI operations review")}`;
  const heroReviewHref = tonywoodFunnelUrlFor(site, "hero_review_workflow") || fallbackContactHref;
  const finalReviewHref = tonywoodFunnelUrlFor(site, "final_review_workflow") || fallbackContactHref;
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
${socialMetaTagsFor(site, { title, description: summary })}  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
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
          <a class="button" href="${escapeHtml(heroReviewHref)}"${funnelAttrsFor(site, "hero_review_workflow")}>Review an AI workflow</a>
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
        <a class="button" href="${escapeHtml(finalReviewHref)}"${funnelAttrsFor(site, "final_review_workflow")}>Review an AI workflow</a>
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
  const fallbackRequestHref = `mailto:${email}?subject=Agentic%20URL%20request`;
  const heroRequestHref = tonywoodFunnelUrlFor(site, "hero_agentic_url_request") || fallbackRequestHref;
  const finalRequestHref = tonywoodFunnelUrlFor(site, "final_agentic_url_request") || fallbackRequestHref;
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
${socialMetaTagsFor(site, { title, description: summary })}  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
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
          <a class="button" href="${escapeHtml(heroRequestHref)}"${funnelAttrsFor(site, "hero_agentic_url_request")}>Request an agentic URL</a>
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
      <a class="button" href="${escapeHtml(finalRequestHref)}"${funnelAttrsFor(site, "final_agentic_url_request")}>Request a room</a>
    </section>
  </main>
</body>
</html>`;
}

function orchistraSiblingPageFor(site) {
  const title = site.title || "Orchistra | The company operating system for people and AI agents";
  const summary = site.summary || "Turn leadership direction into coordinated action across people, AI agents, and existing systems.";
  const heroImage = site.hero_background_image || "/assets/orchistra/hero-conservatory.webp";
  const heroImageMobile = site.hero_background_image_mobile || heroImage;
  const productImage = site.hero_product_image || "/assets/orchistra/hero-console.webp";
  const productImageMobile = site.hero_product_image_mobile || productImage;
  const fieldImage = site.hero_image || "/assets/orchistra/countryside-field.webp";
  const outcomes = site.outcomes || [];
  const companyFlow = site.company_flow || [];
  const operatingModes = site.operating_modes || [];
  const systemsBoundary = site.systems_boundary || {};
  const progressStory = site.progress_story || {};
  const progressItems = progressStory.items || [];
  const cao = site.cao_feeder || {};
  const caoUrl = cao.primary_url || "https://chiefagenticofficer.com/#briefing-signup";
  const caoCampaign = cao.primary_campaign || "orchistra_to_chiefagenticofficer_briefing";
  const caoStage = cao.primary_stage || "source_to_chiefagenticofficer_briefing";
  const caoContent = cao.primary_content || "feeder_cao_briefing";
  const caoHref = trackedOutboundUrlFor(site, caoUrl, caoContent, caoCampaign) || caoUrl;
  const advisoryUrl = cao.secondary_url || defaultTonywoodAdvisoryUrl;
  const advisoryCampaign = cao.secondary_campaign || "orchistra_platform_interest_to_tonywood_advisory";
  const advisoryStage = cao.secondary_stage || "source_to_tonywood_platform_interest";
  const advisoryContent = cao.secondary_content || "feeder_platform_interest";
  const advisoryHref = trackedOutboundUrlFor(site, advisoryUrl, advisoryContent, advisoryCampaign) || advisoryUrl;
  const productInterestContent = "product_view_interest";
  const productInterestHref = trackedOutboundUrlFor(site, advisoryUrl, productInterestContent, advisoryCampaign) || advisoryUrl;
  const finalInterestContent = "final_platform_interest_cta";
  const finalInterestHref = trackedOutboundUrlFor(site, advisoryUrl, finalInterestContent, advisoryCampaign) || advisoryUrl;
  const sibling = site.sibling_product || {
    name: "SNAXK",
    url: "https://snaxk.com/",
    campaign: "orchistra_to_snaxk",
    content: "sibling_snaxk",
    title: "Coordination needs judgement beside it.",
    body: "Orchistra keeps agent work visible and coordinated. SNAXK helps decide what should happen next: proceed, pause, stop, or return to a human.",
  };
  const siblingHref = trackedOutboundUrlFor(site, sibling.url, sibling.content, sibling.campaign) || sibling.url;
  const arrow = siblingArrowIcon();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(summary)}">
${socialMetaTagsFor(site, { title, description: summary })}  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="${escapeHtml(heroImage)}" as="image" fetchpriority="high">
  <link rel="preload" href="/assets/system/instrument-sans-latin-variable.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/system/newsreader-latin-variable.woff2" as="font" type="font/woff2" crossorigin>
${matomoScriptTagFor(site)}  <style>
${siblingProductSharedStyles().trim()}
    :root {
      --sp-accent: #d2ae63;
      --sp-accent-dark: #376f66;
      --orchistra-green: #163a32;
      --orchistra-green-light: #d9e7df;
      --orchistra-sky: #a9ced8;
      --orchistra-brass: #caa65c;
      --orchistra-signal: #d4674f;
    }

    .orchistra-mark {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(255, 253, 247, 0.56);
      border-radius: 50%;
      color: var(--sp-white);
      font-family: var(--sp-serif);
      font-size: 25px;
      font-weight: 500;
      box-shadow: inset 0 0 0 5px rgba(255, 253, 247, 0.06);
    }

    .orchistra-hero {
      --sp-hero-image: url("${escapeHtml(heroImage)}");
      --sp-hero-mobile-image: url("${escapeHtml(heroImageMobile)}");
    }

    .orchistra-hero .sp-hero-inner {
      max-width: 940px;
    }

    .orchistra-hero h1 {
      max-width: none;
      font-size: clamp(76px, 11vw, 156px);
    }

    .orchistra-hero-statement {
      margin: -8px 0 0;
      color: var(--sp-white);
      font-family: var(--sp-serif);
      font-size: clamp(31px, 4vw, 56px);
      font-weight: 380;
      line-height: 1;
    }

    .orchistra-modes-section {
      background: #f1ede2;
    }

    .orchistra-modes {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      border-top: 1px solid var(--sp-line);
      border-left: 1px solid var(--sp-line);
    }

    .orchistra-mode {
      min-height: 360px;
      display: grid;
      align-content: space-between;
      gap: 54px;
      padding: clamp(30px, 5vw, 64px);
      border-right: 1px solid var(--sp-line);
      border-bottom: 1px solid var(--sp-line);
    }

    .orchistra-mode > span,
    .orchistra-flow-step small,
    .orchistra-progress-label {
      color: var(--sp-accent-dark);
      font-size: 11px;
      font-weight: 780;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .orchistra-mode h3 {
      max-width: 16ch;
      margin: 0 0 14px;
      font-family: var(--sp-serif);
      font-size: clamp(34px, 4vw, 54px);
      font-weight: 440;
      line-height: 1;
    }

    .orchistra-mode p {
      max-width: 56ch;
      margin: 0;
      color: var(--sp-muted);
      font-size: 18px;
    }

    .orchistra-flow {
      display: grid;
      grid-template-columns: minmax(300px, 0.72fr) minmax(0, 1.28fr);
      gap: clamp(44px, 8vw, 118px);
      align-items: start;
    }

    .orchistra-flow-copy {
      position: sticky;
      top: 36px;
    }

    .orchistra-flow-copy h2 {
      margin: 12px 0 18px;
      font-family: var(--sp-serif);
      font-size: clamp(44px, 5.8vw, 77px);
      font-weight: 430;
      line-height: 0.98;
    }

    .orchistra-flow-copy p:last-of-type {
      color: rgba(255, 253, 247, 0.68);
      font-size: 19px;
    }

    .orchistra-flow-list {
      border-top: 1px solid rgba(255, 253, 247, 0.18);
    }

    .orchistra-flow-step {
      position: relative;
      display: grid;
      grid-template-columns: 48px 1fr;
      gap: 18px;
      padding: 28px 0 32px;
      border-bottom: 1px solid rgba(255, 253, 247, 0.18);
    }

    .orchistra-flow-step::after {
      content: "";
      position: absolute;
      left: 18px;
      top: 70px;
      bottom: -15px;
      width: 1px;
      background: rgba(169, 206, 216, 0.38);
    }

    .orchistra-flow-step:last-child::after {
      display: none;
    }

    .orchistra-flow-step > span {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(169, 206, 216, 0.62);
      border-radius: 50%;
      color: var(--orchistra-sky);
      font-size: 11px;
      font-weight: 760;
    }

    .orchistra-flow-step h3 {
      margin: 6px 0 6px;
      font-family: var(--sp-serif);
      font-size: clamp(28px, 3.2vw, 40px);
      font-weight: 460;
      line-height: 1.04;
    }

    .orchistra-flow-step small {
      color: var(--orchistra-sky);
    }

    .orchistra-flow-step p {
      max-width: 620px;
      margin: 0;
      color: rgba(255, 253, 247, 0.62);
    }

    .orchistra-product {
      background: #dce8e3;
    }

    .orchistra-product-layout {
      display: grid;
      grid-template-columns: minmax(350px, 0.78fr) minmax(0, 1.22fr);
      gap: clamp(44px, 7vw, 94px);
      align-items: center;
    }

    .orchistra-product-copy h2 {
      margin: 12px 0 18px;
      font-family: var(--sp-serif);
      font-size: clamp(43px, 5.6vw, 76px);
      font-weight: 430;
      line-height: 0.98;
    }

    .orchistra-product-copy > p {
      color: #44534e;
      font-size: 19px;
    }

    .orchistra-product-figure {
      position: relative;
      min-height: 580px;
      margin: 0;
      display: grid;
      place-items: center;
      padding: clamp(22px, 4vw, 54px);
      background:
        linear-gradient(145deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.12)),
        var(--orchistra-green);
      box-shadow: 0 35px 90px rgba(22, 58, 50, 0.23);
      overflow: hidden;
    }

    .orchistra-product-figure::before {
      content: "";
      position: absolute;
      inset: 0;
      background-image: url("${escapeHtml(fieldImage)}");
      background-position: center;
      background-size: cover;
      opacity: 0.16;
      mix-blend-mode: luminosity;
    }

    .orchistra-product-picture {
      position: relative;
      z-index: 1;
      width: 100%;
    }

    .orchistra-product-picture img {
      width: 100%;
      display: block;
      filter: drop-shadow(0 26px 40px rgba(0, 0, 0, 0.32));
    }

    .orchistra-product-figure figcaption {
      position: absolute;
      z-index: 2;
      left: 22px;
      bottom: 18px;
      color: rgba(255, 253, 247, 0.68);
      font-size: 10px;
      font-weight: 760;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .orchistra-outcomes {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      border-top: 1px solid var(--sp-line);
      border-left: 1px solid var(--sp-line);
    }

    .orchistra-outcome {
      min-height: 300px;
      display: grid;
      align-content: space-between;
      gap: 34px;
      padding: clamp(28px, 4.5vw, 54px);
      border-right: 1px solid var(--sp-line);
      border-bottom: 1px solid var(--sp-line);
    }

    .orchistra-outcome span {
      color: var(--sp-accent-dark);
      font-size: 11px;
      font-weight: 780;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .orchistra-outcome h3 {
      margin: 0 0 10px;
      font-family: var(--sp-serif);
      font-size: clamp(31px, 3.8vw, 48px);
      font-weight: 450;
      line-height: 1.03;
    }

    .orchistra-outcome p {
      margin: 0;
      color: var(--sp-muted);
    }

    .orchistra-systems {
      color: var(--sp-white);
      background: #10231e;
    }

    .orchistra-systems-layout {
      display: grid;
      grid-template-columns: minmax(320px, 0.82fr) minmax(0, 1.18fr);
      gap: clamp(46px, 8vw, 120px);
      align-items: end;
    }

    .orchistra-systems h2 {
      margin: 12px 0 18px;
      font-family: var(--sp-serif);
      font-size: clamp(43px, 5.8vw, 76px);
      font-weight: 430;
      line-height: 0.98;
    }

    .orchistra-systems p {
      margin: 0;
      color: rgba(255, 253, 247, 0.7);
      font-size: 19px;
    }

    .orchistra-system-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin: 0;
      padding: 0;
      border-top: 1px solid rgba(255, 253, 247, 0.2);
      list-style: none;
    }

    .orchistra-system-list li {
      min-height: 82px;
      display: flex;
      align-items: center;
      padding: 18px 20px;
      border-right: 1px solid rgba(255, 253, 247, 0.2);
      border-bottom: 1px solid rgba(255, 253, 247, 0.2);
      color: rgba(255, 253, 247, 0.82);
      font-weight: 680;
    }

    .orchistra-progress {
      background: #eef3ef;
    }

    .orchistra-progress-list {
      border-top: 1px solid var(--sp-line);
    }

    .orchistra-progress-item {
      display: grid;
      grid-template-columns: minmax(120px, 0.34fr) minmax(220px, 0.72fr) minmax(0, 1fr);
      gap: clamp(24px, 5vw, 72px);
      align-items: start;
      padding: 34px 0;
      border-bottom: 1px solid var(--sp-line);
    }

    .orchistra-progress-item h3 {
      margin: 0;
      font-family: var(--sp-serif);
      font-size: clamp(29px, 3vw, 42px);
      font-weight: 450;
      line-height: 1.04;
    }

    .orchistra-progress-item p {
      margin: 0;
      color: var(--sp-muted);
      font-size: 17px;
    }

    .orchistra-progress-note {
      max-width: 88ch;
      margin: 28px 0 0;
      color: var(--sp-muted);
      font-size: 14px;
    }

    .orchistra-cao {
      position: relative;
      isolation: isolate;
      color: var(--sp-white);
      background: var(--orchistra-green);
      overflow: hidden;
    }

    .orchistra-cao::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: -1;
      background-image:
        linear-gradient(90deg, rgba(6, 18, 15, 0.92), rgba(6, 18, 15, 0.5)),
        url("${escapeHtml(fieldImage)}");
      background-position: center;
      background-size: cover;
    }

    .orchistra-cao-inner {
      min-height: 580px;
      display: grid;
      align-content: center;
      max-width: 830px;
    }

    .orchistra-cao h2 {
      margin: 12px 0 18px;
      font-family: var(--sp-serif);
      font-size: clamp(44px, 6vw, 82px);
      font-weight: 430;
      line-height: 0.96;
    }

    .orchistra-cao p {
      max-width: 690px;
      color: rgba(255, 253, 247, 0.76);
      font-size: 20px;
    }

    .orchistra-final-cta {
      color: #15221e;
      background: var(--orchistra-brass);
    }

    .orchistra-final-cta-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: clamp(38px, 8vw, 120px);
      align-items: end;
    }

    .orchistra-final-cta h2 {
      max-width: 15ch;
      margin: 12px 0 18px;
      font-family: var(--sp-serif);
      font-size: clamp(46px, 6.3vw, 88px);
      font-weight: 430;
      line-height: 0.96;
    }

    .orchistra-final-cta p {
      max-width: 690px;
      margin: 0;
      color: rgba(21, 34, 30, 0.78);
      font-size: 19px;
    }

    .orchistra-footer-mark {
      width: 52px;
      height: 52px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(255, 253, 247, 0.52);
      border-radius: 50%;
      font-family: var(--sp-serif);
      font-size: 28px;
    }

    @media (max-width: 920px) {
      .orchistra-flow,
      .orchistra-product-layout,
      .orchistra-systems-layout,
      .orchistra-final-cta-layout {
        grid-template-columns: 1fr;
      }

      .orchistra-flow-copy {
        position: static;
      }

      .orchistra-progress-item {
        grid-template-columns: minmax(110px, 0.32fr) minmax(0, 1fr);
      }

      .orchistra-progress-item p {
        grid-column: 2;
      }
    }

    @media (max-width: 680px) {
      .orchistra-mark {
        width: 38px;
        height: 38px;
        font-size: 22px;
      }

      .orchistra-hero h1 {
        font-size: clamp(54px, 17vw, 72px);
        overflow-wrap: normal;
        white-space: nowrap;
      }

      .orchistra-hero-statement {
        font-size: clamp(29px, 9vw, 43px);
      }

      .orchistra-product-figure {
        min-height: 410px;
      }

      .orchistra-product-picture source,
      .orchistra-product-picture img {
        width: 100%;
      }

      .orchistra-outcomes {
        grid-template-columns: 1fr;
      }

      .orchistra-modes,
      .orchistra-system-list,
      .orchistra-progress-item {
        grid-template-columns: 1fr;
      }

      .orchistra-mode {
        min-height: 310px;
      }

      .orchistra-progress-item {
        gap: 12px;
      }

      .orchistra-progress-item p {
        grid-column: auto;
      }
    }
  </style>
</head>
<body class="orchistra-sibling">
  <header class="sp-header">
    <a class="sp-brand" href="/" aria-label="Orchistra home">
      <span class="orchistra-mark" aria-hidden="true">O</span>
      <span class="sp-brand-copy"><strong>Orchistra</strong><span>Company operating system</span></span>
    </a>
    <nav class="sp-nav" aria-label="Primary navigation">
      <a href="#flow">Model</a>
      <a href="#modes">Ways to begin</a>
      <a href="#product">Product</a>
      <a href="#outcomes">Outcomes</a>
      <a href="#progress">Progress</a>
      <a class="sp-nav-cta" href="${escapeHtml(advisoryHref)}"${outboundAttrsFor(site, advisoryContent, advisoryStage, advisoryCampaign)}>Discuss Orchistra</a>
    </nav>
    <details class="sp-mobile-nav">
      <summary aria-label="Open navigation">Menu</summary>
      <div class="sp-mobile-nav-menu">
        <a href="#flow">Model</a>
        <a href="#modes">Ways to begin</a>
        <a href="#product">Product</a>
        <a href="#outcomes">Outcomes</a>
        <a href="#progress">Progress</a>
        <a href="${escapeHtml(advisoryHref)}"${outboundAttrsFor(site, advisoryContent, advisoryStage, advisoryCampaign)}>Discuss Orchistra</a>
      </div>
    </details>
  </header>

  <main>
    <section class="sp-hero orchistra-hero" aria-labelledby="orchistra-title">
      <div class="sp-hero-inner sp-reveal">
        <p class="sp-eyebrow">${escapeHtml(site.eyebrow || "Company operating system")}</p>
        <h1 id="orchistra-title">Orchistra</h1>
        <p class="orchistra-hero-statement">Run a company where people and AI agents move as one.</p>
        <p class="sp-hero-lede">${escapeHtml(summary)}</p>
        <div class="sp-actions">
          <a class="sp-button sp-button-light" href="#flow">See how Orchistra works ${arrow}</a>
          <a class="sp-button sp-button-ghost" href="${escapeHtml(advisoryHref)}"${outboundAttrsFor(site, advisoryContent, advisoryStage, advisoryCampaign)}>Discuss Orchistra</a>
        </div>
      </div>
    </section>

    <section class="sp-intro-rail" aria-label="Orchistra operating outcomes">
      <div><strong>Turn direction into momentum.</strong></div>
      <div><span>Priorities people<br>and agents can act on</span></div>
      <div><span>Leadership at the<br>moments that matter</span></div>
      <div><span>Evidence that improves<br>the next cycle</span></div>
    </section>

    <section class="sp-section sp-dark" id="flow">
      <div class="sp-section-inner orchistra-flow">
        <div class="orchistra-flow-copy">
          <p class="sp-eyebrow">Company model</p>
          <h2>Set the direction. Let the company move. Keep control.</h2>
          <p>Orchistra connects leadership intent to goals, recurring operations, exceptions, human judgement, agent execution, and evidence, so the company can move without losing accountability.</p>
        </div>
        <div class="orchistra-flow-list">
          ${companyFlow.map((step, index) => `<article class="orchistra-flow-step"><span>${String(index + 1).padStart(2, "0")}</span><div><small>${escapeHtml(step.label)}</small><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.body)}</p></div></article>`).join("")}
        </div>
      </div>
    </section>

    <section class="sp-section orchistra-modes-section" id="modes">
      <div class="sp-section-inner">
        <div class="sp-section-heading">
          <p class="sp-eyebrow">Two ways to begin</p>
          <h2>Start with one operating problem. Grow into the whole company.</h2>
          <p>Use Orchistra to direct a highly agentic company from a small leadership team, or introduce agents into an established organisation without weakening human responsibility.</p>
        </div>
        <div class="orchistra-modes">
          ${operatingModes.map((mode) => `<article class="orchistra-mode"><span>${escapeHtml(mode.label)}</span><div><h3>${escapeHtml(mode.title)}</h3><p>${escapeHtml(mode.body)}</p></div></article>`).join("")}
        </div>
      </div>
    </section>

    <section class="sp-section orchistra-product" id="product">
      <div class="sp-section-inner orchistra-product-layout">
        <div class="orchistra-product-copy">
          <p class="sp-eyebrow">Human control surface</p>
          <h2>Know what is moving, what is blocked, and what needs you.</h2>
          <p>Direction, goals, processes, requests, work orders, receipts, and decisions stay attached to one operating picture. Leaders get the context to decide without becoming the manual relay for every agent.</p>
          <div class="sp-actions">
            <a class="sp-button sp-button-dark" href="${escapeHtml(productInterestHref)}"${outboundAttrsFor(site, productInterestContent, advisoryStage, advisoryCampaign)}>Discuss Orchistra ${arrow}</a>
          </div>
        </div>
        <figure class="orchistra-product-figure">
          <picture class="orchistra-product-picture">
            <source media="(max-width: 680px)" srcset="${escapeHtml(productImageMobile)}">
            <img src="${escapeHtml(productImage)}" alt="Illustrative Orchistra workspace showing company work, a human review request, and recorded evidence." loading="lazy">
          </picture>
          <figcaption>Illustrative Orchistra workspace</figcaption>
        </figure>
      </div>
    </section>

    <section class="sp-section" id="outcomes">
      <div class="sp-section-inner">
        <div class="sp-section-heading">
          <p class="sp-eyebrow">Company outcomes</p>
          <h2>Everything leadership needs to turn AI into company performance.</h2>
          <p>Connect direction, responsibility, work, authority, evidence, and improvement so useful AI becomes part of how the company performs, not another experiment leaders have to chase.</p>
        </div>
        <div class="orchistra-outcomes">
          ${outcomes.map((outcome, index) => `<article class="orchistra-outcome"><span>${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(outcome.title)}</h3><p>${escapeHtml(outcome.body)}</p></div></article>`).join("")}
        </div>
      </div>
    </section>

    <section class="sp-section orchistra-systems" id="systems">
      <div class="sp-section-inner orchistra-systems-layout">
        <div>
          <p class="sp-eyebrow">${escapeHtml(systemsBoundary.eyebrow || "Existing systems")}</p>
          <h2>${escapeHtml(systemsBoundary.title || "Coordinate across the company without replacing its records.")}</h2>
          <p>${escapeHtml(systemsBoundary.body || "Orchistra connects intent, work, decisions, and evidence across the systems a company already trusts.")}</p>
        </div>
        <ul class="orchistra-system-list" aria-label="Systems that remain authoritative">
          ${(systemsBoundary.systems || []).map((system) => `<li>${escapeHtml(system)}</li>`).join("")}
        </ul>
      </div>
    </section>

    <section class="sp-section orchistra-progress" id="progress">
      <div class="sp-section-inner">
        <div class="sp-section-heading">
          <p class="sp-eyebrow">${escapeHtml(progressStory.eyebrow || "Current progress")}</p>
          <h2>${escapeHtml(progressStory.title || "A company operating system taking shape in working layers.")}</h2>
          <p>${escapeHtml(progressStory.intro || "Current capability is separated from controlled proof and future direction.")}</p>
        </div>
        <div class="orchistra-progress-list">
          ${progressItems.map((item) => `<article class="orchistra-progress-item"><span class="orchistra-progress-label">${escapeHtml(item.label)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`).join("")}
        </div>
        <p class="orchistra-progress-note">${escapeHtml(progressStory.note || "Availability and authority depend on the configured environment.")}</p>
      </div>
    </section>

    <section class="sp-section sp-dark" id="relationship">
      <div class="sp-section-inner sp-product-relationship">
        <div>
          <p class="sp-eyebrow">Sibling systems</p>
          <h2>${escapeHtml(sibling.title)}</h2>
          <p>${escapeHtml(sibling.body)}</p>
        </div>
        <div class="sp-relationship-rule">
          <span class="sp-eyebrow">SNAXK</span>
          <strong>Keep the work visible. Let judgement decide what happens next.</strong>
          <div class="sp-actions">
            <a class="sp-button sp-button-light" href="${escapeHtml(siblingHref)}"${outboundAttrsFor(site, sibling.content, "source_to_sibling_product", sibling.campaign)}>Visit SNAXK ${arrow}</a>
          </div>
        </div>
      </div>
    </section>

    <section class="sp-section orchistra-cao" id="cao">
      <div class="sp-section-inner orchistra-cao-inner">
        <p class="sp-eyebrow">${escapeHtml(cao.eyebrow || "Chief Agentic Officer")}</p>
        <h2>${escapeHtml(cao.title || "The Chief Agentic Officer defines the mandate. Orchistra makes it operational.")}</h2>
        <p>${escapeHtml(cao.body || "The Chief Agentic Officer names what agentic work may do, who owns it, and what leaders must be able to inspect. Orchistra is where that mandate becomes visible while the work moves.")}</p>
        ${cao.support ? `<p>${escapeHtml(cao.support)}</p>` : ""}
        <div class="sp-actions">
          <a class="sp-button sp-button-light" href="${escapeHtml(caoHref)}"${outboundAttrsFor(site, caoContent, caoStage, caoCampaign)}>${escapeHtml(cao.primary_label || "Read the CAO briefing")} ${arrow}</a>
          <a class="sp-button sp-button-ghost" href="${escapeHtml(advisoryHref)}"${outboundAttrsFor(site, advisoryContent, advisoryStage, advisoryCampaign)}>${escapeHtml(cao.secondary_label || "Discuss Orchistra")}</a>
        </div>
      </div>
    </section>

    <section class="sp-section orchistra-final-cta" id="interest">
      <div class="sp-section-inner orchistra-final-cta-layout">
        <div>
          <p class="sp-eyebrow">${escapeHtml(site.cta_eyebrow || "Platform interest")}</p>
          <h2>${escapeHtml(site.cta_title || "Where could Orchistra unlock momentum in your company?")}</h2>
          <p>${escapeHtml(site.cta_body || "Start with one operating problem, prove the value, and grow from there.")}</p>
        </div>
        <a class="sp-button sp-button-dark" href="${escapeHtml(finalInterestHref)}"${outboundAttrsFor(site, finalInterestContent, advisoryStage, advisoryCampaign)}>${escapeHtml(site.cta_button_label || "Discuss where to start")} ${arrow}</a>
      </div>
    </section>
  </main>

  <footer class="sp-footer">
    <div>
      <span class="orchistra-footer-mark" aria-hidden="true">O</span>
      <p>${escapeHtml(site.footer_tagline || "A company operating system for governed human-and-agent work.")}</p>
    </div>
    <div class="sp-footer-col">
      <strong>Orchistra</strong>
      <a href="#flow">Company model</a>
      <a href="#modes">Ways to begin</a>
      <a href="#outcomes">Outcomes</a>
      <a href="#progress">Progress</a>
    </div>
    <div class="sp-footer-col">
      <strong>Sibling product</strong>
      <a href="${escapeHtml(siblingHref)}"${outboundAttrsFor(site, "footer_snaxk", "source_to_sibling_product", sibling.campaign)}>SNAXK</a>
      <a href="${escapeHtml(caoHref)}"${outboundAttrsFor(site, "footer_cao_briefing", caoStage, caoCampaign)}>CAO briefing</a>
    </div>
    <div class="sp-footer-col">
      <strong>Contact</strong>
      <a href="${escapeHtml(advisoryHref)}"${outboundAttrsFor(site, "footer_platform_interest", advisoryStage, advisoryCampaign)}>Discuss Orchistra</a>
      <a href="/healthz">Status</a>
    </div>
    <div class="sp-footer-legal">
      <span>${escapeHtml(site.footer_product_line || "A YQUP product")}</span>
      <span>${escapeHtml(site.footer_legal || "Copyright (c) 2026 YQUP Ltd")}</span>
    </div>
  </footer>
</body>
</html>`;
}

function orchistraPageFor(site) {
  return orchistraSiblingPageFor(site);
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
  <meta name="description" content="${escapeHtml(page.note || page.message || site.summary || title)}">
${socialMetaTagsFor(site, { title, description: page.note || page.message || site.summary || title })}  <meta name="robots" content="noindex, follow">
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

function xmlEscape(value) {
  return escapeHtml(value).replace(/'/g, "&apos;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/\n/g, "&#10;");
}

function relative(target) {
  return path.relative(process.cwd(), target) || ".";
}
