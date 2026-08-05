# Daymark Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish Daymark, a distinctive privacy-first team calendar with public employee-specific booking, isolated employee workspaces, administrator-wide visibility, and 30-day appointment retention.

**Architecture:** A Vinext application serves an anonymous public booking route and a ChatGPT-sign-in-protected workspace. Cloudflare D1 stores memberships, employee profiles, invitation codes, availability rules, blocked periods, and appointments; all data access passes through scoped repository functions, while a pure scheduling module computes safe public slots. Client components own only interaction state, and server routes re-authorize and revalidate every write.

**Tech Stack:** Vinext, React 19, TypeScript 5.9, Cloudflare Workers and D1, Drizzle ORM, Vitest, Lucide React, CSS modules/global CSS, platform-owned Sign in with ChatGPT.

## Global Constraints

- Employees can read and edit only their own schedule, availability, and appointment details.
- Administrators can read and edit all employee schedules, availability, appointment details, and account status.
- Public visitors receive only employee public profile fields and discrete bookable slots; never expose busy periods, calendar metadata, or client details.
- Appointment and associated client data must be hard-deleted 30 days after the appointment ends and excluded from every read immediately at that boundary.
- Store timestamps in UTC and display Europe/London in the first release.
- Use a warm parchment, ink-blue, burnt-coral editorial planning-desk aesthetic with an oversized date rail and paper-tab appointments; avoid a generic dense blue-and-white calendar grid.
- All flows must be responsive, keyboard/touch accessible, reduced-motion aware, and WCAG AA-conscious.
- Do not add external calendar sync, notifications, payments, client accounts, analytics, or multiple locations.

## File map

- `app/page.tsx`: public booking entry and server-provided initial employee data.
- `app/booking/BookingFlow.tsx`: client booking state machine and accessible step UI.
- `app/workspace/page.tsx`: protected workspace shell and membership routing.
- `app/workspace/WorkspaceClient.tsx`: employee/admin calendar, availability, roster, and appointment interactions.
- `app/api/public/employees/route.ts`: safe public employee directory.
- `app/api/public/slots/route.ts`: computed bookable slots for one employee/date window.
- `app/api/public/bookings/route.ts`: validated, conflict-safe appointment creation.
- `app/api/workspace/enrol/route.ts`: setup-code and invitation-code enrolment.
- `app/api/workspace/schedule/route.ts`: role-scoped schedule reads and appointment cancellation.
- `app/api/workspace/availability/route.ts`: role-scoped availability and block changes.
- `app/api/workspace/team/route.ts`: administrator-only profile, invitation, and account changes.
- `app/chatgpt-auth.ts`: starter-provided platform identity helpers, retained with minimal safe-return-path behaviour.
- `db/schema.ts`: Drizzle schema and indexes.
- `db/index.ts`: D1 accessor retained from the starter.
- `lib/scheduling/types.ts`: shared scheduling domain types.
- `lib/scheduling/slots.ts`: pure Europe/London slot computation and overlap rules.
- `lib/data/repository.ts`: D1 queries, scoped reads/writes, seed data, and retention cleanup.
- `lib/auth/membership.ts`: identity-to-membership resolution and role authorization.
- `lib/http.ts`: compact JSON parsing, validation response, and error response helpers.
- `app/globals.css`: Daymark visual system, responsive layouts, focus, motion, and state styling.
- `app/layout.tsx`: site metadata, fonts, and social preview metadata.
- `tests/slots.test.ts`: slot, buffer, overlap, and time-boundary tests.
- `tests/repository.test.ts`: retention, uniqueness, and scoped-query contract tests.
- `tests/authorization.test.ts`: employee/admin/public permission matrix tests.
- `tests/booking.test.ts`: booking validation and conflict response tests.

---

### Task 1: Scaffold the Sites application and define persistent data

**Files:**
- Modify: `package.json`
- Modify: `.openai/hosting.json`
- Create locally: `.env`
- Modify: `.env.example`
- Create: `vitest.config.ts`
- Modify: `db/schema.ts`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Produces: Drizzle tables `memberships`, `employeeProfiles`, `invitations`, `availabilityRules`, `blockedPeriods`, and `appointments`; `npm run unit`; logical D1 binding `DB`.

- [ ] **Step 1: Initialize the Sites starter and start its retained development session**

Run the plugin's root-level `scripts/init-site.sh` once with the project root as its only argument. Preserve the generated package manager and lockfile. Start `npm run dev`, retain that process, and open the exact Local URL printed by the server once in Codex.

- [ ] **Step 2: Install only the focused UI and test dependencies**

Run:

```bash
npm install lucide-react
npm install --save-dev vitest
```

Add this script without changing the starter build or test scripts:

```json
"unit": "vitest run"
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Write the failing schema contract test**

Create `tests/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  appointments,
  availabilityRules,
  blockedPeriods,
  employeeProfiles,
  invitations,
  memberships,
} from "../db/schema";

describe("Daymark schema", () => {
  it("exports every persistent product table", () => {
    expect([
      memberships,
      employeeProfiles,
      invitations,
      availabilityRules,
      blockedPeriods,
      appointments,
    ]).toHaveLength(6);
  });
});
```

- [ ] **Step 4: Run the test and verify the missing exports fail**

Run: `npm run unit -- tests/schema.test.ts`

Expected: FAIL because `db/schema.ts` does not export the six Daymark tables.

- [ ] **Step 5: Implement the schema and required indexes**

Use text UUID primary keys, integer minute fields, ISO UTC timestamps, integer booleans, and explicit role/status values. Define these exact ownership relations:

```ts
export type TeamRole = "admin" | "employee";
export type AppointmentStatus = "booked" | "cancelled";

// memberships: id, oaiUserId (unique), email, displayName, role, active,
// createdAt, updatedAt
// employeeProfiles: id, membershipId (nullable/unique), publicName, title,
// bio, accent, active, sortOrder
// invitations: id, codeHash (unique), employeeProfileId, expiresAt,
// redeemedAt, createdByMembershipId, createdAt
// availabilityRules: id, employeeProfileId, weekday 0-6, startMinute,
// endMinute, slotMinutes, bufferMinutes, active
// blockedPeriods: id, employeeProfileId, startAt, endAt, note, createdAt
// appointments: id, publicReference (unique), employeeProfileId, startAt,
// endAt, clientName, clientEmail, clientNote, status, createdAt, updatedAt
```

Add query-driven indexes for active/sorted profiles, memberships by OpenAI user ID, availability by employee/weekday, blocks by employee/time, appointments by employee/time, expiration lookups, and a partial unique index on `(employee_profile_id, start_at)` where status is `booked`.

Set `.openai/hosting.json` to:

```json
{
  "d1": "DB",
  "r2": null
}
```

Set `.env.example` to contain only:

```dotenv
DAYMARK_SETUP_CODE=replace-with-a-long-random-one-time-code
```

Create an ignored local `.env` with the same key and a generated development-only value. Never commit that value.

- [ ] **Step 6: Generate and inspect the D1 migration**

Run:

```bash
npm run db:generate
npm run unit -- tests/schema.test.ts
```

Expected: one generated migration containing all six tables and the partial unique booking index; the schema test passes.

- [ ] **Step 7: Commit the foundation**

```bash
git add package.json package-lock.json .openai/hosting.json .env.example vitest.config.ts db drizzle tests/schema.test.ts
git commit -m "feat: define Daymark data foundation"
```

---

### Task 2: Build the pure availability and slot engine

**Files:**
- Create: `lib/scheduling/types.ts`
- Create: `lib/scheduling/slots.ts`
- Create: `tests/slots.test.ts`

**Interfaces:**
- Produces: `computeBookableSlots(input: SlotSearchInput): BookableSlot[]`, `overlaps(a: TimeRange, b: TimeRange): boolean`, `toLondonDateKey(value: Date): string`.
- Consumes: no database or request context; all inputs are plain values.

- [ ] **Step 1: Define scheduling types and write failing examples**

Use these public types:

```ts
export type TimeRange = { startAt: string; endAt: string };
export type AvailabilityRule = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  slotMinutes: number;
  bufferMinutes: number;
};
export type SlotSearchInput = {
  dateKeys: string[];
  now: Date;
  rules: AvailabilityRule[];
  busy: TimeRange[];
  zone: "Europe/London";
};
export type BookableSlot = { dateKey: string; startAt: string; endAt: string };
```

Write tests proving that the engine emits 30-minute slots inside a rule, removes overlaps plus buffers, omits past starts, returns stable UTC ISO timestamps, and produces the correct number of slots across the March and October Europe/London daylight-saving boundaries.

- [ ] **Step 2: Run the slot tests and verify failure**

Run: `npm run unit -- tests/slots.test.ts`

Expected: FAIL because `computeBookableSlots`, `overlaps`, and `toLondonDateKey` do not exist.

- [ ] **Step 3: Implement slot generation with `Intl.DateTimeFormat`**

Implement London wall-clock conversion with `Intl.DateTimeFormat(...).formatToParts()`, derive the UTC offset for the requested local date/time, and perform one correction pass so DST transitions resolve correctly. Generate candidate starts in `slotMinutes` increments, extend each busy interval by the rule's `bufferMinutes`, and return sorted slots.

The key overlap rule is:

```ts
export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return Date.parse(a.startAt) < Date.parse(b.endAt) &&
    Date.parse(b.startAt) < Date.parse(a.endAt);
}
```

- [ ] **Step 4: Run the slot tests**

Run: `npm run unit -- tests/slots.test.ts`

Expected: PASS for normal days, buffers, past filtering, and both UK DST transitions.

- [ ] **Step 5: Commit the scheduling core**

```bash
git add lib/scheduling tests/slots.test.ts
git commit -m "feat: compute private bookable slots"
```

---

### Task 3: Add scoped repositories, seed data, invitations, and retention

**Files:**
- Create: `lib/data/repository.ts`
- Create: `lib/data/contracts.ts`
- Create: `tests/repository.test.ts`

**Interfaces:**
- Produces: `listPublicEmployees()`, `listPublicSlots(employeeId, dateKeys, now)`, `createBooking(input)`, `getMembershipByOaiUserId(userId)`, `claimAdministrator(identity, setupCode)`, `redeemInvitation(identity, code)`, `getSchedule(scope, range)`, `saveAvailability(scope, input)`, `createInvitation(adminId, employeeProfileId)`, `setEmployeeActive(adminId, employeeProfileId, active)`, and `purgeExpiredAppointments(now)`.
- Consumes: `getDb()` from `db/index.ts` and the slot engine from Task 2.

- [ ] **Step 1: Write repository contract tests around an in-memory adapter**

Define a minimal `DaymarkStore` interface whose methods accept a database-like adapter, then test these concrete rules:

```ts
expect(await store.listPublicEmployees()).not.toContainEqual(
  expect.objectContaining({ membershipId: expect.anything() }),
);
const employeeRows = await store.getSchedule(employeeScope("maya"), range);
expect(employeeRows.every((row) => row.employeeProfileId === "maya")).toBe(true);
await expect(store.getSchedule(adminScope("admin"), range)).resolves.toHaveLength(2);
expect(await store.purgeExpiredAppointments(new Date("2026-08-05T12:00:00Z")))
  .toEqual({ deleted: 1 });
```

Include tests for a redeemed invitation being unusable, an expired invitation being rejected, a deactivated employee disappearing publicly, and a booking conflict being represented as `{ ok: false, reason: "slot-taken" }`.

- [ ] **Step 2: Run repository tests and verify failure**

Run: `npm run unit -- tests/repository.test.ts`

Expected: FAIL because the repository contracts do not exist.

- [ ] **Step 3: Implement D1-backed repository functions**

Keep public projections explicit:

```ts
export type PublicEmployee = {
  id: string;
  publicName: string;
  title: string;
  bio: string;
  accent: string;
};
```

Use prepared/parameterized Drizzle queries, call `purgeExpiredAppointments(now)` before schedule and booking operations, and compute `cutoff = now - 30 days`. Seed four editable profiles and sensible weekday rules only when `employee_profiles` is empty. Do not seed memberships, client data, or booked appointments.

Use these initial public profiles:

```ts
[
  ["Maya Chen", "Client partner", "Thoughtful planning and project conversations.", "coral"],
  ["Theo Brooks", "Operations specialist", "Practical sessions for keeping work moving.", "sage"],
  ["Priya Shah", "Project adviser", "Focused support for decisions and next steps.", "lilac"],
  ["Jon Bell", "Team coordinator", "Clear, friendly appointments for general enquiries.", "ochre"],
]
```

Hash setup and invitation codes with SHA-256 before comparing or storing them. Generate invitation codes from `crypto.getRandomValues`, give them a 7-day expiry, and store only the hash.

- [ ] **Step 4: Run repository tests and inspect query indexes**

Run:

```bash
npm run unit -- tests/repository.test.ts
```

Expected: PASS for privacy projections, scoping, invitation consumption, deactivation, retention, and conflict mapping.

- [ ] **Step 5: Commit the data layer**

```bash
git add lib/data tests/repository.test.ts
git commit -m "feat: add privacy-scoped schedule storage"
```

---

### Task 4: Enforce ChatGPT identity, enrolment, and role authorization

**Files:**
- Modify: `app/chatgpt-auth.ts`
- Create: `lib/auth/membership.ts`
- Create: `app/api/workspace/enrol/route.ts`
- Create: `tests/authorization.test.ts`

**Interfaces:**
- Produces: `getWorkspaceActor(): Promise<WorkspaceActor | null>`, `requireEmployeeActor(): Promise<WorkspaceActor>`, `requireAdminActor(): Promise<WorkspaceActor>`, and `POST /api/workspace/enrol`.
- Consumes: `getChatGPTUser()` and membership repository functions from Task 3.

- [ ] **Step 1: Write the failing permission-matrix tests**

Use this actor shape:

```ts
export type WorkspaceActor = {
  membershipId: string;
  employeeProfileId: string | null;
  role: "admin" | "employee";
  email: string;
  displayName: string;
};
```

Test anonymous, authenticated-but-unenrolled, employee, inactive employee, and administrator identities. Assert that employees cannot request another profile ID, administrators can, and no private query runs before authorization succeeds.

- [ ] **Step 2: Run authorization tests and verify failure**

Run: `npm run unit -- tests/authorization.test.ts`

Expected: FAIL because the membership guards are absent.

- [ ] **Step 3: Implement server-only actor resolution**

`getWorkspaceActor()` must return `null` for no ChatGPT identity, no membership, or inactive membership. `requireEmployeeActor()` accepts either active role and throws a typed `WorkspaceAuthError("forbidden")` otherwise. `requireAdminActor()` accepts only `role === "admin"`.

The enrolment endpoint accepts exactly one of:

```ts
type EnrolBody =
  | { kind: "setup"; code: string }
  | { kind: "invitation"; code: string };
```

Setup succeeds only when no administrator exists and the submitted code matches the deployment secret. Invitation redemption links the authenticated identity to the invitation's employee profile in one logical operation. Return neutral 400/403/409 responses without revealing valid codes or membership records.

- [ ] **Step 4: Run the permission tests**

Run: `npm run unit -- tests/authorization.test.ts`

Expected: PASS for the full role matrix and inactive users.

- [ ] **Step 5: Commit identity and authorization**

```bash
git add app/chatgpt-auth.ts app/api/workspace/enrol lib/auth tests/authorization.test.ts
git commit -m "feat: protect team workspaces by role"
```

---

### Task 5: Implement conflict-safe public booking routes

**Files:**
- Create: `lib/http.ts`
- Create: `app/api/public/employees/route.ts`
- Create: `app/api/public/slots/route.ts`
- Create: `app/api/public/bookings/route.ts`
- Create: `tests/booking.test.ts`

**Interfaces:**
- Produces: `GET /api/public/employees`, `GET /api/public/slots?employeeId=<id>&from=<YYYY-MM-DD>`, and `POST /api/public/bookings`.
- Consumes: safe public repository functions from Task 3.

- [ ] **Step 1: Write failing route-handler tests**

Use this booking input contract:

```ts
export type CreateBookingInput = {
  employeeId: string;
  startAt: string;
  clientName: string;
  clientEmail: string;
  clientNote?: string;
};
```

Test malformed identifiers, invalid email, past slots, deactivated employees, unavailable slots, simultaneous slot claims, and a successful response shaped as:

```ts
{
  ok: true,
  booking: {
    reference: "DM-7K4P2Q",
    employeeName: "Maya Chen",
    startAt: "2026-08-10T09:00:00.000Z",
    endAt: "2026-08-10T09:30:00.000Z"
  }
}
```

Assert that public responses contain no client details, membership IDs, blocked-period notes, or busy intervals.

- [ ] **Step 2: Run the booking tests and verify failure**

Run: `npm run unit -- tests/booking.test.ts`

Expected: FAIL because the handlers and validators are absent.

- [ ] **Step 3: Implement strict validation and conflict mapping**

Trim input, cap names at 80 characters and notes at 500, validate a conventional email shape, accept only exact ISO timestamps returned by the slot endpoint, recompute slots server-side, then insert. Map the D1 unique-index collision to HTTP 409:

```ts
return Response.json(
  { ok: false, error: "That time was just booked. Please choose another." },
  { status: 409 },
);
```

Return `Cache-Control: no-store` for slots and booking responses.

- [ ] **Step 4: Run public booking tests**

Run: `npm run unit -- tests/booking.test.ts`

Expected: PASS for validation, privacy, booking, and conflict cases.

- [ ] **Step 5: Commit the public API**

```bash
git add app/api/public lib/http.ts tests/booking.test.ts
git commit -m "feat: add safe public appointment booking"
```

---

### Task 6: Build the distinctive public Daymark booking experience

**Files:**
- Modify: `app/page.tsx`
- Create: `app/booking/BookingFlow.tsx`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Remove: `app/_sites-preview/**`

**Interfaces:**
- Produces: accessible client booking state machine with steps `person`, `date`, `time`, `details`, and `confirmed`.
- Consumes: public endpoints from Task 5.

- [ ] **Step 1: Add a rendered-page assertion that fails on the starter**

Extend `tests/rendered-html.test.mjs` to assert the production output includes:

```js
assert.match(html, /Book time with the right person/i);
assert.match(html, /Your details stay private/i);
assert.doesNotMatch(html, /codex-preview/i);
```

- [ ] **Step 2: Run the existing site test and verify failure**

Run: `npm test`

Expected: FAIL because the starter page has not been replaced.

- [ ] **Step 3: Implement the booking state machine**

`BookingFlow` owns this explicit state:

```ts
type BookingStep = "person" | "date" | "time" | "details" | "confirmed";
type BookingDraft = {
  employee: PublicEmployee | null;
  dateKey: string | null;
  slot: BookableSlot | null;
  clientName: string;
  clientEmail: string;
  clientNote: string;
};
```

Preserve details after a 409, refresh slots, return focus to the time heading, announce errors in an `aria-live="polite"` region, and provide a complete confirmation summary. Use native buttons, labels, and form validation. Show a two-week date strip but only fetch/render discrete slots.

- [ ] **Step 4: Apply the non-generic Daymark visual system**

Implement CSS custom properties for parchment, ink, coral, sage, lilac, ochre, and sky. Use a split first viewport: oversized active-date rail on the left, stacked paper-tab choices in the centre, and a privacy note card on the right. Add subtle offset borders, editorial labels, selected-slot motion, strong focus rings, `prefers-reduced-motion`, and mobile step stacking. Do not use gradients, model-authored SVGs, a dense month grid, or generic dashboard chrome.

- [ ] **Step 5: Replace starter metadata and remove preview infrastructure**

Set the title to `Daymark — Private team booking` and the description to `Book the right person without exposing the team's calendars.` Remove `codex-preview` metadata, delete `app/_sites-preview`, remove its imports, uninstall `react-loading-skeleton` when unused, and refresh the lockfile.

- [ ] **Step 6: Run unit and rendered output tests**

Run:

```bash
npm run unit
npm test
```

Expected: all unit tests pass and rendered HTML includes Daymark copy with no starter marker.

- [ ] **Step 7: Commit the public experience**

```bash
git add app package.json package-lock.json tests/rendered-html.test.mjs
git commit -m "feat: create the Daymark booking experience"
```

---

### Task 7: Build employee and administrator workspaces

**Files:**
- Create: `app/workspace/page.tsx`
- Create: `app/workspace/WorkspaceClient.tsx`
- Create: `app/api/workspace/schedule/route.ts`
- Create: `app/api/workspace/availability/route.ts`
- Create: `app/api/workspace/team/route.ts`
- Modify: `app/globals.css`
- Create: `tests/workspace-routes.test.ts`

**Interfaces:**
- Produces: protected workspace, role-scoped schedule API, availability API, and administrator team API.
- Consumes: actor guards from Task 4 and repository functions from Task 3.

- [ ] **Step 1: Write failing workspace route tests**

Cover these exact cases:

```ts
it("rejects anonymous schedule reads with 401");
it("scopes employee schedule reads to the actor profile");
it("rejects employee attempts to pass another employeeId with 403");
it("allows an administrator to request all active profiles");
it("allows only administrators to create invitations");
it("requires confirmation for appointment cancellation and deactivation");
```

- [ ] **Step 2: Run workspace tests and verify failure**

Run: `npm run unit -- tests/workspace-routes.test.ts`

Expected: FAIL because the routes are absent.

- [ ] **Step 3: Implement role-scoped server routes**

The schedule route accepts `from`, `to`, and, for administrators only, optional `employeeId`. The availability route accepts weekly rules and one-off blocks only for the actor's profile unless the actor is an administrator. The team route supports administrator-only invitation creation, profile editing, and activation changes. Every write validates again after authorization.

- [ ] **Step 4: Build protected server entry and enrolment states**

Mark the page dynamic:

```ts
export const dynamic = "force-dynamic";
```

Use `requireChatGPTUser("/workspace")`. If the identity is not enrolled, show either first-admin setup or invitation-code enrolment without loading schedule data. Active members receive only the initial data their role is allowed to see.

- [ ] **Step 5: Build the planning-desk workspace UI**

Employees see a seven-day editorial agenda, oversized active date, Today panel, appointment detail drawer, weekly availability editor, duration/buffer controls, and block-time form. Administrators additionally see a colour-coded roster filter, team-wide appointments, profile activation, and one-time invitation creation. Label appointments by employee name as well as colour. Mobile converts the week into a swipe-free day agenda with previous/next buttons.

- [ ] **Step 6: Run workspace and full unit tests**

Run:

```bash
npm run unit -- tests/workspace-routes.test.ts
npm run unit
```

Expected: PASS for route authorization and the complete unit suite.

- [ ] **Step 7: Commit protected workspaces**

```bash
git add app/workspace app/api/workspace app/globals.css tests/workspace-routes.test.ts
git commit -m "feat: add private team workspaces"
```

---

### Task 8: Create the social card, validate the production build, and publish

**Files:**
- Create: `public/og.png`
- Modify: `app/layout.tsx`
- Modify: `.openai/hosting.json`

**Interfaces:**
- Produces: validated Cloudflare-compatible build, bespoke Daymark Open Graph image, saved Sites version, and a production deployment suitable for anonymous client booking.
- Consumes: complete site from Tasks 1–7.

- [ ] **Step 1: Generate exactly one site-specific social card**

Use ImageGen with this brief after the final page copy and palette are frozen:

```text
Create a complete 1200×630 landscape social card for “Daymark — Private team booking”. Warm parchment background, deep ink-blue editorial typography, burnt-coral vertical daymark rail, four subtle paper appointment tabs in sage, lilac, ochre, and sky. Include exactly the text “DAYMARK” and “Book the right person. Keep every calendar private.” Calm, premium, slightly tactile, no device mockup, no extra logos, no invented words.
```

Inspect the image text. Retry once only if the required text is wrong or unreadable. Save a passing image as `public/og.png`; otherwise omit image metadata.

- [ ] **Step 2: Add absolute-host social metadata**

Configure Open Graph and X metadata to use `/og.png` through an absolute URL derived from the incoming request host. Include the finished Daymark title and description; do not retain starter metadata.

- [ ] **Step 3: Run the complete verification sequence**

Keep the development session running, then run:

```bash
npm run unit
npm run lint
npm run build
npm test
git status --short
```

Expected: unit, lint, build, and rendered-output tests pass; only intentional source changes remain.

- [ ] **Step 4: Commit the exact validated source**

```bash
git add app public db drizzle lib tests package.json package-lock.json .openai/hosting.json .env.example
git commit -m "feat: complete Daymark private scheduling"
```

- [ ] **Step 5: Create and configure the Sites project once**

Read `.openai/hosting.json`. If it has no `project_id`, create one Sites project titled `Daymark`, slugged with an available `daymark-...` value, and described as a privacy-first team appointment calendar. Persist the returned opaque `project_id` unchanged. Configure a long random `DAYMARK_SETUP_CODE` as a hosted runtime value and retain it for the user handoff.

- [ ] **Step 6: Push, package, save, and request public deployment approval**

Push the validated branch head using the Sites-provided short-lived credential as a per-command authorization header. Package with the plugin's `scripts/package-site.sh` and save one version using the pushed commit SHA and archive. Because anonymous clients must reach the booking route, request explicit approval to publish that saved version publicly. Deploy only after approval, then poll deployment status directly until it succeeds or fails.

- [ ] **Step 7: Open the production URL and stop the local server**

On successful deployment, open the exact deployed URL in Codex, stop the retained development session, and hand off the production URL plus the one-time administrator setup code. Do not expose repository credentials, internal IDs, or temporary archives.
