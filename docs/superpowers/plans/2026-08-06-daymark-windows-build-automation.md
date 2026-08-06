# Daymark Windows Build Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce reproducible, checksum-verifiable unsigned Windows installer artifacts in GitHub Actions without publishing a release or deploying anything.

**Architecture:** A committed runtime manifest pins every downloaded binary by immutable version, official URL, and SHA-256. A PowerShell staging script downloads into a clean directory, verifies before extraction or execution, assembles the offline installer payload, and rejects unlisted files. GitHub Actions runs tests and packaging on Windows, creates `SHA256SUMS.txt`, and uploads workflow artifacts only.

**Tech Stack:** GitHub Actions, PowerShell 7, Node.js 22.23.1, Rust stable, Tauri 2/NSIS, WinSW 2.12.0, cloudflared 2026.7.3, SHA-256.

## Global Constraints

- Download external binaries only from official Node.js, WinSW, and Cloudflare release sources.
- Verify every external binary against a committed SHA-256 before extraction, execution, or packaging.
- Use locked JavaScript and Rust dependencies.
- Run the full Daymark unit, lint, build, rendered-route, migration, and packaging checks.
- Produce `Daymark-Setup-x64-${version}.exe` and `SHA256SUMS.txt`.
- Upload workflow artifacts only; do not publish a GitHub Release.
- Do not deploy the site, create a domain, create Cloudflare resources, or mutate production data.
- Label all artifacts as unsigned preview builds.

---

## File map

- `packaging/runtime-manifest.json`: immutable runtime pins and hashes.
- `scripts/verify-runtime-manifest.mjs`: schema, allowlist, HTTPS, version, and hash validation.
- `scripts/stage-windows-runtime.ps1`: download, verify, extract, and stage payload.
- `scripts/write-sha256s.ps1`: final artifact checksum generation.
- `tests/runtime-manifest.test.mjs`: manifest and staging safety tests.
- `.github/workflows/build-windows-preview.yml`: check, build, and artifact upload workflow.

### Task 1: Commit the verified external-runtime manifest

**Files:**
- Create: `packaging/runtime-manifest.json`
- Create: `scripts/verify-runtime-manifest.mjs`
- Create: `tests/runtime-manifest.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces manifest schema `{ schemaVersion: 1, components: RuntimeComponent[] }`.
- `RuntimeComponent` contains `name`, `version`, `fileName`, `url`, `sha256`, `licenseUrl`, and `destination`.

- [ ] **Step 1: Write the failing manifest test**

```js
assert.equal(manifest.schemaVersion, 1);
assert.deepEqual(manifest.components.map(({ name }) => name).sort(), ["cloudflared", "node", "winsw"]);
for (const item of manifest.components) {
  assert.match(item.url, /^https:\/\//);
  assert.match(item.sha256, /^[a-f0-9]{64}$/);
  assert.ok(!item.url.includes("/latest/"));
}
```

- [ ] **Step 2: Confirm failure**

Run: `node --test tests/runtime-manifest.test.mjs`

Expected: FAIL because the manifest is absent.

- [ ] **Step 3: Add the concrete pinned manifest and validator**

Use exactly these verified entries:

```json
{
  "schemaVersion": 1,
  "components": [
    {
      "name": "node",
      "version": "22.23.1",
      "fileName": "node-v22.23.1-win-x64.zip",
      "url": "https://nodejs.org/dist/v22.23.1/node-v22.23.1-win-x64.zip",
      "sha256": "7df0bc9375723f4a86b3aa1b7cc73342423d9677a8df4538aca31a049e309c29",
      "licenseUrl": "https://github.com/nodejs/node/blob/v22.23.1/LICENSE",
      "destination": "runtime/node"
    },
    {
      "name": "winsw",
      "version": "2.12.0",
      "fileName": "WinSW-x64.exe",
      "url": "https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe",
      "sha256": "05b82d46ad331cc16bdc00de5c6332c1ef818df8ceefcd49c726553209b3a0da",
      "licenseUrl": "https://github.com/winsw/winsw/blob/v2.12.0/LICENSE.txt",
      "destination": "runtime/service/DaymarkService.exe"
    },
    {
      "name": "cloudflared",
      "version": "2026.7.3",
      "fileName": "cloudflared-windows-amd64.exe",
      "url": "https://github.com/cloudflare/cloudflared/releases/download/2026.7.3/cloudflared-windows-amd64.exe",
      "sha256": "8635da433b6df8194746e88ed9d2589566c20e38bfc2a80e431a348b7c765841",
      "licenseUrl": "https://github.com/cloudflare/cloudflared/blob/2026.7.3/LICENSE",
      "destination": "runtime/tunnel/cloudflared.exe"
    }
  ]
}
```

The validator must allow only `nodejs.org`, `github.com/winsw/winsw`, and `github.com/cloudflare/cloudflared`, reject redirects to unapproved hosts, reject duplicate destinations, and compare Node's hash to the signed release SHASUMS file in a separately reported check.

- [ ] **Step 4: Verify and commit**

Run: `node scripts/verify-runtime-manifest.mjs && node --test tests/runtime-manifest.test.mjs`

Expected: PASS.

```text
git add packaging/runtime-manifest.json scripts/verify-runtime-manifest.mjs tests/runtime-manifest.test.mjs package.json package-lock.json
git commit -m "build: pin Windows runtime components"
```

### Task 2: Download and stage an allowlisted offline payload

**Files:**
- Create: `scripts/stage-windows-runtime.ps1`
- Create: `tests/stage-windows-runtime.test.ps1`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: `packaging/runtime-manifest.json`, application build output, local runtime, and service files.
- Produces: `artifacts/windows-stage/` containing only allowlisted runtime and Daymark files.

- [ ] **Step 1: Write the failing staging tests**

```powershell
{ & scripts/stage-windows-runtime.ps1 -Manifest tests/fixtures/bad-hash.json -Destination $TestDrive } | Should -Throw '*SHA-256 mismatch*'
{ & scripts/stage-windows-runtime.ps1 -Manifest tests/fixtures/unapproved-host.json -Destination $TestDrive } | Should -Throw '*host is not approved*'
```

- [ ] **Step 2: Confirm failure**

Run: `pwsh -File tests/stage-windows-runtime.test.ps1`

Expected: FAIL because staging is not implemented.

- [ ] **Step 3: Implement safe staging**

Use `Invoke-WebRequest -MaximumRedirection 0` followed by explicit redirect-host validation, write downloads as `.partial`, compare lowercase SHA-256, then rename. Expand Node only after verification; copy WinSW and cloudflared to exact manifest destinations. Copy `dist`, `drizzle`, `runtime/local`, production `node_modules`, service XML, and third-party licence notices. Fail if the destination exists unless `-Clean` is passed, and never accept a destination outside repository `artifacts/windows-stage` in CI.

- [ ] **Step 4: Verify and commit**

Run: `pwsh -File tests/stage-windows-runtime.test.ps1`

Run: `npm run build && pwsh -File scripts/stage-windows-runtime.ps1 -Destination artifacts/windows-stage -Clean`

Expected: tests PASS; every manifest component reports a matching hash; staged `node.exe`, `DaymarkService.exe`, and `cloudflared.exe` exist.

```text
git add scripts/stage-windows-runtime.ps1 tests/stage-windows-runtime.test.ps1 .gitignore package.json package-lock.json
git commit -m "build: stage verified Windows runtime"
```

### Task 3: Final artifact checksums and package inspection

**Files:**
- Create: `scripts/write-sha256s.ps1`
- Create: `scripts/inspect-windows-installer.ps1`
- Create: `tests/windows-artifact.test.ps1`

**Interfaces:**
- Consumes: built NSIS executable.
- Produces: `artifacts/release/Daymark-Setup-x64-${version}.exe`, `artifacts/release/SHA256SUMS.txt`, and inspection report.

- [ ] **Step 1: Write failing checksum and naming tests**

```powershell
$installers = Get-ChildItem $ReleaseDir -Filter 'Daymark-Setup-x64-*.exe'
$installers.Count | Should -Be 1
(Get-Content "$ReleaseDir/SHA256SUMS.txt" -Raw) | Should -Match '^[a-f0-9]{64}  Daymark-Setup-x64-.+\.exe\r?\n$'
```

- [ ] **Step 2: Confirm failure**

Run: `pwsh -File tests/windows-artifact.test.ps1`

Expected: FAIL because checksum generation is absent.

- [ ] **Step 3: Implement artifact normalization and inspection**

Read version from the root `package.json`, rename the sole NSIS output deterministically, compute SHA-256 with `Get-FileHash`, write ASCII `SHA256SUMS.txt`, then inspect file version, x64 architecture, embedded payload allowlist, unsigned signature state, and absence of `.env`, databases, logs, setup codes, or tunnel tokens.

- [ ] **Step 4: Verify and commit**

Run: `$builtInstaller = (Get-ChildItem desktop/daymark-control/src-tauri/target/release/bundle/nsis/*.exe | Select-Object -First 1).FullName; pwsh -File scripts/write-sha256s.ps1 -Installer $builtInstaller -ReleaseDir artifacts/release`

Run: `$releaseInstaller = (Get-ChildItem artifacts/release/Daymark-Setup-x64-*.exe | Select-Object -First 1).FullName; pwsh -File scripts/inspect-windows-installer.ps1 -Installer $releaseInstaller`

Run: `pwsh -File tests/windows-artifact.test.ps1`

Expected: all PASS and the signature state is reported as `Unsigned preview`, not treated as signed.

```text
git add scripts/write-sha256s.ps1 scripts/inspect-windows-installer.ps1 tests/windows-artifact.test.ps1
git commit -m "build: verify Daymark installer artifacts"
```

### Task 4: GitHub Actions artifact-only workflow

**Files:**
- Create: `.github/workflows/build-windows-preview.yml`
- Create: `tests/windows-workflow.test.mjs`

**Interfaces:**
- Produces workflow artifacts `daymark-windows-preview` containing the installer, checksum file, and inspection report.
- Workflow triggers: `workflow_dispatch` and pull requests that modify runtime, desktop, packaging, dependency lockfiles, or the workflow itself.

- [ ] **Step 1: Write the failing workflow safety test**

```js
assert.match(workflow, /windows-2025/);
assert.match(workflow, /npm ci/);
assert.match(workflow, /cargo test/);
assert.match(workflow, /actions\/upload-artifact@/);
assert.doesNotMatch(workflow, /release|gh release|pages|wrangler deploy/i);
assert.match(workflow, /contents:\s*read/);
```

- [ ] **Step 2: Confirm failure**

Run: `node --test tests/windows-workflow.test.mjs`

Expected: FAIL because the workflow does not exist.

- [ ] **Step 3: Implement the least-privilege workflow**

Pin action revisions by full commit SHA, set `permissions: contents: read`, use `windows-2025`, install Node 22.23.1 and stable Rust with x86_64 MSVC, cache only lockfile-keyed dependencies, then run in order: manifest validation, `npm ci`, unit, lint, build/rendered test, local migration integration, Rust tests, desktop frontend tests, verified staging, NSIS build, installer inspection, checksum generation, and artifact upload. Use `if: always()` only for sanitized diagnostics; do not upload data directories or raw service logs.

- [ ] **Step 4: Verify workflow and commit**

Run: `node --test tests/windows-workflow.test.mjs`

Run: `npx actionlint .github/workflows/build-windows-preview.yml`

Expected: PASS with no write permission and no release/deploy step.

```text
git add .github/workflows/build-windows-preview.yml tests/windows-workflow.test.mjs
git commit -m "ci: build unsigned Windows preview artifacts"
```

### Task 5: Full reproducibility gate

**Files:**
- Modify: `docs/windows-release-checklist.md`

**Interfaces:**
- Consumes: a successful `build-windows-preview` run.
- Produces: reviewed artifact hashes and a human decision point before any future release publication.

- [ ] **Step 1: Run the full local gate**

Run: `npm run unit && npm run lint && npm run test`

Run: `cargo test --locked --manifest-path desktop/daymark-control/src-tauri/Cargo.toml`

Expected: PASS.

- [ ] **Step 2: Trigger the artifact workflow and download outputs**

Trigger `build-windows-preview` with `workflow_dispatch`, wait for success, and download `daymark-windows-preview`. Do not create a release.

- [ ] **Step 3: Independently verify final checksum**

Run: `Get-ChildItem Daymark-Setup-x64-*.exe | Get-FileHash -Algorithm SHA256`

Expected: exact match with `SHA256SUMS.txt` and workflow summary.

- [ ] **Step 4: Record evidence and commit**

Record workflow URL, commit SHA, toolchain versions, installer hash, manifest component hashes, Windows smoke-test results, and explicit `GitHub Release not published` status.

```text
git add docs/windows-release-checklist.md
git commit -m "docs: record Windows preview build evidence"
```
