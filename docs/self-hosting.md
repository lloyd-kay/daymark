# Self-hosting Daymark

## Prerequisites

Use Node.js `>=22.13.0`, npm, a Cloudflare account, and a D1 database. The worker must receive that database under the binding name `DB`.

Create a local environment file from `.env.example`. Set `DAYMARK_SETUP_CODE` to a long random value that is unique to this installation. Never commit the real value. The example `replace-with-a-long-random-one-time-code` is deliberately non-secret.

## Install and verify

```text
npm ci
npm run unit
npm run lint
npm run build
```

On Windows PowerShell, if the package script cannot set the log path, use:

```text
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'; npx vinext build
```

## Database creation and migration

Create a D1 database and bind it as `DB` in the Cloudflare worker configuration used for your installation. Apply the committed migrations in filename order:

1. `drizzle/0000_icy_doorman.sql`
2. `drizzle/0001_daymark_widget_auth.sql`
3. `drizzle/0002_daymark_company_workspaces.sql`

For a configured Wrangler project, each migration can be applied with `npx wrangler d1 execute <database-name> --remote --file=<migration-file>`. Back up the database before every migration. After migration, run `PRAGMA foreign_key_check;`; it must return no rows.

## First company

Open `/workspace/sign-in`, choose **First-time setup**, and enter the private setup code, company name, unique booking URL slug, administrator name, email, and password. Share `/book/{company-slug}` with clients. Staff access is granted only through single-use administrator invitations.

## HTTPS and reverse proxies

Expose Daymark only over HTTPS. Preserve the original `Origin`, `Host`, and forwarding headers at the reverse proxy. Do not cache authentication, workspace, invitation, availability, or booking API responses. Keep the widget script public, but keep staff and join pages protected by their application checks.

## Backup and restore

Export D1 before upgrades and on a regular schedule. Store backups encrypted and outside the web root. Test restores in an isolated database. A restore is complete only after row-count checks, `PRAGMA foreign_key_check;`, a staff sign-in, a company-scoped booking read, and a test booking that is then cancelled.

## Upgrades

1. Back up the database and current source revision.
2. Review release notes and new SQL migrations.
3. Apply migrations in order to a restored test copy.
4. Run the full checks and verify company isolation.
5. Deploy the source revision, then apply the approved production migration.
6. Keep the prior revision and backup available for rollback.

Appointments older than 30 days are removed by the application retention process. Confirm that this period matches your organisation's policy before use.
