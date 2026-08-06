# Daymark

Daymark is private, company-scoped appointment scheduling. Clients see only bookable slots; employees see only their own company calendars; administrators can coordinate the company that granted them access.

The project is currently a private preview. It is not a hosted service and does not collect trial enquiries.

## Requirements

- Node.js `>=22.13.0`
- npm
- A Cloudflare D1 database bound to the worker as `DB`
- A private `DAYMARK_SETUP_CODE`

## Local start

```text
npm ci
copy .env.example .env.local
npm run dev
```

Replace the example setup code before first use. The first administrator creates the first company and its unique booking URL from `/workspace/sign-in`.

## Checks

```text
npm run unit
npm run lint
npm run build
node --test tests/rendered-html.test.mjs
```

The complete installation, migration, backup, restore, and upgrade guide is in [docs/self-hosting.md](docs/self-hosting.md). Security and incident guidance is in [docs/security.md](docs/security.md).

## Core routes

- `/get-daymark` — setup choices
- `/book/{company-slug}` — anonymous external booking
- `/workspace/{company-slug}` — authorised company staff workspace
- `/join/{single-use-code}` — invitation acceptance

Plain `/book` intentionally performs no booking because a company slug is required.
