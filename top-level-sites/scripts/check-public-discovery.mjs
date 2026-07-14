import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sites = JSON.parse(await readFile(path.join(root, "sites.json"), "utf8"));
const failures = [];
const titles = new Map();
const descriptions = new Map();

for (const site of sites) {
  const wwwRoot = path.join(root, "dist", site.domain, "www");
  const pages = [{ route: "/", file: "index.html" }];
  if (site.mode === "cao") pages.push({ route: "/for-agents/", file: "for-agents/index.html" });

  for (const page of pages) {
    const canonical = `https://${site.domain}${page.route}`;
    const html = await readFile(path.join(wwwRoot, page.file), "utf8");
    const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || "";
    const title = tagText(head, "title");
    const description = metaContent(head, "name", "description");
    rememberUnique(titles, title, canonical, "title");
    rememberUnique(descriptions, description, canonical, "description");
    if (!title || !description) failures.push(`${canonical}: title and description are required in the HTML head`);

    const canonicalLinks = linkHrefs(head, "canonical");
    if (canonicalLinks.length !== 1 || canonicalLinks[0] !== canonical || !canonical.startsWith("https://")) failures.push(`${canonical}: expected one absolute HTTPS canonical`);
    if (metaContent(head, "property", "og:url") !== canonical) failures.push(`${canonical}: og:url does not match canonical`);

    const jsonLd = parseJsonLd(head);
    const nodes = Array.isArray(jsonLd?.["@graph"]) ? jsonLd["@graph"] : [];
    const article = nodes.find((node) => ["Article", "BlogPosting"].includes(node?.["@type"]));
    if (!article) {
      failures.push(`${canonical}: missing Article or BlogPosting JSON-LD`);
    } else {
      if (article.headline !== title) failures.push(`${canonical}: JSON-LD headline does not match title`);
      if (article.url !== canonical || article.mainEntityOfPage !== canonical) failures.push(`${canonical}: JSON-LD URL does not match canonical`);
      if (!article.author?.name) failures.push(`${canonical}: JSON-LD author is missing`);
      if (!validDate(article.datePublished) || !validDate(article.dateModified)) failures.push(`${canonical}: JSON-LD publication dates are invalid`);
      if (article.image?.url !== `https://${site.domain}/assets/og-image.png` || article.image?.width !== 1200 || article.image?.height !== 627) failures.push(`${canonical}: JSON-LD image is inconsistent`);
    }
  }

  const canonicalRoot = `https://${site.domain}/`;
  const robots = await readFile(path.join(wwwRoot, "robots.txt"), "utf8");
  if (!robots.includes("User-agent: *") || !robots.includes("Allow: /") || robots.includes("Disallow: /") || !robots.includes(`Sitemap: ${canonicalRoot}sitemap.xml`)) failures.push(`${site.domain}: robots.txt is not crawler-safe`);

  const sitemap = await readFile(path.join(wwwRoot, "sitemap.xml"), "utf8");
  if (!sitemap.includes(`<loc>${canonicalRoot}</loc>`)) failures.push(`${site.domain}: sitemap omits canonical homepage`);
  const feed = await readFile(path.join(wwwRoot, "feed.xml"), "utf8");
  if (!feed.includes(`<id>${canonicalRoot}</id>`) || !feed.includes(`href="${canonicalRoot}feed.xml"`)) failures.push(`${site.domain}: Atom feed URLs are inconsistent`);

  const manifest = JSON.parse(await readFile(path.join(wwwRoot, "site.webmanifest"), "utf8"));
  if (manifest.start_url !== "/" || manifest.scope !== "/" || !manifest.icons?.some((icon) => icon.sizes === "192x192") || !manifest.icons?.some((icon) => icon.sizes === "512x512")) failures.push(`${site.domain}: web manifest is incomplete`);
  await validatePng(path.join(wwwRoot, "apple-touch-icon.png"), 180, site.domain);
  await validatePng(path.join(wwwRoot, "app-icon-192.png"), 192, site.domain);
  await validatePng(path.join(wwwRoot, "app-icon-512.png"), 512, site.domain);
  await stat(path.join(wwwRoot, "favicon.svg"));

  const llms = await readFile(path.join(wwwRoot, "llms.txt"), "utf8");
  if (!llms.includes("public information only") || !llms.includes("authority to act")) failures.push(`${site.domain}: llms.txt lacks the public no-authority boundary`);
  const profileText = await readFile(path.join(wwwRoot, ".well-known", "agentic-profile.json"), "utf8");
  const profile = JSON.parse(profileText);
  if (profile.tier !== "public" || profile.access?.authority !== "none") failures.push(`${site.domain}: agentic profile must be public-safe and grant no authority`);
  if (/"(?:api[_-]?key|password|secret|token)"\s*:/i.test(profileText)) failures.push(`${site.domain}: agentic profile contains a secret-like field`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Public discovery metadata OK for ${sites.length} sites.`);

function rememberUnique(index, value, url, kind) {
  if (!value) return;
  const previous = index.get(value);
  if (previous) failures.push(`${url}: ${kind} duplicates ${previous}`);
  else index.set(value, url);
}

function tagText(html, tag) {
  return decodeEntities(html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]?.trim() || "");
}

function metaContent(html, attr, value) {
  const match = html.match(new RegExp(`<meta\\s+[^>]*${attr}=["']${escapeRegExp(value)}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"))
    || html.match(new RegExp(`<meta\\s+[^>]*content=["']([^"']+)["'][^>]*${attr}=["']${escapeRegExp(value)}["'][^>]*>`, "i"));
  return decodeEntities(match?.[1] || "");
}

function linkHrefs(html, rel) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => new RegExp(`\\brel=["'][^"']*\\b${escapeRegExp(rel)}\\b[^"']*["']`, "i").test(tag))
    .map((tag) => decodeEntities(tag.match(/\bhref=["']([^"']+)["']/i)?.[1] || ""));
}

function parseJsonLd(head) {
  const match = head.match(/<script\b[^>]*id=["']public-page-jsonld["'][^>]*>([\s\S]*?)<\/script>/i);
  try { return match ? JSON.parse(match[1]) : null; } catch { return null; }
}

async function validatePng(filePath, size, domain) {
  const buffer = await readFile(filePath);
  const dimensions = pngDimensions(buffer);
  if (!dimensions || dimensions.width !== size || dimensions.height !== size) failures.push(`${domain}: ${path.basename(filePath)} must be ${size}x${size}`);
}

function pngDimensions(buffer) {
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function validDate(value) { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }
function decodeEntities(value) { return String(value).replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">"); }
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
