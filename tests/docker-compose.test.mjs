import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Docker route remains local by default and preserves named data", async () => {
  const [compose, dockerfile, dockerignore] = await Promise.all([
    readFile(new URL("compose.yaml", root), "utf8"),
    readFile(new URL("Dockerfile", root), "utf8"),
    readFile(new URL(".dockerignore", root), "utf8"),
  ]);

  assert.match(compose, /^\s{2}daymark-data:\s*$/m);
  assert.match(compose, /127\.0\.0\.1:\$\{DAYMARK_PORT:-3210\}:3210/);
  assert.match(compose, /\/api\/health/);
  assert.match(compose, /restart: unless-stopped/);
  assert.doesNotMatch(compose, /DAYMARK_SETUP_CODE:\s*[^$\s]/);

  assert.match(dockerfile, /FROM node:22\.23\.1-bookworm-slim AS build/);
  assert.match(dockerfile, /USER daymark/);
  assert.match(dockerfile, /--host", "0\.0\.0\.0"/);
  assert.match(dockerfile, /--data-dir", "\/var\/lib\/daymark\/data"/);
  assert.match(dockerignore, /^\.env\*$/m);
});
