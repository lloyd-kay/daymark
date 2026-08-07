# Install Daymark manually from source

> [!WARNING]
> Manual installation is for developers and experienced server operators. You are responsible for the Node runtime, database state, backups, updates, HTTPS, and keeping the Daymark process available.

Use Node.js 22.13.0 or newer, npm, Git, and enough access to keep private environment files and backups outside the web root.

## Clone and install dependencies

These commands work in PowerShell, Command Prompt, macOS, Linux, or Git Bash:

```text
git clone https://github.com/lloyd-kay/daymark.git
cd daymark
npm ci
```

## Create `.env.local`

### PowerShell

```powershell
Copy-Item .env.example .env.local
$bytes = New-Object byte[] 20
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$setupCode = -join ($bytes | ForEach-Object { $_.ToString("x2") })
(Get-Content .env.local) -replace 'replace-with-a-long-random-one-time-code', $setupCode | Set-Content .env.local
$env:DAYMARK_SETUP_CODE = $setupCode
$setupCode = $null
```

### Command Prompt

```bat
copy .env.example .env.local
node -e "console.log(require('crypto').randomBytes(20).toString('hex'))"
```

Copy the generated value into `.env.local`, replacing the example, then set it for the current window with `set DAYMARK_SETUP_CODE=your-generated-value`.

### macOS, Linux, or Git Bash

```bash
cp .env.example .env.local
setup_code="$(openssl rand -hex 20)"
sed "s/replace-with-a-long-random-one-time-code/$setup_code/" .env.local > .env.local.new
mv .env.local.new .env.local
export DAYMARK_SETUP_CODE="$setup_code"
unset setup_code
```

Never commit `.env.local` or reuse the setup code as a password.

## Develop or run locally

For development in PowerShell, Command Prompt, macOS, Linux, or Git Bash:

```text
npm run dev
```

For the self-contained local runtime in any of those shells:

```text
npm run build
npm run runtime:migrate
npm run runtime:start
```

By default, the manual runtime stores mutable data under the repository's ignored `.daymark` directory. For a real server, set explicit protected data, backup, and log directories and configure an operating-system service. Never publish the local port directly; use an HTTPS reverse proxy.

## Verify before use

Run in PowerShell, Command Prompt, macOS, Linux, or Git Bash:

```text
npm run unit
npm run lint
npm run build
npm test
```

Check `http://127.0.0.1:3210/api/health`, then create the first company at `/workspace/sign-in`.

## Backup and upgrade

Run in the shell that holds your protected `DAYMARK_SETUP_CODE` environment value:

```text
npm run runtime:backup
```

Keep the generated SQL and JSON manifest together, verify them through Daymark Control or the runtime backup verifier, and copy them to encrypted storage. Before upgrading, back up, inspect the reviewed commit, run the checks above, migrate, restart the service, and confirm an existing booking. Do not pull and run an unreviewed branch on a production database.

## Stop or remove a manual installation

1. Stop the operating-system service or the terminal process running Daymark and confirm `/api/health` no longer responds.
2. Create and verify a final backup, then copy it outside the repository.
3. If you used the default `.daymark` directory, remember that it is inside the checkout: preserve or move it before removing the checkout.
4. Remove the service definition and HTTPS reverse-proxy route before deleting application files.
5. Retain the protected data and backups for the required period. Delete them only as a separate, deliberate action after confirming the exact path and testing the retained backup.

Read the [architecture overview](../architecture.md), [backup guide](../backups.md), [self-hosting index](../self-hosting.md), [security guidance](../security.md), and [troubleshooting](../troubleshooting.md).
