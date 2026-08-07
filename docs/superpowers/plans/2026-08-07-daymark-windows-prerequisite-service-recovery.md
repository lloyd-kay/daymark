# Daymark Windows Prerequisite and Service Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one offline Daymark Windows installer that succeeds on a clean Windows 10/11 x64 machine and a non-admin Daymark Control app that reports health correctly and requests UAC only for fixed service actions.

**Architecture:** Extend the pinned runtime manifest so the Microsoft Visual C++ x64 redistributable passes through the existing verified download, staging, Tauri resource, install-layout, and artifact-inspection chain. Install that prerequisite before Daymark preparation and migration. In the controller, derive immutable paths from the running executable, retain `%ProgramData%\Daymark` for mutable state, decode the existing camel-case health contract, and isolate Windows `runas` execution in a small Rust module with an internal start/stop/restart allowlist.

**Tech Stack:** PowerShell 7/Windows PowerShell 5.1, NSIS/Tauri 2, Rust 2021 with `windows-sys 0.61`, TypeScript/React 19/Vitest, Node.js 22 test runner.

## Global Constraints

- The existing `Daymark-Setup-x64-<version>.exe` remains the only file a customer needs to run.
- Bundle Microsoft Visual C++ Redistributable x64 version `14.51.36247.0` from the immutable Microsoft URL recorded below; never download it on the customer machine.
- Pin SHA-256 `843068991daaa1f73ad9f6239bce4d0f6a07a51f18c37ea2a867e9beca71295c` and require a valid Authenticode signer containing `CN=Microsoft Corporation`.
- Keep Daymark Control non-admin for status, setup, backups, public access, and opening the administrator workspace.
- Permit elevation only for the internally resolved `DaymarkService.exe` actions `start`, `stop`, and `restart`; the frontend must not supply an executable path or command argument.
- Preserve all mutable business state under `%ProgramData%\Daymark` on failed install, repair, upgrade, and recommended uninstall.
- Do not alter database schemas, setup codes, appointments, availability, company membership, or backup formats.
- Generated installers, downloaded binaries, and VM evidence remain outside Git history.

---

## File Map

- `packaging/runtime-manifest.json`: authoritative immutable runtime/prerequisite pins.
- `scripts/verify-runtime-manifest.mjs`: cross-platform manifest schema and approved-URL validation.
- `scripts/stage-windows-runtime.ps1`: secure download/cache verification and Windows payload staging.
- `packaging/windows/THIRD_PARTY_NOTICES.md`: bundled component disclosure.
- `desktop/daymark-control/src-tauri/tauri.conf.json`: maps the staged prerequisite into the NSIS payload.
- `packaging/windows/install-layout.json`: documents the real `%ProgramFiles%\Daymark Control` immutable layout.
- `packaging/windows/installer-hooks.nsh`: installs the prerequisite before any Daymark runtime command.
- `scripts/inspect-windows-installer.ps1`: rejects missing, unapproved, or incorrectly signed staged payloads.
- `desktop/daymark-control/src-tauri/src/service.rs`: runtime paths, service/manual orchestration, and Tauri commands.
- `desktop/daymark-control/src-tauri/src/elevation.rs`: fixed service-action allowlist and Windows `runas` process handling.
- `desktop/daymark-control/src-tauri/src/status.rs`: local health decoding and state mapping.
- `desktop/daymark-control/src/runtime.ts`: typed Tauri commands and safe service-error copy selection.
- `desktop/daymark-control/src/App.tsx`: one-click start/restart behavior and displayed recovery messages.
- `tests/windows/*.ps1`, `tests/*.test.*`, and Rust unit tests: contracts, clean-install smoke checks, and regression coverage.

---

### Task 1: Pin, Verify, and Stage the Microsoft Prerequisite

**Files:**
- Modify: `packaging/runtime-manifest.json`
- Modify: `scripts/verify-runtime-manifest.mjs`
- Modify: `scripts/stage-windows-runtime.ps1`
- Modify: `packaging/windows/THIRD_PARTY_NOTICES.md`
- Modify: `tests/runtime-manifest.test.mjs`
- Modify: `tests/stage-windows-runtime.test.ps1`

**Interfaces:**
- Consumes: existing manifest component fields `name`, `version`, `fileName`, `url`, `sha256`, `licenseUrl`, and `destination`.
- Produces: a verified staged file at `artifacts/windows-stage/vc_redist.x64.exe` with component name `vc-redist`.

- [ ] **Step 1: Write manifest tests that require the pinned Microsoft component**

Add assertions to `tests/runtime-manifest.test.mjs`:

```js
assert.deepEqual(
  manifest.components.map(({ name }) => name).sort(),
  ["cloudflared", "node", "vc-redist", "winsw"],
);

const vcRedist = manifest.components.find(({ name }) => name === "vc-redist");
assert.deepEqual(vcRedist, {
  name: "vc-redist",
  version: "14.51.36247.0",
  fileName: "VC_redist.x64.exe",
  url: "https://download.visualstudio.microsoft.com/download/pr/ebdab8e5-1d7b-4d9f-a11b-cbb1720c3b12/843068991DAAA1F73AD9F6239BCE4D0F6A07A51F18C37EA2A867E9BECA71295C/VC_redist.x64.exe",
  sha256: "843068991daaa1f73ad9f6239bce4d0f6a07a51f18c37ea2a867e9beca71295c",
  licenseUrl: "https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist",
  destination: "vc_redist.x64.exe",
});

for (const item of manifest.components) {
  assert.match(item.version, /^\d+(?:\.\d+){2,3}$/);
}
```

Update the fake download-cache loop in `tests/stage-windows-runtime.test.ps1` to include `VC_redist.x64.exe`, and add a hostile Microsoft-looking URL case:

```powershell
$manifest.components | Where-Object name -eq "vc-redist" | ForEach-Object {
    $_.url = "https://download.visualstudio.microsoft.com/not-an-approved-path/VC_redist.x64.exe"
}
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```powershell
node --test tests/runtime-manifest.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/stage-windows-runtime.test.ps1
```

Expected: the Node test reports that `vc-redist` is missing; the PowerShell contract cannot locate or validate that component.

- [ ] **Step 3: Add the exact component and approved immutable Microsoft path**

Add this object to `packaging/runtime-manifest.json`:

```json
{
  "name": "vc-redist",
  "version": "14.51.36247.0",
  "fileName": "VC_redist.x64.exe",
  "url": "https://download.visualstudio.microsoft.com/download/pr/ebdab8e5-1d7b-4d9f-a11b-cbb1720c3b12/843068991DAAA1F73AD9F6239BCE4D0F6A07A51F18C37EA2A867E9BECA71295C/VC_redist.x64.exe",
  "sha256": "843068991daaa1f73ad9f6239bce4d0f6a07a51f18c37ea2a867e9beca71295c",
  "licenseUrl": "https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist",
  "destination": "vc_redist.x64.exe"
}
```

In `scripts/verify-runtime-manifest.mjs`, require the four exact component names, allow three- or four-part numeric versions with `/^\d+(?:\.\d+){2,3}$/`, and approve only the content-addressed Microsoft path:

```js
["download.visualstudio.microsoft.com", /^\/download\/pr\/[0-9a-f-]{36}\/[A-F0-9]{64}\/VC_redist\.x64\.exe$/],
```

In `scripts/stage-windows-runtime.ps1`, make `Assert-ApprovedManifest` require `cloudflared,node,vc-redist,winsw`, add the equivalent case-insensitive path check, and include `download.visualstudio.microsoft.com` in the redirect allowlist. Keep the common SHA-256 verification and ordinary file-copy branch so `vc-redist` is staged exactly like the two existing executable components.

Update `packaging/windows/THIRD_PARTY_NOTICES.md` with:

```markdown
- Microsoft Visual C++ Redistributable x64 14.51.36247.0 — Microsoft licence: https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist
```

- [ ] **Step 4: Run manifest and staging safety tests**

Run:

```powershell
node scripts/verify-runtime-manifest.mjs
node --test tests/runtime-manifest.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/stage-windows-runtime.test.ps1
```

Expected: all commands pass; output reports four verified pinned Windows runtime components and rejects both hash and host/path tampering.

- [ ] **Step 5: Commit the prerequisite supply-chain contract**

```powershell
git add packaging/runtime-manifest.json packaging/windows/THIRD_PARTY_NOTICES.md scripts/verify-runtime-manifest.mjs scripts/stage-windows-runtime.ps1 tests/runtime-manifest.test.mjs tests/stage-windows-runtime.test.ps1
git commit -m "fix: pin Windows Visual C++ prerequisite"
```

---

### Task 2: Bundle and Install the Prerequisite Before Migration

**Files:**
- Modify: `desktop/daymark-control/src-tauri/tauri.conf.json`
- Modify: `packaging/windows/install-layout.json`
- Modify: `packaging/windows/installer-hooks.nsh`
- Modify: `scripts/inspect-windows-installer.ps1`
- Modify: `tests/windows/installer-contract.test.ps1`
- Modify: `tests/windows-artifact.test.ps1`
- Modify: `tests/windows/smoke-common.ps1`
- Modify: `tests/windows/install-smoke.ps1`
- Modify: `tests/windows/smoke-contract.test.ps1`
- Modify: `tests/windows/uninstall-smoke.ps1`
- Modify: `docs/windows-release-checklist.md`

**Interfaces:**
- Consumes: `artifacts/windows-stage/vc_redist.x64.exe` from Task 1.
- Produces: bundled `$INSTDIR\vc_redist.x64.exe`; prerequisite result policy accepting only `0`, `1638`, or `3010`; inspection fields `vcRedistVersion`, `vcRedistSha256`, and `vcRedistSignature`.

- [ ] **Step 1: Add failing installer-order, payload, signature, and install-root contracts**

Extend `tests/windows/installer-contract.test.ps1` with assertions equivalent to:

```powershell
Assert-True ($resourceMap."../../../artifacts/windows-stage/vc_redist.x64.exe" -eq "vc_redist.x64.exe") "The installer must bundle the Visual C++ prerequisite."
Assert-True ($layout.installRoot -eq "%ProgramFiles%\Daymark Control") "The install layout must match Tauri's product directory."
Assert-True (@($layout.immutable) -contains "vc_redist.x64.exe") "The prerequisite must be part of the immutable payload."
Assert-True ($inspectionScript -match 'Get-AuthenticodeSignature.*vc_redist') "Inspection must verify the prerequisite signature."

$vcIndex = $hooks.IndexOf('vc_redist.x64.exe')
$prepareIndex = $hooks.IndexOf('--prepare-install')
$migrateIndex = $hooks.IndexOf('--migrate')
Assert-True ($vcIndex -ge 0 -and $vcIndex -lt $prepareIndex -and $prepareIndex -lt $migrateIndex) "The Visual C++ prerequisite must run before Daymark preparation and migration."
foreach ($acceptedCode in @("1638", "3010")) {
    Assert-True ($hooks -match $acceptedCode) "The prerequisite policy must accept exit code $acceptedCode."
}
```

Extend `tests/windows-artifact.test.ps1` to require:

```powershell
if ($inspection.vcRedistSignature -ne "Valid Microsoft signature") { throw "The Visual C++ prerequisite signature was not verified." }
if ($inspection.vcRedistSha256 -ne "843068991daaa1f73ad9f6239bce4d0f6a07a51f18c37ea2a867e9beca71295c") { throw "The Visual C++ prerequisite hash changed." }
```

- [ ] **Step 2: Run the installer contracts and verify they fail**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows/installer-contract.test.ps1
```

Expected: FAIL because the Tauri resource, corrected install root, NSIS prerequisite order, and signature inspection are absent.

- [ ] **Step 3: Add the resource, layout entry, and prerequisite-first NSIS hook**

Add to `bundle.resources` in `tauri.conf.json`:

```json
"../../../artifacts/windows-stage/vc_redist.x64.exe": "vc_redist.x64.exe"
```

Change `install-layout.json` to:

```json
"installRoot": "%ProgramFiles%\\Daymark Control"
```

and add `vc_redist.x64.exe` to `immutable`.

Add this macro to `packaging/windows/installer-hooks.nsh` and invoke it as the first operation in `NSIS_HOOK_POSTINSTALL`:

```nsh
!macro DAYMARK_INSTALL_VC_RUNTIME
  DetailPrint "Installing Microsoft Visual C++ runtime"
  nsExec::ExecToLog '"$INSTDIR\vc_redist.x64.exe" /install /quiet /norestart'
  Pop $0
  ${If} $0 != 0
  ${AndIf} $0 != 1638
  ${AndIf} $0 != 3010
    MessageBox MB_OK|MB_ICONSTOP "Daymark could not install the required Microsoft Visual C++ runtime (error $0).$\r$\n$\r$\nYour business data has not been deleted. Restart Windows, then run the Daymark installer again."
    Abort
  ${EndIf}
!macroend
```

The start of `NSIS_HOOK_POSTINSTALL` must be:

```nsh
!macro NSIS_HOOK_POSTINSTALL
  !insertmacro DAYMARK_INSTALL_VC_RUNTIME
  DetailPrint "Preparing protected Daymark data folders"
```

- [ ] **Step 4: Enforce the Microsoft signature and exact prerequisite metadata during release inspection**

Add `vc_redist.x64.exe` to `$allowedTopLevel`. Then inspect it before writing the report:

```powershell
$vcRedist = Join-Path $stagePath "vc_redist.x64.exe"
$vcHash = (Get-FileHash -LiteralPath $vcRedist -Algorithm SHA256).Hash.ToLowerInvariant()
if ($vcHash -ne "843068991daaa1f73ad9f6239bce4d0f6a07a51f18c37ea2a867e9beca71295c") {
    throw "The staged Visual C++ prerequisite hash is not approved."
}
$vcInfo = Get-Item -LiteralPath $vcRedist
if ($vcInfo.VersionInfo.ProductVersion -ne "14.51.36247.0") {
    throw "The staged Visual C++ prerequisite version is not approved."
}
$vcSignature = Get-AuthenticodeSignature -LiteralPath $vcRedist
if ($vcSignature.Status -ne "Valid" -or $vcSignature.SignerCertificate.Subject -notmatch "CN=Microsoft Corporation(?:,|$)") {
    throw "The staged Visual C++ prerequisite does not have a valid Microsoft signature."
}
```

Add these ordered report properties:

```powershell
vcRedistVersion = $vcInfo.VersionInfo.ProductVersion
vcRedistSha256 = $vcHash
vcRedistSignature = "Valid Microsoft signature"
```

- [ ] **Step 5: Correct smoke-test paths and prove the installed prerequisite**

Change all immutable install-root construction in `tests/windows/smoke-common.ps1`, `tests/windows/install-smoke.ps1`, and `tests/windows/uninstall-smoke.ps1` from `Daymark` to `Daymark Control`. Keep every `%ProgramData%\Daymark` path unchanged.

Add this helper to `smoke-common.ps1`:

```powershell
function Assert-DaymarkVcRuntime {
    $key = Get-ItemProperty -LiteralPath "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" -ErrorAction Stop
    if ($key.Installed -ne 1) { throw "The Microsoft Visual C++ x64 runtime is not installed." }
    $version = [version]($key.Version -replace '^v', '')
    if ($version -lt [version]"14.51.36247.0") { throw "The Microsoft Visual C++ x64 runtime is older than Daymark requires." }
    return $version.ToString()
}
```

Call it immediately after `Invoke-DaymarkInstaller` and record `vcRedistVersion` in both pre-restart and post-restart JSON evidence. Extend `smoke-contract.test.ps1` and `docs/windows-release-checklist.md` to require a clean machine without the redistributable, `vcRedistVersion`, the real `Daymark Control` application directory, and preserved `%ProgramData%\Daymark`.

- [ ] **Step 6: Run the installer and smoke contracts**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows/installer-contract.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows/smoke-contract.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows/smoke-helpers.test.ps1
```

Expected: all three pass. No installer is executed by these contract tests.

- [ ] **Step 7: Commit the offline installer integration**

```powershell
git add desktop/daymark-control/src-tauri/tauri.conf.json packaging/windows/install-layout.json packaging/windows/installer-hooks.nsh scripts/inspect-windows-installer.ps1 tests/windows/installer-contract.test.ps1 tests/windows-artifact.test.ps1 tests/windows/smoke-common.ps1 tests/windows/install-smoke.ps1 tests/windows/smoke-contract.test.ps1 tests/windows/uninstall-smoke.ps1 docs/windows-release-checklist.md
git commit -m "fix: install Windows prerequisite before migration"
```

---

### Task 3: Resolve the Actual Install Directory and Lock the Health Contract

**Files:**
- Modify: `desktop/daymark-control/src-tauri/src/service.rs`
- Modify: `desktop/daymark-control/src-tauri/src/status.rs`

**Interfaces:**
- Produces: `runtime_paths_from_executable(executable: &Path, program_data: &Path) -> RuntimePaths`.
- Preserves: `runtime_paths() -> RuntimePaths` for existing controller callers.
- Locks: health JSON fields `status`, `appVersion`, and `latestMigration`.

- [ ] **Step 1: Replace the old path expectation with a failing executable-relative unit test**

In `service.rs`, replace `runtime_paths_keep_programs_and_business_data_separate` with:

```rust
#[test]
fn runtime_paths_follow_the_control_executable_and_keep_business_data_separate() {
    let executable = Path::new(r"C:\Program Files\Daymark Control\Daymark Control.exe");
    let program_data = Path::new(r"C:\ProgramData");
    let paths = runtime_paths_from_executable(executable, program_data);

    assert_eq!(paths.install_dir, PathBuf::from(r"C:\Program Files\Daymark Control"));
    assert_eq!(paths.data_dir, PathBuf::from(r"C:\ProgramData\Daymark"));
    assert_eq!(paths.service_wrapper, paths.install_dir.join("DaymarkService.exe"));
    assert_eq!(paths.runtime_launcher, paths.install_dir.join("DaymarkRuntime.exe"));
    assert!(paths.settings_file.starts_with(&paths.data_dir));
}
```

Add a health regression test in `status.rs`:

```rust
#[test]
fn decodes_the_runtime_camel_case_health_contract() {
    let health = parse_health_response(
        r#"{"status":"ok","appVersion":"0.1.0","latestMigration":"0002_daymark_company_workspaces.sql"}"#,
    )
    .expect("valid Daymark health must decode");
    assert_eq!(health.app_version, "0.1.0");
    assert_eq!(health.latest_migration.as_deref(), Some("0002_daymark_company_workspaces.sql"));
    assert!(health_is_ready(&health));

    let incomplete = parse_health_response(
        r#"{"status":"ok","appVersion":"0.1.0","latestMigration":null}"#,
    )
    .expect("syntactically valid incomplete health must decode");
    assert!(!health_is_ready(&incomplete));
}
```

- [ ] **Step 2: Run Rust tests and verify the new path test fails**

Run:

```powershell
cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml runtime_paths_follow_the_control_executable -- --exact
```

Expected: compile failure because `runtime_paths_from_executable` and `health_is_ready` do not exist. The existing `#[serde(rename_all = "camelCase")]` is retained; the test locks that working field mapping while adding the missing migration-completeness check.

- [ ] **Step 3: Derive immutable runtime paths from the current executable**

Implement the helper:

```rust
pub(crate) fn runtime_paths_from_executable(executable: &Path, program_data: &Path) -> RuntimePaths {
    let install_dir = executable
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from(r"C:\Program Files\Daymark Control"));
    let data_dir = program_data.join("Daymark");

    RuntimePaths {
        settings_file: data_dir.join("control.json"),
        service_wrapper: install_dir.join("DaymarkService.exe"),
        runtime_launcher: install_dir.join("DaymarkRuntime.exe"),
        node_executable: install_dir.join("node").join("node.exe"),
        runtime_cli: install_dir.join("runtime").join("local").join("cli.ts"),
        install_dir,
        data_dir,
    }
}
```

Make `runtime_paths()` call `std::env::current_exe()` and pass the `%ProgramData%` root into that helper. Its only fallback for an unavailable executable path is `%ProgramFiles%\Daymark Control\Daymark Control.exe`; it must never reconstruct `%ProgramFiles%\Daymark`.

Extract the existing health body decode to:

```rust
fn parse_health_response(body: &str) -> Option<HealthResponse> {
    serde_json::from_str::<HealthResponse>(body).ok()
}

fn health_is_ready(health: &HealthResponse) -> bool {
    health.status == "ok"
        && health.latest_migration.as_deref() == Some(EXPECTED_MIGRATION)
}
```

Use both helpers from `check_health()`. Return `Running` only when the HTTP status is `200` and `health_is_ready` is true; a missing or older migration remains `NeedsAttention`.

- [ ] **Step 4: Run the full Rust suite**

Run:

```powershell
cargo fmt --manifest-path desktop/daymark-control/src-tauri/Cargo.toml -- --check
cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml
```

Expected: all unit and integration tests pass, including executable-relative paths and camel-case health decoding.

- [ ] **Step 5: Commit the controller path and health regression fix**

```powershell
git add desktop/daymark-control/src-tauri/src/service.rs desktop/daymark-control/src-tauri/src/status.rs
git commit -m "fix: resolve installed runtime beside Daymark Control"
```

---

### Task 4: Add Allowlisted On-Demand UAC Service Actions

**Files:**
- Create: `desktop/daymark-control/src-tauri/src/elevation.rs`
- Modify: `desktop/daymark-control/src-tauri/src/lib.rs`
- Modify: `desktop/daymark-control/src-tauri/src/main.rs`
- Modify: `desktop/daymark-control/src-tauri/src/service.rs`
- Modify: `desktop/daymark-control/src-tauri/Cargo.toml`
- Modify: `desktop/daymark-control/src/runtime.ts`
- Modify: `desktop/daymark-control/src/runtime.test.ts`
- Modify: `desktop/daymark-control/src/App.tsx`
- Modify: `desktop/daymark-control/src/App.test.tsx`

**Interfaces:**
- Produces: private Rust enum `ServiceAction::{Start, Stop, Restart}` and `run_elevated_service_action(executable: &Path, action: ServiceAction) -> Result<(), ControlError>`.
- Produces: Tauri command `restart_runtime` with no frontend-supplied arguments.
- Produces: TypeScript `restartRuntime(): Promise<void>` and `runtimeActionErrorMessage(value: unknown): string`.

- [ ] **Step 1: Write failing Rust allowlist and result-mapping tests**

Create `elevation.rs` with a test module first:

```rust
#[cfg(test)]
mod tests {
    use super::{service_exit_result, shell_failure, ServiceAction};
    use windows_sys::Win32::Foundation::ERROR_CANCELLED;

    #[test]
    fn exposes_only_fixed_winsw_actions() {
        assert_eq!(ServiceAction::Start.argument(), "start");
        assert_eq!(ServiceAction::Stop.argument(), "stop");
        assert_eq!(ServiceAction::Restart.argument(), "restart");
    }

    #[test]
    fn distinguishes_cancelled_elevation_from_service_failure() {
        assert_eq!(shell_failure(ERROR_CANCELLED).code, "service_action_cancelled");
        assert_eq!(shell_failure(5).code, "service_elevation_failed");
        assert_eq!(service_exit_result(5).unwrap_err().code, "service_action_failed");
        assert!(service_exit_result(0).is_ok());
    }
}
```

Add a service test proving restart is a first-class internal action rather than frontend arguments. Add `pub fn restart_runtime(...)` to the test import before implementation so compilation fails.

- [ ] **Step 2: Write failing frontend tests for one restart call and precise cancellation copy**

In `runtime.test.ts`, add:

```ts
it("maps service action failures without exposing arbitrary error text", () => {
  expect(runtimeActionErrorMessage({ code: "service_action_cancelled" })).toBe(
    "Administrator approval was cancelled. Daymark was not changed.",
  );
  expect(runtimeActionErrorMessage({ code: "service_action_failed" })).toBe(
    "Windows could not change the Daymark service. Open Recovery tools for details.",
  );
  expect(runtimeActionErrorMessage("untrusted backend text")).toBe(
    "Windows could not change the Daymark service.",
  );
});
```

Mock the runtime module in `App.test.tsx`, render a running status, click `Restart Daymark`, and assert `restartRuntime` is called once while `stopRuntime` and `startRuntime` are not called.

- [ ] **Step 3: Run focused Rust and frontend tests and verify they fail**

Run:

```powershell
cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml elevation
npm --prefix desktop/daymark-control test -- --run src/runtime.test.ts src/App.test.tsx
```

Expected: Rust fails because the module/functions are absent; Vitest fails because the restart command and safe error mapper are absent.

- [ ] **Step 4: Implement direct Windows `runas` execution in the isolated module**

Add `Win32_System_Registry`, `Win32_System_Threading`, `Win32_UI_Shell`, and `Win32_UI_WindowsAndMessaging` to the existing `windows-sys` features in `Cargo.toml`.

Implement `ServiceAction` as a private, non-deserializable enum. On Windows, `run_elevated_service_action` must:

```rust
let verb = wide("runas");
let file = wide_path(executable);
let parameters = wide(action.argument());
let mut info = SHELLEXECUTEINFOW {
    cbSize: size_of::<SHELLEXECUTEINFOW>() as u32,
    fMask: SEE_MASK_NOCLOSEPROCESS,
    lpVerb: verb.as_ptr(),
    lpFile: file.as_ptr(),
    lpParameters: parameters.as_ptr(),
    nShow: SW_HIDE,
    ..Default::default()
};
```

Call `ShellExecuteExW`, map `GetLastError() == ERROR_CANCELLED` to:

```rust
ControlError::new(
    "service_action_cancelled",
    "Administrator approval was cancelled. Daymark was not changed.",
)
```

Map other launch failures to `service_elevation_failed`. Wait on the returned process handle with `WaitForSingleObject(..., INFINITE)`, obtain its code with `GetExitCodeProcess`, always `CloseHandle`, and map non-zero codes to `service_action_failed`. The non-Windows implementation must return `service_action_unsupported`; no shell or PowerShell command construction is permitted.

- [ ] **Step 5: Route service start, stop, and restart through the allowlisted module**

Replace `run_service_action(&str)` with:

```rust
fn run_service_action(&self, action: ServiceAction) -> Result<(), ControlError> {
    ensure_runtime_file(&self.paths.service_wrapper)?;
    run_elevated_service_action(&self.paths.service_wrapper, action)
}
```

Use `ServiceAction::Start` and `ServiceAction::Stop` in the existing branches. Add:

```rust
fn restart(&self, mode: RuntimeMode) -> Result<(), ControlError> {
    match mode {
        RuntimeMode::Service => self.run_service_action(ServiceAction::Restart),
        RuntimeMode::Manual => {
            self.stop_manual()?;
            self.start_manual()
        }
    }
}

#[tauri::command]
pub fn restart_runtime(controller: State<'_, ServiceController>) -> Result<(), ControlError> {
    controller.restart(controller.read_mode())
}
```

Register only the parameterless `restart_runtime` command in `main.rs`. Remove the old `service_result(Output)` and generic `administrator_required` mapping.

- [ ] **Step 6: Use one restart request and render safe specific errors in React**

Add to `runtime.ts`:

```ts
export async function restartRuntime(): Promise<void> {
  await invoke("restart_runtime");
}

export function runtimeActionErrorMessage(value: unknown): string {
  const code = isRecord(value) && typeof value.code === "string" ? value.code : null;
  if (code === "service_action_cancelled") {
    return "Administrator approval was cancelled. Daymark was not changed.";
  }
  if (code === "service_action_failed") {
    return "Windows could not change the Daymark service. Open Recovery tools for details.";
  }
  if (code === "service_elevation_failed") {
    return "Windows could not request administrator approval.";
  }
  return "Windows could not change the Daymark service.";
}
```

In `App.tsx`, call `restartRuntime()` when already running and `startRuntime()` when stopped. Catch `error: unknown` and pass it to `runtimeActionErrorMessage(error)`. Do not call stop then start for a service restart.

- [ ] **Step 7: Format and run the complete controller test suites**

Run:

```powershell
cargo fmt --manifest-path desktop/daymark-control/src-tauri/Cargo.toml
cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml
npm --prefix desktop/daymark-control test -- --run
npm --prefix desktop/daymark-control run build
```

Expected: all Rust and frontend tests pass; the running-state button issues one fixed restart command; cancellation and failure text are distinct.

- [ ] **Step 8: Commit scoped service elevation**

```powershell
git add desktop/daymark-control/src-tauri/src/elevation.rs desktop/daymark-control/src-tauri/src/lib.rs desktop/daymark-control/src-tauri/src/main.rs desktop/daymark-control/src-tauri/src/service.rs desktop/daymark-control/src-tauri/Cargo.toml desktop/daymark-control/src-tauri/Cargo.lock desktop/daymark-control/src/runtime.ts desktop/daymark-control/src/runtime.test.ts desktop/daymark-control/src/App.tsx desktop/daymark-control/src/App.test.tsx
git commit -m "fix: request UAC for Daymark service actions"
```

---

### Task 5: Build, Inspect, and Validate the One-File Windows Release

**Files:**
- Modify only if verification exposes a defect: files owned by Tasks 1–4
- Generate outside Git: `artifacts/windows-stage/**`
- Generate outside Git: `artifacts/release/Daymark-Setup-x64-0.1.0.exe`
- Generate outside Git: `artifacts/release/SHA256SUMS.txt`
- Generate outside Git: `artifacts/release/inspection.json`
- Generate outside Git on VM: `%ProgramData%\Daymark\smoke\*.json`

**Interfaces:**
- Consumes: all committed changes from Tasks 1–4.
- Produces: one inspected offline installer and disposable-VM evidence for prerequisite installation, Daymark health, administrator workspace access, approved restart, data preservation, and restart persistence.

- [ ] **Step 1: Run the complete source and packaging verification suite**

Run:

```powershell
npm run lint
npm run unit
npm run build
node scripts/verify-runtime-manifest.mjs
node --test tests/runtime-manifest.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/stage-windows-runtime.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows/installer-contract.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows/smoke-contract.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows/smoke-helpers.test.ps1
cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml
npm --prefix desktop/daymark-control test -- --run
npm --prefix desktop/daymark-control run build
```

Expected: every command exits `0`. Fix any regression at its owning task boundary and rerun the failing command before continuing.

- [ ] **Step 2: Stage the verified offline payload and prove migration outside the installer**

Run:

```powershell
npm run windows:stage
npm run windows:test-staged-migration
```

Expected: staging reports all four pinned components; `artifacts/windows-stage/vc_redist.x64.exe` has the approved SHA-256 and Microsoft signature; the disposable migration passes.

- [ ] **Step 3: Build and inspect the installer artifact**

Run:

```powershell
npm run windows:installer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows-artifact.test.ps1
```

Expected: exactly one normalized installer exists, its checksum matches, its size reflects the complete offline payload, and `inspection.json` records the approved redistributable version, hash, and signature.

- [ ] **Step 4: Confirm generated binaries remain untracked**

Run:

```powershell
git status --short
git ls-files artifacts
```

Expected: no generated installer, staged runtime, downloaded executable, VM log, setup code, password, database, or smoke JSON appears as a tracked change.

- [ ] **Step 5: Run the clean Windows VM release gate**

On a disposable Windows 10 or Windows 11 x64 VM with no `HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64` installed:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\windows\install-smoke.ps1 -Installer .\Daymark-Setup-x64-0.1.0.exe -ConfirmDisposableMachine -ManualWarningConfirmed
```

Verify manually before restart:

```text
The single installer completes without a database migration error.
Daymark Control reports Running.
Open administrator workspace opens http://127.0.0.1:3210/workspace/sign-in.
Restart Daymark shows one normal UAC prompt; approving it returns the service to Running.
Cancelling a later restart reports that approval was cancelled and leaves the running service unchanged.
The smoke JSON records vcRedistVersion >= 14.51.36247.0.
```

Restart Windows, then run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\windows\install-smoke.ps1 -ResumeAfterRestart -ConfirmDisposableMachine
```

Expected: health is `ok`, the service is automatic/running, and the appointment conflict proves persistence across restart.

- [ ] **Step 6: Review the branch and commit any verification-only documentation update**

If the release checklist is updated with non-secret results, commit only that text file:

```powershell
git add docs/windows-release-checklist.md
git commit -m "docs: record Windows recovery verification"
```

If no tracked file changed, do not create an empty commit.

- [ ] **Step 7: Push the branch and update the existing draft pull request**

Run:

```powershell
git status -sb
git log --oneline origin/agent/fix-windows-migration-package..HEAD
git push origin agent/fix-windows-migration-package
gh pr view 1 --repo lloyd-kay/daymark --json url,isDraft,headRefName,statusCheckRollup
```

Expected: the branch is clean and synchronized, PR `#1` remains a draft until the clean-VM evidence passes, and no binary artifact or secret is included.
