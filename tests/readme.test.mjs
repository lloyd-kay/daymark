import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(path.join(repoRoot, relative), "utf8");

test("README is a truthful branded four-route chooser", () => {
  const readme = read("README.md");
  assert.match(readme, /^<p align="center">\s*<img src="\.\/public\/og\.png"/m);
  assert.match(readme, /Book the right person\. Keep every calendar private\./);
  for (const heading of ["choose-your-installation", "windows-installer", "docker-compose", "cloudflare", "manual-source-installation", "verify-daymark"]) {
    assert.match(readme, new RegExp(`<a id="${heading}"></a>`));
  }
  for (const route of ["Windows installer", "Docker Compose", "Cloudflare", "Manual source"]) {
    assert.match(readme, new RegExp(`\\| \\*\\*${route}\\*\\* \\|`));
  }
  assert.match(readme, /Windows installer.*Recommended/s);
  assert.match(readme, /licence pending/i);
  assert.match(readme, /unsigned preview/i);
  assert.doesNotMatch(readme, /releases\/latest\/download/i);
});

test("installation guides contain the required safety details", () => {
  const windows = read("docs/install/windows.md");
  assert.match(windows, /Windows 10 or Windows 11, 64-bit/);
  assert.match(windows, /unrecognised publisher/i);
  assert.match(windows, /Always-on service \(recommended\)/);
  assert.match(windows, /Client booking links and temporary public links stop working when Daymark is closed\./);
  assert.match(windows, /%ProgramData%\\Daymark\\data/);
  assert.match(windows, /preserved by default/i);

  const docker = read("docs/install/docker.md");
  for (const command of ["docker compose build", "docker compose up -d", "docker compose ps", "docker compose down"]) {
    assert.ok(docker.includes(command));
  }
  assert.match(docker, /docker compose down` does not delete the `daymark-data` volume/);
  assert.match(docker, /docker compose down --volumes.*permanently removes/s);

  const cloudflare = read("docs/install/cloudflare.md");
  for (const command of [
    "npx wrangler d1 create daymark",
    "npx wrangler d1 migrations apply DB --local",
    "npx wrangler d1 migrations apply DB --remote",
    "npx wrangler secret put DAYMARK_SETUP_CODE",
  ]) assert.ok(cloudflare.includes(command));
  assert.match(cloudflare, /Node\.js 22\.13\.0 or newer/);
  assert.match(cloudflare, /Back up the remote D1 database before migrations/);

  const manual = read("docs/install/manual.md");
  assert.match(manual, /> \[!WARNING\][\s\S]*Manual installation is for developers/);
  for (const shell of ["PowerShell", "Command Prompt", "macOS, Linux, or Git Bash"]) assert.ok(manual.includes(shell));
});

test("all local documentation links resolve and troubleshooting stays safe", () => {
  const docs = [
    "README.md",
    "docs/install/windows.md",
    "docs/install/docker.md",
    "docs/install/cloudflare.md",
    "docs/install/manual.md",
    "docs/troubleshooting.md",
  ];
  const all = docs.map((file) => ({ file, content: read(file) }));
  for (const { file, content } of all) {
    for (const match of content.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)]+\.md(?:#[^)]+)?)\)/g)) {
      const target = match[1].split("#")[0];
      assert.ok(existsSync(path.resolve(path.dirname(path.join(repoRoot, file)), target)), `${file} links to missing ${target}`);
    }
  }
  const troubleshooting = read("docs/troubleshooting.md");
  for (const topic of ["Port 3210 is already in use", "Service will not start", "Migration failed", "Backup verification failed", "Temporary link stopped", "Permanent tunnel credentials were revoked"]) {
    assert.ok(troubleshooting.includes(topic));
  }
  assert.doesNotMatch(troubleshooting, /delete `%ProgramData%\\Daymark`/i);
});

test("README keeps architecture, backup, security, and contribution guidance discoverable", () => {
  const readme = read("README.md");
  for (const target of [
    "docs/architecture.md",
    "docs/backups.md",
    "docs/security.md",
    "CONTRIBUTING.md",
  ]) {
    assert.ok(readme.includes(`](${target})`), `README must link to ${target}`);
    assert.ok(existsSync(path.join(repoRoot, target)), `Missing ${target}`);
  }
});

test("unfamiliar readers get safe acquisition, mobile choices, and removal guidance", () => {
  const readme = read("README.md");
  const dockerSection = readme.slice(readme.indexOf("## Docker Compose"), readme.indexOf("## Cloudflare"));
  assert.match(readme, /not yet available as a public download/i);
  assert.match(readme, /On a phone or narrow screen/);
  assert.ok(dockerSection.indexOf("RandomNumberGenerator") < dockerSection.indexOf("docker compose up -d"));

  const windows = read("docs/install/windows.md");
  assert.match(windows, /maintainer or invited tester/i);
  assert.match(windows, /booking URL name.*cedar-house/is);

  const cloudflare = read("docs/install/cloudflare.md");
  assert.match(cloudflare, /## Recurring backups and restore checks/);
  assert.match(cloudflare, /## Retire a Cloudflare deployment/);
  assert.match(cloudflare, /PowerShell/i);

  const manual = read("docs/install/manual.md");
  assert.match(manual, /## Stop or remove a manual installation/);

  const troubleshooting = read("docs/troubleshooting.md");
  assert.match(troubleshooting, /If Daymark fails repeatedly, stop retrying/i);
});
