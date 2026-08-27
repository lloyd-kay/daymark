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

test("server-renders the Daymark product demonstration", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Scheduling without shared calendars\./i);
  assert.match(html, /product-title-line title-line-coral/);
  assert.match(html, /product-title-line title-line-lilac/);
  assert.match(html, /product-title-line title-line-sky/);
  assert.match(html, /Build and test one clear setup/i);
  assert.match(html, /No appointment will be created/i);
  assert.match(html, /Step 1 of 2/i);
  assert.match(html, /Where will customers start\?/i);
  assert.match(html, /Anywhere on my website/i);
  assert.match(html, /On a specific service page/i);
  assert.doesNotMatch(html, /How should booking open\?/i);
  assert.doesNotMatch(html, /Live Cedar House preview/i);
  assert.doesNotMatch(html, /daymark:\/\/import-setup\?code=/i);
  assert.match(html, /For custom widgets or integrations,/i);
  assert.match(html, /contact us\./i);
  assert.match(html, /Cedar House/i);
  assert.match(html, /journey-choice journey-choice-catalogue/i);
  assert.match(html, /aria-pressed="false" aria-labelledby="journey-catalogue-title"/i);
  assert.doesNotMatch(html, /widget-choice widget-choice-floating/i);
  assert.match(html, /Interior consultation/i);
  assert.match(html, /Garden planning/i);
  assert.doesNotMatch(html, /Camera installation|Alarm installation|smart home/i);
  assert.match(html, /Get Daymark/i);
  assert.doesNotMatch(html, /Confirm appointment/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("keeps the plain booking route non-transactional", async () => {
  const response = await render("/book");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Use the booking link supplied by the company/i);
  assert.doesNotMatch(html, /Confirm appointment/i);
});

test("requires a company scope for embeddable booking while limiting framing to embeds", async () => {
  const embedResponse = await render("/embed?employee=maya-chen&channel=test-channel-7f3a");
  assert.equal(embedResponse.status, 404);
  assert.equal(
    embedResponse.headers.get("content-security-policy"),
    "frame-ancestors 'self' https: http://localhost:*",
  );
  assert.equal(embedResponse.headers.get("x-frame-options"), null);

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

test("server-renders the Get Daymark setup choices", async () => {
  const response = await render("/get-daymark");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Choose how Daymark runs/i);
  assert.match(html, /Self-hosted/i);
  assert.match(html, /Daymark Hosted/i);
  assert.match(html, /Enquiries opening soon/i);
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
  const [page, setupBuilder, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/home/HomepageSetupBuilder.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /import\s+\{\s*HomepageSetupBuilder\s*\}\s+from/);
  assert.doesNotMatch(page, /import\s+\{\s*DemoBookingFlow\s*\}\s+from/);
  assert.match(setupBuilder, /import\s+\{\s*DemoBookingFlow\s*\}\s+from/);
  assert.doesNotMatch(page, /LiveBookingFlow/);
  assert.match(layout, /Private booking for teams/);
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
