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
];

const failures = [];

for (const site of sites) {
  const htmlPath = path.join(root, "dist", site.domain, "www", "index.html");
  const html = await readFile(htmlPath, "utf8");
  for (const property of requiredProperties) {
    if (!hasMeta(html, "property", property)) {
      failures.push(`${site.domain}: missing meta property ${property}`);
    }
  }
  for (const name of requiredNames) {
    if (!hasMeta(html, "name", name)) {
      failures.push(`${site.domain}: missing meta name ${name}`);
    }
  }

  const ogImage = metaContent(html, "property", "og:image");
  const expectedImage = `https://${site.domain}/assets/og-image.png`;
  if (ogImage !== expectedImage) {
    failures.push(`${site.domain}: expected og:image ${expectedImage}, got ${ogImage || "<missing>"}`);
  }

  const twitterImage = metaContent(html, "name", "twitter:image");
  if (twitterImage !== expectedImage) {
    failures.push(`${site.domain}: expected twitter:image ${expectedImage}, got ${twitterImage || "<missing>"}`);
  }
  const secureImage = metaContent(html, "property", "og:image:secure_url");
  if (secureImage !== expectedImage) {
    failures.push(`${site.domain}: expected og:image:secure_url ${expectedImage}, got ${secureImage || "<missing>"}`);
  }
  const imageType = metaContent(html, "property", "og:image:type");
  if (imageType !== "image/png") {
    failures.push(`${site.domain}: expected og:image:type image/png, got ${imageType || "<missing>"}`);
  }

  const width = metaContent(html, "property", "og:image:width");
  const height = metaContent(html, "property", "og:image:height");
  if (width !== "1200" || height !== "627") {
    failures.push(`${site.domain}: expected og:image dimensions 1200x627, got ${width || "?"}x${height || "?"}`);
  }

  const imagePath = path.join(root, "dist", site.domain, "www", "assets", "og-image.png");
  const image = await readFile(imagePath);
  const imageStat = await stat(imagePath);
  const dimensions = pngDimensions(image);
  if (!dimensions || dimensions.width !== 1200 || dimensions.height !== 627) {
    failures.push(`${site.domain}: PNG is not 1200x627`);
  }
  if (imageStat.size > 5 * 1024 * 1024) {
    failures.push(`${site.domain}: PNG is larger than 5 MB`);
  }
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
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
