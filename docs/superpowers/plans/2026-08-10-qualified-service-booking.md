# Qualified Service Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add administrator-managed services and employee qualifications, then support full-catalogue and explicitly preselected-service booking across direct links and widgets.

**Architecture:** Add workspace-scoped service and employee-service qualification tables, with appointment service snapshots and a single reusable eligibility predicate. Protected service-management APIs feed a new administrator Services panel; anonymous service, employee, slot, and booking APIs apply the same workspace and qualification checks. Direct pages and widgets pass an explicit Daymark service slug, while the booking transport submits an internal service ID and the repository revalidates eligibility and overlap.

**Tech Stack:** TypeScript 5.9, React 19, Vinext, Drizzle ORM with Cloudflare D1/SQLite, Vitest, Node test runner, vanilla iframe widget JavaScript, packaged local Wrangler runtime.

## Global Constraints

- Implement only full-catalogue and preselected-service booking; payment remains documented and unimplemented.
- Do not infer services from URLs, titles, DOM text, product handles, or other host-page content.
- Preserve floating and inline widgets, optional employee preselection, direct booking pages, the non-transactional demonstration, authentication, workspace isolation, and 30-day appointment retention.
- Manual approval and certificate-backed approval may coexist; certificate-backed approval requires a certificate name and expiry date and expires after that Europe/London calendar date.
- Service duration is 15–480 minutes in 15-minute increments.
- Never edit manually, delete, stage, or commit `.daymark/`, database files, logs, setup codes, exports, or external restore snapshots.
- The source restore tag is `restore-2026-08-10-before-service-catalog`; the cold data snapshot is `C:\Users\Lloyd\Files\Daymark-restore-points\2026-08-10-before-service-catalog\.daymark`.
- Do not implement payments, commerce-provider adapters, certificate uploads, third-party certificate verification, shared capability taxonomies, pricing, tax, deposits, quantities, invoices, locations, or travel matching.
- Do not publish a release or deploy Daymark; push the tested feature to GitHub as explicitly requested.

---

## File structure

- `db/schema.ts`: persistent service, qualification, and appointment-snapshot schema.
- `drizzle/0004_daymark_service_catalog.sql` plus Drizzle metadata: migration and General appointment backfill.
- `lib/services/eligibility.ts`: shared date, slug, qualification, and duration validation with no database access.
- `lib/data/contracts.ts`: public, protected, booking, qualification, and appointment service types.
- `lib/data/service-repository.ts`: protected service CRUD and qualification persistence.
- `lib/data/repository.ts`: public service/employee/slot booking reads, atomic booking insert, schedule snapshot projection, and seed repair.
- `lib/service-management.ts`: administrator authorization and request validation for service mutations.
- `lib/service-management-runtime.ts`: production dependency wiring.
- `app/api/workspace/services/route.ts`: same-origin protected service-management route.
- `app/workspace/ServicesPanel.tsx`: administrator catalogue and qualification interface.
- `app/workspace/WorkspaceClient.tsx` and `app/workspace/[workspaceSlug]/page.tsx`: Services navigation and initial protected data.
- `lib/public-booking.ts` and public API routes: anonymous catalogue, qualified employee, slot, and booking contracts.
- `lib/booking/transport.ts`: service-aware live and demonstration transports.
- `app/booking/BookingFlow.tsx`, `LiveBookingFlow.tsx`, and `DemoBookingFlow.tsx`: service-first and fixed-service journeys.
- `app/book/[workspaceSlug]/page.tsx`: optional validated preselected service.
- `lib/widget/protocol.ts`, `public/daymark-widget.js`, `app/embed/page.tsx`, and `app/workspace/EmbedPanel.tsx`: explicit service configuration and forwarding.
- `app/globals.css`: catalogue, service-management, qualification, and responsive booking styles.
- Focused tests under `tests/`: schema/migration, eligibility, repository, protected API/service/UI, public API/transport/UI, and widget behavior.

---

### Task 1: Service schema, shared eligibility, migration, and backward-compatible defaults

**Files:**
- Create: `lib/services/eligibility.ts`
- Create: `tests/service-eligibility.test.ts`
- Modify: `db/schema.ts`
- Modify: `lib/data/contracts.ts`
- Modify: `lib/auth/repository.ts`
- Modify: `lib/data/repository.ts`
- Modify: `tests/schema.test.ts`
- Modify: `tests/repository.test.ts`
- Modify: `tests/auth-service.test.ts`
- Modify: `tests/local-runtime/migrations.test.ts`
- Create: `drizzle/0004_daymark_service_catalog.sql`
- Create: `drizzle/meta/0004_snapshot.json`
- Modify: `drizzle/meta/_journal.json`

**Interfaces:**
- Produces: `PublicService`, `WorkspaceService`, `EmployeeServiceQualification`, and `QualificationMethod` types.
- Produces: `normalizeServiceSlug(value: string): string`, `validServiceDuration(value: unknown): value is number`, `validDateOnly(value: unknown): value is string`, and `qualificationIsCurrent(record, today): boolean`.
- Produces schema exports `services` and `employeeServiceQualifications` and appointment columns `serviceId`, `serviceName`, and `serviceDurationMinutes`.

- [ ] **Step 1: Write failing schema and eligibility tests**

```ts
it("keeps manual approval current and expires certificate approval after its London expiry date", () => {
  expect(qualificationIsCurrent({ active: true, method: "manual", expiresOn: null }, "2026-08-10")).toBe(true);
  expect(qualificationIsCurrent({ active: true, method: "certificate", expiresOn: "2026-08-10" }, "2026-08-10")).toBe(true);
  expect(qualificationIsCurrent({ active: true, method: "certificate", expiresOn: "2026-08-09" }, "2026-08-10")).toBe(false);
});

it("defines workspace-scoped service, qualification, and appointment snapshot columns", () => {
  expect(getTableColumns(services).workspaceId.notNull).toBe(true);
  expect(getTableColumns(employeeServiceQualifications).workspaceId.notNull).toBe(true);
  expect(getTableColumns(appointments).serviceId.notNull).toBe(false);
  expect(getTableColumns(appointments).serviceName.notNull).toBe(true);
  expect(getTableColumns(appointments).serviceDurationMinutes.notNull).toBe(true);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm run unit -- tests/service-eligibility.test.ts tests/schema.test.ts tests/repository.test.ts tests/auth-service.test.ts tests/local-runtime/migrations.test.ts`

Expected: FAIL because the eligibility module, service tables, service contracts, General appointment creation, and `0004` migration do not exist.

- [ ] **Step 3: Add the minimal shared validators and data contracts**

```ts
export type QualificationMethod = "manual" | "certificate";

export function qualificationIsCurrent(
  value: { active: boolean; method: QualificationMethod; expiresOn: string | null },
  today: string,
): boolean {
  if (!value.active) return false;
  return value.method === "manual"
    ? true
    : validDateOnly(value.expiresOn) && value.expiresOn >= today;
}

export function validServiceDuration(value: unknown): value is number {
  return typeof value === "number"
    && Number.isInteger(value)
    && value >= 15
    && value <= 480
    && value % 15 === 0;
}
```

Define `PublicService` with `id`, `slug`, `name`, `category`, `description`, and `durationMinutes`; define protected qualification and workspace-service records with only the approved certificate fields.

- [ ] **Step 4: Add the schema and generate the Drizzle migration**

Add `services` before `appointments`, add `employeeServiceQualifications`, and extend appointments with a nullable service relationship plus non-null snapshot defaults. Run:

```powershell
npm run db:generate -- --name daymark_service_catalog
```

Rename the generated file to `drizzle/0004_daymark_service_catalog.sql` only if Drizzle chooses a different descriptive suffix; keep its generated snapshot and journal entry aligned.

- [ ] **Step 5: Add explicit General appointment migration backfill**

Append statement-breakpoint-separated SQL that inserts one deterministic General appointment service per workspace, inserts manual qualifications for existing active profiles, backfills appointment service IDs/names/durations, and ends with:

```sql
PRAGMA foreign_key_check;
--> statement-breakpoint
PRAGMA optimize;
```

Update initial workspace creation to insert its General appointment in the existing batch. Extend seed repair so profiles created after migrations receive an idempotent manual General appointment qualification.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npm run unit -- tests/service-eligibility.test.ts tests/schema.test.ts tests/repository.test.ts tests/auth-service.test.ts tests/local-runtime/migrations.test.ts`

Expected: PASS with the migration list reporting five files and `0004_daymark_service_catalog.sql` as latest.

- [ ] **Step 7: Commit the persistence slice**

```powershell
git add -- db/schema.ts drizzle lib/services/eligibility.ts lib/data/contracts.ts lib/auth/repository.ts lib/data/repository.ts tests/service-eligibility.test.ts tests/schema.test.ts tests/repository.test.ts tests/auth-service.test.ts tests/local-runtime/migrations.test.ts
git diff --cached --check
git commit -m "Add qualified service persistence"
```

---

### Task 2: Protected service-management repository and API

**Files:**
- Create: `lib/data/service-repository.ts`
- Create: `lib/service-management.ts`
- Create: `lib/service-management-runtime.ts`
- Create: `app/api/workspace/services/route.ts`
- Create: `tests/service-management.test.ts`
- Create: `tests/workspace-services-route.test.ts`
- Modify: `tests/authorization.test.ts`

**Interfaces:**
- Produces repository functions `listWorkspaceServices(scope, now?)`, `createWorkspaceService(admin, input)`, `updateWorkspaceService(admin, input)`, `setWorkspaceServiceActive(admin, serviceId, active)`, and `setEmployeeServiceQualification(admin, input)`.
- Produces `createServiceManagement(dependencies)` with `list()` and `mutate(raw)` methods.
- Produces authenticated `GET` and same-origin `POST` at `/api/workspace/services?workspace={slug}`.

- [ ] **Step 1: Write failing service-management tests**

```ts
it("denies service data to an employee before invoking storage", async () => {
  const deps = dependencies({ role: "employee" });
  const result = await createServiceManagement(deps).list();
  expect(result.status).toBe(403);
  expect(deps.listWorkspaceServices).not.toHaveBeenCalled();
});

it("requires certificate name and expiry for certificate-backed approval", async () => {
  const deps = dependencies({ role: "admin" });
  const result = await createServiceManagement(deps).mutate({
    action: "set-qualification",
    serviceId: "service-camera",
    employeeProfileId: "maya-chen",
    active: true,
    method: "certificate",
    certificateName: "",
    expiresOn: null,
  });
  expect(result.status).toBe(400);
  expect(deps.setEmployeeServiceQualification).not.toHaveBeenCalled();
});
```

Add a route test proving cross-origin POST is rejected before JSON parsing or service invocation.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm run unit -- tests/service-management.test.ts tests/workspace-services-route.test.ts tests/authorization.test.ts`

Expected: FAIL because the service-management modules and route do not exist.

- [ ] **Step 3: Implement workspace-scoped repository operations**

Every write first resolves an active administrator membership and its workspace. Every service and employee predicate includes that workspace ID. Qualification upsert uses the unique employee-service key, preserves expired records for administrator visibility, clears certificate fields for manual approval, and sets `active: false` instead of deleting on removal.

Slug creation uses `normalizeServiceSlug(name)` and deterministic `-2` through `-99` collision candidates. The database unique index remains the final race guard.

- [ ] **Step 4: Implement protected validation and routing**

Support these exact actions:

```ts
type ServiceAction =
  | { action: "create-service"; name: string; category: string; description: string; durationMinutes: number }
  | { action: "update-service"; serviceId: string; name: string; category: string; description: string; durationMinutes: number }
  | { action: "set-service-active"; serviceId: string; active: boolean; confirm: true }
  | {
      action: "set-qualification";
      serviceId: string;
      employeeProfileId: string;
      active: boolean;
      method: "manual" | "certificate";
      certificateName: string | null;
      certificateReference: string | null;
      issuedOn: string | null;
      expiresOn: string | null;
      confirm?: true;
    };
```

Bound names/categories to 80 characters, descriptions to 500, certificate names/references to 120, require date-only issued/expiry values, reject issue dates after expiry, and require `confirm: true` for removal or service deactivation.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm run unit -- tests/service-management.test.ts tests/workspace-services-route.test.ts tests/authorization.test.ts`

Expected: PASS, including administrator-only reads, validation branches, workspace-scoped dependency calls, and same-origin route protection.

- [ ] **Step 6: Commit the protected domain slice**

```powershell
git add -- lib/data/service-repository.ts lib/service-management.ts lib/service-management-runtime.ts app/api/workspace/services tests/service-management.test.ts tests/workspace-services-route.test.ts tests/authorization.test.ts
git diff --cached --check
git commit -m "Add protected service management"
```

---

### Task 3: Administrator Services panel and workspace integration

**Files:**
- Create: `app/workspace/ServicesPanel.tsx`
- Modify: `app/workspace/WorkspaceClient.tsx`
- Modify: `app/workspace/[workspaceSlug]/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/workspace-ui.test.tsx`

**Interfaces:**
- `ServicesPanel({ workspaceSlug, profiles, initialServices })` owns protected refresh and mutation state.
- `WorkspaceClient` receives `initialServices: WorkspaceService[]` and exposes a Services view only to administrators.

- [ ] **Step 1: Write failing administrator UI tests**

```tsx
it("shows Services only to administrators", async () => {
  const adminView = await renderWorkspace(admin, profiles, [], services);
  expect(findButton(adminView.container, "Services")).not.toBeNull();
  const employeeView = await renderWorkspace(employee, [profiles[0]], [], []);
  expect(findButton(employeeView.container, "Services")).toBeNull();
});

it("submits a certificate-backed qualification and refreshes protected data", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(fetch)
    .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
    .mockResolvedValueOnce(jsonResponse(200, {
      services: [{
        ...cameraService,
        qualifications: [{
          employeeProfileId: "maya-chen",
          active: true,
          method: "certificate",
          certificateName: "Eufy Alarm Installer",
          certificateReference: "CERT-1042",
          issuedOn: "2026-01-10",
          expiresOn: "2027-01-10",
          current: true,
        }],
      }],
    }));
  const { container } = await render(createElement(ServicesPanel, {
    workspaceSlug: "cedar-house",
    profiles,
    initialServices: [cameraService],
  }));
  await changeSelect(container.querySelector<HTMLSelectElement>("select[name='qualification-maya-chen']")!, "certificate");
  await changeInput(container.querySelector<HTMLInputElement>("input[name='certificate-name-maya-chen']")!, "Eufy Alarm Installer");
  await changeInput(container.querySelector<HTMLInputElement>("input[name='certificate-reference-maya-chen']")!, "CERT-1042");
  await changeInput(container.querySelector<HTMLInputElement>("input[name='certificate-expiry-maya-chen']")!, "2027-01-10");
  await act(async () => buttonNamed(container, "Save Maya Chen qualification").click());
  expect(container.textContent).toContain("Current");
  expect(container.textContent).toContain("Eufy Alarm Installer");
});
```

- [ ] **Step 2: Run the workspace UI test and verify RED**

Run: `npm run unit -- tests/workspace-ui.test.tsx`

Expected: FAIL because `ServicesPanel`, the Services navigation item, and `initialServices` do not exist.

- [ ] **Step 3: Implement the Services panel**

Render:

- a create form with Name, Category, Description, and Duration;
- one editable service card per service with immutable slug display and activation control;
- one qualification editor per employee with Not qualified, Admin approved, and Certificate options;
- certificate name, reference, issue date, and expiry date only when Certificate is selected; and
- status text derived from the protected `current` and expiry values.

After every successful mutation, call protected GET and replace the panel's service state. Use `window.confirm` for service deactivation and qualification removal. Keep error/status copy in `role="status"` containers.

- [ ] **Step 4: Wire server data and role gates**

The workspace page loads protected services only for administrators. `WorkspaceClient` adds `Services2` from Lucide, extends `WorkspaceView` with `services`, and renders the new panel only when `actor.role === "admin"`.

- [ ] **Step 5: Add responsive, focus-visible Daymark styles**

Add service-card, catalogue-form, qualification-grid, status-chip, and certificate-field rules using existing colours, paper borders, font variables, and the existing mobile breakpoints. Do not add a new CSS framework or arbitrary host styling.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npm run unit -- tests/workspace-ui.test.tsx tests/service-management.test.ts`

Expected: PASS with administrator visibility, employee exclusion, service mutation, manual approval, certificate fields, removal confirmation, and refreshed status behavior.

- [ ] **Step 7: Commit the administrator UI slice**

```powershell
git add -- app/workspace/ServicesPanel.tsx app/workspace/WorkspaceClient.tsx app/workspace/[workspaceSlug]/page.tsx app/globals.css tests/workspace-ui.test.tsx
git diff --cached --check
git commit -m "Add service qualification controls"
```

---

### Task 4: Service-aware public repository, scheduling, APIs, and appointment snapshots

**Files:**
- Modify: `lib/scheduling/types.ts`
- Modify: `lib/scheduling/slots.ts`
- Modify: `lib/data/repository.ts`
- Modify: `lib/public-booking.ts`
- Create: `app/api/public/[workspaceSlug]/services/route.ts`
- Modify: `app/api/public/[workspaceSlug]/employees/route.ts`
- Modify: `app/api/public/[workspaceSlug]/slots/route.ts`
- Modify: `app/api/public/[workspaceSlug]/bookings/route.ts`
- Modify: `tests/slots.test.ts`
- Modify: `tests/repository.test.ts`
- Modify: `tests/booking.test.ts`
- Modify: `tests/auth-routes.test.ts`

**Interfaces:**
- `SlotSearchInput` gains required `durationMinutes`.
- `listPublicServices(scope, employeeId?, now?)` returns only active services with at least one current eligible employee.
- `listPublicEmployees(scope, serviceId?, now?)` filters by qualification when service ID is present.
- `listPublicSlots(scope, serviceId, employeeId, dateKeys, now)` returns `{ service, employee, slots }` only for a current same-workspace pairing.
- `CreateBookingInput` requires `serviceId`; successful booking includes `serviceName` and `serviceDurationMinutes`.
- Anonymous service exposes `services({ employeeId? })`, `employees({ serviceId })`, `slots({ serviceId, employeeId, from })`, and `book(raw)`.

- [ ] **Step 1: Write failing duration, eligibility, privacy, and snapshot tests**

```ts
it("fits a 90-minute service into 30-minute start intervals", () => {
  const slots = computeBookableSlots({
    dateKeys: ["2026-08-10"],
    now: new Date("2026-08-01T12:00:00.000Z"),
    rules: [{ weekday: 1, startMinute: 540, endMinute: 660, slotMinutes: 30, bufferMinutes: 0 }],
    busy: [],
    durationMinutes: 90,
    zone: "Europe/London",
  });
  expect(slots).toEqual([
    { dateKey: "2026-08-10", startAt: "2026-08-10T08:00:00.000Z", endAt: "2026-08-10T09:30:00.000Z" },
    { dateKey: "2026-08-10", startAt: "2026-08-10T08:30:00.000Z", endAt: "2026-08-10T10:00:00.000Z" },
  ]);
});

it("never exposes certificate fields in anonymous employee or service responses", async () => {
  const result = await createPublicBookingService(scope, dependencies()).employees({ serviceId: "service-camera" });
  expect(JSON.stringify(result.body)).not.toMatch(/certificate|expiresOn|issuedOn/i);
});
```

Add repository-level SQL/projection tests for same-workspace qualification predicates and appointment snapshot values. Add a booking-service test proving missing `serviceId` is rejected before storage.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm run unit -- tests/slots.test.ts tests/repository.test.ts tests/booking.test.ts tests/auth-routes.test.ts`

Expected: FAIL because duration, service-aware repository signatures, public services route, service validation, and snapshots are absent.

- [ ] **Step 3: Make slot calculation duration-aware**

Use `durationMinutes` for candidate end time and working-window fit, but continue incrementing candidate starts by each rule's `slotMinutes`. Apply existing buffer expansion to the complete candidate range.

- [ ] **Step 4: Implement public catalogue and eligibility queries**

Use one Drizzle eligibility condition for active manual approval or current certificate expiry. Include workspace predicates on service, qualification, and employee rows. When no `serviceId` is supplied to `listPublicEmployees`, preserve the existing protected/admin roster behavior; anonymous routes always supply a selected service.

- [ ] **Step 5: Revalidate and atomically insert service-aware bookings**

After slot lookup, insert with `INSERT ... SELECT` semantics guarded by:

- current same-workspace service/employee qualification;
- active service and employee;
- no booked appointment satisfying `existing.startAt < candidate.endAt AND existing.endAt > candidate.startAt`; and
- the existing exact-start unique index.

Persist `serviceId`, service name snapshot, and service duration snapshot. Return `slot-taken` when the guarded insert writes no row after the slot was initially available.

- [ ] **Step 6: Extend public service validation and routes**

Whitelist only public service and employee fields. Require valid service ID, employee ID, date, and future ISO time. Add a no-store `GET /api/public/{workspaceSlug}/services`; update employees, slots, and bookings routes to pass the new service context.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `npm run unit -- tests/slots.test.ts tests/repository.test.ts tests/booking.test.ts tests/auth-routes.test.ts`

Expected: PASS for duration, expiry, cross-workspace rejection, privacy, overlap, conflict, snapshot, and route behavior.

- [ ] **Step 8: Commit the public domain slice**

```powershell
git add -- lib/scheduling lib/data/repository.ts lib/data/contracts.ts lib/public-booking.ts app/api/public tests/slots.test.ts tests/repository.test.ts tests/booking.test.ts tests/auth-routes.test.ts
git diff --cached --check
git commit -m "Make public booking service aware"
```

---

### Task 5: Catalogue and fixed-service booking interfaces

**Files:**
- Modify: `lib/booking/transport.ts`
- Modify: `app/booking/BookingFlow.tsx`
- Modify: `app/booking/LiveBookingFlow.tsx`
- Modify: `app/demo/DemoBookingFlow.tsx`
- Modify: `app/book/[workspaceSlug]/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/booking-transport.test.ts`
- Modify: `tests/booking-flow.test.ts`
- Modify: `tests/widget-integration.test.tsx`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- `BookingTransport.loadEmployees(serviceId)` loads safe public employees.
- `BookingTransport.loadSlots(serviceId, employeeId, from)` and `createBooking(input)` carry service context.
- `BookingFlow` receives `initialServices`, `initialEmployees`, `initialServiceId?`, and `initialEmployeeId?`.
- `LiveBookingFlow` forwards those values; the server page resolves optional `?service={slug}`.

- [ ] **Step 1: Write failing transport and UI tests**

```tsx
it("starts catalogue mode with services and then shows only loaded qualified employees", async () => {
  const transport = serviceAwareTransport();
  const view = await render(<BookingFlow initialServices={[camera, alarm]} initialEmployees={[]} transport={transport} />);
  expect(view.container.textContent).toContain("Which service do you need?");
  await click(buttonContaining(view.container, "Camera installation"));
  expect(view.container.textContent).toContain("Maya Chen");
  expect(view.container.textContent).not.toContain("Alarm installation");
});

it("locks a preselected service and submits its internal id", async () => {
  const transport = serviceAwareTransport({
    confirmation: {
      reference: "DM-CAMERA",
      serviceName: "Camera installation",
      serviceDurationMinutes: 90,
      employeeName: "Maya Chen",
      startAt: "2026-08-10T08:00:00.000Z",
      endAt: "2026-08-10T09:30:00.000Z",
      address: "14 Sample Street, Oxford",
      contactSummary: "a••••@example.com",
    },
  });
  const view = await render(<BookingFlow
    initialServices={[camera]}
    initialServiceId="service-camera"
    initialEmployees={[maya]}
    transport={transport}
  />);
  expect(view.container.textContent).not.toContain("Which service do you need?");
  await click(buttonContaining(view.container, "Maya Chen"));
  await click(view.container.querySelector<HTMLButtonElement>(".date-card:not([disabled])")!);
  await click(view.container.querySelector<HTMLButtonElement>(".time-tabs button")!);
  await change(view.container.querySelector<HTMLInputElement>("input[name='name']")!, "Alex Morgan");
  await change(view.container.querySelector<HTMLInputElement>("input[name='address']")!, "14 Sample Street, Oxford");
  await change(view.container.querySelector<HTMLInputElement>("input[name='email']")!, "alex@example.com");
  await submit(view.container.querySelector<HTMLFormElement>("form")!);
  expect(view.container.textContent).toContain("Camera installation");
  expect(view.container.textContent).toContain("1 hr 30 min");
  expect(transport.createBooking).toHaveBeenCalledWith(expect.objectContaining({ serviceId: "service-camera" }));
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm run unit -- tests/booking-transport.test.ts tests/booking-flow.test.ts tests/widget-integration.test.tsx`

Expected: FAIL because the transport and UI are person-first and have no service context.

- [ ] **Step 3: Extend live and demo transports**

Live transport fetches `/services`, `/employees?serviceId=...`, `/slots?serviceId=...&employeeId=...`, and submits `serviceId`. Demo transport returns one fixed General consultation service, keeps all operations in memory, and includes its service snapshot in confirmation.

- [ ] **Step 4: Implement dynamic booking steps**

Catalogue mode steps are Service, Person, Date, Time, Details. Fixed-service mode visually starts at Person and does not allow Back to Service. The selection slip and confirmation show service name and formatted duration. Reset returns catalogue mode to Service and fixed mode to Person.

If a chosen service has no qualified employees, show a clear empty state and allow Back only in catalogue mode. Conflict recovery reloads slots with both service and employee IDs.

- [ ] **Step 5: Resolve direct-link service slugs server-side**

The page lists public services, treats no query as catalogue mode, resolves an exact active service slug when supplied, loads only its qualified employees, and calls `notFound()` for malformed, inactive, cross-workspace, or unknown supplied slugs.

- [ ] **Step 6: Add accessible responsive service cards**

Use real buttons, visible focus, category/name/description/duration hierarchy, reduced-motion compatibility, and existing Daymark paper/tab styling. Preserve the iframe height protocol by keeping content in the existing booking shell.

- [ ] **Step 7: Run focused and rendered tests and verify GREEN**

Run: `npm run unit -- tests/booking-transport.test.ts tests/booking-flow.test.ts tests/widget-integration.test.tsx && npm run build && node --test tests/rendered-html.test.mjs`

Expected: PASS for catalogue, preselection, duration labels, reset/back behavior, demonstration isolation, server route rendering, and production compilation.

- [ ] **Step 8: Commit the booking interface slice**

```powershell
git add -- lib/booking/transport.ts app/booking app/demo/DemoBookingFlow.tsx app/book/[workspaceSlug]/page.tsx app/globals.css tests/booking-transport.test.ts tests/booking-flow.test.ts tests/widget-integration.test.tsx tests/rendered-html.test.mjs
git diff --cached --check
git commit -m "Add service first booking journeys"
```

---

### Task 6: Explicit service configuration for widgets and direct links

**Files:**
- Modify: `lib/widget/protocol.ts`
- Modify: `public/daymark-widget.js`
- Modify: `app/embed/page.tsx`
- Modify: `app/workspace/EmbedPanel.tsx`
- Modify: `tests/widget.test.ts`
- Modify: `tests/widget-host.test.ts`
- Modify: `tests/widget-integration.test.tsx`
- Modify: `tests/workspace-ui.test.tsx`

**Interfaces:**
- `normalizeWidgetConfig` returns `{ mode, employee, service, label }`, defaulting service to `all` and rejecting unsafe values.
- `buildEmbedSnippet(origin, mode, employee, service, label, workspaceSlug)` emits `data-service`.
- Embed page passes resolved `initialServices`, `initialServiceId`, and qualified `initialEmployees` into `LiveBookingFlow`.

- [ ] **Step 1: Write failing protocol, host, and configurator tests**

```ts
expect(normalizeWidgetConfig({ mode: "inline", employee: "all", service: "ring-doorbell" })).toEqual({
  mode: "inline",
  employee: "all",
  service: "ring-doorbell",
  label: "Book an appointment",
});

expect(inline.iframe.src).toBe(
  "https://widgets.daymark.test/embed?workspace=cedar-house&employee=maya-chen&service=ring-doorbell&channel=inline-channel",
);
```

Add UI assertions that choosing Preselect a service updates both the snippet and direct link, while Show all services emits `data-service="all"` and the unqualified employee combinations are absent from the selector.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm run unit -- tests/widget.test.ts tests/widget-host.test.ts tests/widget-integration.test.tsx tests/workspace-ui.test.tsx`

Expected: FAIL because service configuration is not normalized, emitted, forwarded, resolved, or displayed.

- [ ] **Step 3: Extend protocol and host script**

Read `script.dataset.service`, accept `all` or a safe slug, include it in iframe and fixed-service fallback URLs, and show Booking unavailable for an invalid value. Keep message validation, sandbox, focus trap, privacy reset, and multi-widget isolation unchanged.

- [ ] **Step 4: Resolve service and employee together in the embed route**

For `service=all`, list services filtered by an optional fixed employee. For a fixed service, require the service to exist inside the workspace and require an optional fixed employee to be currently qualified. Any mismatch calls `notFound()` without exposing which identifier was foreign.

- [ ] **Step 5: Extend the administrator configurator**

Add Booking journey radios and a service selector. Filter employee choices to employees currently eligible for the selected fixed service; in catalogue mode retain active team choices and rely on service filtering inside the booking page. Generate and display both the exact snippet and direct booking URL.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npm run unit -- tests/widget.test.ts tests/widget-host.test.ts tests/widget-integration.test.tsx tests/workspace-ui.test.tsx`

Expected: PASS for safe normalization, exact iframe/direct URLs, fallback behavior, qualification combinations, copyable configuration, and unchanged widget security/lifecycle behavior.

- [ ] **Step 7: Commit the integration slice**

```powershell
git add -- lib/widget/protocol.ts public/daymark-widget.js app/embed/page.tsx app/workspace/EmbedPanel.tsx tests/widget.test.ts tests/widget-host.test.ts tests/widget-integration.test.tsx tests/workspace-ui.test.tsx
git diff --cached --check
git commit -m "Add service scoped widget entries"
```

---

### Task 7: Full verification, temporary migration proof, packaged runtime, browser QA, and GitHub update

**Files:**
- Modify only when a verification failure produces a new failing regression test and the minimal fix required by that test.
- Do not modify `.daymark/` manually or include it in Git operations.

**Interfaces:**
- Produces a tested feature branch and GitHub pull request/update without a release or deployment.

- [ ] **Step 1: Review requirements and repository state**

Run:

```powershell
git status --short --branch
git diff master...HEAD --stat
git diff master...HEAD --check
git ls-files .daymark
```

Expected: only intended tracked feature files differ; `.daymark/` is untracked and `git ls-files .daymark` prints nothing.

- [ ] **Step 2: Run the complete automated verification**

Run:

```powershell
npm run unit
npm run lint
npm test
node --test tests/local-runtime/integration.test.mjs
```

Expected: every command exits 0 with no test failures or lint errors; the production build lists the new public services and protected workspace services routes.

- [ ] **Step 3: Prove migration and restore behavior without business data**

Use the existing local-runtime integration test and a new temporary directory to apply all five committed migrations, verify `PRAGMA foreign_key_check`, confirm General appointment/qualification backfill on a controlled legacy fixture, and exercise backup verification. Never point this proof at `.daymark/`.

- [ ] **Step 4: Rebuild the staged packaged runtime**

Stop the managed port-3000 session cleanly with `stop`, then run:

```powershell
npm run windows:stage
npm run windows:test-staged-migration
```

Expected: staging and staged migration checks exit 0 and contain no `.env`, `.daymark`, database, backup, or log payload.

- [ ] **Step 5: Apply migration and restart only after backup verification**

Reconfirm the external snapshot exists and the source restore tag resolves to `1d8207177efdb78f89147832a2cb2e9613388b9a`. Start the staged runtime on port 3000 with the existing `.env.local` and `.daymark` paths. The runtime's normal migration command may apply `0004`; do not manually edit runtime files.

Expected health JSON: `status: "ok"`, app version `0.1.1`, latest migration `0004_daymark_service_catalog.sql`.

- [ ] **Step 6: Perform administrator and public browser QA in Chrome**

Using the permitted Chrome control skill:

1. sign in to the existing local workspace;
2. create **Camera installation** and **Alarm installation** test services;
3. manually qualify one employee for Camera only;
4. add one current and one expired certificate-backed assignment in controlled records;
5. verify catalogue mode lists only publicly eligible services;
6. verify the Camera preselected direct link skips the catalogue;
7. verify only Camera-qualified employees appear;
8. verify a generated preselected inline/floating widget resolves the same service;
9. complete one booking and confirm service name/duration in the protected schedule; and
10. confirm the browser console and relevant network requests contain no errors.

Do not use real customer contact data in QA; use obvious local test values.

- [ ] **Step 7: Run fresh final verification after browser-driven data checks**

Run:

```powershell
npm run unit
npm run lint
npm test
git diff --check
git status --short --branch
```

Expected: all checks exit 0; `.daymark/` remains the sole untracked path.

- [ ] **Step 8: Commit any final test-only or regression fix, then publish through GitHub**

If Step 7 leaves intended tracked changes, stage only those explicit paths and commit them. Then:

```powershell
git push -u origin agent/service-catalog-booking
```

Open a draft pull request against `master` with a body covering the two entry modes, qualification/expiry enforcement, migration and restore points, deferred payments, and exact verification evidence. Do not create a release, deploy, or delete the feature branch or restore tag.

---

## Plan self-review

- **Specification coverage:** Tasks 1–6 cover every persistence, eligibility, administrator, public booking, direct-link, widget, migration, privacy, and backward-compatibility requirement. Task 7 covers backup confirmation, packaged migration, browser behavior, and GitHub publication. Payment is documented but intentionally absent from implementation tasks.
- **Placeholder scan:** Every task names exact files, commands, expected failures, concrete implementation boundaries, and observable test behavior. UI examples use concrete events and literal fixtures.
- **Type consistency:** Public service identity is an internal `id` plus public workspace-scoped `slug`; browser entry points carry the slug, while anonymous employee/slot/booking calls carry the resolved internal ID. Qualification date fields consistently use `issuedOn` and `expiresOn`; appointment snapshots consistently use `serviceName` and `serviceDurationMinutes`.
- **Safety review:** Source and business-data restore points precede changes, migrations are proven in temporary data first, `.daymark/` remains excluded, same-origin and administrator gates cover mutations, and no publishing beyond the requested GitHub update is included.
