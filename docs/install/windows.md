# Install Daymark on Windows

The assisted installer is the recommended route for normal Windows users. It includes Daymark Control, the local booking runtime, the required Microsoft Visual C++ runtime, database tools, a Windows service wrapper, backups, and the optional public-link helper.

## What you need

- Windows 10 or Windows 11, 64-bit.
- An administrator account for the installation.
- About 700 MB free during installation and at least 1 GB free for future data and backups.
- If you are a maintainer or invited tester, the reviewed `Daymark-Setup-x64-<version>.exe` and matching `SHA256SUMS.txt` for the same commit.

The preview is not yet code-signed. Windows may show an **unrecognised publisher** warning. Confirm that the filename and SHA-256 match the reviewed build; do not bypass unrelated security warnings or use an installer from an unknown source.

## Obtain the installer

The installer is not yet a public download. If you are not a maintainer or invited tester, wait for a reviewed GitHub Release rather than accepting an `.exe` from a third party.

Maintainers can build the exact checked-out commit from an elevated PowerShell window after completing the [manual development prerequisites](manual.md):

```powershell
npm ci
npm run windows:verify-runtime
npm run windows:stage
npm run windows:installer
```

The final installer, `SHA256SUMS.txt`, and inspection report appear under `artifacts\release`. An invited tester should receive the installer and checksum together, plus the full commit identifier that produced them.

## Verify the installer

Open PowerShell in the folder containing both downloaded files:

```powershell
$installer = Get-ChildItem .\Daymark-Setup-x64-*.exe | Select-Object -First 1
(Get-FileHash $installer.FullName -Algorithm SHA256).Hash.ToLower()
Get-Content .\SHA256SUMS.txt
```

The two long hashes must match exactly. There is no direct public download until a real reviewed GitHub Release exists.

## Install and create the first company

1. Run the installer and accept the administrator prompt.
2. Read the unsigned-preview and data-location notice.
3. Let the installer finish its database migration and health check.
4. Open **Daymark Control** from the desktop shortcut.
5. Under first setup, choose **Reveal setup code** or **Copy setup code**. The installer created this one-time private key so only the computer's owner can create the first administrator. Do not send it to anyone.
6. Open `http://127.0.0.1:3210/workspace/sign-in`, choose **First-time setup**, and enter the code, company name, booking URL name, administrator name, email, and a password of at least 12 characters. The booking URL name is the short readable part of the client address—for example, `cedar-house` becomes `/book/cedar-house`.

Your client page is `http://127.0.0.1:3210/book/{company-slug}` on this computer. Clients do not sign in; they provide an appointment address and either an email address or phone number.

## Choose how Daymark runs

### Always-on service (recommended)

Daymark starts with Windows and keeps local booking available while the computer is on. This is the default.

### Manual mode

Daymark runs only while Daymark Control is open. The app displays this warning:

> Client booking links and temporary public links stop working when Daymark is closed. Availability cannot be served while this computer or Daymark is offline.

## Public booking access

- **Local only** is safest while setting up and testing on the same computer.
- **Temporary test link** creates a changing `trycloudflare.com` address so an invited tester can briefly open the local booking page from another device. It may stop without notice and is not for real client bookings.
- **Permanent address** is reserved for a later setup using your own domain and Cloudflare account. Daymark does not create those resources automatically.

A failure in the optional public link does not stop the local booking service.

## Files and backups

Application files live under `%ProgramFiles%\Daymark Control`. Mutable files are kept separately:

- Database: `%ProgramData%\Daymark\data`
- Verified backups: `%ProgramData%\Daymark\backups`
- Sanitised operational logs: `%ProgramData%\Daymark\logs`
- Windows-protected setup and tunnel material: `%ProgramData%\Daymark\secrets`

Use **Create backup** in Daymark Control before upgrades or important configuration changes. A successful backup has a JSON manifest and matching SQL file; **Verify backup** recomputes its SHA-256 before it is trusted. Copy verified backups to encrypted storage away from this computer.

## Upgrade

1. Create and verify a backup.
2. Verify the newer installer hash.
3. Run the newer installer over the existing version.
4. The installer stops Daymark, creates another pre-upgrade backup, replaces only application files, migrates, restarts the prior service mode, and checks health.
5. Confirm an existing appointment is still present before discarding the older installer.

## Uninstall safely

Use **Installed apps** in Windows Settings. Daymark removes the service, shortcut, application, and public-link helper. Calendars, appointments, protected details, logs, and backups under `%ProgramData%\Daymark` are **preserved by default**.

Permanent data removal is a separate confirmation and cannot be undone. Keep the recommended preserve option unless you have verified backups and deliberately intend to erase the installation.

If anything fails, use [Daymark troubleshooting](../troubleshooting.md). Release testing is recorded in the [Windows checklist](../windows-release-checklist.md).
