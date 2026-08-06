# Daymark Installation README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the short technical README with a visually distinctive, nontechnical-first installation guide covering Windows installer, Docker Compose, Cloudflare, and manual source setup with commands that are verified as written.

**Architecture:** The root README acts as a branded decision page and quick start, while detailed route-specific procedures live in focused documents under `docs/install`. Automated documentation tests enforce required warnings, current versions, valid internal links, shell-labelled commands, and the absence of fabricated download or release claims.

**Tech Stack:** GitHub Markdown, existing `public/og.png` Daymark artwork, Shields badges, Node test runner, PowerShell, Docker Compose, Wrangler 4.92.

## Global Constraints

- Lead with existing Daymark artwork and the promise “Book the right person. Keep every calendar private.”
- Explain the product and privacy model before technical prerequisites.
- Present exactly four routes: Windows installer, Docker Compose, Cloudflare, and manual source installation.
- Windows is recommended for normal Windows users; manual source installation carries a prominent advanced-user warning.
- Temporary Quick Tunnel links are for testing only and not for real client bookings.
- Do not fabricate an installer download, GitHub Release, hosted service, domain, or production URL.
- Do not claim a software licence until a `LICENSE` file is deliberately selected and committed; show `licence pending` while absent.
- Commands must name their shell and run from a clean clone as written.
- Never show a real setup code, credential, tunnel token, client detail, or local database path from a real installation.
- Preserve links to architecture, security, backup, and contribution guidance.

---

## File map

- `README.md`: branded product summary, privacy promise, badges, route chooser, concise quick starts, verification, support status.
- `docs/install/windows.md`: assisted installer, first setup, service/manual mode, public access, upgrades, backup, and uninstall.
- `docs/install/docker.md`: Compose start, persistence, health, backup, upgrade, and removal.
- `docs/install/cloudflare.md`: Worker/D1 prerequisites, migration, secret, deploy, and verification.
- `docs/install/manual.md`: developer setup for PowerShell, Command Prompt, and POSIX shells.
- `docs/troubleshooting.md`: collapsible advanced recovery content linked from route guides.
- `tests/readme.test.mjs`: structural, copy, link, version, and truthfulness checks.
- `tests/docs-commands.test.ps1`: executable PowerShell documentation checks.

### Task 1: Branded README header and installation decision table

**Files:**
- Modify: `README.md`
- Create: `tests/readme.test.mjs`

**Interfaces:**
- Produces: stable anchors `#choose-your-installation`, `#windows-installer`, `#docker-compose`, `#cloudflare`, `#manual-source-installation`, and `#verify-daymark`.

- [ ] **Step 1: Write the failing structure and truthfulness test**

```js
assert.match(readme, /^<p align="center">\s*<img src="\.\/public\/og\.png"/m);
assert.match(readme, /Book the right person\. Keep every calendar private\./);
assert.match(readme, /\| Windows installer \|.*Recommended/s);
assert.match(readme, /\| Docker Compose \|/);
assert.match(readme, /\| Cloudflare \|/);
assert.match(readme, /\| Manual source \|/);
assert.match(readme, /licence pending/i);
assert.doesNotMatch(readme, /releases\/latest\/download/);
```

- [ ] **Step 2: Confirm failure**

Run: `node --test tests/readme.test.mjs`

Expected: FAIL because the current README lacks the branded route chooser.

- [ ] **Step 3: Implement the visual top section**

Use centered HTML only for the hero artwork, wordmark, promise, and restrained badges; keep the rest semantic Markdown. Badges must communicate `Windows 10/11 x64`, `Docker`, `Cloudflare Workers`, `unsigned preview`, and `licence pending`. Follow with a three-sentence explanation: clients pick an employee and an offered time; employees see only their own working calendar; company administrators can manage the company without exposing one employee's calendar to another.

Add this decision table:

| Method | Best for | Database included | Public address | Difficulty |
|---|---|---:|---|---|
| **Windows installer** | Normal Windows users | Yes | Local first; optional testing link | **Recommended** |
| **Docker Compose** | Home servers, VPSs, NASs | Yes | You provide a reverse proxy/domain | Easy |
| **Cloudflare** | Managed edge hosting | D1 in your account | Cloudflare route/domain | Intermediate |
| **Manual source** | Developers changing Daymark | Local D1 tools | Local unless configured | Advanced |

Under the table add a GitHub note: `The Windows installer is an unsigned preview. Until a reviewed installer is attached to a GitHub Release, build artifacts are available only from successful repository workflow runs.`

- [ ] **Step 4: Verify and commit**

Run: `node --test tests/readme.test.mjs`

Expected: PASS for hero, badges, privacy copy, table, and honest preview state.

```text
git add README.md tests/readme.test.mjs
git commit -m "docs: redesign Daymark installation overview"
```

### Task 2: Complete Windows installer guide

**Files:**
- Create: `docs/install/windows.md`
- Modify: `README.md`
- Modify: `tests/readme.test.mjs`

**Interfaces:**
- Consumes: `Daymark-Setup-x64-${version}.exe` and Daymark Control behaviour from the Windows plan.
- Produces: complete clean install, first setup, access, backup, upgrade, and uninstall instructions.

- [ ] **Step 1: Add failing Windows-guide assertions**

```js
assert.match(windows, /Windows 10 or Windows 11, 64-bit/);
assert.match(windows, /unrecognised publisher/i);
assert.match(windows, /Always-on service \(recommended\)/);
assert.match(windows, /Client booking links and temporary public links stop working when Daymark is closed\./);
assert.match(windows, /%ProgramData%\\Daymark\\data/);
assert.match(windows, /preserved by default/i);
```

- [ ] **Step 2: Confirm failure**

Run: `node --test tests/readme.test.mjs`

Expected: FAIL because `docs/install/windows.md` is absent.

- [ ] **Step 3: Write the exact assisted path**

Document: prerequisites; obtaining the installer from a reviewed release or signed-in workflow artifact; verifying `SHA256SUMS.txt` with PowerShell; handling the unsigned warning without encouraging users to bypass unrelated security prompts; choosing always-on or manual mode; first-company fields; local URL `http://127.0.0.1:3210`; optional temporary test link; permanent-domain prerequisite; data/backups/log locations; creating and verifying a backup; installing a newer setup file over the existing version; uninstall preservation; and separate permanent-data removal confirmation.

Use this PowerShell verification command:

```powershell
$installer = Get-ChildItem .\Daymark-Setup-x64-*.exe | Select-Object -First 1
(Get-FileHash $installer.FullName -Algorithm SHA256).Hash.ToLower()
Get-Content .\SHA256SUMS.txt
```

Do not provide a direct download URL until an installer is attached to a real GitHub Release.

- [ ] **Step 4: Verify and commit**

Run: `node --test tests/readme.test.mjs`

Expected: PASS.

```text
git add README.md docs/install/windows.md tests/readme.test.mjs
git commit -m "docs: add Windows installer guide"
```

### Task 3: Complete Docker Compose guide

**Files:**
- Create: `docs/install/docker.md`
- Modify: `README.md`
- Modify: `tests/readme.test.mjs`
- Create: `tests/docs-commands.test.ps1`

**Interfaces:**
- Consumes: root `Dockerfile`, `compose.yaml`, `.env.example`, and `runtime/local/cli.ts`.
- Produces: commands for setup code generation, start, health, backup, upgrade, stop, and safe removal.

- [ ] **Step 1: Add failing Docker command assertions**

```js
for (const command of ["docker compose build", "docker compose up -d", "docker compose ps", "docker compose down"]) {
  assert.ok(docker.includes(command));
}
assert.match(docker, /docker compose down` does not delete `daymark-data/);
assert.doesNotMatch(docker, /docker compose down --volumes/);
```

- [ ] **Step 2: Confirm failure**

Run: `node --test tests/readme.test.mjs`

Expected: FAIL because the Docker guide is absent.

- [ ] **Step 3: Write exact Docker setup**

PowerShell setup-code generation:

```powershell
$bytes = New-Object byte[] 20
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$env:DAYMARK_SETUP_CODE = [Convert]::ToHexString($bytes)
Copy-Item .env.example .env.local
Add-Content .env.local "DAYMARK_SETUP_CODE=$env:DAYMARK_SETUP_CODE"
docker compose build
docker compose up -d
docker compose ps
```

POSIX setup-code generation:

```bash
cp .env.example .env.local
printf 'DAYMARK_SETUP_CODE=%s\n' "$(openssl rand -hex 20)" >> .env.local
docker compose build
docker compose up -d
docker compose ps
```

Document `http://127.0.0.1:3210/api/health`, first-company setup, named-volume location, CLI backup command executed inside the container, pull/build upgrade with a pre-upgrade backup, `docker compose down` safety, and an explicit warning that `docker compose down --volumes` permanently removes local data.

- [ ] **Step 4: Validate configuration and commit**

Run: `node --test tests/readme.test.mjs`

Run: `docker compose config`

Expected: PASS and valid Compose configuration.

```text
git add README.md docs/install/docker.md tests/readme.test.mjs tests/docs-commands.test.ps1
git commit -m "docs: add Docker installation guide"
```

### Task 4: Rewrite the Cloudflare route with explicit local/remote safety

**Files:**
- Create: `docs/install/cloudflare.md`
- Modify: `docs/self-hosting.md`
- Modify: `README.md`
- Modify: `tests/readme.test.mjs`

**Interfaces:**
- Consumes: D1 binding `DB`, migrations under `drizzle`, Worker build, and `DAYMARK_SETUP_CODE`.
- Produces: clean Cloudflare deployment procedure that never confuses local and remote D1.

- [ ] **Step 1: Add failing Cloudflare safety assertions**

```js
assert.match(cloudflare, /Node\.js 22\.13\.0 or newer/);
assert.match(cloudflare, /npx wrangler d1 create daymark/);
assert.match(cloudflare, /npx wrangler d1 migrations apply DB --local/);
assert.match(cloudflare, /npx wrangler d1 migrations apply DB --remote/);
assert.match(cloudflare, /npx wrangler secret put DAYMARK_SETUP_CODE/);
assert.match(cloudflare, /Back up the remote D1 database before migrations/);
```

- [ ] **Step 2: Confirm failure**

Run: `node --test tests/readme.test.mjs`

Expected: FAIL because the explicit guide is absent.

- [ ] **Step 3: Write the Cloudflare installation path**

Document account and domain/route prerequisites, `npm ci`, `npx wrangler login`, D1 creation, copying the returned database id into the project configuration, local migrations with `--local`, local verification, remote backup/export, remote migrations with `--remote`, secret creation through stdin prompt, `npm run build`, `npx wrangler deploy --config dist/server/wrangler.json`, health check, first-company setup, and post-deploy foreign-key/company-isolation checks. Clearly say the implementation does not create Cloudflare resources automatically.

- [ ] **Step 4: Verify and commit**

Run: `node --test tests/readme.test.mjs`

Expected: PASS with both local and remote flags present.

```text
git add README.md docs/install/cloudflare.md docs/self-hosting.md tests/readme.test.mjs
git commit -m "docs: clarify Cloudflare deployment"
```

### Task 5: Complete manual source guide with three shell variants

**Files:**
- Create: `docs/install/manual.md`
- Modify: `README.md`
- Modify: `package.json`
- Create: `scripts/with-wrangler-log.mjs`
- Create: `tests/cross-platform-scripts.test.mjs`
- Modify: `tests/readme.test.mjs`

**Interfaces:**
- Produces: cross-platform `npm run dev`, `npm run build`, and `npm run start` without POSIX-only inline environment syntax.
- Documents PowerShell, Command Prompt, and POSIX `.env.local` setup.

- [ ] **Step 1: Write failing cross-platform script tests**

```js
for (const name of ["dev", "build", "start"]) {
  assert.doesNotMatch(pkg.scripts[name], /^WRANGLER_LOG_PATH=/);
  assert.match(pkg.scripts[name], /scripts\/with-wrangler-log\.mjs/);
}
assert.match(manual, /PowerShell/);
assert.match(manual, /Command Prompt/);
assert.match(manual, /macOS, Linux, or Git Bash/);
```

- [ ] **Step 2: Confirm failure**

Run: `node --test tests/cross-platform-scripts.test.mjs tests/readme.test.mjs`

Expected: FAIL because scripts use POSIX-only syntax and the guide is absent.

- [ ] **Step 3: Add the portable launcher and exact manual route**

`scripts/with-wrangler-log.mjs` must set `process.env.WRANGLER_LOG_PATH ||= ".wrangler/wrangler.log"`, allow only `dev | build | start`, and spawn the matching local Vinext binary with `shell: false`. Update the npm scripts to call it.

The guide must cover clean clone, Node >=22.13.0, `npm ci`, shell-specific copy commands, secure setup-code generation, local migrations, development start, unit/lint/build/rendered checks, local runtime commands, data locations, backup, upgrade by pulling a reviewed commit only after backup, and links to architecture/security. Place this callout above all commands:

> [!WARNING]
> Manual installation is for developers and experienced server operators. You are responsible for the Node runtime, database state, backups, updates, HTTPS, and keeping the Daymark process available.

- [ ] **Step 4: Verify and commit**

Run: `node --test tests/cross-platform-scripts.test.mjs tests/readme.test.mjs`

Run: `npm run unit && npm run lint && npm run test`

Expected: all PASS on Windows and no script requires POSIX inline environment syntax.

```text
git add README.md docs/install/manual.md package.json package-lock.json scripts/with-wrangler-log.mjs tests
git commit -m "docs: add verified manual installation"
```

### Task 6: Troubleshooting, links, and unfamiliar-reader review

**Files:**
- Create: `docs/troubleshooting.md`
- Modify: `README.md`
- Modify: `docs/install/windows.md`
- Modify: `docs/install/docker.md`
- Modify: `docs/install/cloudflare.md`
- Modify: `docs/install/manual.md`
- Modify: `tests/readme.test.mjs`

**Interfaces:**
- Produces: recovery guidance for port conflict, service failure, locked/corrupt data, failed migration, failed backup verification, offline tunnel setup, changed Quick Tunnel URL, and revoked permanent token.

- [ ] **Step 1: Add failing link and recovery-topic tests**

```js
for (const topic of ["Port 3210 is already in use", "Service will not start", "Migration failed", "Backup verification failed", "Temporary link stopped", "Permanent tunnel credentials were revoked"]) {
  assert.ok(troubleshooting.includes(topic));
}
for (const target of localMarkdownLinks(allDocs)) assert.ok(existsSync(resolve(repoRoot, target)), `Missing ${target}`);
```

- [ ] **Step 2: Confirm failure**

Run: `node --test tests/readme.test.mjs`

Expected: FAIL because troubleshooting and final links are incomplete.

- [ ] **Step 3: Write plain-language recovery sections**

Each issue must state what happened, what remains safe, the exact check to run, the recovery action, and where sanitized logs live. Never tell users to delete `%ProgramData%\Daymark` as a routine fix. Use collapsible `<details>` blocks only in troubleshooting, not for essential installation steps.

- [ ] **Step 4: Run the complete documentation gate**

Run: `node --test tests/readme.test.mjs tests/cross-platform-scripts.test.mjs tests/docker-compose.test.mjs`

Run: `npm run unit && npm run lint && npm run test`

Expected: all PASS; every internal link resolves; no fake download/release URL appears.

- [ ] **Step 5: Conduct a visual and unfamiliar-reader review**

Preview the README on GitHub desktop and mobile widths. Confirm artwork is sharp, badges wrap cleanly, the table remains readable, warnings are visible, code blocks are short, and headings form a useful table of contents. Ask a reader unfamiliar with the repository to choose an installation route and locate first setup, backup, upgrade, and uninstall without assistance; record unclear wording and correct it.

- [ ] **Step 6: Commit**

```text
git add README.md docs tests/readme.test.mjs
git commit -m "docs: finish Daymark installation handbook"
```
