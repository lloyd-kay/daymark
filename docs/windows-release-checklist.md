# Daymark Windows preview release checklist

This checklist is for disposable test machines only. Do not run installation lifecycle tests on a computer that holds real Daymark business data.

## Evidence to record

- Release version:
- Tester:
- Date:
- Installer filename:
- Installer SHA-256:
- Evidence folder:
- No secrets, setup codes, passwords, client details, or tunnel tokens appear in logs: Not yet run

## Automated lifecycle matrix

| Platform | Clean install | Service + health | First company | Booking survives restart | Failed tunnel isolated | Upgrade + verified backup | Uninstall preserves data | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Windows 10 x64 | Not yet run | Not yet run | Not yet run | Not yet run | Not yet run | Not yet run | Not yet run | Not yet run |
| Windows 11 x64 | Not yet run | Not yet run | Not yet run | Not yet run | Not yet run | Not yet run | Not yet run | Not yet run |

## Manual checks on each platform

- Windows shows the expected unrecognised-publisher warning for this unsigned preview.
- The installer uses the Daymark header and sidebar artwork without distortion.
- Daymark Control opens from the desktop shortcut.
- Manual mode shows exactly: “Client booking links and temporary public links stop working when Daymark is closed. Availability cannot be served while this computer or Daymark is offline.”
- A temporary public link is clearly marked as unsuitable for real client bookings.
- The installer creates no desktop terminal window during normal service operation.
- The installed application contains `lib\runtime-health.ts` and `package.json`; the smoke evidence reports `installedRuntimeDependencies: true`.
- Upgrade preserves the original appointment and records a verified pre-upgrade backup.
- Uninstall defaults to preserving `%ProgramData%\Daymark` and requires a separate destructive confirmation to delete it.

## Run order

1. On a clean disposable machine, run `install-smoke.ps1` with `-ConfirmDisposableMachine -ManualWarningConfirmed` and the preview installer.
2. Restart Windows, then rerun it with `-ResumeAfterRestart -ConfirmDisposableMachine`.
3. Run `upgrade-smoke.ps1` with the previous and current installers.
4. Run `uninstall-smoke.ps1`, choose the recommended option to preserve data, and retain the JSON evidence files.
5. Inspect the evidence and installer logs for accidental secrets before marking the platform passed.

## Release decision

- Windows 10 x64 result: Not yet run
- Windows 11 x64 result: Not yet run
- Code signing status: Unsigned preview
- Public GitHub Release approved by project owner: Not yet approved
- Final release decision: Not yet run
