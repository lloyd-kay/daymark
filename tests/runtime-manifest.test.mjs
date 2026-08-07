import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifestUrl = new URL("../packaging/runtime-manifest.json", import.meta.url);

test("Windows runtime components are pinned to approved immutable downloads", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(
    manifest.components.map(({ name }) => name).sort(),
    ["cloudflared", "node", "vc-redist", "winsw"],
  );

  const vcRedist = manifest.components.find(({ name }) => name === "vc-redist");
  assert.deepEqual(vcRedist, {
    name: "vc-redist",
    version: "14.51.36247.0",
    fileName: "VC_redist.x64.exe",
    url: "https://download.visualstudio.microsoft.com/download/pr/ebdab8e5-1d7b-4d9f-a11b-cbb1720c3b12/843068991DAAA1F73AD9F6239BCE4D0F6A07A51F18C37EA2A867E9BECA71295C/VC_redist.x64.exe",
    sha256: "843068991daaa1f73ad9f6239bce4d0f6a07a51f18c37ea2a867e9beca71295c",
    licenseUrl: "https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist",
    destination: "vc_redist.x64.exe",
  });

  const destinations = new Set();
  for (const item of manifest.components) {
    assert.match(item.version, /^\d+(?:\.\d+){2,3}$/);
    assert.match(item.url, /^https:\/\//);
    assert.doesNotMatch(item.url, /\/latest(?:\/|$)/i);
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
    assert.ok(!destinations.has(item.destination), `duplicate destination: ${item.destination}`);
    destinations.add(item.destination);
  }
});
