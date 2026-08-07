# Daymark architecture

Daymark has one booking product with several ways to run it. The Windows installer, Docker image, manual local runtime, and Cloudflare deployment all serve the same company-scoped application and database model.

## Main parts

- The public website explains Daymark and demonstrates booking without creating real appointments.
- `/book/{company-slug}` and the widgets provide anonymous, company-specific booking.
- `/workspace/{company-slug}` is the private staff workspace.
- The application API resolves the company from a trusted route or membership before reading employees, availability, or appointments.
- The database stores global staff identities separately from invitation-only company memberships.
- Daymark Control manages the Windows service, protected setup material, backups, and optional public access.

## Privacy boundaries

Clients receive discrete offered slots, not the calendar events or rules behind them. Employees can access only the employee profile assigned to their membership. Company administrators can coordinate their own company, but they are not told whether a staff account belongs to another company.

The anonymous client never supplies an internal company identifier. The server resolves the public slug and applies the resulting company scope to employees, availability, blocked time, and appointments. Unknown or foreign identifiers return a generic unavailable response.

## Local Windows and Docker data flow

The local runtime listens on loopback by default and runs the built application with a local D1-compatible database. On Windows, immutable files live under Program Files while database state, backups, logs, and protected secrets live under ProgramData. Docker keeps the same mutable categories in its persistent named volume.

Optional tunnel support forwards HTTPS traffic to the loopback service. Tunnel failure is isolated from local runtime health. A temporary address is for testing only; a stable production address requires operator-owned domain and Cloudflare configuration.

## Cloudflare data flow

The Cloudflare route runs the application as a Worker and binds the database as `DB` in the operator's account. Local and remote D1 migrations are intentionally separate. Operators back up remote D1 before migration and manage deployment secrets through Cloudflare rather than repository files.

See the [security model](security.md), [backup guide](backups.md), and [installation routes](self-hosting.md).
