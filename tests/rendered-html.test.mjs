import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Daymark booking experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Daymark — Private team booking<\/title>/i);
  assert.match(html, /Book time with/i);
  assert.match(html, /the right person/i);
  assert.match(html, /Your details stay private/i);
  assert.match(html, /Maya Chen/i);
  assert.match(html, /Open team workspace/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("server-renders the standalone live booking route", async () => {
  const response = await render("/book");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /A clear path to a good conversation/i);
  assert.match(html, /Maya Chen/i);
});

test("server-renders the embeddable booking route with framing limited to embeds", async () => {
  const embedResponse = await render("/embed?employee=maya-chen&channel=test-channel-7f3a");
  assert.equal(embedResponse.status, 200);
  assert.equal(
    embedResponse.headers.get("content-security-policy"),
    "frame-ancestors 'self' https: http://localhost:*",
  );
  assert.equal(embedResponse.headers.get("x-frame-options"), null);

  const html = await embedResponse.text();
  assert.match(html, /<title>Daymark appointment booking\.<\/title>/i);
  assert.match(html, /A clear path to a good conversation/i);

  const bookResponse = await render("/book");
  assert.equal(bookResponse.headers.get("content-security-policy"), "frame-ancestors 'none'");
  assert.equal(bookResponse.headers.get("x-frame-options"), "DENY");

  const unsafeResponse = await render("/embed?employee=%3Cscript%3E&channel=test-channel-7f3a");
  assert.equal(unsafeResponse.status, 404);

  const repeatedEmployeeResponse = await render(
    "/embed?employee=maya-chen&employee=theo-brooks&channel=test-channel-7f3a",
  );
  assert.equal(repeatedEmployeeResponse.status, 404);
});

test("redirects the team workspace to staff sign-in", async () => {
  const response = await render("/workspace");
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location"), "http://localhost").pathname, "/workspace/sign-in");
});

test("server-renders staff sign-in without the retired ChatGPT enrolment", async () => {
  const response = await render("/workspace/sign-in");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Staff sign in/i);
  assert.match(html, /Employees see only their own calendar/i);
  assert.doesNotMatch(html, /Sign in with ChatGPT/i);

  const appSource = await readSourceTree(new URL("../app/", import.meta.url));
  assert.doesNotMatch(appSource, /Sign in with ChatGPT/i);
});

test("removes starter infrastructure and keeps the editorial visual system", async () => {
  const [page, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /LiveBookingFlow/);
  assert.match(layout, /Daymark — Private team booking/);
  assert.match(css, /--paper:/);
  assert.match(css, /--ink:/);
  assert.match(css, /daymark-rail/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page, /codex-preview|SkeletonPreview/);

  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});

async function readSourceTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(entries.map(async (entry) => {
    const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) return readSourceTree(url);
    return /\.(?:ts|tsx|js|mjs)$/.test(entry.name) ? readFile(url, "utf8") : "";
  }));
  return contents.join("\n");
}
