<p align="center">
  <img src="./public/og.png" alt="Daymark — private booking for teams" width="900">
</p>

<h1 align="center">Daymark</h1>

<p align="center"><strong>Book the right person. Keep every calendar private.</strong></p>

<p align="center">
  <img alt="Windows 10 and 11 x64" src="https://img.shields.io/badge/Windows-10%20%7C%2011%20x64-0b2b3a">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-ready-76a9bd">
  <img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-e66745">
  <img alt="Unsigned preview" src="https://img.shields.io/badge/release-unsigned%20preview-d8a23a">
  <img alt="Licence pending" src="https://img.shields.io/badge/licence-pending-a48bad">
</p>

Daymark is appointment scheduling built around separate employee calendars. Clients choose a person and one of the times that person offers; they never see the calendar behind those times. Employees see only their own company calendar, while a company administrator can coordinate that company without revealing one employee's calendar to another.

This repository is a working public preview. It is not yet a hosted service, and no public installer download or production Daymark domain is being claimed here.

<a id="choose-your-installation"></a>
## Choose your installation

| Method | Best for | Database included | Public address | Difficulty |
| --- | --- | ---: | --- | --- |
| **Windows installer** | Normal Windows users | Yes | Local first; optional testing link | **Recommended** |
| **Docker Compose** | Home servers, VPSs, and NASs | Yes | You provide a reverse proxy or domain | Easy |
| **Cloudflare** | Managed edge hosting | D1 in your account | Cloudflare route or domain | Intermediate |
| **Manual source** | Developers changing Daymark | Local D1 tools | Local unless configured | Advanced |

On a phone or narrow screen, choose from this shorter list:

- **Use Windows installer** if you want the complete app on one Windows computer with minimal setup.
- **Use Docker Compose** if you already operate a home server, VPS, or NAS.
- **Use Cloudflare** if you are comfortable managing Workers, D1, secrets, and a domain.
- **Use Manual source** only if you are developing Daymark or maintaining a custom server.

> [!IMPORTANT]
> The Windows installer is an unsigned preview and is **not yet available as a public download**. A maintainer or invited tester can build it locally or receive the installer and matching checksum directly for testing. Everyone else should wait for a reviewed GitHub Release; there is deliberately no made-up download link.

<a id="windows-installer"></a>
## Windows installer

This is the simplest route. One `.exe` contains Daymark Control, the booking app, its local database runtime, service support, backup tools, and the optional temporary-link helper. It does not require Docker or a separate Node.js installation.

1. As a maintainer or invited tester, obtain `Daymark-Setup-x64-<version>.exe` and its `SHA256SUMS.txt` for the exact reviewed commit.
2. Verify the file, run it as an administrator, and acknowledge the expected unsigned-preview notice.
3. Open Daymark Control, reveal the protected first-time setup code, then create the first company.

Read the complete [Windows installer guide](docs/install/windows.md), including service mode, backups, upgrades, and safe uninstall.

<a id="docker-compose"></a>
## Docker Compose

This route packages Daymark and its database tools into a container and keeps business data in the `daymark-data` volume. It is suitable for a private server where Docker already works.

```powershell
# PowerShell
Copy-Item .env.example .env.local
$bytes = New-Object byte[] 20
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$setupCode = -join ($bytes | ForEach-Object { $_.ToString("x2") })
(Get-Content .env.local) -replace 'replace-with-a-long-random-one-time-code', $setupCode | Set-Content .env.local
$setupCode = $null
docker compose build
docker compose up -d
docker compose ps
```

Follow the [Docker Compose guide](docs/install/docker.md) for the POSIX-shell equivalent, backup commands, and reverse-proxy requirements.

<a id="cloudflare"></a>
## Cloudflare

Use this route when you want Cloudflare Workers and a D1 database in your own account. You remain responsible for the Cloudflare account, domain or route, database backups, and deployment access.

See the [Cloudflare guide](docs/install/cloudflare.md) for separate local and remote migration commands.

<a id="manual-source-installation"></a>
## Manual source installation

> [!WARNING]
> Manual installation is for developers and experienced server operators. You are responsible for the Node runtime, database state, backups, updates, HTTPS, and keeping the Daymark process available.

The manual path supports PowerShell, Command Prompt, and macOS/Linux/Git Bash. Start with the [manual source guide](docs/install/manual.md).

<a id="verify-daymark"></a>
## Verify Daymark

For source-based installations, run these checks from the repository root:

```text
npm run unit
npm run lint
npm run build
npm test
```

A healthy local runtime answers at `http://127.0.0.1:3210/api/health` with status `ok`. The company-specific public address is `/book/{company-slug}`; plain `/book` intentionally cannot create appointments.

## Privacy and operations

- Staff accounts are invitation-only. One account may be granted access to several companies, but one company administrator is not told about another company's membership.
- Anonymous booking pages expose offered slots, not working calendars.
- Appointments older than 30 days are removed by the application; backups and external logs need matching retention rules.
- Temporary Quick Tunnel addresses are for testing only, not real client bookings.

Continue with the [architecture overview](docs/architecture.md), [backup guide](docs/backups.md), [security guidance](docs/security.md), [troubleshooting](docs/troubleshooting.md), or the [Windows release checklist](docs/windows-release-checklist.md). If you want to help improve Daymark, read [CONTRIBUTING.md](CONTRIBUTING.md). The project licence is pending until a deliberate `LICENSE` file is selected and committed.
