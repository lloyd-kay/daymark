# Daymark Company Tenancy Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce durable company workspaces, global staff accounts, private multi-workspace memberships, and workspace-authorized staff routes without losing existing Daymark records.

**Architecture:** Separate global identity (`accounts`, `credentials`, `auth_sessions`) from company authorization (`workspaces`, `memberships`). Every company-owned record carries or derives a mandatory workspace ID. A session authenticates an account; a second server-side lookup authorizes that account for the workspace slug in the route.

**Tech Stack:** Vinext, React 19, TypeScript 5.9, Drizzle ORM 0.45, Cloudflare D1/SQLite, Vitest.

## Global Constraints

- An account may hold approved memberships in multiple workspaces.
- A visitor cannot self-join a workspace.
- Administrators never receive another workspace's name, role, or membership count.
- Unknown or unauthorized workspace access must not confirm whether foreign records exist.
- Preserve the 30-day appointment retention rule and existing staff password/session protections.
- Keep the application local; do not publish, create a domain, or launch Daymark Hosted.

---

### Task 1: Workspace, account, and membership schema

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/0002_daymark_company_workspaces.sql`
- Modify: `drizzle/meta/_journal.json`
- Create: `drizzle/meta/0002_snapshot.json`
- Modify: `tests/schema.test.ts`

**Interfaces:**
- Produces: `workspaces`, `accounts`, workspace-scoped `memberships`, account-scoped `credentials` and `authSessions`.
- Produces: `workspaceId` on company-owned profile, invitation, availability, block, and appointment records.

- [ ] **Step 1: Write failing schema and migration tests**

Add assertions using `getTableColumns` that `workspaces.slug` is required, `memberships.workspaceId` and `memberships.accountId` are required, `credentials.accountId` replaces `membershipId`, and every company-owned table has a required `workspaceId`. Read `0002_daymark_company_workspaces.sql` and assert that it creates the initial workspace before copying legacy rows and does not re-enable foreign keys until all rebuilds finish.

- [ ] **Step 2: Run the focused test and verify the missing tables/columns fail**

Run: `npm run unit -- tests/schema.test.ts`

Expected: FAIL because `workspaces`, `accounts`, and workspace columns do not exist.

- [ ] **Step 3: Define the normalized schema**

Use these table boundaries:

```ts
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (table) => [uniqueIndex("idx_workspaces_slug").on(table.slug)]);

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (table) => [uniqueIndex("idx_accounts_email").on(table.email)]);

export const memberships = sqliteTable("memberships", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  accountId: text("account_id").notNull().references(() => accounts.id),
  role: text("role").$type<TeamRole>().notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (table) => [
  uniqueIndex("idx_memberships_workspace_account").on(table.workspaceId, table.accountId),
  index("idx_memberships_account_active").on(table.accountId, table.active),
]);
```

Scope `employeeProfiles`, `invitations`, `availabilityRules`, `blockedPeriods`, and `appointments` with non-null `workspaceId`. Store invitation `emailHash`, requested `role`, and optional `employeeProfileId`. Point credentials and sessions to `accountId`.

- [ ] **Step 4: Generate and inspect the migration**

Run: `npm run db:generate`

Edit the generated SQL so it creates a deterministic legacy workspace (`id='workspace-daymark'`, `name='Daymark'`, `slug='daymark'`), copies each legacy account once by normalized email, maps existing memberships to accounts, and assigns every legacy company-owned row to `workspace-daymark`. Keep `PRAGMA foreign_keys=OFF` through the final dependent-table rebuild, then run `PRAGMA foreign_key_check` and `PRAGMA optimize` before commit.

- [ ] **Step 5: Run schema tests**

Run: `npm run unit -- tests/schema.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the schema boundary**

```text
git add db/schema.ts drizzle tests/schema.test.ts
git commit -m "feat: add company workspace schema"
```

### Task 2: Workspace slug and authorization contracts

**Files:**
- Create: `lib/workspaces/slug.ts`
- Create: `lib/workspaces/contracts.ts`
- Modify: `lib/data/contracts.ts`
- Modify: `lib/auth/membership.ts`
- Modify: `lib/auth/repository.ts`
- Modify: `tests/authorization.test.ts`
- Modify: `tests/repository.test.ts`

**Interfaces:**
- Produces: `normalizeWorkspaceSlug(value: string): string`.
- Produces: `WorkspaceSummary`, `AccountSessionRecord`, and `WorkspaceActor` with `workspaceId`, `workspaceSlug`, `accountId`, `membershipId`, `role`, and workspace-local `employeeProfileId`.
- Produces: `getWorkspaceActor(slug: string, request?: Request): Promise<WorkspaceActor | null>`.

- [ ] **Step 1: Write failing slug and cross-workspace authorization tests**

Test that `normalizeWorkspaceSlug(" Cedar House ")` returns `cedar-house`, reserved values such as `sign-in`, `api`, `book`, `embed`, and `get-daymark` are rejected by `workspaceSlugError`, and `resolveWorkspaceActor(session, membership)` returns null when account IDs or workspace IDs do not match.

- [ ] **Step 2: Verify the focused tests fail**

Run: `npm run unit -- tests/authorization.test.ts tests/repository.test.ts`

Expected: FAIL for missing workspace contracts and slug helpers.

- [ ] **Step 3: Implement the pure authorization boundary**

Define:

```ts
export type AccountSessionRecord = {
  accountId: string;
  email: string;
  displayName: string;
  active: boolean;
  mustChangePassword: boolean;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
};

export type WorkspaceActor = AccountSessionRecord & {
  workspaceId: string;
  workspaceSlug: string;
  membershipId: string;
  employeeProfileId: string | null;
  role: "admin" | "employee";
};
```

`getWorkspaceActor` must hash the session cookie, load the account session, resolve the active workspace by slug, then load exactly one active membership for the same account and workspace. Do not return the account's other memberships.

- [ ] **Step 4: Update repository projections**

Change credential and session lookups to account IDs. Add `findWorkspaceMembership(accountId, workspaceSlug)` and `listAccountWorkspaces(accountId)`; the latter is used only for the signed-in user's private chooser. Add `workspaceId` to `ScheduleScope` and require it in `profileIdsForScope`.

- [ ] **Step 5: Run focused tests**

Run: `npm run unit -- tests/authorization.test.ts tests/repository.test.ts tests/staff-account-repository.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit authorization contracts**

```text
git add lib/workspaces lib/data/contracts.ts lib/auth tests
git commit -m "feat: authorize staff by company workspace"
```

### Task 3: Atomic first-company setup and global sign-in

**Files:**
- Modify: `lib/auth/service.ts`
- Modify: `lib/auth/repository.ts`
- Modify: `app/api/auth/setup/route.ts`
- Modify: `app/workspace/sign-in/SignInPanel.tsx`
- Modify: `tests/auth-service.test.ts`
- Modify: `tests/auth-routes.test.ts`

**Interfaces:**
- Consumes: `normalizeWorkspaceSlug`, account-scoped sessions, normalized schema.
- Produces: `createInitialWorkspaceAdministrator({ workspaceName, workspaceSlug, email, displayName, verifier }): Promise<{ accountId: string; workspaceSlug: string }>`.
- Produces: setup success body `{ ok: true, mustChangePassword: false, workspaceSlug: string }`.

- [ ] **Step 1: Write failing setup tests**

Extend setup fixtures with `workspaceName: "Cedar House"` and `workspaceSlug: "cedar-house"`. Assert invalid/reserved slugs return 400, an existing workspace returns 409, and successful setup calls one atomic dependency then issues an account session.

- [ ] **Step 2: Verify setup tests fail**

Run: `npm run unit -- tests/auth-service.test.ts tests/auth-routes.test.ts`

Expected: FAIL because setup accepts no workspace fields and sessions still use membership IDs.

- [ ] **Step 3: Implement account-scoped authentication**

Change `issueSession` to accept `accountId`. Change sign-in, password replacement, session revocation, and lockout persistence to use account IDs. Keep the generic invalid-credential response and existing timing-safe dummy verifier.

- [ ] **Step 4: Implement atomic initial setup**

In one D1 batch, insert the workspace, account, credential, administrator membership, and session prerequisites. The repository must return no partial success. Extend the first-time setup form with Company name and Booking URL fields, and redirect success to `/workspace/${workspaceSlug}`.

- [ ] **Step 5: Run auth tests**

Run: `npm run unit -- tests/auth-service.test.ts tests/auth-routes.test.ts tests/password.test.ts tests/request-security.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit setup and sign-in changes**

```text
git add lib/auth app/api/auth app/workspace/sign-in tests
git commit -m "feat: create the first company workspace atomically"
```

### Task 4: Company-scoped staff routes and private workspace chooser

**Files:**
- Create: `app/workspace/[workspaceSlug]/page.tsx`
- Create: `app/workspace/[workspaceSlug]/sign-in/page.tsx`
- Create: `app/workspace/WorkspaceChooser.tsx`
- Modify: `app/workspace/page.tsx`
- Modify: `app/workspace/WorkspaceClient.tsx`
- Modify: `lib/workspace-runtime.ts`
- Modify: `lib/workspace-service.ts`
- Modify: `app/api/workspace/schedule/route.ts`
- Modify: `app/api/workspace/availability/route.ts`
- Modify: `app/api/workspace/team/route.ts`
- Modify: `tests/workspace-routes.test.ts`
- Modify: `tests/workspace-ui.test.tsx`

**Interfaces:**
- Consumes: `getWorkspaceActor(workspaceSlug)`, `listAccountWorkspaces(accountId)`.
- Produces: protected `/workspace/[workspaceSlug]` and workspace API calls requiring `workspace` query scope until APIs receive path routes in the booking-surface plan.

- [ ] **Step 1: Write failing route and privacy tests**

Assert signed-out access redirects to `/workspace/cedar-house/sign-in`, foreign membership returns a generic access-denied screen, and the server props sent to an administrator contain no other-workspace membership data. Assert `/workspace` lists workspaces only for the signed-in account.

- [ ] **Step 2: Verify the route tests fail**

Run: `npm run unit -- tests/workspace-routes.test.ts tests/workspace-ui.test.tsx`

Expected: FAIL because the workspace has no slug route or chooser.

- [ ] **Step 3: Add company route authorization**

Resolve route `workspaceSlug` before loading profiles, schedules, or availability. Pass `workspaceId` through `ScheduleScope` and every workspace service dependency. Return 404/403 without querying team records when membership is absent.

- [ ] **Step 4: Add the private chooser**

The generic `/workspace` route may list `{ name, slug, role }` only to its signed-in account. Do not include this list in company admin APIs or team projections. Company-specific sign-in includes a same-origin return path and never confirms whether an email has another membership.

- [ ] **Step 5: Run workspace tests**

Run: `npm run unit -- tests/workspace-routes.test.ts tests/workspace-team-route.test.ts tests/workspace-ui.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit staff routing**

```text
git add app/workspace app/api/workspace lib/workspace-runtime.ts lib/workspace-service.ts tests
git commit -m "feat: scope staff workspaces by company"
```

### Task 5: Invitation-only multi-company membership

**Files:**
- Create: `app/join/[code]/page.tsx`
- Create: `app/join/[code]/JoinWorkspacePanel.tsx`
- Create: `app/api/auth/invitations/accept/route.ts`
- Modify: `lib/auth/staff-accounts.ts`
- Modify: `lib/auth/repository.ts`
- Modify: `app/workspace/TeamAccessPanel.tsx`
- Modify: `tests/staff-accounts.test.ts`
- Modify: `tests/staff-account-repository.test.ts`
- Modify: `tests/workspace-team-route.test.ts`

**Interfaces:**
- Produces: `createWorkspaceInvitation(actor, { email, role, employeeProfileId }): Promise<{ code: string; expiresAt: string } | null>`.
- Produces: `acceptWorkspaceInvitation(code, accountId): Promise<{ workspaceSlug: string } | null>`.

- [ ] **Step 1: Write failing invitation privacy tests**

Assert the same neutral admin response is returned when the invited email is new or already has an account. Assert only the matching signed-in account may accept the code, codes are hashed and single-use, expiry is enforced, and accepting creates one workspace membership without changing memberships elsewhere.

- [ ] **Step 2: Verify invitation tests fail**

Run: `npm run unit -- tests/staff-accounts.test.ts tests/staff-account-repository.test.ts tests/workspace-team-route.test.ts`

Expected: FAIL because current staff creation is membership-local and reveals credential state.

- [ ] **Step 3: Implement neutral invitation creation**

Store `workspaceId`, normalized-email hash, requested role, optional profile ID, expiry, and creator membership. Return the raw code only once. The admin UI always says: `Access invitation created. Existing Daymark users keep their current password.`

- [ ] **Step 4: Implement invitation acceptance**

Hash the code, require an unredeemed unexpired invitation, hash the signed-in account email, compare hashes, then insert the workspace membership and link the profile in one batch. Mark the invitation redeemed only in the same successful batch. Duplicate acceptance returns a generic invalid-invitation result.

- [ ] **Step 5: Run invitation and full tenancy tests**

Run: `npm run unit -- tests/staff-accounts.test.ts tests/staff-account-repository.test.ts tests/workspace-team-route.test.ts tests/authorization.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit invitation-only access**

```text
git add app/join app/api/auth/invitations lib/auth app/workspace/TeamAccessPanel.tsx tests
git commit -m "feat: grant company access by private invitation"
```

### Task 6: Tenancy-stage verification

**Files:**
- Verify: all files changed in Tasks 1-5

- [ ] **Step 1: Run the full unit suite**

Run: `npm run unit`

Expected: all tests pass.

- [ ] **Step 2: Run lint and the Windows-compatible production build**

Run: `npm run lint`

Run in PowerShell: `$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'; npx vinext build`

Expected: both commands exit 0 and the build lists the company workspace and join routes.

- [ ] **Step 3: Run rendered-route tests and inspect migration integrity**

Run: `node --test tests/rendered-html.test.mjs`

Run the migration against a copied local D1 database, then execute `PRAGMA foreign_key_check;` and confirm it returns zero rows.

- [ ] **Step 4: Record the tenancy checkpoint**

```text
git status --short
git log -6 --oneline
```

Expected: clean working tree with each tenancy task committed.
