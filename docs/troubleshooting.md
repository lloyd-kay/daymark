# Daymark troubleshooting

These recovery steps preserve business data. Sanitise logs before sharing them: remove appointment details, addresses, contacts, setup codes, tokens, domains, and internal network addresses.

<details>
<summary><strong>Port 3210 is already in use</strong></summary>

Daymark could not bind its local address. Data and backups remain safe. Check the process using port 3210 with `Get-NetTCPConnection -LocalPort 3210` in PowerShell or `ss -ltnp | grep 3210` on Linux. Stop the unrelated process or deliberately choose a different Daymark port, then restart Daymark and check `/api/health`.
</details>

<details>
<summary><strong>Service will not start</strong></summary>

The Windows service failed, but `%ProgramData%\Daymark\data` remains untouched. Open Daymark Control and use its status and retry controls. Check sanitised logs under `%ProgramData%\Daymark\logs`; create a backup before repair or reinstall. Reinstalling the same reviewed version replaces application files and preserves data.
</details>

<details>
<summary><strong>Migration failed</strong></summary>

Daymark stopped rather than claiming the database was ready. Keep the current data directory unchanged. Preserve the failure log and the most recent verified backup, then test the migration against a restored disposable copy. Do not retry production migrations repeatedly until the failing step is understood.
</details>

<details>
<summary><strong>Backup verification failed</strong></summary>

The SQL file no longer matches its manifest and must not be used for restore. Current Daymark data is unchanged. Keep the failed pair for investigation, create a fresh backup, verify it, and copy the new pair to encrypted storage. Never edit the SQL or manifest in place.
</details>

<details>
<summary><strong>Temporary link stopped</strong></summary>

Quick Tunnel addresses may change or stop without notice; this does not stop local Daymark. Confirm `http://127.0.0.1:3210/api/health`, then create a new temporary link in Daymark Control. Do not treat a replacement temporary address as a stable client URL.
</details>

<details>
<summary><strong>Permanent tunnel credentials were revoked</strong></summary>

Public access stops, but the loopback service and database remain safe. Confirm local health, revoke the old Cloudflare token fully, issue a replacement with only the required tunnel permissions, and store it again through Daymark Control. Never put the token in a command line, issue, screenshot, or log.
</details>

<details>
<summary><strong>Data appears locked or damaged</strong></summary>

Stop automated retries and preserve the current directory. Create a filesystem-level copy while Daymark is stopped, retain the latest verified application backup, and test restoration only in an isolated location. Routine recovery never begins by removing the Daymark ProgramData directory.
</details>

For incident handling and company-isolation expectations, read [security guidance](security.md). Windows release testers should also use the [release checklist](windows-release-checklist.md).
