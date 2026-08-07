# Deploy Daymark to Cloudflare

This route runs Daymark on Cloudflare Workers with a D1 database in your Cloudflare account. Daymark does not create the account, database, route, domain, or production secrets automatically.

## Prerequisites

- Node.js 22.13.0 or newer and npm.
- A Cloudflare account with Workers and D1 access.
- A domain or Worker route you control if clients will use the deployment.
- Permission to create secrets and make encrypted database backups.

## Install and sign in with PowerShell

```powershell
git clone https://github.com/lloyd-kay/daymark.git
Set-Location daymark
npm ci
npx wrangler login
npx wrangler d1 create daymark
npm run build
```

Copy the database ID returned by Cloudflare into the `DB` binding in the generated `dist/server/wrangler.json`. Keep the binding name exactly `DB`. Because this file is generated, repeat the binding update after a clean rebuild and before migration or deployment.

## Prove migrations locally first

```powershell
npx wrangler d1 migrations apply DB --local --config dist/server/wrangler.json
npm run dev
```

Check the local site and `http://127.0.0.1:3000/api/health`. Local D1 and remote D1 are separate; a successful local migration does not change production.

## Back up and migrate remote D1

**Back up the remote D1 database before migrations.** Store the export encrypted and outside the repository. Then run:

```powershell
npx wrangler d1 export DB --remote --config dist/server/wrangler.json --output daymark-before-migration.sql
npx wrangler d1 migrations apply DB --remote --config dist/server/wrangler.json
```

Do not commit the export. After migration, run a remote `PRAGMA foreign_key_check;`; it must return no rows.

## Store the setup secret and deploy

Generate a long random setup code in a password manager, then let Wrangler prompt for it so it does not appear in shell history:

```powershell
npx wrangler secret put DAYMARK_SETUP_CODE --config dist/server/wrangler.json
npx wrangler deploy --config dist/server/wrangler.json
```

Open the deployed `/api/health`, then `/workspace/sign-in` to create the first company. Verify that `/book/{company-slug}` exposes only offered slots, a staff account cannot enter another company without an invitation, and D1 foreign-key checks remain clean.

Before every upgrade: export remote D1, test new migrations against a restored copy, rebuild, reapply the correct database binding, migrate with `--remote`, and deploy the reviewed revision.

## Recurring backups and restore checks

Export remote D1 on a regular schedule and before every migration or important configuration change. Keep dated exports encrypted outside the repository and outside the Cloudflare account when practical. At intervals appropriate for your organisation, import an export into a separate disposable D1 database, run migrations and foreign-key checks, sign in, and verify a test appointment. The full standard is in the [backup guide](../backups.md).

## Retire a Cloudflare deployment

1. Export D1 and verify the retained copy before removing anything.
2. Remove the public route or custom domain first so new bookings stop.
3. In the Cloudflare dashboard, delete the Daymark Worker only after confirming the correct account and service name. Worker secrets disappear with it.
4. Keep the D1 database while deciding how long the business data must be retained.
5. Delete D1 only as a separate, deliberate action after a second confirmation and a tested backup. Database deletion is irreversible.
6. Remove local exports only according to the same retention decision; never leave them unencrypted in the repository folder.

See [security guidance](../security.md) and [troubleshooting](../troubleshooting.md).
