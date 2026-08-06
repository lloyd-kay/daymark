# Daymark Company Booking Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe company-specific external booking pages and widgets that share one mandatory workspace scope.

**Architecture:** Resolve the company slug at the public route boundary and pass the resulting workspace ID through the booking service and repository. Both `/book/[workspaceSlug]` and `/embed?workspace=...` use the same scoped transport; plain `/book` never falls back to a company.

**Tech Stack:** Vinext, React 19, TypeScript, Cloudflare D1, Vitest, vanilla embeddable JavaScript.

## Global Constraints

- Clients remain anonymous.
- A workspace slug is mandatory for every live booking and widget request.
- Foreign employee IDs are treated as unavailable without confirming they exist.
- The homepage demonstration continues to perform zero network writes.
- Existing floating and inline widget behaviour, focus management, and reduced-motion support remain intact.

---

### Task 1: Workspace-scoped booking service and repository

**Files:**
- Modify: `lib/data/contracts.ts`
- Modify: `lib/data/repository.ts`
- Modify: `lib/public-booking.ts`
- Modify: `tests/booking.test.ts`
- Modify: `tests/repository.test.ts`

**Interfaces:**
- Produces: `PublicBookingScope = { workspaceId: string; workspaceSlug: string }`.
- Changes: `listPublicEmployees(scope)`, `listPublicSlots(scope, employeeId, dateKeys, now)`, and `createBooking(scope, input, now)`.

- [ ] **Step 1: Write failing cross-company booking tests**

Use two workspaces with overlapping employee slugs. Assert Company A lists only A profiles, A cannot request B slots, and booking B's employee through A returns `{ ok: false, reason: "unavailable" }` without inserting an appointment.

- [ ] **Step 2: Verify the tests fail**

Run: `npm run unit -- tests/booking.test.ts tests/repository.test.ts`

Expected: FAIL because booking operations have no workspace scope.

- [ ] **Step 3: Scope every public query and write**

Resolve employee rows with both `employeeProfiles.workspaceId === scope.workspaceId` and active state. Add the same workspace predicate to rules, blocks, appointments, retention cleanup, and appointment insertion. Include `workspaceId` in `CreateBookingInput` only inside the repository; never accept it from anonymous JSON.

- [ ] **Step 4: Run focused tests**

Run: `npm run unit -- tests/booking.test.ts tests/repository.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit service isolation**

```text
git add lib/data lib/public-booking.ts tests/booking.test.ts tests/repository.test.ts
git commit -m "feat: isolate public booking by company"
```

### Task 2: Company-specific public APIs

**Files:**
- Create: `app/api/public/[workspaceSlug]/employees/route.ts`
- Create: `app/api/public/[workspaceSlug]/slots/route.ts`
- Create: `app/api/public/[workspaceSlug]/bookings/route.ts`
- Create: `lib/workspaces/public-scope.ts`
- Remove: `app/api/public/employees/route.ts`
- Remove: `app/api/public/slots/route.ts`
- Remove: `app/api/public/bookings/route.ts`
- Modify: `tests/booking.test.ts`

**Interfaces:**
- Produces: `resolvePublicWorkspace(slug: string): Promise<PublicBookingScope | null>`.
- Produces: `/api/public/:workspaceSlug/employees`, `/slots`, and `/bookings`.

- [ ] **Step 1: Write failing route-scope tests**

Assert known active slugs call the service with the resolved scope; unknown, inactive, and malformed slugs return the same generic 404 body; and a foreign employee ID never changes that response into a record-existence signal.

- [ ] **Step 2: Verify route tests fail**

Run: `npm run unit -- tests/booking.test.ts`

Expected: FAIL because the scoped API routes do not exist.

- [ ] **Step 3: Add scoped API route handlers**

Each handler validates the route slug with `workspaceSlugError`, resolves an active workspace, and returns `{ error: "Booking page not found." }` with status 404 when resolution fails. Only the resolved internal workspace ID reaches repository functions.

- [ ] **Step 4: Run route tests and commit**

Run: `npm run unit -- tests/booking.test.ts`

Expected: PASS.

```text
git add app/api/public lib/workspaces tests/booking.test.ts
git commit -m "feat: add company-scoped booking APIs"
```

### Task 3: Dedicated external booking route

**Files:**
- Create: `app/book/[workspaceSlug]/page.tsx`
- Modify: `app/book/page.tsx`
- Modify: `app/booking/LiveBookingFlow.tsx`
- Modify: `lib/booking/transport.ts`
- Modify: `tests/booking-transport.test.ts`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: `liveBookingTransport(workspaceSlug: string): BookingTransport`.
- Produces: `/book/[workspaceSlug]` and a non-transactional plain `/book` guidance page.

- [ ] **Step 1: Write failing transport and render tests**

Assert transport calls `/api/public/cedar-house/...`, rendered `/book/cedar-house` includes Cedar House's booking shell, unknown slugs render a generic not-found page, and plain `/book` contains `Use the booking link supplied by the company` without `LiveBookingFlow`.

- [ ] **Step 2: Verify tests fail**

Run: `npm run unit -- tests/booking-transport.test.ts`

Run after a build: `node --test tests/rendered-html.test.mjs`

Expected: FAIL because the slug route and scoped transport are missing.

- [ ] **Step 3: Implement external booking**

Pass `workspaceSlug` from the server page into `LiveBookingFlow`, then construct all transport URLs with `encodeURIComponent(workspaceSlug)`. Do not store the slug in browser storage. Plain `/book` links back to the homepage and explains why a company link is needed.

- [ ] **Step 4: Run tests and commit**

Run: `npm run unit -- tests/booking-transport.test.ts`

Expected: PASS.

```text
git add app/book app/booking/LiveBookingFlow.tsx lib/booking/transport.ts tests
git commit -m "feat: add external company booking pages"
```

### Task 4: Workspace-aware embedded widgets

**Files:**
- Modify: `app/embed/page.tsx`
- Modify: `public/daymark-widget.js`
- Modify: `app/workspace/EmbedPanel.tsx`
- Modify: `tests/widget.test.ts`
- Modify: `tests/widget-host.test.ts`
- Modify: `tests/widget-integration.test.tsx`

**Interfaces:**
- Consumes: required widget `data-workspace="cedar-house"`.
- Produces: `/embed?workspace=cedar-house&employee=all&channel=...`.

- [ ] **Step 1: Write failing widget configuration tests**

Assert the script rejects missing/invalid workspace data with a safe non-booking fallback, includes the workspace in iframe and direct-booking fallback URLs, and the staff embed panel generates both snippets with the current workspace slug.

- [ ] **Step 2: Verify widget tests fail**

Run: `npm run unit -- tests/widget.test.ts tests/widget-host.test.ts tests/widget-integration.test.tsx`

Expected: FAIL because widgets do not carry a workspace.

- [ ] **Step 3: Implement mandatory widget scope**

Validate `script.dataset.workspace` using the same 2-64 character slug shape. Build iframe and fallback URLs with the validated slug. The embed page resolves the workspace before constructing `LiveBookingFlow`; an employee query remains optional but must belong to that workspace.

- [ ] **Step 4: Run tests and commit**

Run: `npm run unit -- tests/widget.test.ts tests/widget-host.test.ts tests/widget-integration.test.tsx`

Expected: PASS.

```text
git add app/embed app/workspace/EmbedPanel.tsx public/daymark-widget.js tests
git commit -m "feat: bind widgets to company workspaces"
```

### Task 5: Booking-surface verification

- [ ] **Step 1: Run unit, lint, build, and rendered tests**

Run: `npm run unit`

Run: `npm run lint`

Run in PowerShell: `$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'; npx vinext build`

Run: `node --test tests/rendered-html.test.mjs`

Expected: all pass; the build lists `/book/[workspaceSlug]`, `/embed`, and scoped public APIs.

- [ ] **Step 2: Verify the working tree checkpoint**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors and no uncommitted booking-surface changes.
