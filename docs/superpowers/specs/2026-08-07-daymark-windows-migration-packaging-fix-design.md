# Daymark Windows migration packaging fix

## Problem

The Windows installer stages `runtime/local/backups.ts`, which imports `../../lib/runtime-health`, but the installer neither stages nor bundles the repository `lib` directory. On a clean Windows computer, `DaymarkRuntime.exe --migrate` therefore exits with `ERR_MODULE_NOT_FOUND` before Wrangler opens or changes the local database. The installer then displays its data-preservation failure message.

## Repair

Treat `lib` as an immutable runtime root everywhere the Windows package is assembled:

- copy `lib` into `artifacts/windows-stage` beside `runtime`, `dist`, and `drizzle`;
- map staged `lib` into the Tauri/NSIS resource bundle;
- list `lib` in the documented immutable installation layout.

No database schema, migration, runtime command, or user interface changes are required.

## Regression boundary

The installer contract test will assert that all three packaging layers include `lib`. The rebuilt staged runtime must contain `lib/runtime-health.ts`, and a disposable invocation of the packaged `DaymarkRuntime.exe --migrate` must return zero against a fresh test data directory.

## Verification and release

Run the installer contract, staging safety checks, packaged migration reproduction, web tests, desktop tests, Rust tests, lint, production build, Docker configuration check, and Windows installer inspection. Produce a new unsigned preview installer and SHA-256 checksum. Publish the source correction through a GitHub pull request; keep generated installer binaries out of Git history and do not create a public release without separate approval.

## Safety

All migration reproduction uses a disposable data root. Existing `%ProgramData%\Daymark` contents are never deleted or reused. Failure logs must not expose the protected setup code.
