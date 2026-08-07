import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifestUrl = new URL("../packaging/runtime-manifest.json", import.meta.url);

test("Windows runtime components are pinned to approved immutable downloads", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(
    manifest.components.map(({ name }) => name).sort(),
    ["cloudflared", "node", "winsw"],
  );

  const destinations = new Set();
  for (const item of manifest.components) {
    assert.match(item.version, /^\d+(?:\.\d+){2}$/);
    assert.match(item.url, /^https:\/\//);
    assert.doesNotMatch(item.url, /\/latest(?:\/|$)/i);
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
    assert.ok(!destinations.has(item.destination), `duplicate destination: ${item.destination}`);
    destinations.add(item.destination);
  }
});
