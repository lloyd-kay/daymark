# Contributing to Daymark

Daymark is currently a public preview with its software licence still pending. Opening a contribution does not grant rights beyond GitHub's normal contribution workflow; do not redistribute or reuse the project until a deliberate `LICENSE` file is committed.

## Before proposing a change

1. Open an issue describing the user problem, unless the change is a small documentation correction.
2. Keep the existing privacy boundaries: company membership is invitation-only, employees do not see one another's calendars, and anonymous users see offered slots only.
3. Never include real setup codes, passwords, tunnel tokens, appointment details, database files, `.env` files, logs, backup exports, internal addresses, or screenshots containing private data.
4. Back up any local development data before migrations.

## Develop and verify

Use Node.js 22.13.0 or newer, follow the [manual source guide](docs/install/manual.md), and keep changes focused. Before requesting review, run:

```text
npm run unit
npm run lint
npm run build
npm test
```

Windows Control or installer changes must also pass the relevant tests under `desktop/daymark-control` and `tests/windows`. Do not attach or publish an installer unless its source revision, SHA-256, unsigned status, and disposable-machine test evidence are clear.

## Pull requests

Explain the user-visible result, privacy or data implications, tests run, and any manual checks still pending. Link the issue or approved plan. Keep generated builds, local databases, secrets, and test evidence containing private data out of commits.

Read the [architecture overview](docs/architecture.md), [security guidance](docs/security.md), and [backup guide](docs/backups.md) before changing authentication, company scoping, booking, persistence, public access, or installation behavior.
