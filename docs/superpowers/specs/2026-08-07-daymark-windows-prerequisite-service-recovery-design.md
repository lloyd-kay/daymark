# Daymark Windows Prerequisite and Service Recovery Design

## Goal

Make the assisted Windows installation complete on a clean Windows 10 or Windows 11 x64 computer, then make Daymark Control report and manage the installed service correctly without requiring the entire app to run as administrator.

## Confirmed failures

The clean-VM installer copied the complete runtime and reached the migration command, but Wrangler returned `write EOF`. Installing Microsoft's current signed x64 Visual C++ Redistributable allowed the same Daymark installer to complete. The packaged `workerd.exe` imports the Visual C++ runtime DLLs, so the redistributable is a required offline prerequisite rather than an optional troubleshooting step.

After installation, Daymark Control showed **Needs attention** and could not start the service. Two source mismatches explain that state:

- the installed application root is `C:\Program Files\Daymark Control`, while the controller constructs `C:\Program Files\Daymark`;
- `/api/health` returns `appVersion` and `latestMigration`, while the Rust health decoder expects snake-case fields.

Changing a Windows service also requires elevation. Daymark Control currently launches the service wrapper directly and turns every failure into a generic administrator warning without requesting elevation.

## Installer prerequisite

The existing Daymark `.exe` remains the only file users need to run. The installer will contain a pinned x64 Microsoft Visual C++ Redistributable downloaded from an approved Microsoft HTTPS location, verified at build time by SHA-256, and checked for a valid Microsoft Authenticode signature during release inspection.

The NSIS post-install sequence will be:

1. install or confirm the bundled Visual C++ runtime;
2. prepare protected Daymark data folders;
3. apply database migrations;
4. install and start the Daymark service;
5. wait for local health.

The prerequisite will run unattended with restart suppression. A success result, an already-installed compatible/newer version, or a restart-required success result may continue. Other results stop Daymark installation with a prerequisite-specific recovery message. Daymark will never download the prerequisite on the customer's machine.

The runtime manifest, staging allowlist, Tauri resource map, immutable install layout, release inspection, notices, and installer contracts will describe the same prerequisite so none of those layers can silently omit it.

## Runtime paths and health

Installed runtime paths will be derived from the directory containing the running Daymark Control executable. This matches Tauri's actual installation directory and also keeps development/test overrides possible without hard-coded product-folder names. Mutable data remains fixed under `%ProgramData%\Daymark`.

The Rust health response will deserialize the API's camel-case fields. A `200` response with `status: "ok"`, `appVersion`, and `latestMigration` will display **Running**. Malformed responses, non-200 responses, or incomplete migrations will remain **Needs attention**.

## Administrator actions

Daymark Control will run normally without elevation. Read-only status, opening the administrator workspace, viewing setup state, and other ordinary actions will not request administrator access.

Only the fixed service actions `start`, `stop`, and `restart` may use Windows' `runas` elevation path. The executable path is resolved internally; the frontend cannot supply a program path or arbitrary command-line arguments. Windows will show its standard UAC prompt when one of these actions is requested.

Cancellation or denial returns a clear message that the action was cancelled and leaves the existing service state unchanged. A non-zero service-wrapper result reports that the service action failed rather than claiming every failure is a permission problem. Daymark Control refreshes service health after the elevated helper exits.

## Data safety

No database schema, setup code, appointment, availability, company membership, or backup format changes are part of this work. `%ProgramData%\Daymark` remains preserved on failed install, repair, upgrade, and recommended uninstall. The Visual C++ prerequisite is a machine-level Microsoft component and is not removed when Daymark is uninstalled.

## Verification

Test-first coverage will prove:

- the pinned Visual C++ package is staged, bundled, inspected, and invoked before migration;
- unsupported prerequisite exit codes stop installation safely;
- runtime files resolve relative to the actual executable directory;
- camel-case health JSON produces a running status;
- only the allowlisted service actions can request elevation;
- cancellation and service failures remain distinguishable and safe;
- existing source, desktop, Rust, staging, migration, installer, and artifact suites remain green.

The release gate is a fresh disposable Windows VM with no preinstalled Visual C++ Redistributable: one Daymark `.exe` must complete installation, report **Running**, open the local administrator workspace, and successfully perform an approved service restart. Generated installers and VM evidence remain outside Git history.
