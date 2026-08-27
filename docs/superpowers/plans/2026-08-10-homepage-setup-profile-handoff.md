# Homepage Catalogue and Setup-Profile Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the homepage demonstrate service-specific smart-home bookings and carry its Floating/Inline selection into an installed Daymark workspace through a confirmed app link or portable setup code.

**Architecture:** Keep the setup-profile codec and demonstration catalogue pure and deterministic. Persist only normalized workspace defaults behind the existing authenticated, same-origin administrator boundary. Route both manual and `daymark://` imports through one confirmation flow, while a narrowly scoped Tauri adapter validates the custom URI, starts/focuses the local runtime, and opens only the loopback import route.

**Tech Stack:** React 19, Vinext/Next-compatible App Router, TypeScript, Vitest/Testing Library, Drizzle ORM with SQLite/D1 migrations, Tauri 2, Rust, PowerShell Windows packaging tests.

## Global Constraints

- Work on `codex/homepage-setup-handoff`, based on restore commit `c622b49ecf1af428eed317be3434fdd4f3b92e15`.
- Preserve the verified annotated tag `restore-2026-08-10-before-homepage-handoff` and cold snapshot at `C:\Users\Lloyd\Files\Daymark-restore-points\2026-08-10-before-homepage-handoff\.daymark`.
- Never edit, delete, stage, or commit `C:\Users\Lloyd\Files\Daymark\.daymark`. Normal writes by the packaged runtime are allowed.
- Follow red-green-refactor for every behavior change: add a focused failing test, run it and observe the expected failure, implement the minimum production change, then rerun the focused test.
- Keep homepage demo behavior local: no `fetch`, booking write, workspace read, or widget host event.
- Treat setup codes as non-secret preferences, never as authorization. Existing workspace writes still require a current administrator session and same-origin mutation.
- Do not add paid booking, hosted handoff storage, real service data, automatic website editing, non-Windows protocols, or Vinext upgrades.
- Do not publish, merge, release, or modify the prior pull request while executing this plan. End with a tested local feature commit and request the separate completion review before any remote publication.

---

## Task 1: Implement the canonical setup-profile codec

**Files:**

- Create: `lib/setup-profile.ts`
- Create: `lib/setup-profile-vectors.json`
- Create: `tests/setup-profile.test.ts`

- [ ] **Step 1: Add deterministic codec contract vectors**

Create `lib/setup-profile-vectors.json` as the cross-language contract used by TypeScript and Rust tests:

```json
{
  "valid": [
    { "code": "DM1-C-F-2ZE7", "layout": "floating" },
    { "code": "DM1-C-I-355C", "layout": "inline" }
  ],
  "invalid": [
    "DM1-C-F-2ZE8",
    "DM1-C-X-2ZE7",
    "DM2-C-F-2ZE7",
    "DM1-C-F-2ZE7-EXTRA",
    "DM1 C F 2ZE7"
  ]
}
```

- [ ] **Step 2: Write the failing TypeScript codec tests**

Cover all exact rules in `tests/setup-profile.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  SetupProfileError,
  buildSetupProfileUri,
  decodeSetupProfile,
  encodeSetupProfile,
} from "../lib/setup-profile";

describe("setup profile codec", () => {
  it.each([
    ["floating", "DM1-C-F-2ZE7"],
    ["inline", "DM1-C-I-355C"],
  ] as const)("encodes %s deterministically", (layout, code) => {
    expect(encodeSetupProfile(layout)).toBe(code);
    expect(decodeSetupProfile(code)).toEqual({
      version: 1,
      journey: "catalogue",
      layout,
    });
  });

  it("trims only surrounding whitespace and normalizes ASCII case", () => {
    expect(decodeSetupProfile("\u2003dm1-c-i-355c\u2003").layout).toBe("inline");
    expect(() => decodeSetupProfile("DM1-C- I-355C")).toThrow(SetupProfileError);
  });

  it("distinguishes checksum, version, format, and value failures", () => {
    expectError("DM1-C-F-2ZE8", "invalid_checksum");
    expectError("DM2-C-F-2ZE7", "unsupported_version");
    expectError("DM1-C-X-2ZE7", "unsupported_value");
    expectError("DM1-C-F-2ZE7-EXTRA", "invalid_format");
  });

  it("builds only the canonical Daymark app link", () => {
    expect(buildSetupProfileUri("DM1-C-F-2ZE7")).toBe(
      "daymark://import-setup?code=DM1-C-F-2ZE7",
    );
  });
});
```

Add the local `expectError` helper and vector-file assertions, including exact 12-character length, internal whitespace, non-ASCII, unknown checksum alphabet characters, missing segments, duplicate-looking suffixes, and inputs longer than 256 characters.

- [ ] **Step 3: Run the test and confirm the missing-module failure**

Run: `npm run unit -- tests/setup-profile.test.ts`

Expected: FAIL because `../lib/setup-profile` does not exist.

- [ ] **Step 4: Implement the pure codec**

Expose this exact public API from `lib/setup-profile.ts`:

```ts
export type SetupLayout = "floating" | "inline";

export type SetupProfile = {
  version: 1;
  journey: "catalogue";
  layout: SetupLayout;
};

export type SetupProfileErrorCode =
  | "invalid_format"
  | "unsupported_version"
  | "invalid_checksum"
  | "unsupported_value";

export class SetupProfileError extends Error {
  constructor(readonly code: SetupProfileErrorCode) {
    super(code);
    this.name = "SetupProfileError";
  }
}

export function encodeSetupProfile(layout: SetupLayout): string;
export function decodeSetupProfile(value: string): SetupProfile;
export function buildSetupProfileUri(code: string): string;
```

Implementation rules:

- checksum ASCII bytes of `DM1-C-F` or `DM1-C-I` using CRC-16/CCITT-FALSE (`poly=0x1021`, `init=0xffff`, no reflection, `xorout=0`);
- encode the unsigned 16-bit result to four digits using `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`;
- trim surrounding Unicode whitespace and uppercase only ASCII `a` through `z`;
- require exact normalized shape `/^DM[0-9]-[A-Z]-[A-Z]-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/` and length 12 before interpreting fields;
- report unsupported version/value before checksum only when the structural shape is valid; otherwise report `invalid_format`;
- verify the checksum before returning a typed profile;
- make `buildSetupProfileUri` decode and re-encode the supplied code before interpolation, so malformed input cannot enter a URI.

- [ ] **Step 5: Rerun focused tests and commit the codec slice**

Run: `npm run unit -- tests/setup-profile.test.ts`

Expected: PASS.

Run: `git diff --check`

Commit: `git add lib/setup-profile.ts lib/setup-profile-vectors.json tests/setup-profile.test.ts && git commit -m "Add canonical setup profile codec"`

---

## Task 2: Replace the generic demo with the smart-home catalogue

**Files:**

- Create: `lib/booking/demo.ts`
- Modify: `lib/booking/transport.ts`
- Modify: `app/demo/DemoBookingFlow.tsx`
- Modify: `tests/booking-transport.test.ts`
- Modify: `tests/widget-integration.test.tsx`

- [ ] **Step 1: Write failing service-aware demo tests**

In `tests/booking-transport.test.ts`, replace the one-service assumptions with assertions that:

```ts
expect(DEMO_SERVICES.map(({ id, durationMinutes }) => ({ id, durationMinutes }))).toEqual([
  { id: "service-demo-camera-installation", durationMinutes: 90 },
  { id: "service-demo-alarm-installation", durationMinutes: 120 },
]);
expect((await demoBookingTransport.loadEmployees("service-demo-camera-installation"))
  .map((employee) => employee.publicName)).toEqual(["Maya Chen", "Jon Bell"]);
expect((await demoBookingTransport.loadEmployees("service-demo-alarm-installation"))
  .map((employee) => employee.publicName)).toEqual(["Theo Brooks", "Priya Shah"]);
```

Also assert Camera slot ends 90 minutes after start, Alarm slot ends 120 minutes after start, confirmation uses the selected service name/duration, an ineligible employee is rejected, and a `global.fetch` spy is never called.

In `tests/widget-integration.test.tsx`, change the homepage demo test to begin on the Service step, select Camera, see only Maya/Jon, return to Service, select Alarm, and see only Theo/Priya. Complete one flow and assert the final copy says no appointment was created.

- [ ] **Step 2: Run the focused tests and confirm old generic behavior fails**

Run: `npm run unit -- tests/booking-transport.test.ts tests/widget-integration.test.tsx`

Expected: FAIL because the current wrapper supplies one preselected General consultation and the demo transport ignores `serviceId`.

- [ ] **Step 3: Isolate and implement the demonstration catalogue**

Move all demo-only data and transport behavior from `lib/booking/transport.ts` into `lib/booking/demo.ts`. Keep the live transport and shared `BookingTransport` types in `transport.ts`.

Define the exact catalogue:

```ts
export const DEMO_SERVICES: PublicService[] = [
  {
    id: "service-demo-camera-installation",
    slug: "camera-installation",
    name: "Camera installation",
    category: "Smart home installation",
    description: "Install and configure connected security cameras.",
    durationMinutes: 90,
  },
  {
    id: "service-demo-alarm-installation",
    slug: "alarm-installation",
    name: "Alarm installation",
    category: "Smart home installation",
    description: "Install and configure a connected alarm system.",
    durationMinutes: 120,
  },
];

const ELIGIBLE_EMPLOYEE_IDS = {
  "service-demo-camera-installation": ["maya-chen", "jon-bell"],
  "service-demo-alarm-installation": ["theo-brooks", "priya-shah"],
} as const;
```

`loadEmployees(serviceId)`, `loadSlots(serviceId, employeeId)`, and `createBooking(input)` must all resolve and validate the selected service. Reuse deterministic date/seed generation, but calculate every `endAt` from `service.durationMinutes`. Return `DEMO-ONLY` and masked contact details without retaining data.

- [ ] **Step 4: Start the homepage flow at Service**

Change `app/demo/DemoBookingFlow.tsx` to pass:

```tsx
<BookingFlow
  initialServices={DEMO_SERVICES}
  initialEmployees={[]}
  transport={demoBookingTransport}
  demo
/>
```

Do not pass `initialServiceId`; the shared flow must present its existing Service step.

- [ ] **Step 5: Rerun focused tests and commit the demo slice**

Run: `npm run unit -- tests/booking-transport.test.ts tests/widget-integration.test.tsx tests/booking-flow.test.ts`

Expected: PASS.

Commit: `git add lib/booking/demo.ts lib/booking/transport.ts app/demo/DemoBookingFlow.tsx tests/booking-transport.test.ts tests/widget-integration.test.tsx && git commit -m "Demonstrate service qualified bookings"`

---

## Task 3: Turn homepage layout selection into a setup builder

**Files:**

- Create: `app/home/HomepageSetupBuilder.tsx`
- Modify: `app/home/WidgetOptionsShowcase.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/homepage-showcase.test.tsx`

- [ ] **Step 1: Replace the local-only test with failing builder tests**

In `tests/homepage-showcase.test.tsx`, retain the visual/accessibility assertions and add:

- default summary `Full service catalogue · Floating widget`;
- default code `DM1-C-F-2ZE7` and app-link `daymark://import-setup?code=DM1-C-F-2ZE7`;
- choosing Inline updates `aria-pressed`, summary, code, and URI to `DM1-C-I-355C`;
- `Use on another machine` reveals the code without network activity;
- Copy writes only the code and announces `Setup code copied.` through `role=status`/`aria-live`;
- missing clipboard shows manual-copy guidance without losing the code;
- fallback copy remains visible after clicking `Open in Daymark` and does not claim launch detection.

- [ ] **Step 2: Run the test and observe the absent builder behavior**

Run: `npm run unit -- tests/homepage-showcase.test.tsx`

Expected: FAIL because `WidgetOptionsShowcase` owns disposable state and renders no transfer actions.

- [ ] **Step 3: Make preview selection controlled**

Export the shared placement type and change `WidgetOptionsShowcase` to:

```ts
export type WidgetPlacement = "floating" | "inline";

export function WidgetOptionsShowcase({
  selected,
  onSelect,
}: {
  selected: WidgetPlacement;
  onSelect: (placement: WidgetPlacement) => void;
})
```

Preserve card text, preview markup, keyboard buttons, `aria-pressed`, icons, and responsive styling. Remove its internal selection state.

- [ ] **Step 4: Add the stateful homepage builder**

`HomepageSetupBuilder` owns `selected`, `codeVisible`, and copy status. It derives the code with `encodeSetupProfile(selected)` and the link with `buildSetupProfileUri(code)`. Render:

- both controlled previews;
- heading `Your Daymark setup`;
- normal text summary for catalogue plus selected layout;
- an ordinary `<a href={appLink}>Open in Daymark</a>`;
- a `Use on another machine` button that reveals a read-only selectable code and Copy button;
- persistent fallback text: `If Daymark does not open, install it first or use this setup code on the other machine.`

Do not attach timers, polling, protocol-success detection, storage, or network calls.

- [ ] **Step 5: Integrate the builder and update presentation**

Replace `<WidgetOptionsShowcase />` in `app/page.tsx` with `<HomepageSetupBuilder />`. Update the demo support copy to explain service-first employee filtering. Add narrow, existing-style CSS classes for summary, transfer actions, code field, status, focus, and stacked mobile layout.

- [ ] **Step 6: Rerun tests and commit the homepage slice**

Run: `npm run unit -- tests/homepage-showcase.test.tsx tests/widget-integration.test.tsx`

Expected: PASS.

Commit: `git add app/home/HomepageSetupBuilder.tsx app/home/WidgetOptionsShowcase.tsx app/page.tsx app/globals.css tests/homepage-showcase.test.tsx && git commit -m "Build transferable homepage setup profiles"`

---

## Task 4: Add workspace Embed preference persistence and migration

**Files:**

- Modify: `db/schema.ts`
- Modify: `lib/data/contracts.ts`
- Create: `lib/data/embed-preference-repository.ts`
- Create: `tests/embed-preference-repository.test.ts`
- Modify: `tests/schema.test.ts`
- Modify: `tests/local-runtime/migrations.test.ts`
- Modify: `tests/local-runtime/integration.test.mjs`
- Create through Drizzle: `drizzle/0005_daymark_embed_preferences.sql`
- Create through Drizzle: `drizzle/meta/0005_snapshot.json`
- Modify through Drizzle: `drizzle/meta/_journal.json`

- [ ] **Step 1: Add failing schema, migration, and repository tests**

Assert the schema exports `workspaceEmbedPreferences` with:

- `workspace_id` primary key and cascading FK to `workspaces.id`;
- `default_mode` required and checked to `floating|inline`;
- `default_service_scope` required and checked to `all`;
- `created_at` and `updated_at` using existing timestamp conventions.

Migration tests must prove an existing workspace receives exactly one `floating/all` row and a fresh database applies through `0005_daymark_embed_preferences.sql`.

Repository tests must prove:

- read returns the row for only the supplied workspace ID;
- an active administrator membership in that same workspace can upsert mode;
- employee, inactive, and cross-workspace memberships cannot update;
- reapplying the same value remains one row and succeeds;
- a database failure leaves the previous value unchanged.

- [ ] **Step 2: Run the focused persistence tests and observe failure**

Run: `npm run unit -- tests/schema.test.ts tests/local-runtime/migrations.test.ts tests/embed-preference-repository.test.ts`

Expected: FAIL because the table, migration, and repository do not exist.

- [ ] **Step 3: Add the schema and typed contract**

Add to `lib/data/contracts.ts`:

```ts
export type EmbedMode = "floating" | "inline";
export type EmbedServiceScope = "all";

export type WorkspaceEmbedPreference = {
  workspaceId: string;
  defaultMode: EmbedMode;
  defaultServiceScope: EmbedServiceScope;
};
```

Define `workspaceEmbedPreferences` in `db/schema.ts` with SQL check constraints named `workspace_embed_preferences_default_mode_check` and `workspace_embed_preferences_service_scope_check`.

- [ ] **Step 4: Generate and inspect migration 0005**

Run: `npm run db:generate -- --name daymark_embed_preferences`

Expected generated files: `drizzle/0005_daymark_embed_preferences.sql`, `drizzle/meta/0005_snapshot.json`, and updated journal.

Append this deterministic backfill after table creation:

```sql
INSERT INTO `workspace_embed_preferences`
  (`workspace_id`, `default_mode`, `default_service_scope`, `created_at`, `updated_at`)
SELECT `id`, 'floating', 'all', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM `workspaces`;
```

Inspect generated SQL and snapshot; do not hand-invent snapshot metadata.

- [ ] **Step 5: Implement the defensive repository**

Expose:

```ts
export type EmbedPreferenceAdminScope = {
  membershipId: string;
  workspaceId: string;
};

export async function getWorkspaceEmbedPreference(
  scope: { workspaceId: string },
): Promise<WorkspaceEmbedPreference>;

export async function setWorkspaceEmbedPreference(
  admin: EmbedPreferenceAdminScope,
  input: Pick<WorkspaceEmbedPreference, "defaultMode" | "defaultServiceScope">,
): Promise<boolean>;
```

The update must use one atomic upsert (or a D1 batch with equivalent atomic authorization). Its conflict-update branch must be guarded by an `EXISTS` membership predicate requiring matching `membershipId`, matching `workspaceId`, active membership, and role `admin`, and it must use `RETURNING` to distinguish a denied write. Never accept a workspace ID from profile content.

- [ ] **Step 6: Rerun persistence tests and commit**

Run: `npm run unit -- tests/schema.test.ts tests/local-runtime/migrations.test.ts tests/embed-preference-repository.test.ts`

Run: `node --test tests/local-runtime/integration.test.mjs`

Expected: PASS and latest migration `0005_daymark_embed_preferences.sql`.

Commit: `git add db/schema.ts lib/data/contracts.ts lib/data/embed-preference-repository.ts tests/embed-preference-repository.test.ts tests/schema.test.ts tests/local-runtime/migrations.test.ts tests/local-runtime/integration.test.mjs drizzle && git commit -m "Persist workspace embed defaults"`

---

## Task 5: Protect preference reads, default changes, and profile imports

**Files:**

- Create: `lib/embed-preferences.ts`
- Create: `lib/embed-preferences-runtime.ts`
- Create: `app/api/workspace/embed-preferences/route.ts`
- Create: `tests/embed-preferences.test.ts`
- Create: `tests/embed-preference-routes.test.ts`

- [ ] **Step 1: Write failing service tests**

Build dependency fakes around this API:

```ts
const service = createEmbedPreferences({
  getActor,
  getWorkspaceEmbedPreference,
  setWorkspaceEmbedPreference,
});

await service.read();
await service.mutate({ action: "set-default", defaultMode: "inline" });
await service.mutate({ action: "import-profile", code: "DM1-C-F-2ZE7" });
```

Assert unauthenticated `401`, must-change-password `428`, employee `403`, malformed action/value `400`, invalid checksum `400`, unsupported version with update guidance `400`, successful import/set returning normalized `{ preference }`, idempotent import success, and failed repository write returning a safe error without changing the fake stored value.

- [ ] **Step 2: Write failing route boundary tests**

`tests/embed-preference-routes.test.ts` must verify:

- GET reads `workspace` from the query and uses no-store JSON;
- POST rejects missing/mismatched `Origin` before reading a body;
- POST forwards only parsed JSON through the workspace-scoped runtime service;
- raw database or code details are not echoed in error bodies.

- [ ] **Step 3: Run focused tests and confirm modules are absent**

Run: `npm run unit -- tests/embed-preferences.test.ts tests/embed-preference-routes.test.ts`

Expected: FAIL because the service and route do not exist.

- [ ] **Step 4: Implement the domain service and runtime composition**

Mirror the proven `service-management.ts` boundary. `createEmbedPreferences` calls `getActor()` first and permits only an active admin with no forced password change. It accepts exactly two actions:

```ts
type EmbedPreferenceMutation =
  | { action: "set-default"; defaultMode: EmbedMode }
  | { action: "import-profile"; code: string };
```

For `set-default`, force `defaultServiceScope: "all"`. For `import-profile`, call `decodeSetupProfile`, map its layout, and ignore no extra fields because the codec rejects them. On success, read/return the effective stored preference.

`embed-preferences-runtime.ts` composes `getWorkspaceActor(workspaceSlug, request)` with the repository. The route mirrors `app/api/workspace/services/route.ts` and uses `isSameOriginMutation`, `safeJson`, and `noStoreJson`.

- [ ] **Step 5: Rerun and commit the protected API slice**

Run: `npm run unit -- tests/embed-preferences.test.ts tests/embed-preference-routes.test.ts`

Expected: PASS.

Commit: `git add lib/embed-preferences.ts lib/embed-preferences-runtime.ts app/api/workspace/embed-preferences/route.ts tests/embed-preferences.test.ts tests/embed-preference-routes.test.ts && git commit -m "Protect workspace embed preferences"`

---

## Task 6: Read and edit the persisted default in Embed

**Files:**

- Modify: `app/workspace/[workspaceSlug]/page.tsx`
- Modify: `app/workspace/WorkspaceClient.tsx`
- Modify: `app/workspace/EmbedPanel.tsx`
- Modify: `tests/workspace-ui.test.tsx`

- [ ] **Step 1: Add failing workspace UI tests**

Extend `tests/workspace-ui.test.tsx` to prove:

- an initial Inline preference selects Inline and generates the full-catalogue snippet (`data-mode="inline"`, `data-service="all"`);
- admins can still choose Floating or a preselected service for the current snippet without changing the stored default;
- `Save as workspace default` posts `{ action: "set-default", defaultMode }` to the workspace-scoped endpoint;
- save success updates the visible `Workspace default` label and announces success;
- save failure retains the previous default and offers retry;
- `Import setup code` links to `/setup-profile/import`.

- [ ] **Step 2: Run the UI test and observe hard-coded Floating failure**

Run: `npm run unit -- tests/workspace-ui.test.tsx`

Expected: FAIL because `EmbedPanel` always starts in Floating and has no persistence action.

- [ ] **Step 3: Load the preference with workspace data**

In `app/workspace/[workspaceSlug]/page.tsx`, add `getWorkspaceEmbedPreference({ workspaceId: actor.workspaceId })` to the existing admin `Promise.all`. Pass it to `WorkspaceClient` as `initialEmbedPreference`. Employees continue to receive no Embed data or controls.

Add `initialEmbedPreference: WorkspaceEmbedPreference | null` to the client props and pass it to `EmbedPanel`.

- [ ] **Step 4: Add explicit default saving without restricting snippets**

Change `EmbedPanel` props to include `initialPreference`. Initialize `mode` from `initialPreference.defaultMode`, while keeping journey and service controls independent. Track `savedDefaultMode` separately from the current snippet mode.

Add a `Save as workspace default` button that POSTs to:

```ts
`/api/workspace/embed-preferences?workspace=${encodeURIComponent(workspaceSlug)}`
```

with same-origin JSON `{ action: "set-default", defaultMode: mode }`. Only update `savedDefaultMode` after a successful response. Label the current default in normal text. Keep the existing self-contained snippet behavior and both layout choices.

- [ ] **Step 5: Rerun tests and commit**

Run: `npm run unit -- tests/workspace-ui.test.tsx tests/embed-preferences.test.ts`

Expected: PASS.

Commit: `git add app/workspace/[workspaceSlug]/page.tsx app/workspace/WorkspaceClient.tsx app/workspace/EmbedPanel.tsx tests/workspace-ui.test.tsx && git commit -m "Use workspace embed defaults"`

---

## Task 7: Add one confirmed manual/app-link import flow, including first setup

**Files:**

- Create: `app/setup-profile/SetupProfileConfirmation.tsx`
- Create: `app/setup-profile/SetupProfileImportPanel.tsx`
- Create: `app/setup-profile/import/page.tsx`
- Modify: `app/workspace/sign-in/SignInPanel.tsx`
- Modify: `app/workspace/sign-in/page.tsx`
- Modify: `app/workspace/PasswordChangeGate.tsx`
- Modify: `app/workspace/[workspaceSlug]/page.tsx`
- Modify: `app/workspace/WorkspaceClient.tsx`
- Modify: `app/api/auth/setup/route.ts`
- Modify: `lib/auth/service.ts`
- Modify: `lib/auth/repository.ts`
- Modify: `lib/data/contracts.ts`
- Modify: `app/globals.css`
- Create: `tests/setup-profile-import.test.tsx`
- Modify: `tests/auth-service.test.ts`
- Modify: `tests/auth-routes.test.ts`
- Modify: `tests/staff-account-repository.test.ts`

- [ ] **Step 1: Write failing confirmation/import component tests**

Cover these states in `tests/setup-profile-import.test.tsx`:

- empty manual entry accepts a pasted code only after `Review setup`;
- malformed/checksum/version errors use safe distinct guidance;
- valid code shows `Import this setup?`, `Full service catalogue`, and the correct default layout;
- `Cancel` clears the pending code and performs no fetch;
- one eligible workspace is shown explicitly; multiple eligible workspaces require a selection with no silent first choice;
- employees are absent from workspace choices;
- `Import setup` posts `{ action: "import-profile", code }` once, disables during submission, and redirects to `/workspace/<slug>?view=embed` only on success;
- first-install confirmation reveals the first-administrator form with the normalized code retained in component state;
- clipboard/profile code never appears in an error string.

- [ ] **Step 2: Add failing first-administrator atomicity tests**

Extend auth tests so optional `setupProfileCode`:

- rejects invalid input before hashing/creating a workspace;
- maps Floating/Inline to `embedPreference` passed to the repository;
- defaults to `floating/all` when absent;
- remains optional for existing setup clients;
- is inserted in the same D1 batch as workspace, general service/qualification, roster, availability, account, membership, and credential;
- leaves no workspace/preference if any batch statement fails.

- [ ] **Step 3: Run focused tests and confirm failure**

Run: `npm run unit -- tests/setup-profile-import.test.tsx tests/auth-service.test.ts tests/auth-routes.test.ts tests/staff-account-repository.test.ts`

Expected: FAIL because import UI and setup preference plumbing do not exist.

- [ ] **Step 4: Build the shared confirmation presentation**

`SetupProfileConfirmation` receives only typed `SetupProfile`, busy state, and `onConfirm/onCancel`. It renders the approved wording and places focus on its heading when shown. Escape invokes cancel when not busy. Buttons are `Import setup` and `Cancel`; nothing is submitted on mount.

`SetupProfileImportPanel` owns raw input, decoded pending profile/code, selected workspace, and result state. It uses the shared codec for both query-provided and pasted codes. It receives:

```ts
type SetupProfileImportPanelProps = {
  initialCode: string;
  installationState: "unclaimed" | "sign-in-required" | "ready";
  adminWorkspaces: WorkspaceSummary[];
  redirectPath: string;
};
```

For `sign-in-required`, render `SignInPanel` with `setupAllowed={false}` and the exact encoded return path. For `ready`, filter choices server-side to admin workspaces and POST to the preference API. For `unclaimed`, confirmation transitions to `SignInPanel` in setup view with the normalized pending code.

Extend `SignInPanel` with these optional props while preserving every existing caller:

```ts
initialView?: "sign-in" | "setup";
setupProfileCode?: string;
```

Initialize its view from `initialView`, include `setupProfileCode` only in first-administrator POST bodies, and never render the non-secret profile code as the protected installer setup credential. The user must still enter Daymark's separate protected setup code. Extend `PasswordChangeGate` with a server-supplied local `redirectPath` and send the user back to the encoded import route after a successful required password change.

- [ ] **Step 5: Add the dynamic import page**

`app/setup-profile/import/page.tsx` is `force-dynamic`. It:

1. reads at most one string `code` search parameter;
2. obtains `getAccountSession()` and `administratorExists()`;
3. returns `unclaimed` if no active administrator exists;
4. returns `sign-in-required` if one exists but no session exists;
5. handles forced password change through `PasswordChangeGate` with the same return path;
6. loads `listAccountWorkspaces(session.accountId)`, filters `role === "admin"`, and passes them to the client;
7. never applies a profile server-side during render.

Add an ordinary `Import setup code` link to the first-time setup view and Embed panel so both entry points use this route.

- [ ] **Step 6: Carry a confirmed profile through first setup atomically**

Add optional `setupProfileCode` to `SignInPanel` setup submission, the auth setup route, `AuthDependencies.createInitialWorkspaceAdministrator`, and the repository input. The auth service decodes the code and passes:

```ts
embedPreference: {
  defaultMode: decodedProfile?.layout ?? "floating",
  defaultServiceScope: "all",
}
```

The repository imports `workspaceEmbedPreferences` and inserts that preference immediately after the workspace statement inside the existing single `db.batch`. It never stores the code.

After setup success, route to `/workspace/<slug>?view=embed` when a profile was imported; otherwise preserve the current workspace destination.

- [ ] **Step 7: Open Embed after success without making URL state global**

Accept `searchParams` in the workspace server page and pass `initialView="embed"` only for an admin request with `view=embed`; otherwise pass `schedule`. Initialize `WorkspaceClient` from this allowlisted prop. Do not allow arbitrary query values to select internal views.

- [ ] **Step 8: Add accessible styles, rerun, and commit**

Run: `npm run unit -- tests/setup-profile-import.test.tsx tests/auth-service.test.ts tests/auth-routes.test.ts tests/staff-account-repository.test.ts tests/workspace-ui.test.tsx`

Expected: PASS.

Commit: `git add app/setup-profile app/workspace app/api/auth/setup/route.ts lib/auth lib/data/contracts.ts app/globals.css tests/setup-profile-import.test.tsx tests/auth-service.test.ts tests/auth-routes.test.ts tests/staff-account-repository.test.ts tests/workspace-ui.test.tsx && git commit -m "Confirm and import setup profiles"`

---

## Task 8: Register and safely handle `daymark://` in Daymark Control

**Files:**

- Modify: `desktop/daymark-control/package.json`
- Modify through npm: `desktop/daymark-control/package-lock.json`
- Modify: `desktop/daymark-control/src-tauri/Cargo.toml`
- Modify through Cargo: `desktop/daymark-control/src-tauri/Cargo.lock`
- Modify: `desktop/daymark-control/src-tauri/tauri.conf.json`
- Create: `desktop/daymark-control/src/deep-links.ts`
- Create: `desktop/daymark-control/src/deep-links.test.ts`
- Modify: `desktop/daymark-control/src/App.tsx`
- Modify: `desktop/daymark-control/src/App.test.tsx`
- Create: `desktop/daymark-control/src-tauri/src/setup_profile.rs`
- Modify: `desktop/daymark-control/src-tauri/src/lib.rs`
- Modify: `desktop/daymark-control/src-tauri/src/main.rs`
- Modify: `desktop/daymark-control/src-tauri/src/service.rs`
- Modify: `desktop/daymark-control/src-tauri/src/status.rs`
- Create: `desktop/daymark-control/src-tauri/tests/setup_profile_contract.rs`
- Modify: `tests/windows/installer-contract.test.ps1`
- Modify: `tests/windows/smoke-common.ps1`
- Modify: `tests/windows/install-smoke.ps1`

- [ ] **Step 1: Add failing native URI contract tests**

Rust tests must accept only:

```text
daymark://import-setup?code=DM1-C-F-2ZE7
daymark://import-setup?code=DM1-C-I-355C
```

Reject URI length over 256, wrong/case-varied scheme or host, path `/extra`, user info, port, fragment, missing query, duplicate `code`, unknown query, encoded/internal whitespace, non-ASCII, invalid checksum, unknown version/journey/layout, and trailing data. Assert accepted output is only normalized code plus one of the two canonical loopback URLs, such as `http://127.0.0.1:3210/setup-profile/import?code=DM1-C-F-2ZE7`.

`setup_profile_contract.rs` loads `lib/setup-profile-vectors.json` relative to `CARGO_MANIFEST_DIR` and applies every vector, preventing TypeScript/Rust drift.

- [ ] **Step 2: Add failing frontend deep-link forwarding tests**

Mock `@tauri-apps/plugin-deep-link` and `@tauri-apps/api/core`. Assert `getCurrent()` URLs and later `onOpenUrl` URLs are forwarded one at a time to:

```ts
invoke("open_setup_profile_import", { uri });
```

The listener must be installed only in Tauri, unsubscribe on React cleanup, avoid logging URI/code, and show only a generic Control error when the native command rejects it.

- [ ] **Step 3: Run tests and confirm missing plugin/adapter failures**

Run: `cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml setup_profile`

Run: `npm --prefix desktop/daymark-control test -- --run src/deep-links.test.ts src/App.test.tsx`

Expected: FAIL because the adapter and plugin dependencies are absent.

- [ ] **Step 4: Install pinned frontend and Rust plugins**

Run from repository root:

```powershell
npm --prefix desktop/daymark-control install --save-exact @tauri-apps/plugin-deep-link@2.4.9
cargo add --manifest-path desktop/daymark-control/src-tauri/Cargo.toml tauri-plugin-deep-link@2.4.9
cargo add --manifest-path desktop/daymark-control/src-tauri/Cargo.toml tauri-plugin-single-instance@2 --features deep-link
```

Review both lockfile diffs and keep the resulting exact resolved versions. Do not upgrade unrelated packages.

- [ ] **Step 5: Configure installer-owned protocol registration**

Add `plugins.deep-link.desktop.schemes: ["daymark"]` to `tauri.conf.json`. Register `tauri_plugin_single_instance` first in `main.rs`, with its `deep-link` feature and a callback that shows/focuses the existing `main` webview. Register `tauri_plugin_deep_link::init()` after it.

Do not write a second manual registry implementation in NSIS; Tauri's generated registration and uninstall cleanup remain the single owner.

- [ ] **Step 6: Implement strict Rust parsing and local launch**

In `setup_profile.rs`, expose pure parser/checksum helpers plus this command:

```rust
#[tauri::command]
pub fn open_setup_profile_import(
    uri: String,
    controller: tauri::State<'_, ServiceController>,
) -> Result<(), ControlError>;
```

The command must:

1. reject `uri.len() > 256` before URL parsing;
2. enforce the exact URI boundary and exactly one query pair;
3. validate the same code structure/alphabet/CRC vectors without interpreting layout beyond the allowlist;
4. ensure the runtime is reachable, starting the configured service/manual runtime through a `pub(crate)` service helper if needed;
5. wait only for the bounded loopback health readiness already used by Control;
6. construct the loopback URL from a constant base and percent-encoded normalized code;
7. pass it through `status::assert_safe_local_url` before opening;
8. return generic `ControlError` values and never log the URI/code.

Add the module to `lib.rs` and command to `generate_handler!`.

- [ ] **Step 7: Wire initial and subsequent deep links in React**

`deep-links.ts` wraps `getCurrent` and `onOpenUrl` behind one `listenForSetupProfileLinks(onError)` function. `App.tsx` installs it in an effect and displays a generic message such as `That Daymark setup link could not be opened. Use the setup code instead.`. Keep all raw input out of UI and console.

- [ ] **Step 8: Assert installer and installed registry contracts**

Extend `installer-contract.test.ps1` to assert the exact scheme, deep-link dependency, single-instance `deep-link` feature, and generated app command boundary.

Add `Assert-DaymarkProtocolRegistration` to `smoke-common.ps1`. It must read `Registry::HKEY_CLASSES_ROOT\daymark`, require `URL Protocol`, and require the open command to point only to the installed `Daymark Control.exe` with one quoted `%1` argument. Call it after install and after restart in `install-smoke.ps1`.

- [ ] **Step 9: Rerun native/installer tests and commit**

Run: `npm --prefix desktop/daymark-control test -- --run`

Run: `npm --prefix desktop/daymark-control run build`

Run: `cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml`

Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows/installer-contract.test.ps1`

Expected: PASS.

Commit: `git add desktop/daymark-control tests/windows && git commit -m "Handle confirmed Daymark setup links"`

---

## Task 9: Advance packaged-runtime migration expectations

**Files:**

- Modify: `tests/runtime-health.test.ts`
- Modify: `tests/local-runtime/integration.test.mjs`
- Modify: `desktop/daymark-control/src/main.tsx`
- Modify: `desktop/daymark-control/src/App.test.tsx`
- Modify: `desktop/daymark-control/src/runtime.test.ts`
- Modify: `desktop/daymark-control/src-tauri/src/status.rs`
- Modify: `desktop/daymark-control/src-tauri/tests/tunnel_contract.rs`
- Modify: any exact migration manifest assertion found by `rg "0004_daymark_service_catalog"`

- [ ] **Step 1: Change tests to expect migration 0005 and observe failure**

Update health/integration fixtures to `0005_daymark_embed_preferences.sql`, then run:

Run: `npm run unit -- tests/runtime-health.test.ts`

Run: `npm --prefix desktop/daymark-control test -- --run`

Run: `cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml status`

Expected: FAIL wherever production still pins 0004.

- [ ] **Step 2: Update production migration expectations**

Change the desktop fallback and Rust `EXPECTED_MIGRATION` to `0005_daymark_embed_preferences.sql`. `lib/runtime-health.ts` already derives its expected migration from the committed journal; do not add a second hard-coded TypeScript value.

Run: `rg -n "0004_daymark_service_catalog" lib desktop tests runtime drizzle/meta/_journal.json`

Review every remaining match. Historical migration application references may remain; current-latest assertions must not.

- [ ] **Step 3: Rerun and commit the version-alignment slice**

Run: `npm run unit -- tests/runtime-health.test.ts tests/local-runtime/migrations.test.ts`

Run: `npm --prefix desktop/daymark-control test -- --run`

Run: `cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml`

Expected: PASS.

Commit: `git add lib desktop tests runtime drizzle/meta/_journal.json && git commit -m "Expect embed preference migration"`

---

## Task 10: Full verification, packaged runtime, and completion review

**Files:**

- Modify if needed from evidence only: implementation/test files above
- Create test evidence only in already ignored artifact/evidence paths

- [ ] **Step 1: Run the complete repository gates from a clean command prompt**

Run in order:

```powershell
npm run unit
npm run lint
npm test
npm run windows:verify-runtime
npm run windows:test-staged-migration
npm --prefix desktop/daymark-control test -- --run
npm --prefix desktop/daymark-control run build
cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows/installer-contract.test.ps1
git diff --check
```

Expected: every command exits 0. Fix any regression with a new focused failing test before changing production code.

- [ ] **Step 2: Audit and rebuild the staged Windows runtime**

Run:

```powershell
npm run windows:stage
npm run windows:verify-runtime
```

Confirm `.daymark/` is not present under `artifacts/windows-stage` and no setup-profile code is embedded in logs or manifests.

- [ ] **Step 3: Restart the exact packaged runtime on port 3000**

Send `stop` to the currently managed runtime session, confirm port 3000 is released, then start `runtime/local/cli.ts start` with:

- app dir `C:\Users\Lloyd\Files\Daymark\artifacts\windows-stage`;
- the existing protected Daymark setup-code environment (never print it);
- data/backup/log dirs under `C:\Users\Lloyd\Files\Daymark\.daymark` through normal runtime configuration;
- host `127.0.0.1`, port `3000`.

Wait for `http://127.0.0.1:3000/api/health` to report:

```json
{"status":"ok","appVersion":"0.1.1","latestMigration":"0005_daymark_embed_preferences.sql"}
```

- [ ] **Step 4: Browser-verify the homepage and both catalogue paths**

Using the approved Chrome/in-app-browser capability at `http://localhost:3000/`:

1. verify the demo begins at Service;
2. select Camera, confirm only Maya/Jon, choose a slot, and verify 90-minute confirmation;
3. restart, select Alarm, confirm only Theo/Priya, and verify 120-minute confirmation;
4. confirm completion says no appointment was created;
5. inspect console and network: no errors, no demo booking request, no unexpected request.

- [ ] **Step 5: Browser-verify builder, confirmation, and persistence**

1. verify Floating summary/code/app-link;
2. select Inline and verify all three update;
3. reveal/copy both codes and verify live feedback;
4. manually enter one code at `/setup-profile/import`, cancel, and prove no preference change;
5. sign in as an administrator, import the other code, select a workspace deliberately when offered, and verify success opens Embed;
6. verify Embed starts with imported full-catalogue layout;
7. generate the other layout without saving and prove the default remains unchanged after reload;
8. save the other layout as default and prove it persists after reload;
9. verify keyboard focus, narrow viewport, console, and mutation requests.

- [ ] **Step 6: Verify the installed custom protocol on disposable Windows evidence path**

Build the installer only after all source gates pass:

```powershell
npm run windows:installer
```

Run the existing disposable-machine install smoke workflow with its required explicit switches and secrets. Verify registry association, invoke both canonical app links from Chrome, accept the browser-owned `Open Daymark?` prompt, confirm Control focuses/starts the runtime, cancel one import, confirm the other, and record the resulting Embed default. Reject malformed/oversized URI test cases without opening a non-loopback destination.

- [ ] **Step 7: Audit protected data and Git scope**

Run:

```powershell
git status --short
git diff --stat restore-2026-08-10-before-homepage-handoff..HEAD
git diff --name-only --cached
git ls-files -- .daymark
```

Required evidence:

- `.daymark/` remains untracked and is absent from index and commits (`git ls-files -- .daymark` prints nothing);
- restore tag still resolves to `c622b49ecf1af428eed317be3434fdd4f3b92e15`;
- no unrelated file or generated local business data is staged;
- all feature commits are on `codex/homepage-setup-handoff`.

- [ ] **Step 8: Run the completion-review skill, fix findings, and create the final local commit**

Use `superpowers:requesting-code-review`, address all verified issues with focused tests, then rerun every affected gate and `superpowers:verification-before-completion`.

If verification fixes remain after the task commits, stage each reviewed implementation/test path explicitly with path-scoped `git add --` invocations, inspect the staged diff, and commit them with message `Complete homepage setup handoff`.

Do not stage `.daymark/`. Do not push, merge, release, or alter Pull Request 2 during this task. Report the branch, commits, restore point, exact test evidence, browser/native results, and any manual disposable-machine step that remains.
