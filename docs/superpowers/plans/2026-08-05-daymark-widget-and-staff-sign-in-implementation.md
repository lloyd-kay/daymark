# Daymark Widget and Staff Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Daymark’s root route into a non-transactional product demonstration, move real anonymous booking to `/book`, add floating and inline iframe widgets, and replace ChatGPT identity with secure administrator-managed staff email/password accounts.

**Architecture:** The existing role-scoped workspace and booking services remain the authorization and scheduling core. New focused authentication modules own password derivation, opaque sessions, throttling, cookies, and D1 credential persistence; live and demonstration booking wrappers share one UI through separate transport objects. A tiny host-page script creates an isolated `/embed` iframe, while the root page uses only the local demonstration transport and cannot call production booking endpoints.

**Tech Stack:** Vinext, React 19, TypeScript 5.9, Cloudflare Workers Web Crypto and D1, Drizzle ORM, Vitest, Node test runner, Lucide React, global CSS, Sites hosting.

## Global Constraints

- Clients never sign in and never receive free/busy records, calendar metadata, client data, or the reason a slot is unavailable.
- Employees can read and modify only their own schedule; administrators retain full-team access, enforced on every server read and write.
- The root route is a clearly labelled demonstration that performs no availability or booking network requests.
- Real anonymous booking lives at `/book` and requires name, service address, and at least one valid contact method: email, phone, or both.
- Appointment address, contact details, notes, reference, and schedule data are hard-deleted 30 days after the appointment ends.
- Staff accounts are created only by administrators. Generated temporary passwords are displayed once and must be changed before schedule or client data is shown.
- Permanent passwords are 12–128 characters, salted per account, and derived with PBKDF2-SHA-256 at 210,000 iterations; readable passwords are never stored or logged.
- Sessions use random opaque tokens, store only token hashes, expire after 12 hours idle and seven days absolute, and are revoked on logout, password change/reset, or account deactivation.
- Login responses do not reveal whether an email exists; repeated failures are throttled by hashed normalized email plus hashed request fingerprint.
- Both widget modes use one script and the same iframe booking route. The host page receives only size and close messages, never booking data.
- Only `/embed` permits external HTTPS framing; all other Daymark pages reject external framing.
- Widget configuration is limited to `data-mode`, `data-employee`, and optional `data-label`; arbitrary CSS, HTML, client accounts, notifications, calendar sync, payments, analytics, and multiple organizations remain out of scope.
- Times remain stored in UTC and displayed in Europe/London.
- Preserve the parchment, ink, coral rail, and paper-tab visual identity across homepage, booking, widget, sign-in, and workspace.
- Preserve keyboard/touch access, focus restoration, reduced motion, responsive layouts, and WCAG AA-conscious contrast.
- Do not publish publicly without an explicit user approval immediately before the public deployment call.

## File Map

- `db/schema.ts`: credential, session, attempt, membership, and appointment schema changes.
- `drizzle/0001_daymark_widget_auth.sql`: generated migration for authentication and richer booking details.
- `lib/data/contracts.ts`: nullable contact fields, address, credential-aware team profiles, and password-change actor state.
- `lib/auth/password.ts`: PBKDF2, salt, opaque-token, temporary-password, and constant-time verification helpers.
- `lib/auth/request-security.ts`: cookie parsing/serialization, same-origin checks, and hashed request fingerprints.
- `lib/auth/repository.ts`: D1 account, credential, attempt, session, reset, and revocation persistence.
- `lib/auth/service.ts`: pure setup, sign-in, password-change, logout, throttling, and generic-error orchestration.
- `lib/auth/runtime.ts`: production dependency wiring for authentication routes.
- `lib/auth/staff-accounts.ts`: administrator-facing temporary-password creation, reset, activation, and session revocation.
- `lib/auth/membership.ts`: session-to-workspace actor resolution and unchanged role guards.
- `app/api/auth/setup/route.ts`: first-administrator setup and session creation.
- `app/api/auth/sign-in/route.ts`: generic staff credential authentication.
- `app/api/auth/password/route.ts`: forced temporary-password replacement.
- `app/api/auth/sign-out/route.ts`: session revocation and cookie clearing.
- `app/workspace/sign-in/page.tsx`: staff sign-in and first-administrator setup entry.
- `app/workspace/sign-in/SignInPanel.tsx`: accessible sign-in/setup interaction.
- `app/workspace/PasswordChangeGate.tsx`: forced password-change form.
- `app/workspace/page.tsx`: session-protected workspace routing.
- `app/workspace/TeamAccessPanel.tsx`: administrator account creation, reset, activation, and one-time temporary password display.
- `app/workspace/EmbedPanel.tsx`: mode/employee selection, preview, and generated embed snippet.
- `app/workspace/WorkspaceClient.tsx`: navigation integration and richer appointment details.
- `lib/booking/transport.ts`: shared live/demo booking transport contracts and implementations.
- `app/booking/BookingFlow.tsx`: transport-driven booking state machine with address and optional email/phone.
- `app/booking/LiveBookingFlow.tsx`: live transport wrapper used by standalone and embedded booking.
- `app/demo/DemoBookingFlow.tsx`: demonstration transport wrapper used only by the homepage.
- `app/book/page.tsx`: real standalone public booking page.
- `lib/widget/protocol.ts`: widget configuration and message validation.
- `app/embed/page.tsx`: frameable booking route.
- `app/embed/EmbedBridge.tsx`: resize/close/reset messaging for one iframe channel.
- `public/daymark-widget.js`: copy-paste floating/inline host integration.
- `worker/index.ts`: route-specific framing policy.
- `app/page.tsx`: product homepage and harmless demonstration.
- `app/globals.css`: homepage, live booking, widget, authentication, and workspace styles.
- `tests/schema.test.ts`: persistent table and column contracts.
- `tests/password.test.ts`: derivation, verification, token, and temporary-password contracts.
- `tests/request-security.test.ts`: cookie, same-origin, and fingerprint contracts.
- `tests/auth-service.test.ts`: setup, generic login, throttling, session, and forced-change behavior.
- `tests/authorization.test.ts`: session actor and unchanged employee/admin boundaries.
- `tests/booking.test.ts`: address/contact validation, masking, and conflict behavior.
- `tests/booking-transport.test.ts`: proof that demo transport performs no fetch.
- `tests/widget.test.ts`: configuration, message, framing, and script contract.
- `tests/workspace-routes.test.ts`: admin-only account lifecycle and employee denial.
- `tests/rendered-html.test.mjs`: homepage, live booking, embed, sign-in, metadata, and starter-removal checks.

---

### Task 1: Extend the data model without weakening existing privacy

**Files:**
- Modify: `db/schema.ts`
- Modify: `lib/data/contracts.ts`
- Modify: `tests/schema.test.ts`
- Create: `drizzle/0001_daymark_widget_auth.sql`
- Modify: `drizzle/meta/_journal.json`
- Create: `drizzle/meta/0001_snapshot.json`

**Interfaces:**
- Produces: Drizzle tables `credentials`, `authSessions`, and `loginAttempts`.
- Produces: nullable `memberships.oaiUserId`, nullable `appointments.clientEmail`, and new `appointments.clientPhone` and `appointments.clientAddress` columns.
- Produces: `CredentialRecord`, `SessionActorRecord`, and updated `CreateBookingInput`, `ScheduleEntry`, `TeamProfile`, and `MembershipRecord` types.

- [ ] **Step 1: Write the failing schema contract**

Update `tests/schema.test.ts` to require the new tables and appointment fields:

```ts
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  appointments,
  authSessions,
  credentials,
  loginAttempts,
} from "../db/schema";

describe("staff authentication schema", () => {
  it("exports credential, session, and login-attempt tables", () => {
    expect(credentials).toBeDefined();
    expect(authSessions).toBeDefined();
    expect(loginAttempts).toBeDefined();
  });

  it("stores address plus optional email and phone on appointments", () => {
    const columns = getTableColumns(appointments);
    expect(columns.clientAddress.notNull).toBe(true);
    expect(columns.clientEmail.notNull).toBe(false);
    expect(columns.clientPhone.notNull).toBe(false);
  });
});
```

- [ ] **Step 2: Run the schema test and verify the red state**

Run:

```powershell
npx.cmd vitest run tests/schema.test.ts
```

Expected: FAIL because `credentials`, `authSessions`, `loginAttempts`, `clientAddress`, and `clientPhone` do not exist.

- [ ] **Step 3: Add the exact schema records**

Keep the legacy `invitations` table migration-safe but remove its use in later tasks. Make `memberships.oaiUserId` nullable. Add the following tables and indexes in `db/schema.ts`:

```ts
export const credentials = sqliteTable(
  "credentials",
  {
    id: text("id").primaryKey(),
    membershipId: text("membership_id").notNull().references(() => memberships.id, {
      onDelete: "cascade",
    }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    passwordIterations: integer("password_iterations").notNull(),
    mustChangePassword: integer("must_change_password", { mode: "boolean" })
      .notNull()
      .default(true),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: text("locked_until"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_credentials_membership_id").on(table.membershipId),
    uniqueIndex("idx_credentials_email").on(table.email),
  ],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    membershipId: text("membership_id").notNull().references(() => memberships.id, {
      onDelete: "cascade",
    }),
    tokenHash: text("token_hash").notNull(),
    createdAt: text("created_at").notNull(),
    lastUsedAt: text("last_used_at").notNull(),
    idleExpiresAt: text("idle_expires_at").notNull(),
    absoluteExpiresAt: text("absolute_expires_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("idx_auth_sessions_token_hash").on(table.tokenHash),
    index("idx_auth_sessions_membership_expiry").on(
      table.membershipId,
      table.idleExpiresAt,
      table.absoluteExpiresAt,
    ),
  ],
);

export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: text("id").primaryKey(),
    emailHash: text("email_hash").notNull(),
    fingerprintHash: text("fingerprint_hash").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    windowStartedAt: text("window_started_at").notNull(),
    lockedUntil: text("locked_until"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_login_attempts_subject").on(
      table.emailHash,
      table.fingerprintHash,
    ),
    index("idx_login_attempts_updated").on(table.updatedAt),
  ],
);
```

Add a partial unique membership index so concurrent setup requests cannot create two first administrators:

```ts
uniqueIndex("idx_memberships_single_admin")
  .on(table.role)
  .where(sql`${table.role} = 'admin'`)
```

Update appointment fields exactly:

```ts
clientAddress: text("client_address").notNull().default(""),
clientEmail: text("client_email"),
clientPhone: text("client_phone"),
```

Update `lib/data/contracts.ts` so booking and schedule values use:

```ts
export type CreateBookingInput = {
  employeeId: string;
  startAt: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientNote?: string;
};

export type CredentialRecord = {
  membershipId: string;
  employeeProfileId: string | null;
  displayName: string;
  role: "admin" | "employee";
  active: boolean;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  mustChangePassword: boolean;
  lockedUntil: string | null;
};

export type SessionActorRecord = {
  membershipId: string;
  employeeProfileId: string | null;
  displayName: string;
  email: string;
  role: "admin" | "employee";
  active: boolean;
  mustChangePassword: boolean;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
};
```

Add `clientAddress`, nullable `clientEmail`, and nullable `clientPhone` to `ScheduleEntry`; add `hasCredential: boolean` to `TeamProfile`; change `MembershipRecord.oaiUserId` to `string | null` until the legacy ChatGPT functions are removed in Task 4.

- [ ] **Step 4: Generate and inspect the named migration**

Run:

```powershell
npx.cmd drizzle-kit generate --name daymark_widget_auth
```

Expected: `drizzle/0001_daymark_widget_auth.sql` creates the three authentication tables, preserves existing appointment rows while rebuilding nullable contact columns, adds `client_address` and `client_phone`, and changes `oai_user_id` to nullable. Inspect the SQL and confirm it does not drop `appointments`, `employee_profiles`, `availability_rules`, or `blocked_periods` without copying their data.

- [ ] **Step 5: Run the schema and existing unit tests**

Run:

```powershell
npx.cmd vitest run tests/schema.test.ts tests/repository.test.ts tests/booking.test.ts
```

Expected: PASS after updating existing fixtures with `clientAddress`, `clientEmail`, and `clientPhone` values.

- [ ] **Step 6: Commit the data model**

```powershell
git add db/schema.ts lib/data/contracts.ts tests/schema.test.ts tests/repository.test.ts tests/booking.test.ts drizzle
git commit -m "feat: extend Daymark booking and auth schema"
```

---

### Task 2: Add password, session-token, cookie, and request-security primitives

**Files:**
- Create: `lib/auth/password.ts`
- Create: `lib/auth/request-security.ts`
- Create: `tests/password.test.ts`
- Create: `tests/request-security.test.ts`

**Interfaces:**
- Produces: `hashPassword(password): Promise<PasswordVerifier>`.
- Produces: `verifyPassword(password, verifier): Promise<boolean>`.
- Produces: `validPermanentPassword`, `generateTemporaryPassword`, `generateSessionToken`, and `hashOpaqueValue`.
- Produces: `sessionTokenFromRequest`, `sessionCookie`, `clearSessionCookie`, `isSameOriginMutation`, and `requestFingerprintHash`.

- [ ] **Step 1: Write failing password primitive tests**

Create `tests/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  generateTemporaryPassword,
  hashOpaqueValue,
  hashPassword,
  validPermanentPassword,
  verifyPassword,
} from "../lib/auth/password";

describe("password protection", () => {
  it("derives a salted PBKDF2 verifier and rejects the wrong password", async () => {
    const verifier = await hashPassword("correct horse battery staple");
    expect(verifier.iterations).toBe(210_000);
    expect(verifier.hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery staple", verifier)).toBe(true);
    expect(await verifyPassword("incorrect horse battery staple", verifier)).toBe(false);
  });

  it("enforces 12 to 128 characters without composition rules", () => {
    expect(validPermanentPassword("long passphrase")).toBe(true);
    expect(validPermanentPassword("too short")).toBe(false);
    expect(validPermanentPassword("x".repeat(129))).toBe(false);
  });

  it("creates non-readable temporary passwords and opaque session tokens", async () => {
    const temporary = generateTemporaryPassword();
    const token = generateSessionToken();
    expect(temporary).toMatch(/^[A-HJ-NP-Z2-9]{5}(?:-[A-HJ-NP-Z2-9]{5}){3}$/);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await hashOpaqueValue(token)).not.toBe(token);
  });
});
```

- [ ] **Step 2: Write failing request-security tests**

Create `tests/request-security.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  clearSessionCookie,
  isSameOriginMutation,
  requestFingerprintHash,
  sessionCookie,
  sessionTokenFromRequest,
} from "../lib/auth/request-security";

describe("session cookies and mutation origin", () => {
  it("round-trips only the Daymark session cookie", () => {
    const setCookie = sessionCookie("opaque-token", new Date("2026-08-12T12:00:00.000Z"));
    expect(setCookie).toContain("daymark_session=opaque-token");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(sessionTokenFromRequest(new Request("https://daymark.example", {
      headers: { cookie: "theme=paper; daymark_session=opaque-token" },
    }))).toBe("opaque-token");
    expect(clearSessionCookie()).toContain("Max-Age=0");
  });

  it("rejects cross-origin writes", () => {
    const request = new Request("https://daymark.example/api/auth/sign-in", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    });
    expect(isSameOriginMutation(request)).toBe(false);
  });

  it("hashes request fingerprints without retaining raw IP or user agent", async () => {
    const request = new Request("https://daymark.example/api/auth/sign-in", {
      headers: {
        "cf-connecting-ip": "203.0.113.10",
        "user-agent": "Example Browser",
      },
    });
    const fingerprint = await requestFingerprintHash(request);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).not.toContain("203.0.113.10");
  });
});
```

- [ ] **Step 3: Run both tests and verify the red state**

Run:

```powershell
npx.cmd vitest run tests/password.test.ts tests/request-security.test.ts
```

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement Web Crypto primitives**

Create `lib/auth/password.ts` with these constants and returned shapes:

```ts
const ITERATIONS = 210_000;
const encoder = new TextEncoder();

export type PasswordVerifier = {
  hash: string;
  salt: string;
  iterations: number;
};

export async function hashPassword(password: string): Promise<PasswordVerifier> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    hash: await derive(password, salt, ITERATIONS),
    salt: toBase64Url(salt),
    iterations: ITERATIONS,
  };
}

export async function verifyPassword(
  password: string,
  verifier: PasswordVerifier,
): Promise<boolean> {
  const actual = await derive(password, fromBase64Url(verifier.salt), verifier.iterations);
  return timingSafeTextEqual(actual, verifier.hash);
}

export function validPermanentPassword(value: string): boolean {
  return value.length >= 12 && value.length <= 128;
}
```

Use `crypto.subtle.importKey` plus `deriveBits` with `name: "PBKDF2"`, `hash: "SHA-256"`, and 256 output bits. Encode random 32-byte session tokens as unpadded base64url. Generate temporary passwords from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` in four five-character groups, using `crypto.getRandomValues` and rejection sampling to avoid modulo bias.

Create `lib/auth/request-security.ts` with cookie name `daymark_session`, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax`, and the supplied expiry. For mutations, compare `Origin` to the public request origin derived from `x-forwarded-host`, `x-forwarded-proto`, `host`, and the request URL. Hash the concatenated Cloudflare IP header and user agent with `hashOpaqueValue`; never return or persist the raw input.

- [ ] **Step 5: Run focused tests and lint**

Run:

```powershell
npx.cmd vitest run tests/password.test.ts tests/request-security.test.ts
npm.cmd run lint
```

Expected: all tests PASS and lint exits 0.

- [ ] **Step 6: Commit the security primitives**

```powershell
git add lib/auth/password.ts lib/auth/request-security.ts tests/password.test.ts tests/request-security.test.ts
git commit -m "feat: add staff credential security primitives"
```

---

### Task 3: Persist credentials, throttle login, and orchestrate authentication

**Files:**
- Create: `lib/auth/repository.ts`
- Create: `lib/auth/service.ts`
- Create: `lib/auth/runtime.ts`
- Create: `tests/auth-service.test.ts`
- Modify: `tests/repository.test.ts`

**Interfaces:**
- Consumes: authentication tables from Task 1 and cryptographic values from Task 2.
- Produces: `createAuthService(dependencies)` with `setup`, `signIn`, `changePassword`, and `signOut` methods.
- Produces: `authService()` runtime wiring.
- Produces: repository functions `createAdministratorAccount`, `findCredentialByEmail`, `recordFailedLogin`, `clearFailedLogins`, `createAuthSession`, `findSessionActor`, `replacePassword`, `revokeSession`, `revokeMembershipSessions`, `insertStaffCredential`, and `replaceStaffPasswordVerifier`.

- [ ] **Step 1: Write failing service tests for neutral login and forced change**

Create `tests/auth-service.test.ts` around an injected dependency factory. The central tests must be concrete:

```ts
it("returns the same invalid response for a missing account and a wrong password", async () => {
  const missing = dependencies({ credential: null });
  const wrong = dependencies({ verifyPassword: false });
  const first = await createAuthService(missing).signIn(
    { email: "nobody@example.com", password: "incorrect password" },
    "fingerprint",
    now,
  );
  const second = await createAuthService(wrong).signIn(
    { email: "maya@example.com", password: "incorrect password" },
    "fingerprint",
    now,
  );
  expect(first).toEqual(second);
  expect(first).toEqual({
    status: 401,
    body: { ok: false, error: "Email or password not recognised." },
  });
});

it("creates a session while preserving the forced-password-change gate", async () => {
  const deps = dependencies({ verifyPassword: true, mustChangePassword: true });
  const result = await createAuthService(deps).signIn(
    { email: "maya@example.com", password: "temporary password" },
    "fingerprint",
    now,
  );
  expect(result.status).toBe(200);
  expect(result.body).toEqual({ ok: true, mustChangePassword: true });
  expect(result.session?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(deps.createAuthSession).toHaveBeenCalledWith(
    "membership-maya",
    expect.stringMatching(/^[a-f0-9]{64}$/),
    expect.objectContaining({
      idleExpiresAt: "2026-08-06T00:00:00.000Z",
      absoluteExpiresAt: "2026-08-12T12:00:00.000Z",
    }),
  );
});
```

Also cover: setup-code mismatch, second-admin setup denial, invalid password length, five failures causing a 15-minute retry response, successful login clearing failures, password change revoking all prior sessions and creating a replacement session, and logout revoking the current token hash.

- [ ] **Step 2: Run the service test and verify the red state**

Run:

```powershell
npx.cmd vitest run tests/auth-service.test.ts
```

Expected: FAIL because `lib/auth/service.ts` is missing.

- [ ] **Step 3: Implement the pure authentication service**

Use this public result contract in `lib/auth/service.ts`:

```ts
export type AuthResult = {
  status: number;
  body: { ok: boolean; error?: string; mustChangePassword?: boolean };
  session?: { token: string; expiresAt: string };
};

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
```

`setup` accepts `{ setupCode, displayName, email, password }`, compares SHA-256 hashes of supplied and expected setup codes, verifies no administrator exists, requires display name length 1–80, valid email length 3–254, and `validPermanentPassword`, then stores an administrator credential with `mustChangePassword: false` and creates a session.

`signIn` normalizes email, hashes it before attempt persistence, checks `retryAt`, performs a dummy PBKDF2 verification when the account is missing, verifies active account state, records a generic failure, and creates a session on success. Use this fixed non-account verifier so the missing-account path performs the same algorithm and work factor without creating a readable credential:

```ts
const DUMMY_VERIFIER = {
  salt: "AAAAAAAAAAAAAAAAAAAAAA",
  hash: "A0Bw09WO7-dVT6w2l1AasdIZCVZwAvyGoFtu5dQAg7U",
  iterations: 210_000,
};
```

The idle expiry is `now + 12 hours`; absolute expiry is `now + 7 days`.

`changePassword` requires a valid active session and a 12–128 character new password, derives a new verifier, clears `mustChangePassword`, revokes every membership session, and creates one replacement session.

`signOut` hashes the supplied token and revokes that one session. Every failure body is explicit in the tests; credential failures use only `Email or password not recognised.`

- [ ] **Step 4: Add focused D1 authentication persistence**

Create `lib/auth/repository.ts`; do not add these queries to the existing 671-line booking repository. Use normalized email uniqueness and D1 `batch` for account creation. `findSessionActor` must join `auth_sessions`, `memberships`, `credentials`, and `employee_profiles`, and must require:

```ts
and(
  eq(authSessions.tokenHash, tokenHash),
  isNull(authSessions.revokedAt),
  gt(authSessions.idleExpiresAt, now.toISOString()),
  gt(authSessions.absoluteExpiresAt, now.toISOString()),
  eq(memberships.active, true),
)
```

After a valid lookup, advance only `lastUsedAt` and `idleExpiresAt`, never beyond `absoluteExpiresAt`. Login attempt windows last 15 minutes; the fifth failure locks the hashed email/fingerprint subject for 15 minutes. When a real credential exists, increment its account-wide `failedAttempts` and `lockedUntil` in the same failure path; use the later of the account and subject retry times. Successful verification clears both credential and subject counters. Delete attempt records older than 24 hours and expired or revoked sessions during normal sign-in and session-lookup activity.

`insertStaffCredential` takes the administrator membership ID plus `{ employeeProfileId, email, displayName, verifier }`, verifies the caller is an active administrator, verifies the profile is active and unlinked, inserts an employee membership with `oaiUserId: null`, inserts a credential with `mustChangePassword: true`, and links the profile in one batch.

`replaceStaffPasswordVerifier` verifies the caller is an administrator, replaces the verifier, sets `mustChangePassword: true`, clears lock fields, and revokes all sessions for the target membership.

- [ ] **Step 5: Wire production dependencies and repository contract tests**

Create `lib/auth/runtime.ts`:

```ts
import { createAuthService } from "./service";
import * as authRepository from "./repository";
import {
  hashOpaqueValue,
  hashPassword,
  verifyPassword,
  generateSessionToken,
} from "./password";

export function authService() {
  return createAuthService({
    ...authRepository,
    hashOpaqueValue,
    hashPassword,
    verifyPassword,
    generateSessionToken,
  });
}
```

Extend `tests/repository.test.ts` with pure projection and expiry helpers exported by `lib/auth/repository.ts`: `nextIdleExpiry(now, absoluteExpiry)`, `loginLockUntil(failedAttempts, now)`, and `sessionIsUsable(record, now)`. Assert the 12-hour idle expiry is capped by seven-day absolute expiry and revoked/expired records are unusable.

- [ ] **Step 6: Run authentication and repository tests**

Run:

```powershell
npx.cmd vitest run tests/auth-service.test.ts tests/password.test.ts tests/request-security.test.ts tests/repository.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the authentication domain**

```powershell
git add lib/auth/repository.ts lib/auth/service.ts lib/auth/runtime.ts tests/auth-service.test.ts tests/repository.test.ts
git commit -m "feat: add staff authentication domain"
```

---

### Task 4: Replace ChatGPT enrolment with staff sign-in routes and gates

**Files:**
- Modify: `lib/auth/membership.ts`
- Modify: `lib/workspace-service.ts`
- Create: `app/api/auth/setup/route.ts`
- Create: `app/api/auth/sign-in/route.ts`
- Create: `app/api/auth/password/route.ts`
- Create: `app/api/auth/sign-out/route.ts`
- Create: `app/workspace/sign-in/page.tsx`
- Create: `app/workspace/sign-in/SignInPanel.tsx`
- Create: `app/workspace/PasswordChangeGate.tsx`
- Modify: `app/workspace/page.tsx`
- Modify: `app/workspace/WorkspaceClient.tsx`
- Delete: `app/chatgpt-auth.ts`
- Delete: `lib/auth/enrolment.ts`
- Delete: `app/api/workspace/enrol/route.ts`
- Delete: `app/workspace/EnrolmentPanel.tsx`
- Modify: `tests/authorization.test.ts`
- Delete: `tests/enrolment.test.ts`
- Modify: `tests/workspace-routes.test.ts`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `authService()` and `sessionTokenFromRequest()`.
- Produces: staff routes that set or clear `daymark_session`.
- Produces: `WorkspaceActor.mustChangePassword` and session-backed `getWorkspaceActor(request?)`.

- [ ] **Step 1: Rewrite actor tests for session identity**

Replace ChatGPT identity assertions in `tests/authorization.test.ts` with membership-only resolution:

```ts
const sessionActor = {
  membershipId: "membership-maya",
  employeeProfileId: "maya-chen",
  role: "employee" as const,
  email: "maya@example.com",
  displayName: "Maya Chen",
  active: true,
  mustChangePassword: false,
  idleExpiresAt: "2026-08-06T00:00:00.000Z",
  absoluteExpiresAt: "2026-08-12T12:00:00.000Z",
};

expect(resolveWorkspaceActor(sessionActor)).toEqual({
  membershipId: "membership-maya",
  employeeProfileId: "maya-chen",
  role: "employee",
  email: "maya@example.com",
  displayName: "Maya Chen",
  mustChangePassword: false,
});
expect(resolveWorkspaceActor({ ...sessionActor, active: false })).toBeNull();
```

Add a workspace-service assertion that a `mustChangePassword: true` actor receives status 428 and no schedule dependency is called.

- [ ] **Step 2: Run authorization tests and verify the red state**

Run:

```powershell
npx.cmd vitest run tests/authorization.test.ts tests/workspace-routes.test.ts
```

Expected: FAIL because the actor still requires a ChatGPT identity and has no password-change state.

- [ ] **Step 3: Resolve workspace actors from opaque sessions**

Change `resolveWorkspaceActor` to accept one `SessionActorRecord | null`. Add `mustChangePassword` to `WorkspaceActor`. `getWorkspaceActor` must read the session cookie from `headers()`, hash it, call `findSessionActor`, and return null without touching D1 when the cookie is absent.

In `createWorkspaceService`, centralize the gate:

```ts
async function readyActor(dependencies: WorkspaceDependencies) {
  const actor = await dependencies.getActor();
  if (!actor) return { actor: null, error: unauthorized() };
  if (actor.mustChangePassword) {
    return {
      actor: null,
      error: {
        status: 428,
        body: { ok: false, error: "Change your temporary password first." },
      },
    };
  }
  return { actor, error: null };
}
```

Use it before every schedule, availability, cancellation, and team operation. Keep `actorCanAccessProfile` and `requireRole` behavior unchanged.

- [ ] **Step 4: Add same-origin authentication API routes**

Each POST route must reject `!isSameOriginMutation(request)` with status 403 before parsing JSON. `setup` reads `DAYMARK_SETUP_CODE` from `cloudflare:workers`, `sign-in` computes `requestFingerprintHash(request)`, and successful setup/sign-in/password change responses append `sessionCookie(result.session.token, new Date(result.session.expiresAt))`.

The sign-out response always appends `clearSessionCookie()`, even when the token is absent, and revokes the token when present. All responses set `Cache-Control: no-store`.

- [ ] **Step 5: Build the sign-in, setup, and forced-change UI**

`app/workspace/sign-in/page.tsx` renders a static Daymark sign-in frame without querying D1. `SignInPanel.tsx` uses two views:

```ts
type AuthView = "sign-in" | "setup";
```

The sign-in form posts `{ email, password }` to `/api/auth/sign-in`. The setup form posts `{ setupCode, displayName, email, password }` to `/api/auth/setup`. Both use labelled inputs, `autocomplete="email"`, `autocomplete="current-password"` or `autocomplete="new-password"`, generic status text, and redirect to `/workspace` on success.

`PasswordChangeGate.tsx` posts `{ password, confirmation }` to `/api/auth/password`; it does not render schedule content behind the form. On success it reloads `/workspace` with the replacement session cookie.

`app/workspace/page.tsx` follows this order:

```tsx
const actor = await getWorkspaceActor();
if (!actor) redirect("/workspace/sign-in");
if (actor.mustChangePassword) return <PasswordChangeGate displayName={actor.displayName} />;
```

Replace the sign-out anchor in `WorkspaceClient` with a button that POSTs `/api/auth/sign-out`, then navigates to `/`.

- [ ] **Step 6: Remove the ChatGPT enrolment path and update route checks**

Delete the four listed ChatGPT/enrolment files and remove their imports. Remove `AuthenticatedIdentity`, `getMembershipByOaiUserId`, `claimAdministrator`, `redeemInvitation`, and invitation-use tests; remove `oaiUserId` from `MembershipRecord` while leaving the nullable legacy database column migration-safe. Update `tests/rendered-html.test.mjs` so `/workspace` redirects to `/workspace/sign-in`, `/workspace/sign-in` contains “Staff sign in,” and neither rendered HTML nor source contains “Sign in with ChatGPT.”

Run:

```powershell
npx.cmd vitest run tests/authorization.test.ts tests/workspace-routes.test.ts tests/auth-service.test.ts
npm.cmd run lint
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'; & '.\node_modules\.bin\vinext.cmd' build
node --test tests/rendered-html.test.mjs
```

Expected: every command exits 0.

- [ ] **Step 7: Commit the staff sign-in surface**

```powershell
git add app/api/auth app/workspace lib/auth/membership.ts lib/workspace-service.ts tests
git rm app/chatgpt-auth.ts lib/auth/enrolment.ts app/api/workspace/enrol/route.ts app/workspace/EnrolmentPanel.tsx tests/enrolment.test.ts
git commit -m "feat: replace ChatGPT enrolment with staff sign-in"
```

---

### Task 5: Require address/contact details and move live booking to `/book`

**Files:**
- Modify: `lib/public-booking.ts`
- Modify: `lib/data/repository.ts`
- Create: `lib/booking/transport.ts`
- Modify: `app/booking/BookingFlow.tsx`
- Create: `app/booking/LiveBookingFlow.tsx`
- Create: `app/book/page.tsx`
- Modify: `app/page.tsx`
- Modify: `app/workspace/WorkspaceClient.tsx`
- Modify: `tests/booking.test.ts`
- Create: `tests/booking-transport.test.ts`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: `BookingTransport`, `liveBookingTransport`, and `demoBookingTransport`.
- Produces: live standalone booking at `/book`.
- Produces: booking confirmations with `address` and masked `contactSummary`, never raw contact fields.

- [ ] **Step 1: Write failing booking validation and masking tests**

Update the valid fixture in `tests/booking.test.ts`:

```ts
const validBooking = {
  employeeId: "maya-chen",
  startAt: "2026-08-10T08:00:00.000Z",
  clientName: "Lloyd Example",
  clientAddress: "14 Example Street, London, N1 1AA",
  clientEmail: "lloyd@example.com",
  clientPhone: null,
  clientNote: "Planning conversation",
};
```

Add exact cases:

```ts
it("requires an address and at least one contact method", async () => {
  const service = createPublicBookingService(dependencies());
  const noAddress = await service.book(
    { ...validBooking, clientAddress: "" },
    new Date("2026-08-05T12:00:00.000Z"),
  );
  const noContact = await service.book(
    { ...validBooking, clientEmail: null, clientPhone: null },
    new Date("2026-08-05T12:00:00.000Z"),
  );
  expect(noAddress.body.error).toBe("Enter the appointment address.");
  expect(noContact.body.error).toBe("Enter an email address or phone number.");
});

it("masks the confirmation contact", async () => {
  const result = await createPublicBookingService(dependencies()).book(
    validBooking,
    new Date("2026-08-05T12:00:00.000Z"),
  );
  expect(result.body.booking).toMatchObject({
    address: "14 Example Street, London, N1 1AA",
    contactSummary: "l••••@example.com",
  });
  expect(JSON.stringify(result.body)).not.toContain("lloyd@example.com");
});
```

- [ ] **Step 2: Run booking tests and verify the red state**

Run:

```powershell
npx.cmd vitest run tests/booking.test.ts
```

Expected: FAIL because address/phone validation and masked confirmation do not exist.

- [ ] **Step 3: Extend validation, persistence, retention, and schedule projection**

In `lib/public-booking.ts`, normalize address whitespace to single spaces, cap address at 240 characters, allow email to be null, validate email only when present, and validate phone with:

```ts
/^[+\d][\d\s().-]{6,24}$/
```

Require at least one valid contact value. Export and test:

```ts
export function maskContact(email: string | null, phone: string | null): string {
  if (email) {
    const [local, domain] = email.split("@");
    return `${local.slice(0, 1)}${"•".repeat(Math.max(4, local.length - 1))}@${domain}`;
  }
  const digits = phone?.replace(/\D/g, "") ?? "";
  return `•••• ${digits.slice(-4)}`;
}
```

In `lib/data/repository.ts`, insert address/email/phone, select all three for protected schedules, and keep `purgeExpiredAppointments` deleting the whole appointment row at the existing 30-day cutoff. In `lib/public-booking.ts`, construct the public confirmation from the repository’s employee/time result plus the parsed address and `maskContact`; never return raw email or phone.

- [ ] **Step 4: Introduce transport-driven booking and live route**

Create `lib/booking/transport.ts`:

```ts
export type BookingTransport = {
  loadSlots(employeeId: string, from: string): Promise<{
    dateKeys: string[];
    slots: BookableSlot[];
  }>;
  createBooking(input: CreateBookingInput): Promise<{
    reference: string;
    employeeName: string;
    startAt: string;
    endAt: string;
    address: string;
    contactSummary: string;
  }>;
};
```

`liveBookingTransport` calls the existing public slot and booking endpoints and throws an `Error` with the endpoint’s safe message. `demoBookingTransport` returns fixed sample employees/slots and a `DEMO-ONLY` confirmation without reading `fetch`.

Refactor `BookingFlow` to receive `transport`, `initialEmployeeId?: string`, `embedded?: boolean`, and `demonstration?: boolean`. Add `clientAddress`, `clientEmail`, and `clientPhone` to draft state. Address is required; email and phone use a shared help/error message and neither input alone is HTML-required. The submit button says “Complete demonstration” in demonstration mode and “Confirm appointment” in live mode.

Create `LiveBookingFlow.tsx` as a client wrapper that supplies `liveBookingTransport`. Create `/book` using the same public profile seeds and live wrapper. Keep the current root page temporarily rendering `LiveBookingFlow`; Task 7 replaces it with the final demo homepage.

- [ ] **Step 5: Prove the demonstration transport cannot fetch**

Create `tests/booking-transport.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { demoBookingTransport } from "../lib/booking/transport";

it("completes the sample flow without network access", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  const slots = await demoBookingTransport.loadSlots("maya-chen", "2026-08-06");
  const booking = await demoBookingTransport.createBooking({
    employeeId: "maya-chen",
    startAt: slots.slots[0].startAt,
    clientName: "Demo Visitor",
    clientAddress: "14 Sample Street, London",
    clientEmail: "demo@example.com",
    clientPhone: null,
    clientNote: "",
  });
  expect(booking.reference).toBe("DEMO-ONLY");
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});
```

- [ ] **Step 6: Verify and commit live booking**

Run:

```powershell
npx.cmd vitest run tests/booking.test.ts tests/booking-transport.test.ts tests/repository.test.ts
npm.cmd run lint
```

Expected: PASS.

```powershell
git add app/book app/booking app/page.tsx app/workspace/WorkspaceClient.tsx lib/booking lib/data lib/public-booking.ts tests
git commit -m "feat: add address-aware standalone booking"
```

---

### Task 6: Build the floating and inline iframe widget

**Files:**
- Create: `lib/widget/protocol.ts`
- Create: `app/embed/page.tsx`
- Create: `app/embed/EmbedBridge.tsx`
- Create: `public/daymark-widget.js`
- Modify: `worker/index.ts`
- Create: `tests/widget.test.ts`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `LiveBookingFlow` from Task 5.
- Produces: `/embed?employee=maya-chen&channel=test-channel-7f3a` and `/daymark-widget.js`.
- Produces: `normalizeWidgetConfig`, `validWidgetMessage`, and `framePolicyHeaders`.

- [ ] **Step 1: Write failing widget protocol and framing tests**

Create `tests/widget.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  framePolicyHeaders,
  normalizeWidgetConfig,
  validWidgetMessage,
} from "../lib/widget/protocol";

describe("widget boundaries", () => {
  it("supports both modes and rejects unsafe employee identifiers", () => {
    expect(normalizeWidgetConfig({ mode: "floating", employee: "maya-chen" })).toEqual({
      mode: "floating",
      employee: "maya-chen",
      label: "Book an appointment",
    });
    expect(normalizeWidgetConfig({ mode: "unknown", employee: "<script>" })).toEqual({
      mode: "floating",
      employee: "all",
      label: "Book an appointment",
    });
  });

  it("accepts only the matching channel and known message types", () => {
    expect(validWidgetMessage({ type: "daymark:resize", channel: "abc", height: 640 }, "abc")).toBe(true);
    expect(validWidgetMessage({ type: "daymark:booking", channel: "abc", email: "private@example.com" }, "abc")).toBe(false);
  });

  it("allows framing only for the embed route", () => {
    expect(framePolicyHeaders("/embed").get("content-security-policy")).toContain("frame-ancestors 'self' https:");
    expect(framePolicyHeaders("/workspace").get("x-frame-options")).toBe("DENY");
  });

  it("ships one script with floating and inline modes", async () => {
    const source = await readFile("public/daymark-widget.js", "utf8");
    expect(source).toMatch(/floating/);
    expect(source).toMatch(/inline/);
    expect(source).toMatch(/iframe/);
    expect(source).not.toMatch(/clientEmail|clientPhone|clientAddress/);
  });
});
```

- [ ] **Step 2: Run widget tests and verify the red state**

Run:

```powershell
npx.cmd vitest run tests/widget.test.ts
```

Expected: FAIL because widget files do not exist.

- [ ] **Step 3: Implement strict configuration, messages, and route headers**

`normalizeWidgetConfig` accepts only `floating` or `inline`, the same public employee-id regex as booking, and a trimmed label of 1–80 characters. `validWidgetMessage` accepts only:

```ts
type WidgetMessage =
  | { type: "daymark:resize"; channel: string; height: number }
  | { type: "daymark:close"; channel: string };
```

Resize height must be an integer from 280 through 1200. `framePolicyHeaders("/embed")` returns `Content-Security-Policy: frame-ancestors 'self' https: http://localhost:*`; every other path returns `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`.

Wrap `handler.fetch` in `worker/index.ts`, clone the response headers, apply the policy, and return a new response with the same body, status, and status text.

- [ ] **Step 4: Build the embedded route and bridge**

`app/embed/page.tsx` validates `employee` and `channel`, renders a compact `<LiveBookingFlow embedded initialEmployeeId={employee} />`, and adds `<EmbedBridge channel={channel} />`. The iframe page title is “Daymark appointment booking.”

`EmbedBridge` uses `ResizeObserver` on `document.documentElement`, posts only resize messages to `window.parent`, and posts close after a custom `daymark:complete` browser event. It validates reset messages by channel and `event.source === window.parent`; reset dispatches `daymark:reset` without reading or sending form values.

- [ ] **Step 5: Implement one self-contained host script**

`public/daymark-widget.js` must be a dependency-free IIFE. It obtains its origin from `new URL(document.currentScript.src).origin`, creates a random channel with `crypto.randomUUID()`, and creates:

```js
iframe.title = "Daymark appointment booking";
iframe.sandbox = "allow-scripts allow-forms allow-same-origin";
iframe.src = `${origin}/embed?employee=${encodeURIComponent(employee)}&channel=${encodeURIComponent(channel)}`;
```

Inline mode inserts the wrapper immediately after the script element and starts at 680px high. Floating mode appends an accessible launcher and hidden panel to `document.body`; Escape closes the panel, open state traps Tab within launcher/panel controls, and closing restores launcher focus. The message listener verifies `event.origin`, `event.source === iframe.contentWindow`, message type, channel, and height cap. A 10-second load timeout replaces the panel with a direct `/book` link. Do not dispatch booking payloads or references to the host page.

- [ ] **Step 6: Add compact responsive embed styles and verify**

Add `.embed-shell`, `.booking-studio.is-embedded`, widget-size booking controls, and full-height small-screen behavior to `app/globals.css`. Preserve all focus and reduced-motion rules.

Run:

```powershell
npx.cmd vitest run tests/widget.test.ts tests/booking-transport.test.ts
npm.cmd run lint
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'; & '.\node_modules\.bin\vinext.cmd' build
node --test tests/rendered-html.test.mjs
```

Expected: `/embed` builds, widget tests pass, and rendered HTML has the iframe title and frame policy.

- [ ] **Step 7: Commit the widget**

```powershell
git add lib/widget app/embed public/daymark-widget.js worker/index.ts app/globals.css tests/widget.test.ts tests/rendered-html.test.mjs
git commit -m "feat: add embeddable Daymark widgets"
```

---

### Task 7: Turn the root route into a no-write product demonstration

**Files:**
- Create: `app/demo/DemoBookingFlow.tsx`
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `tests/booking-transport.test.ts`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `demoBookingTransport` and `BookingFlow` from Task 5.
- Produces: a marketing/product homepage at `/` that performs no booking or slot writes.

- [ ] **Step 1: Change rendered-route tests to describe the product homepage**

Update the root test in `tests/rendered-html.test.mjs` to require:

```js
assert.match(html, /Scheduling without shared calendars/i);
assert.match(html, /Interactive demonstration/i);
assert.match(html, /No appointment will be created/i);
assert.match(html, /Floating widget/i);
assert.match(html, /Inline panel/i);
assert.match(html, /Start real booking/i);
assert.doesNotMatch(html, /Confirm appointment/i);
```

Add a source assertion that `app/page.tsx` imports `DemoBookingFlow`, not `LiveBookingFlow`.

- [ ] **Step 2: Build and verify the red state**

Run:

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'; & '.\node_modules\.bin\vinext.cmd' build
node --test tests/rendered-html.test.mjs
```

Expected: FAIL because the root still presents live booking.

- [ ] **Step 3: Create the demonstration wrapper**

Create `DemoBookingFlow.tsx` as a client component that renders:

```tsx
<BookingFlow
  initialEmployees={DEMO_EMPLOYEES}
  transport={demoBookingTransport}
  demonstration
/>
```

The fixed employee set remains Maya, Theo, Priya, and Jon. Demo dates are calculated relative to the current Europe/London date so the flow never looks stale. Completion dispatches no widget event and returns reference `DEMO-ONLY`.

- [ ] **Step 4: Recompose the homepage as product marketing**

Replace the root content with:

- Header links: “How it works,” “Widget options,” and “Staff sign in.”
- Editorial hero: eyebrow “Private team scheduling,” heading “Scheduling without shared calendars,” body explaining client choice and employee isolation, CTA to `#demo`, and secondary link to `/book` labelled “Start real booking.”
- Three privacy promises: discrete slots only, employee-isolated workspaces, administrator oversight.
- A clearly bordered “Interactive demonstration” section containing `DemoBookingFlow` and the exact notice “No appointment will be created.”
- A widget-options section showing both the floating launcher and inline panel, with one-line embed positioning and a link to staff sign-in for setup.
- Footer links to `/book` and `/workspace/sign-in`.

Keep the paper-tab vocabulary but vary section composition so it reads as a product homepage, not a calendar dashboard.

- [ ] **Step 5: Update metadata and prove no network use**

Set title to `Daymark — Private booking for teams` and description to `Let clients book the right person while every employee calendar stays private.` Keep the existing generated social card.

Extend `tests/booking-transport.test.ts` to call every demo transport method with `vi.spyOn(globalThis, "fetch")` and assert zero calls.

- [ ] **Step 6: Verify and commit the homepage**

Run:

```powershell
npx.cmd vitest run tests/booking-transport.test.ts
npm.cmd run lint
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'; & '.\node_modules\.bin\vinext.cmd' build
node --test tests/rendered-html.test.mjs
```

Expected: PASS.

```powershell
git add app/page.tsx app/layout.tsx app/demo app/globals.css tests/booking-transport.test.ts tests/rendered-html.test.mjs
git commit -m "feat: create Daymark product demonstration"
```

---

### Task 8: Give administrators staff-account and embed controls

**Files:**
- Modify: `lib/auth/repository.ts`
- Create: `lib/auth/staff-accounts.ts`
- Modify: `lib/data/repository.ts`
- Modify: `lib/workspace-service.ts`
- Modify: `lib/workspace-runtime.ts`
- Modify: `app/api/workspace/team/route.ts`
- Create: `app/workspace/TeamAccessPanel.tsx`
- Create: `app/workspace/EmbedPanel.tsx`
- Modify: `app/workspace/WorkspaceClient.tsx`
- Modify: `app/globals.css`
- Modify: `tests/workspace-routes.test.ts`
- Modify: `tests/repository.test.ts`

**Interfaces:**
- Consumes: administrator actor and credential repository from Tasks 3–4; widget configuration from Task 6.
- Produces: administrator-only `create-account`, `reset-password`, and `set-active` team actions.
- Produces: copyable, exact hosted embed snippets for both widget modes.

- [ ] **Step 1: Write failing account lifecycle authorization tests**

Replace the invitation test in `tests/workspace-routes.test.ts` with:

```ts
it("allows only administrators to create a staff account", async () => {
  const employeeDeps = dependencies(employee);
  const denied = await createWorkspaceService(employeeDeps).teamAction({
    action: "create-account",
    employeeProfileId: "theo-brooks",
    email: "theo@example.com",
    displayName: "Theo Brooks",
    confirm: true,
  });
  expect(denied.status).toBe(403);
  expect(employeeDeps.createStaffAccount).not.toHaveBeenCalled();

  const adminDeps = dependencies(admin);
  const created = await createWorkspaceService(adminDeps).teamAction({
    action: "create-account",
    employeeProfileId: "theo-brooks",
    email: "theo@example.com",
    displayName: "Theo Brooks",
    confirm: true,
  });
  expect(created.status).toBe(201);
  expect(created.body.temporaryPassword).toMatch(/^[A-HJ-NP-Z2-9-]+$/);
});
```

Add tests that reset requires `confirm: true`, employees cannot reset, deactivation calls `setStaffActive` and `revokeMembershipSessions`, and raw passwords are returned only from the create/reset response object.

- [ ] **Step 2: Run workspace tests and verify the red state**

Run:

```powershell
npx.cmd vitest run tests/workspace-routes.test.ts
```

Expected: FAIL because workspace dependencies still create invitations.

- [ ] **Step 3: Replace invitations with credential lifecycle actions**

Change workspace dependencies to:

```ts
createStaffAccount(
  adminMembershipId: string,
  input: { employeeProfileId: string; email: string; displayName: string },
): Promise<{ temporaryPassword: string } | null>;
resetStaffPassword(
  adminMembershipId: string,
  employeeProfileId: string,
): Promise<{ temporaryPassword: string } | null>;
setStaffActive(
  adminMembershipId: string,
  employeeProfileId: string,
  active: boolean,
): Promise<boolean>;
```

Implement these three functions in `lib/auth/staff-accounts.ts`. `createStaffAccount` and `resetStaffPassword` generate the temporary password, derive its verifier, call `insertStaffCredential` or `replaceStaffPasswordVerifier`, and return the readable password only from that one successful call. `setStaffActive` updates both membership and profile active state and revokes target sessions on deactivation.

The workspace service validates employee IDs, normalized email, display-name length 1–80, explicit confirmation, and administrator role. Account creation returns status 201; reset and activation return 200. Remove `createInvitation` from runtime wiring and UI use.

Update `listTeamProfiles` to left-join credentials and return `memberEmail` from the credential plus `hasCredential: Boolean(credentialId)`.

- [ ] **Step 4: Split staff access controls out of the large workspace component**

Create `TeamAccessPanel.tsx` with props:

```ts
type TeamAccessPanelProps = {
  profiles: TeamProfile[];
  onProfilesChange(profiles: TeamProfile[]): void;
};
```

Each unlinked profile has email/display-name fields and “Create staff account.” Linked profiles have “Reset temporary password” and activate/deactivate controls. Both create and reset require `window.confirm`. The returned temporary password appears in a paper slip exactly once in component state with Copy and Dismiss actions; navigating away or dismissing removes it and it is never fetched again.

Move current team-card markup from `WorkspaceClient` into this component, reducing the parent’s account responsibility to view selection.

- [ ] **Step 5: Add the administrator embed configurator**

Create `EmbedPanel.tsx` with `profiles: TeamProfile[]`. It maintains:

```ts
type EmbedMode = "floating" | "inline";
const [mode, setMode] = useState<EmbedMode>("floating");
const [employee, setEmployee] = useState("all");
```

Build the exact snippet from `window.location.origin`, selected mode, selected public employee ID, and label `Book an appointment`. Show a Daymark-styled static preview for each mode, a read-only `<textarea>` containing the snippet, and a Copy button. The panel contains no client data and performs no API calls.

Add an administrator-only “Embed” navigation button and render `EmbedPanel`; employees never receive the control. Update protected appointment cards to display service address and whichever contact fields are present.

- [ ] **Step 6: Verify workspace behavior and commit**

Run:

```powershell
npx.cmd vitest run tests/workspace-routes.test.ts tests/authorization.test.ts tests/repository.test.ts
npm.cmd run lint
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'; & '.\node_modules\.bin\vinext.cmd' build
```

Expected: PASS.

```powershell
git add app/api/workspace/team app/workspace app/globals.css lib/auth/repository.ts lib/data/repository.ts lib/workspace-service.ts lib/workspace-runtime.ts tests
git commit -m "feat: add staff accounts and embed controls"
```

---

### Task 9: Run privacy-focused integration checks and save the new Sites version

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/widget.test.ts`
- Modify: `docs/superpowers/plans/2026-08-05-daymark-widget-and-staff-sign-in-implementation.md`
- Build artifact: `outputs/daymark-widget-site.tar.gz`

**Interfaces:**
- Consumes: the complete source state from Tasks 1–8.
- Produces: one validated, pushed, saved Sites version; public deployment remains approval-gated.

- [ ] **Step 1: Add final server-rendered privacy assertions**

The final Node tests must assert:

```js
const home = await render("/");
assert.match(await home.text(), /No appointment will be created/i);

const booking = await render("/book");
const bookingHtml = await booking.text();
assert.match(bookingHtml, /Appointment address/i);
assert.match(bookingHtml, /Email or phone/i);

const signIn = await render("/workspace/sign-in");
assert.match(await signIn.text(), /Staff sign in/i);

const workspace = await render("/workspace");
assert.equal(workspace.status, 307);
assert.equal(workspace.headers.get("location"), "/workspace/sign-in");

const embed = await render("/embed?employee=maya-chen&channel=test-channel");
assert.match(embed.headers.get("content-security-policy") ?? "", /frame-ancestors 'self' https:/i);
assert.doesNotMatch(embed.headers.get("x-frame-options") ?? "", /DENY/i);
```

Read `app/page.tsx`, `app/chatgpt-auth.ts`, and `app/api/workspace/enrol/route.ts` via `access`; assert the latter two reject with `ENOENT`, and assert the root page contains `DemoBookingFlow` but not `LiveBookingFlow`.

- [ ] **Step 2: Run the complete fresh verification sequence**

Run in order and inspect each exit code:

```powershell
npm.cmd run unit
npm.cmd run lint
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'; & '.\node_modules\.bin\vinext.cmd' build
node --test tests/rendered-html.test.mjs
git diff --check
git status --short
```

Expected: all Vitest files pass; lint exits 0; the production build lists `/`, `/book`, `/embed`, four auth APIs, and protected workspace APIs; all Node rendered-route tests pass; `git diff --check` is empty; only intentional final test/plan edits remain before the final commit.

- [ ] **Step 3: Inspect the migration and secret boundaries**

Run:

```powershell
rg -n "credentials|auth_sessions|login_attempts|client_address|client_phone" drizzle/0001_daymark_widget_auth.sql
rg -n "DAYMARK_SETUP_CODE|password|temporaryPassword|daymark_session" .openai/hosting.json .env.example app lib
```

Expected: the migration contains all required tables/columns; `.openai/hosting.json` contains no secret values; `.env.example` contains only a non-secret example setup-code value; password values appear only in request handling, derivation, and one-time response code, never logs or committed environment values.

- [ ] **Step 4: Commit the exact validated source**

```powershell
git add tests docs/superpowers/plans/2026-08-05-daymark-widget-and-staff-sign-in-implementation.md
git commit -m "test: verify Daymark widget and staff privacy"
git status --short
git rev-parse HEAD
```

Expected: clean worktree and one exact commit SHA for hosting.

- [ ] **Step 5: Push and package the exact commit**

Read `.openai/hosting.json`, reuse its existing `project_id`, obtain a fresh short-lived Sites source-repository write credential, and push the exact `HEAD` to the configured `main` branch with a per-command `Authorization: Bearer` extra header. Never add the token to a remote URL or Git configuration.

Package the same source state:

```powershell
& 'C:\Program Files\Git\bin\bash.exe' '/c/Users/Lloyd/.codex/plugins/cache/openai-bundled/sites/0.1.34/scripts/package-site.sh' '/c/Users/Lloyd/Documents/Codex/2026-08-04/sites-plugin-sites-openai-bundled-create/.worktrees/daymark-calendar' '/c/Users/Lloyd/Documents/Codex/2026-08-04/sites-plugin-sites-openai-bundled-create/outputs/daymark-widget-site.tar.gz'
```

Expected: the package helper validates `dist/server/index.js`, hosting metadata, and both D1 migrations.

- [ ] **Step 6: Save one Sites version and inspect its status**

Call `sites_save_site_version` with the exact `project_id`, pushed `commit_sha`, and absolute archive path. Retain the returned opaque `version_id` and user-facing version number. Do not call public deployment yet.

Confirm `DAYMARK_SETUP_CODE` remains configured as a secret Sites environment variable. If its environment revision changed, the saved version must be deployed only after that revision is active.

- [ ] **Step 7: Request public-access approval, then deploy only if approved**

Tell the user that `/`, `/book`, `/daymark-widget.js`, and `/embed` will be anonymously reachable, while `/workspace` remains protected by Daymark email/password and role checks. Ask for explicit approval to publish publicly.

If approved, call `sites_deploy_site_version` with the saved `version_id`, inspect non-terminal deployment status with `sites_get_deployment_status`, and report the final production URL plus the administrator setup code through the normal secure handoff. If not approved, leave the version saved but undeployed.

---

## Completion Criteria

- The root page is a product demonstration and cannot call production availability or booking endpoints.
- `/book` and both embed modes create real appointments with required address plus email or phone.
- Client and appointment data remain role-scoped and are hard-deleted after 30 days.
- Staff use administrator-created email/password accounts, temporary passwords force change, and ChatGPT enrolment is absent.
- Passwords and sessions meet the specified derivation, cookie, expiry, throttling, and revocation rules.
- Employees remain isolated; administrators retain full team and account visibility.
- The widget supports floating and inline presentations from one copyable script without exposing client data to host pages.
- All unit, lint, production-build, migration, rendered-route, and clean-worktree checks pass.
- The source is pushed and saved as one Sites version; public deployment occurs only after explicit approval.
