import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const approvedDownloads = new Map([
  ["nodejs.org", /^\/dist\/v\d+\.\d+\.\d+\/node-v\d+\.\d+\.\d+-win-x64\.zip$/],
  ["github.com", /^\/(?:winsw\/winsw|cloudflare\/cloudflared)\/releases\/download\//],
  ["download.visualstudio.microsoft.com", /^\/download\/pr\/[0-9a-f-]{36}\/[A-F0-9]{64}\/VC_redist\.x64\.exe$/],
]);

export function validateRuntimeManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.components)) {
    throw new Error("Runtime manifest must use schema version 1.");
  }
  const names = manifest.components.map(({ name }) => name).sort();
  if (JSON.stringify(names) !== JSON.stringify(["cloudflared", "node", "vc-redist", "winsw"])) {
    throw new Error("Runtime manifest must contain node, winsw, cloudflared and vc-redist exactly once.");
  }

  const destinations = new Set();
  for (const component of manifest.components) {
    const url = new URL(component.url);
    const approvedPath = approvedDownloads.get(url.hostname);
    if (url.protocol !== "https:" || !approvedPath?.test(url.pathname)) {
      throw new Error(`Runtime download host or path is not approved: ${component.url}`);
    }
    if (!/^\d+(?:\.\d+){2,3}$/.test(component.version)) {
      throw new Error(`Runtime version is not immutable: ${component.name}`);
    }
    if (!/^[a-f0-9]{64}$/.test(component.sha256)) {
      throw new Error(`Runtime SHA-256 is invalid: ${component.name}`);
    }
    if (destinations.has(component.destination)) {
      throw new Error(`Runtime destination is duplicated: ${component.destination}`);
    }
    if (path.isAbsolute(component.destination) || component.destination.includes("..")) {
      throw new Error(`Runtime destination escapes the installer payload: ${component.destination}`);
    }
    destinations.add(component.destination);
  }
  return manifest;
}

async function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const manifestPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(scriptDirectory, "../packaging/runtime-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  validateRuntimeManifest(manifest);
  process.stdout.write(`Verified ${manifest.components.length} pinned Windows runtime components.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
