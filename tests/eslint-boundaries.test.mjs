import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("ESLint excludes generated workspace folders from the project boundary", () => {
  const config = readFileSync(new URL("../eslint.config.mjs", import.meta.url), "utf8");
  assert.match(config, /["']\.worktrees\/\*\*["']/);
  assert.match(config, /["']work\/\*\*["']/);
});
