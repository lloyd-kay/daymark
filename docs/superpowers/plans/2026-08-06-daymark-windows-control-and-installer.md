# Daymark Windows Control and Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the branded Daymark Control desktop app and one assisted Windows x64 installer that includes the application, local database runtime, service wrapper, tunnel helper, backups, shortcuts, and uninstaller.

**Architecture:** A Tauri 2 shell provides the Daymark-branded control surface while Rust commands manage the separately installed local runtime, Windows service, DPAPI-protected secrets, and cloudflared processes. WinSW owns always-on service lifecycle; manual mode uses the same runtime and data. A custom per-machine NSIS bundle installs immutable files under Program Files and preserves mutable data under ProgramData.

**Tech Stack:** Tauri 2, Rust stable with locked `Cargo.lock`, React 19, TypeScript 5.9, WinSW 2.12.0, cloudflared 2026.7.3, NSIS via Tauri, Windows DPAPI, Vitest.

## Global Constraints

- First release supports 64-bit Windows 10 and Windows 11 only.
- Artifact name is `Daymark-Setup-x64-${version}.exe` and it is a complete offline installer.
- The unsigned preview must clearly warn that Windows may show an unrecognised-publisher warning.
- Always-on service mode is the default.
- Manual mode must show exactly: “Client booking links and temporary public links stop working when Daymark is closed. Availability cannot be served while this computer or Daymark is offline.”
- Local runtime binds only to loopback.
- Store immutable files under `%ProgramFiles%\Daymark`; mutable data, backups, and logs under `%ProgramData%\Daymark`.
- Setup and tunnel secrets use Windows-protected credential storage and never appear in logs or command lines.
- Uninstall preserves business data and backups unless the user separately confirms permanent deletion.
- No automatic updates and no GitHub Release publishing in this plan.

---

## File map

- `desktop/daymark-control/src/*`: branded React control interface.
- `desktop/daymark-control/src-tauri/src/contracts.rs`: serialized status and command contracts.
- `desktop/daymark-control/src-tauri/src/service.rs`: WinSW and manual runtime control.
- `desktop/daymark-control/src-tauri/src/secrets.rs`: DPAPI protection.
- `desktop/daymark-control/src-tauri/src/tunnel.rs`: local, temporary, and permanent access states.
- `desktop/daymark-control/src-tauri/src/backups.rs`: invokes the runtime backup interface.
- `desktop/daymark-control/src-tauri/src/main.rs`: Tauri command registration and lifecycle.
- `packaging/windows/DaymarkService.xml`: WinSW service definition.
- `packaging/windows/installer-hooks.nsh`: install, upgrade, and uninstall hooks.
- `packaging/windows/assets/*`: branded installer imagery and icons.
- `tests/windows/*`: PowerShell smoke tests for disposable Windows runners.

### Task 1: Scaffold Tauri and render the branded control shell

**Files:**
- Create: `desktop/daymark-control/package.json`
- Create: `desktop/daymark-control/vite.config.ts`
- Create: `desktop/daymark-control/tsconfig.json`
- Create: `desktop/daymark-control/index.html`
- Create: `desktop/daymark-control/src/main.tsx`
- Create: `desktop/daymark-control/src/App.tsx`
- Create: `desktop/daymark-control/src/daymark-control.css`
- Create: `desktop/daymark-control/src/App.test.tsx`
- Create: `desktop/daymark-control/src-tauri/Cargo.toml`
- Create: `desktop/daymark-control/src-tauri/tauri.conf.json`
- Create: `desktop/daymark-control/src-tauri/src/main.rs`

**Interfaces:**
- Produces: keyboard-accessible Daymark Control shell and Tauri app identifier `com.daymark.control`.
- Uses `RuntimeStatus` fixture until Task 2 provides the command.

- [ ] **Step 1: Write the failing visual contract test**

```tsx
render(<App initialStatus={stoppedStatus} />);
expect(screen.getByRole("heading", { name: "Daymark Control" })).toBeVisible();
expect(screen.getByText("Stopped")).toBeVisible();
expect(screen.getByRole("button", { name: "Start Daymark" })).toBeEnabled();
expect(screen.getByRole("link", { name: "Open administrator workspace" })).toHaveAttribute("href", "http://127.0.0.1:3210/workspace/sign-in");
```

- [ ] **Step 2: Confirm failure**

Run: `npm --prefix desktop/daymark-control test -- --run`

Expected: FAIL because the desktop project does not exist.

- [ ] **Step 3: Implement the shell**

Use the existing Libre Bodoni and DM Sans font assets, cream paper texture, coloured file-tab bands, navy text, coral action, visible focus rings, and `@media (prefers-reduced-motion: reduce)`. Include status, runtime mode, access, actions, backup, version, migration, and recovery panels. Status must be written text plus icon, never colour alone.

- [ ] **Step 4: Verify and commit**

Run: `npm --prefix desktop/daymark-control test -- --run && npm --prefix desktop/daymark-control run build`

Expected: PASS and a desktop frontend build.

```text
git add desktop/daymark-control
git commit -m "feat: scaffold branded Daymark Control"
```

### Task 2: Typed status, health polling, and safe external links

**Files:**
- Create: `desktop/daymark-control/src/contracts.ts`
- Create: `desktop/daymark-control/src/runtime.ts`
- Create: `desktop/daymark-control/src/runtime.test.ts`
- Create: `desktop/daymark-control/src-tauri/src/contracts.rs`
- Create: `desktop/daymark-control/src-tauri/src/status.rs`
- Modify: `desktop/daymark-control/src-tauri/src/main.rs`

**Interfaces:**
- Produces Rust/TypeScript-equivalent `RuntimeStatus` with `state`, `mode`, `access`, `localUrl`, `publicUrl`, `version`, `latestMigration`, and `message`.
- Tauri commands: `get_runtime_status() -> Result<RuntimeStatus, ControlError>` and `open_local_url(path: String) -> Result<(), ControlError>`.

- [ ] **Step 1: Write failing contract and URL tests**

```ts
expect(parseRuntimeStatus({ state: "running", mode: "service", access: "local", localUrl: "http://127.0.0.1:3210", publicUrl: null, version: "0.1.0", latestMigration: "0002_daymark_company_workspaces.sql", message: null }).state).toBe("running");
expect(() => assertSafeLocalUrl("https://example.com/workspace")).toThrow("Only the local Daymark address can be opened");
```

- [ ] **Step 2: Confirm failure**

Run: `npm --prefix desktop/daymark-control test -- --run src/runtime.test.ts`

Expected: FAIL because runtime contracts do not exist.

- [ ] **Step 3: Implement status polling**

Rust accepts only `http://127.0.0.1:3210` and `http://localhost:3210`, checks `/api/health` with a three-second timeout, and maps failures to `stopped` or `needs_attention` without surfacing response bodies. React polls every five seconds while the window is visible and pauses while hidden.

- [ ] **Step 4: Verify and commit**

Run: `npm --prefix desktop/daymark-control test -- --run && cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml`

Expected: PASS.

```text
git add desktop/daymark-control
git commit -m "feat: report Daymark runtime status"
```

### Task 3: Windows service and manual-mode lifecycle

**Files:**
- Create: `desktop/daymark-control/src-tauri/src/service.rs`
- Create: `desktop/daymark-control/src-tauri/tests/service_contract.rs`
- Create: `desktop/daymark-control/src/RuntimeModePanel.tsx`
- Create: `desktop/daymark-control/src/RuntimeModePanel.test.tsx`
- Modify: `desktop/daymark-control/src/App.tsx`
- Modify: `desktop/daymark-control/src-tauri/src/main.rs`
- Create: `packaging/windows/DaymarkService.xml`

**Interfaces:**
- Produces commands `start_runtime()`, `stop_runtime()`, and `set_runtime_mode(mode: RuntimeMode)`.
- `RuntimeMode` is `"service" | "manual"`; switching modes preserves the same `RuntimePaths`.

- [ ] **Step 1: Write failing manual-warning and service-command tests**

```tsx
render(<RuntimeModePanel mode="service" onChange={onChange} />);
await user.click(screen.getByRole("radio", { name: "Manual mode" }));
expect(screen.getByRole("alert")).toHaveTextContent("Client booking links and temporary public links stop working when Daymark is closed. Availability cannot be served while this computer or Daymark is offline.");
expect(onChange).not.toHaveBeenCalled();
await user.click(screen.getByRole("button", { name: "I understand — use manual mode" }));
expect(onChange).toHaveBeenCalledWith("manual");
```

- [ ] **Step 2: Confirm failure**

Run: `npm --prefix desktop/daymark-control test -- --run src/RuntimeModePanel.test.tsx`

Expected: FAIL because the mode panel does not exist.

- [ ] **Step 3: Implement lifecycle controls**

WinSW configuration must set service id `Daymark`, start mode `Automatic`, restart on unexpected exit, stop timeout 30 seconds, and bounded rolling logs under `%ProgramData%\Daymark\logs`. Arguments point to bundled `node.exe` and `runtime/local/cli.ts start` without embedding secrets. Manual mode launches the same command as a Tauri child and stops it when Control exits. Service actions require elevation and report actionable error codes.

- [ ] **Step 4: Verify and commit**

Run: `npm --prefix desktop/daymark-control test -- --run && cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml`

Expected: PASS.

```text
git add desktop/daymark-control packaging/windows/DaymarkService.xml
git commit -m "feat: manage Daymark service and manual mode"
```

### Task 4: DPAPI-protected first setup and backup actions

**Files:**
- Create: `desktop/daymark-control/src-tauri/src/secrets.rs`
- Create: `desktop/daymark-control/src-tauri/src/backups.rs`
- Create: `desktop/daymark-control/src/SetupPanel.tsx`
- Create: `desktop/daymark-control/src/BackupPanel.tsx`
- Create: `desktop/daymark-control/src/SetupPanel.test.tsx`
- Create: `desktop/daymark-control/src/BackupPanel.test.tsx`
- Modify: `desktop/daymark-control/src/App.tsx`
- Modify: `desktop/daymark-control/src-tauri/src/main.rs`

**Interfaces:**
- Produces commands `get_setup_state()`, `reveal_setup_code()`, `copy_setup_code()`, `create_backup()`, `verify_backup(path)`, and `restore_backup(path)`.
- Secrets are stored as DPAPI ciphertext scoped to the local machine and readable only by administrators/SYSTEM ACLs.

- [ ] **Step 1: Write failing disclosure and backup tests**

```tsx
expect(screen.queryByText("AAAAA-AAAAA-AAAAA-AAAAA")).not.toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "Reveal setup code" }));
expect(await screen.findByText("AAAAA-AAAAA-AAAAA-AAAAA")).toBeVisible();
expect(screen.getByRole("button", { name: "Create verified backup" })).toBeEnabled();
```

- [ ] **Step 2: Confirm failure**

Run: `npm --prefix desktop/daymark-control test -- --run src/SetupPanel.test.tsx src/BackupPanel.test.tsx`

Expected: FAIL because the panels do not exist.

- [ ] **Step 3: Implement protected secrets and backup bridge**

Generate 20 random Crockford Base32 characters with Windows CNG, group `5-5-5-5`, protect via DPAPI, and never pass the clear value through process arguments. Reveal only after an explicit action and clear from React state after 60 seconds or when the window loses focus. Backup commands invoke the local runtime CLI with JSON output, show integrity and creation time, and require typed confirmation before restore.

- [ ] **Step 4: Verify and commit**

Run: `npm --prefix desktop/daymark-control test -- --run && cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml`

Expected: PASS.

```text
git add desktop/daymark-control
git commit -m "feat: protect setup and backup controls"
```

### Task 5: Temporary and permanent public-access states

**Files:**
- Create: `desktop/daymark-control/src-tauri/src/tunnel.rs`
- Create: `desktop/daymark-control/src-tauri/tests/tunnel_contract.rs`
- Create: `desktop/daymark-control/src/PublicAccessPanel.tsx`
- Create: `desktop/daymark-control/src/PublicAccessPanel.test.tsx`
- Modify: `desktop/daymark-control/src/App.tsx`
- Modify: `desktop/daymark-control/src-tauri/src/main.rs`

**Interfaces:**
- Produces commands `start_quick_tunnel()`, `stop_tunnel()`, `begin_permanent_tunnel_login()`, and `save_permanent_tunnel_token(token)`.
- Access state is `local | temporary_starting | temporary | permanent | error`.

- [ ] **Step 1: Write failing temporary-link warning test**

```tsx
render(<PublicAccessPanel access="local" />);
await user.click(screen.getByRole("button", { name: "Create temporary test link" }));
expect(screen.getByRole("alert")).toHaveTextContent("Testing only");
expect(screen.getByText(/address may change or stop/i)).toBeVisible();
expect(screen.getByText(/not for real client bookings/i)).toBeVisible();
```

- [ ] **Step 2: Confirm failure**

Run: `npm --prefix desktop/daymark-control test -- --run src/PublicAccessPanel.test.tsx`

Expected: FAIL because public-access controls do not exist.

- [ ] **Step 3: Implement tunnel lifecycle**

Quick Tunnel runs bundled `cloudflared tunnel --url http://127.0.0.1:3210 --no-autoupdate`, parses only the assigned `https://*.trycloudflare.com` URL, and stops independently without touching Daymark. Permanent setup opens Cloudflare browser authentication or accepts a narrowly scoped tunnel token, stores the token through DPAPI, and refuses non-HTTPS public URLs. Public-access failure must leave local status running.

- [ ] **Step 4: Verify and commit**

Run: `npm --prefix desktop/daymark-control test -- --run && cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml`

Expected: PASS.

```text
git add desktop/daymark-control
git commit -m "feat: manage Daymark public access"
```

### Task 6: Assisted NSIS install, upgrade, and uninstall

**Files:**
- Create: `packaging/windows/installer-hooks.nsh`
- Create: `packaging/windows/install-layout.json`
- Create: `packaging/windows/assets/sidebar.bmp`
- Create: `packaging/windows/assets/header.bmp`
- Create: `tests/windows/installer-contract.test.ps1`
- Modify: `desktop/daymark-control/src-tauri/tauri.conf.json`

**Interfaces:**
- Consumes: built local runtime, Node runtime, WinSW, cloudflared, and Daymark Control.
- Produces: per-machine `Daymark-Setup-x64-${version}.exe` and registry uninstall entry.

- [ ] **Step 1: Write failing installer contract checks**

```powershell
$config = Get-Content 'desktop/daymark-control/src-tauri/tauri.conf.json' -Raw | ConvertFrom-Json
$config.bundle.targets | Should -Contain 'nsis'
$config.bundle.windows.nsis.installMode | Should -Be 'perMachine'
(Get-Content 'packaging/windows/installer-hooks.nsh' -Raw) | Should -Match 'Preserve Daymark data'
(Get-Content 'packaging/windows/installer-hooks.nsh' -Raw) | Should -Match 'Unsigned preview'
```

- [ ] **Step 2: Confirm failure**

Run: `pwsh -File tests/windows/installer-contract.test.ps1`

Expected: FAIL because installer hooks are absent.

- [ ] **Step 3: Implement installation lifecycle**

The installer checks x64 Windows 10/11, requests elevation, displays unsigned-preview and licence/data notices, installs immutable files, creates restricted ProgramData directories, generates the protected setup code, applies migrations, installs service mode by default, waits up to 60 seconds for health, creates shortcuts, then opens Control and first setup. Upgrade stops the prior mode, verifies data, creates a pre-upgrade backup, replaces only Program Files, migrates, restores the prior mode, and retains the backup on failure. Uninstall removes service, shortcuts, Control, and tunnel integration but preserves ProgramData by default; permanent deletion is a separate unchecked confirmation.

- [ ] **Step 4: Build and inspect the installer**

Run: `pwsh -File tests/windows/installer-contract.test.ps1`

Run: `npm --prefix desktop/daymark-control run tauri build -- --bundles nsis`

Expected: contract PASS and exactly one x64 NSIS executable renamed from the root package version, for example `Daymark-Setup-x64-0.1.0.exe`.

- [ ] **Step 5: Commit**

```text
git add packaging/windows desktop/daymark-control/src-tauri/tauri.conf.json tests/windows
git commit -m "feat: package assisted Windows installer"
```

### Task 7: Disposable Windows installation verification

**Files:**
- Create: `tests/windows/install-smoke.ps1`
- Create: `tests/windows/upgrade-smoke.ps1`
- Create: `tests/windows/uninstall-smoke.ps1`
- Create: `docs/windows-release-checklist.md`

**Interfaces:**
- Consumes: current and previous preview installers.
- Produces: machine-readable smoke results plus the manual Windows 10/11 x64 checklist.

- [ ] **Step 1: Write smoke scripts with explicit assertions**

Scripts must assert: service installed and automatic; `/api/health` is `ok`; first company can be created; a booking persists across service and machine restart; manual warning is present; Quick Tunnel failure does not stop local runtime; upgrade creates a verified backup and preserves booking; uninstall removes application files while `%ProgramData%\Daymark\data` remains.

- [ ] **Step 2: Run on a disposable Windows 11 x64 machine**

Run: `$installer = (Get-ChildItem .\Daymark-Setup-x64-*.exe | Select-Object -First 1).FullName; pwsh -File tests/windows/install-smoke.ps1 -Installer $installer`

Expected: PASS with no secrets in logs.

- [ ] **Step 3: Run upgrade and uninstall checks**

Run: `$installer = (Get-ChildItem .\Daymark-Setup-x64-*.exe | Select-Object -First 1).FullName; pwsh -File tests/windows/upgrade-smoke.ps1 -PreviousInstaller $env:DAYMARK_PREVIOUS_INSTALLER -Installer $installer`

Run: `pwsh -File tests/windows/uninstall-smoke.ps1`

Expected: PASS; data and backups remain after uninstall.

- [ ] **Step 4: Complete the manual checklist and commit**

Manually repeat clean install, restart, service booking, manual-mode warning, temporary link, upgrade, and uninstall on Windows 10 x64 and Windows 11 x64. Record OS build, installer hash, result, and evidence paths without client data.

```text
git add tests/windows docs/windows-release-checklist.md
git commit -m "test: verify Windows install lifecycle"
```
