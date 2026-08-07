# Self-hosting Daymark

Choose the guide that matches who will operate the installation:

- [Windows installer](install/windows.md) — recommended assisted setup with Daymark Control, local database, service, backup tools, and safe uninstall.
- [Docker Compose](install/docker.md) — a persistent container for a home server, VPS, or NAS.
- [Cloudflare](install/cloudflare.md) — Workers and D1 in your Cloudflare account.
- [Manual source](install/manual.md) — advanced development and custom server setup.

All routes use the same privacy rules: public pages reveal only offered slots, employees see only calendars granted within their company, and administrators cannot see memberships a person holds in another company. Back up before migrations or upgrades, test restores away from production, expose booking only through HTTPS, and align backups and logs with the 30-day appointment retention policy.

See [security guidance](security.md) and [troubleshooting](troubleshooting.md) before opening an installation to clients.
