# Daymark backup guide

Back up Daymark before every upgrade or migration and on a schedule appropriate for the appointments you hold. Store backup copies encrypted, outside the application directory, and away from the computer or account running Daymark.

## Windows installer

Use **Create backup** in Daymark Control. A completed backup contains a `.sql` export and a `.json` manifest under `%ProgramData%\Daymark\backups`. Use **Verify backup** to recompute the SQL file's SHA-256 before trusting it. Keep the pair together and copy both files to protected storage.

The Windows installer also creates a verified pre-upgrade backup before replacing application files. Uninstall preserves the Daymark data and backup directories by default.

## Docker Compose

Run the backup command in the [Docker guide](install/docker.md). It writes the SQL and manifest into the persistent `daymark-data` volume. Copy both files out to encrypted off-server storage; a Docker volume alone is not an independent backup.

## Cloudflare D1

Export remote D1 before applying remote migrations, as shown in the [Cloudflare guide](install/cloudflare.md). Do not commit exports. Keep the export encrypted and test restoration against a separate disposable D1 database before relying on it.

## Manual source installation

Run `npm run runtime:backup` with the same protected runtime environment used by Daymark. Verify the resulting manifest and SQL pair, then copy it away from the working directory.

## Restore standard

A restore is not proven merely because a file imported. On an isolated installation:

1. Verify the backup hash before import.
2. Apply the expected migrations.
3. Run database integrity and foreign-key checks.
4. Confirm staff sign-in and company isolation.
5. Confirm an existing appointment and create a disposable test appointment.
6. Record the result without setup codes, passwords, tokens, client details, or internal addresses.

If verification fails, keep current data unchanged and follow [troubleshooting](troubleshooting.md).
