import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssUrl = new URL("../app/globals.css", import.meta.url);

test("keeps the inline privacy note in a compact right-side column", async () => {
  const css = await readFile(cssUrl, "utf8");

  assert.match(
    css,
    /\.embed-shell \.booking-studio\.is-embedded\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*82px minmax\(0, 1fr\) minmax\(200px, 230px\);/,
  );
  assert.match(
    css,
    /\.embed-shell \.booking-studio\.is-embedded \.privacy-note\s*\{[\s\S]*?grid-column:\s*3;[\s\S]*?grid-row:\s*1;[\s\S]*?margin:[^;]*-12px;[\s\S]*?transform:\s*rotate\(1\.2deg\);/,
  );
});

test("stacks the inline privacy note below controls on narrow screens", async () => {
  const css = await readFile(cssUrl, "utf8");

  assert.match(
    css,
    /@media \(max-width:\s*760px\)[\s\S]*?\.embed-shell \.booking-studio\.is-embedded\s*\{[\s\S]*?display:\s*block;[\s\S]*?\.embed-shell \.booking-studio\.is-embedded \.privacy-note\s*\{[\s\S]*?margin:\s*0 18px 24px;[\s\S]*?transform:\s*none;/,
  );
});
