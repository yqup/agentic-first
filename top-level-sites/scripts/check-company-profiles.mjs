import { execFile } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultCommand = process.env.AGENTIC_FIRST_VALIDATE || "agentic-first-validate";
const options = { timeout: 30000, maxBuffer: 1024 * 1024 };

export async function checkProfileValidator({ command = defaultCommand } = {}) {
  try {
    await execFileAsync(command, ["--help"], options);
  } catch (error) {
    throw new Error(
      "The canonical agentic-first-validate CLI is required (Python 3.11+). "
      + "Install top-level-sites/requirements-build.txt in a virtualenv and activate it, "
      + "or set AGENTIC_FIRST_VALIDATE to its executable path. "
      + "See top-level-sites/README.md#build.",
      { cause: error },
    );
  }
}

export async function validateProfiles({ root = defaultRoot, command = defaultCommand, log = console.log } = {}) {
  await checkProfileValidator({ command });
  const sites = JSON.parse(await readFile(path.join(root, "sites.json"), "utf8"));
  const expected = sites.map((site) => site.domain).sort();
  const dist = path.join(root, "dist");
  const outputDirs = (await readdir(dist, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const directories = [];
  for (const domain of outputDirs) {
    if (!expected.includes(domain)) {
      try {
        await access(path.join(dist, domain, "www", ".well-known", "agentic-profile.json"));
      } catch (error) {
        if (error.code === "ENOENT") continue;
        throw error;
      }
    }
    directories.push(domain);
  }
  if (!expected.length || new Set(expected).size !== expected.length) {
    throw new Error("Company profile validation requires a non-empty, unique site list.");
  }
  if (JSON.stringify(directories) !== JSON.stringify(expected)) {
    throw new Error(`Company profile output mismatch. Expected: ${expected.join(", ")}; found: ${directories.join(", ") || "none"}.`);
  }

  const failures = [];
  for (const domain of directories) {
    const profile = path.join(dist, domain, "www", ".well-known", "agentic-profile.json");
    try {
      const { stdout, stderr } = await execFileAsync(command, [profile], options);
      log(`${domain}: ${stdout.trim()}`);
      if (stderr.trim()) log(`${domain}: ${stderr.trim()}`);
    } catch (error) {
      const details = [error.stdout, error.stderr].filter(Boolean).join("\n").trim() || error.message;
      failures.push(`${domain}: ${details}`);
    }
  }
  if (failures.length) {
    throw new Error(`Company profile validation failed for ${failures.length}/${directories.length} sites:\n${failures.join("\n")}`);
  }
  log(`Company profiles OK for ${directories.length} sites (canonical agentic-first-validate).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await validateProfiles();
}
