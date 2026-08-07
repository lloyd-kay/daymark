# Daymark Windows Migration Packaging Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a clean Windows installer include the shared runtime-health module so its first database migration completes.

**Architecture:** Keep the existing TypeScript runtime and Rust launcher unchanged. Repair the three packaging declarations that define the staged payload, the Tauri/NSIS resource payload, and the documented immutable installation layout, then verify the packaged launcher against disposable ProgramData.

**Tech Stack:** PowerShell, Tauri 2, Rust, Node.js 22.23.1, TSX, Wrangler D1, NSIS

## Global Constraints

- Do not change database schema, migration SQL, setup-code handling, or existing `%ProgramData%\Daymark` data.
- Keep generated installer binaries and disposable data outside Git history.
- The corrected installer remains an unsigned preview; do not create a public GitHub Release without separate approval.
- Publish source through a GitHub pull request after all verification passes.

---

### Task 1: Lock the runtime-root packaging contract

**Files:**
- Modify: `tests/windows/installer-contract.test.ps1`
- Modify: `scripts/stage-windows-runtime.ps1`
- Modify: `desktop/daymark-control/src-tauri/tauri.conf.json`
- Modify: `packaging/windows/install-layout.json`

**Interfaces:**
- Consumes: `runtime/local/backups.ts` import of `../../lib/runtime-health`.
- Produces: staged and installed `lib/runtime-health.ts` at the relative path expected by the packaged TypeScript runtime.

- [ ] **Step 1: Write the failing packaging contract**

Add assertions that the staging script names `lib`, the Tauri resource map contains `../../../artifacts/windows-stage/lib/` mapped to `lib`, and `install-layout.json` lists `lib` under `immutable`.

- [ ] **Step 2: Run the contract and verify it fails**

Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows/installer-contract.test.ps1`

Expected: FAIL because `lib` is absent from the current packaging declarations.

- [ ] **Step 3: Add `lib` to every packaging layer**

Change the staging directory list to:

```powershell
foreach ($directory in @("dist", "drizzle", "runtime", "lib")) {
```

Add this Tauri resource entry:

```json
"../../../artifacts/windows-stage/lib/": "lib"
```

Add `"lib"` beside `"runtime"` in the immutable install layout.

- [ ] **Step 4: Run the contract and staging safety tests**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows/installer-contract.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/stage-windows-runtime.test.ps1
```

Expected: both PASS.

- [ ] **Step 5: Commit the packaging repair**

```powershell
git add tests/windows/installer-contract.test.ps1 scripts/stage-windows-runtime.ps1 desktop/daymark-control/src-tauri/tauri.conf.json packaging/windows/install-layout.json
git commit -m "fix: include shared runtime in Windows package"
```

### Task 2: Prove the staged migration and rebuild the installer

**Files:**
- Generated: `artifacts/windows-stage/lib/runtime-health.ts`
- Generated: `artifacts/release/Daymark-Setup-x64-0.1.0.exe`
- Generated: `artifacts/release/SHA256SUMS.txt`
- Generated: `artifacts/release/inspection.json`

**Interfaces:**
- Consumes: corrected packaging declarations from Task 1.
- Produces: a locally verified unsigned installer and matching checksum; no generated outputs are committed.

- [ ] **Step 1: Build the site and rebuild the staged runtime**

Run:

```powershell
npm run build
npm run windows:stage
```

Expected: success and `artifacts/windows-stage/lib/runtime-health.ts` exists.

- [ ] **Step 2: Rebuild the native launcher**

Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-windows-launcher.ps1`

Expected: `artifacts/windows-stage/DaymarkRuntime.exe` is a valid Windows executable.

- [ ] **Step 3: Reproduce migration against disposable data**

Create a uniquely named folder under ignored `work/`, pass it as `ProgramData` only to the child verification process, then run:

```powershell
artifacts/windows-stage/DaymarkRuntime.exe --prepare-install
artifacts/windows-stage/DaymarkRuntime.exe --migrate
```

Expected: both commands return exit code `0`; the disposable database records the latest committed migration.

- [ ] **Step 4: Build and inspect the installer**

Run: `npm run windows:installer`

Expected: one normalized `.exe`, one matching SHA-256 entry, and `inspection.json` reports `Unsigned preview`, `x64`, and a passed payload allowlist.

- [ ] **Step 5: Run artifact checks**

Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows-artifact.test.ps1`

Expected: PASS.

### Task 3: Verify and publish the correction

**Files:**
- Modify: none unless verification exposes a separate defect.

**Interfaces:**
- Consumes: corrected source commit and locally rebuilt installer.
- Produces: pushed branch and draft pull request targeting `master`.

- [ ] **Step 1: Run source verification**

Run:

```powershell
npm run unit
npm run lint
npm test
npm test --prefix desktop/daymark-control -- --run
npm run build --prefix desktop/daymark-control
docker compose config --quiet
```

Expected: all pass.

- [ ] **Step 2: Run Rust and Windows verification**

Run the Rust tests with `C:\Users\Lloyd\.cargo\bin\cargo.exe`, then run `tests/docs-commands.test.ps1`, `tests/stage-windows-runtime.test.ps1`, and every `tests/windows/*.test.ps1` contract.

Expected: all pass.

- [ ] **Step 3: Check the publication diff**

Run: `git diff --check`, `git status -sb`, and inspect `master...HEAD`.

Expected: only the approved design, plan, test, and packaging-source changes are tracked; no installer binary or disposable data is staged.

- [ ] **Step 4: Push and open a draft pull request**

Push `agent/fix-windows-migration-package`, then create a draft PR against `master` describing the missing `lib` root, the clean-install impact, the data-safety behavior, and verification results.

- [ ] **Step 5: Report the local installer**

Provide the absolute installer path and SHA-256 so the corrected build can be copied to the disposable VM for a final human installation test.
