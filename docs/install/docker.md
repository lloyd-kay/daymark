# Install Daymark with Docker Compose

Use this route on a home server, VPS, or NAS where Docker Engine and Docker Compose already work. Daymark listens only on the host's loopback address by default; add a properly configured HTTPS reverse proxy before sharing it.

## 1. Clone and create the private setup code

### PowerShell

```powershell
git clone https://github.com/lloyd-kay/daymark.git
Set-Location daymark
Copy-Item .env.example .env.local
$bytes = New-Object byte[] 20
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$setupCode = -join ($bytes | ForEach-Object { $_.ToString("x2") })
(Get-Content .env.local) -replace 'replace-with-a-long-random-one-time-code', $setupCode | Set-Content .env.local
$setupCode = $null
```

### macOS, Linux, or Git Bash

```bash
git clone https://github.com/lloyd-kay/daymark.git
cd daymark
cp .env.example .env.local
setup_code="$(openssl rand -hex 20)"
sed "s/replace-with-a-long-random-one-time-code/$setup_code/" .env.local > .env.local.new
mv .env.local.new .env.local
unset setup_code
```

Never commit `.env.local` or paste its setup code into an issue or log.

## 2. Build and start

```text
docker compose build
docker compose up -d
docker compose ps
```

Open `http://127.0.0.1:3210/api/health`; it should report `status` as `ok`. Then open `http://127.0.0.1:3210/workspace/sign-in` and create the first company with the setup code stored in `.env.local`.

## Data and backups

The Compose file stores database state, backups, and logs in the named `daymark-data` volume. `docker compose down` does not delete the `daymark-data` volume.

Create a verified SQL backup before upgrades:

```text
docker compose exec daymark node --import tsx runtime/local/cli.ts backup --app-dir /app --data-dir /var/lib/daymark/data --backup-dir /var/lib/daymark/backups --log-dir /var/lib/daymark/logs
```

Copy the resulting `.sql` and `.json` files from the volume to encrypted off-server storage and keep them together.

## Upgrade

1. Create and copy a verified backup.
2. Fetch the reviewed source revision.
3. Run `docker compose build`.
4. Run `docker compose up -d`.
5. Run `docker compose ps` and check `/api/health`.
6. Confirm an existing appointment remains available to the authorised staff member.

## Stop or remove

```text
docker compose down
```

> [!CAUTION]
> `docker compose down --volumes` permanently removes the local Daymark volume and its business data. It is intentionally not part of the normal instructions.

For public access, place an HTTPS reverse proxy in front of Daymark, preserve the original host and origin headers, and do not cache staff or booking API responses. See [security guidance](../security.md) and [troubleshooting](../troubleshooting.md).
