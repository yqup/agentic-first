import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sites = JSON.parse(await readFile(path.join(root, "sites.json"), "utf8"));

const requiredProperties = [
  "og:type",
  "og:title",
  "og:description",
  "og:url",
  "og:image",
  "og:image:secure_url",
  "og:image:type",
  "og:image:width",
  "og:image:height",
  "og:image:alt",
];

const requiredNames = [
  "twitter:card",
  "twitter:title",
  "twitter:description",
  "twitter:image",
  "twitter:image:alt",
];

const failures = [];

for (const site of sites) {
  const htmlPath = path.join(root, "dist", site.domain, "www", "index.html");
  const html = await readFile(htmlPath, "utf8");
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || "";
  for (const property of requiredProperties) {
    if (!hasMeta(head, "property", property)) failures.push(`${site.domain}: missing meta property ${property}`);
  }
  for (const name of requiredNames) {
    if (!hasMeta(head, "name", name)) failures.push(`${site.domain}: missing meta name ${name}`);
  }

  const expectedImage = `https://${site.domain}/assets/og-image.png`;
  for (const [label, attr, value] of [
    ["og:image", "property", "og:image"],
    ["og:image:secure_url", "property", "og:image:secure_url"],
    ["twitter:image", "name", "twitter:image"],
  ]) {
    const actual = metaContent(head, attr, value);
    if (actual !== expectedImage) failures.push(`${site.domain}: expected ${label} ${expectedImage}, got ${actual || "<missing>"}`);
  }

  const ogTitle = metaContent(head, "property", "og:title");
  const ogDescription = metaContent(head, "property", "og:description");
  if (metaContent(head, "name", "twitter:title") !== ogTitle) failures.push(`${site.domain}: Twitter title does not match Open Graph`);
  if (metaContent(head, "name", "twitter:description") !== ogDescription) failures.push(`${site.domain}: Twitter description does not match Open Graph`);
  if (metaContent(head, "name", "twitter:card") !== "summary_large_image") failures.push(`${site.domain}: twitter:card must be summary_large_image`);
  if (metaContent(head, "property", "og:image:type") !== "image/png") failures.push(`${site.domain}: og:image:type must be image/png`);
  if (metaContent(head, "property", "og:image:width") !== "1200" || metaContent(head, "property", "og:image:height") !== "627") {
    failures.push(`${site.domain}: expected Open Graph dimensions 1200x627`);
  }
  if (!metaContent(head, "property", "og:image:alt") || !metaContent(head, "name", "twitter:image:alt")) failures.push(`${site.domain}: social image alt text is missing`);

  const imagePath = path.join(root, "dist", site.domain, "www", "assets", "og-image.png");
  const image = await readFile(imagePath);
  const imageStat = await stat(imagePath);
  const dimensions = pngDimensions(image);
  if (!dimensions || dimensions.width !== 1200 || dimensions.height !== 627) failures.push(`${site.domain}: PNG is not 1200x627`);
  if (imageStat.size >= 1024 * 1024) failures.push(`${site.domain}: PNG must be below 1 MB`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Social preview metadata OK for ${sites.length} sites.`);

function hasMeta(html, attr, value) {
  return new RegExp(`<meta\\s+[^>]*${attr}=["']${escapeRegExp(value)}["'][^>]*>`, "i").test(html);
}

function metaContent(html, attr, value) {
  const match = html.match(new RegExp(`<meta\\s+[^>]*${attr}=["']${escapeRegExp(value)}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"))
    || html.match(new RegExp(`<meta\\s+[^>]*content=["']([^"']+)["'][^>]*${attr}=["']${escapeRegExp(value)}["'][^>]*>`, "i"));
  return match?.[1] || "";
}

function pngDimensions(buffer) {
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
