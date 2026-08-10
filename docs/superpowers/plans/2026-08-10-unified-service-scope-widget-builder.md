# Unified Service Scope and Widget Setup Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage's disconnected demonstration and layout chooser with one Daymark-styled builder whose full-catalogue/page-specific scope and Floating/Inline layout transfer safely into a workspace, including an explicit active-service mapping for page-specific imports.

**Architecture:** Keep one client-owned homepage draft and one interactive, deterministic booking demonstration. Emit a version 2 setup profile containing only journey intent and layout, preserve version 1 catalogue decoding, and require the protected runtime to map page-specific intent to a stable workspace service ID. Persist layout, scope, and service atomically behind the existing administrator boundary; resolve the current public service slug only when generating an Embed snippet or direct link.

**Tech Stack:** TypeScript 5.9, React 19, Vinext App Router, Vitest/jsdom, Drizzle ORM with Cloudflare D1/SQLite, Tauri 2, Rust, PowerShell Windows packaging tests, packaged local Wrangler runtime.

## Global Constraints

- Work on `codex/homepage-setup-handoff`, starting from approved design commit `647899e` and restore commit `d41a95c511054c2d365f96b29f3049256a9d4862`.
- Preserve the annotated tag `restore-2026-08-10-before-service-scope-builder` and the hash-verified cold snapshot at `C:\Users\Lloyd\Files\Daymark-restore-points\2026-08-10-before-service-scope-builder\.daymark`.
- Never edit, delete, stage, commit, or package `C:\Users\Lloyd\Files\Daymark\.daymark`. Normal writes made through the packaged runtime during migration and browser verification are permitted.
- Follow red-green-refactor for every behavior change: write a focused failing test, run it and record the expected failure, implement the minimum production change, then rerun the focused test before moving on.
- Keep the homepage demonstration deterministic and local. It may use the existing in-memory demo transport, but it must not fetch workspace data, create a real appointment, or emit widget host completion events.
- Never infer a service from a host URL, Shopify handle, page title, DOM text, or product data. Page-specific integration always uses an administrator-selected Daymark service.
- Setup-profile codes are non-secret preferences, not authorization. They must never carry a workspace ID, real service ID/slug, customer data, credential, or installer secret.
- Preserve version 1 catalogue codes, existing `data-service="all"` snippets, existing explicit-service snippets, direct booking links, and public service-unavailable behavior.
- Do not add payment or checkout behavior, automatic host-site editing, URL scraping, a live homepage workspace, or a real demo booking.
- Keep Vinext and the pinned desktop/runtime dependencies unchanged.
- Make small, path-scoped commits. Before each commit, inspect `git diff --check` and `git diff --cached`; never use broad staging commands that could include `.daymark/`.
- Do not merge or release during implementation. After all verification and completion review pass, satisfy the user's GitHub update request by publishing only the reviewed feature branch/PR; do not repurpose or merge an unrelated PR.

---

## Task 1: Extend the setup-profile contract to version 2

**Files:**

- Modify: `lib/setup-profile.ts`
- Modify: `lib/setup-profile-vectors.json`
- Modify: `tests/setup-profile.test.ts`
- Modify: `desktop/daymark-control/src/deep-links.test.ts`
- Modify: `desktop/daymark-control/src-tauri/src/setup_profile.rs`
- Modify: `desktop/daymark-control/src-tauri/tests/profile_import_contract.rs`

**Interface:**

```ts
export type SetupLayout = "floating" | "inline";
export type SetupJourney = "catalogue" | "page-service";

export type SetupProfileV1 = {
  version: 1;
  journey: "catalogue";
  layout: SetupLayout;
};

export type SetupProfileV2 = {
  version: 2;
  journey: SetupJourney;
  layout: SetupLayout;
};

export type SetupProfile = SetupProfileV1 | SetupProfileV2;
export type SetupProfileDraft = Pick<SetupProfileV2, "journey" | "layout">;

export function encodeSetupProfile(profile: SetupProfileDraft | SetupProfile): string;
export function decodeSetupProfile(value: string): SetupProfile;
export function buildSetupProfileUri(code: string): string;
```

- [ ] **Step 1: Freeze all six canonical cross-language vectors**

Update `lib/setup-profile-vectors.json` so valid entries include `version`, `journey`, and `layout`:

```json
{
  "valid": [
    { "code": "DM1-C-F-2ZE7", "version": 1, "journey": "catalogue", "layout": "floating" },
    { "code": "DM1-C-I-355C", "version": 1, "journey": "catalogue", "layout": "inline" },
    { "code": "DM2-C-F-36UR", "version": 2, "journey": "catalogue", "layout": "floating" },
    { "code": "DM2-C-I-2SPS", "version": 2, "journey": "catalogue", "layout": "inline" },
    { "code": "DM2-P-F-34D6", "version": 2, "journey": "page-service", "layout": "floating" },
    { "code": "DM2-P-I-2Y6D", "version": 2, "journey": "page-service", "layout": "inline" }
  ],
  "invalid": [
    "DM1-C-F-2ZE8",
    "DM1-P-F-2ZE7",
    "DM2-C-F-36US",
    "DM2-X-F-36UR",
    "DM3-C-F-36UR",
    "DM2-C-F-36UR-EXTRA",
    "DM2 C F 36UR"
  ]
}
```

- [ ] **Step 2: Write the failing TypeScript version-2 tests**

Replace the layout-only encoder cases in `tests/setup-profile.test.ts` with draft-based version 2 cases and retain explicit version 1 decode coverage:

```ts
it.each([
  [{ journey: "catalogue", layout: "floating" }, "DM2-C-F-36UR"],
  [{ journey: "catalogue", layout: "inline" }, "DM2-C-I-2SPS"],
  [{ journey: "page-service", layout: "floating" }, "DM2-P-F-34D6"],
  [{ journey: "page-service", layout: "inline" }, "DM2-P-I-2Y6D"],
] as const)("encodes the v2 draft %j", (draft, code) => {
  expect(encodeSetupProfile(draft)).toBe(code);
  expect(decodeSetupProfile(code)).toEqual({ version: 2, ...draft });
});

it("continues decoding and canonicalizing both v1 catalogue codes", () => {
  const profile = decodeSetupProfile(" dm1-c-i-355c ");
  expect(profile).toEqual({ version: 1, journey: "catalogue", layout: "inline" });
  expect(encodeSetupProfile(profile)).toBe("DM1-C-I-355C");
  expect(buildSetupProfileUri(" dm1-c-i-355c ")).toBe(
    "daymark://import-setup?code=DM1-C-I-355C",
  );
});
```

Also assert that a version 1 `P` journey is `unsupported_value`, an unknown version is `unsupported_version`, every vector decodes to its full JSON metadata, and malformed/checksum cases retain their existing safe error classifications.

- [ ] **Step 3: Make Rust consume the richer vectors, then observe both failures**

Change `ValidVector` in `profile_import_contract.rs` to deserialize `version: u8`, `journey: String`, and `layout: String`; assert the supported combinations and add all six canonical native URIs. Add version 2 URIs to `deep-links.test.ts` to prove the frontend forwards them unchanged and in order.

Run:

```powershell
npm run unit -- tests/setup-profile.test.ts
cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml setup_profile
```

Expected: FAIL because the TypeScript encoder accepts only a layout and both decoders reject `DM2`.

- [ ] **Step 4: Implement strict v1/v2 TypeScript encoding and decoding**

Implement these rules in `lib/setup-profile.ts`:

- a versionless `SetupProfileDraft` always emits version 2;
- passing a decoded `SetupProfile` preserves its version during canonical reconstruction;
- version 1 accepts only `C`; version 2 accepts `C` and `P`;
- `P` maps to `page-service`, while `C` maps to `catalogue`;
- both versions retain exact length 12, the existing safe alphabet, ASCII-only case normalization, and CRC-16/CCITT-FALSE checksum;
- `buildSetupProfileUri` decodes and re-encodes the supplied profile before interpolation.

Do not weaken the error ordering: structurally invalid input is `invalid_format`; a shaped unknown version is `unsupported_version`; a shaped unsupported marker is `unsupported_value`; a supported body with the wrong suffix is `invalid_checksum`.

- [ ] **Step 5: Extend the native parser without broadening the URI boundary**

In Rust, keep the exact scheme/host/path/query checks and change only the code marker rules:

```rust
let supported_profile = match (bytes[2], bytes[4]) {
    (b'1', b'C') => true,
    (b'2', b'C' | b'P') => true,
    _ => false,
};
```

Continue requiring `DM`, a single version digit, `F|I`, exact checksum, uppercase ASCII, one `code` query, and no path, credentials, port, fragment, duplicates, percent-encoded ambiguity, or trailing data.

- [ ] **Step 6: Rerun the codec/native gates and commit**

Run:

```powershell
npm run unit -- tests/setup-profile.test.ts
npm --prefix desktop/daymark-control test -- --run src/deep-links.test.ts
cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml setup_profile
git diff --check
```

Expected: PASS.

Commit with explicit paths:

```powershell
git add -- lib/setup-profile.ts lib/setup-profile-vectors.json tests/setup-profile.test.ts desktop/daymark-control/src/deep-links.test.ts desktop/daymark-control/src-tauri/src/setup_profile.rs desktop/daymark-control/src-tauri/tests/profile_import_contract.rs
git commit -m "Add service scope setup profiles"
```

---

## Task 2: Add database-backed service-scoped workspace defaults

**Files:**

- Modify: `lib/data/contracts.ts`
- Modify: `db/schema.ts`
- Create: `drizzle/0006_service_scope_widget_defaults.sql`
- Create: `drizzle/meta/0006_snapshot.json`
- Modify: `drizzle/meta/_journal.json`
- Modify: `tests/schema.test.ts`
- Create: `tests/embed-preference-migration.test.ts`

**Interface:**

```ts
export type EmbedServiceScope = "all" | "service";

export type WorkspaceEmbedPreference = {
  workspaceId: string;
  defaultMode: "floating" | "inline";
  defaultServiceScope: EmbedServiceScope;
  defaultServiceId: string | null;
};
```

- [ ] **Step 1: Write failing schema and migration-contract tests**

Extend `tests/schema.test.ts` to require `defaultServiceId` to be nullable and to inspect the exact `0006` migration. Create `tests/embed-preference-migration.test.ts` with a Miniflare D1 fixture representing the post-`0005` schema, two workspaces, one service in each, and existing Floating/Inline catalogue preferences.

The migration test must prove backfill preserves layout while normalizing existing rows to `all` plus null, accepts `workspace-a/service-a`, rejects `all` plus a service, rejects `service` plus null, rejects `workspace-a/service-b`, and finishes with an empty `PRAGMA foreign_key_check` result.

Run:

```powershell
npm run unit -- tests/schema.test.ts tests/embed-preference-migration.test.ts
```

Expected: FAIL because `defaultServiceId` and migration `0006` do not exist.

- [ ] **Step 2: Expand the contracts and model the database invariants**

Move `workspaceEmbedPreferences` below `services` in `db/schema.ts` so a composite foreign key can reference the service table. Import `foreignKey`, add a unique parent key, and model the preference like this:

```ts
uniqueIndex("idx_services_workspace_id").on(table.workspaceId, table.id),

defaultServiceScope: text("default_service_scope")
  .$type<"all" | "service">()
  .notNull(),
defaultServiceId: text("default_service_id"),

check(
  "workspace_embed_preferences_service_scope_check",
  sql`(
    ${table.defaultServiceScope} = 'all' and ${table.defaultServiceId} is null
  ) or (
    ${table.defaultServiceScope} = 'service' and ${table.defaultServiceId} is not null
  )`,
),
foreignKey({
  name: "workspace_embed_preferences_service_workspace_fk",
  columns: [table.workspaceId, table.defaultServiceId],
  foreignColumns: [services.workspaceId, services.id],
}),
```

Keep the existing workspace cascade and mode check. The composite key prevents a valid service ID from another workspace being stored.

- [ ] **Step 3: Generate, inspect, and harden migration 0006**

Run:

```powershell
npm run db:generate -- --name service_scope_widget_defaults
```

Require the exact output name `drizzle/0006_service_scope_widget_defaults.sql`. Inspect the generated rebuild and ensure it: disables foreign keys before the table replacement; adds `idx_services_workspace_id`; creates the nullable service column and composite foreign key; checks both valid scope/ID pairs; copies old rows as `all,NULL` while preserving mode/timestamps; drops/renames safely; runs `PRAGMA foreign_key_check` and `PRAGMA optimize`; and restores foreign keys. Preserve generated metadata IDs and snapshot structure.

- [ ] **Step 4: Rerun migration tests and commit**

Run:

```powershell
npm run unit -- tests/schema.test.ts tests/embed-preference-migration.test.ts
git diff --check
```

Expected: PASS.

Commit:

```powershell
git add -- lib/data/contracts.ts db/schema.ts drizzle/0006_service_scope_widget_defaults.sql drizzle/meta/0006_snapshot.json drizzle/meta/_journal.json tests/schema.test.ts tests/embed-preference-migration.test.ts
git commit -m "Store service scoped widget defaults"
```

---

## Task 3: Validate service-scoped preference writes behind the admin API

**Files:**

- Modify: `lib/data/embed-preference-repository.ts`
- Modify: `lib/embed-preferences.ts`
- Modify if types require it: `lib/embed-preferences-runtime.ts`
- Modify: `tests/embed-preference-repository.test.ts`
- Modify: `tests/embed-preferences.test.ts`
- Modify: `tests/embed-preference-routes.test.ts`

**Requests:**

```ts
type SetDefaultRequest = {
  action: "set-default";
  defaultMode: "floating" | "inline";
  defaultServiceScope: "all" | "service";
  serviceId: string | null;
};

type ImportProfileRequest = {
  action: "import-profile";
  code: string;
  serviceId: string | null;
};
```

- [ ] **Step 1: Expand repository fixtures and write failing authorization tests**

In `tests/embed-preference-repository.test.ts`, add a `services` table and seed active `service-a`, inactive `service-a-inactive`, and active cross-workspace `service-b`. Include `default_service_id` plus the scope/ID check in the preference fixture.

Add cases proving catalogue writes require `serviceId: null`; page-specific writes accept only an active service in the actor workspace; inactive, missing, malformed, and cross-workspace IDs return `false` and preserve the previous row; idempotent upsert reads back all four fields; and existing employee/inactive-admin/wrong-workspace denial remains intact.

- [ ] **Step 2: Write failing exact-request service tests**

Update `tests/embed-preferences.test.ts` with successful requests for all/null, service/internal-ID, V1 catalogue import, V2 catalogue import, and V2 page import. Assert `set-default` rejects `all`+ID and `service`+null, while page imports reject null and catalogue imports reject non-null before storage. Retain exact-key, 401, 428, 403, safe code guidance, and storage-failure coverage. Update the route test to forward the new exact bodies.

Run:

```powershell
npm run unit -- tests/embed-preference-repository.test.ts tests/embed-preferences.test.ts tests/embed-preference-routes.test.ts
```

Expected: FAIL because the repository accepts only `all` and the service layer expects the old keys.

- [ ] **Step 3: Make the repository authorize the complete tuple atomically**

Select and return `defaultServiceId`. Change the setter input to the three mutable preference fields. Prevalidate mode, scope/ID pair, and opaque ID shape. In the single `INSERT ... SELECT ... ON CONFLICT DO UPDATE`, require an active same-workspace administrator and, for `service`, an active row in `services` with both matching ID and workspace. Upsert `default_service_id`; do not use a separate service preflight query that can race deactivation.

- [ ] **Step 4: Parse exact API shapes and derive imports from the code**

In `createEmbedPreferences`, require exactly the keys shown above, parse `serviceId` as null or a safe opaque string, and validate the set-default scope/ID pair. For import, decode the profile and derive `all|null` for catalogue or `service|serviceId` for page-specific. Pass `defaultServiceId` to storage. Repository rejection remains generic 403 guidance so cross-workspace details do not leak.

Never accept or persist a public slug in this API.

- [ ] **Step 5: Rerun and commit**

Run:

```powershell
npm run unit -- tests/embed-preference-repository.test.ts tests/embed-preferences.test.ts tests/embed-preference-routes.test.ts
git diff --check
```

Expected: PASS.

Commit:

```powershell
git add -- lib/data/embed-preference-repository.ts lib/embed-preferences.ts lib/embed-preferences-runtime.ts tests/embed-preference-repository.test.ts tests/embed-preferences.test.ts tests/embed-preference-routes.test.ts
git commit -m "Validate service scoped embed preferences"
```

Omit `lib/embed-preferences-runtime.ts` if unchanged.

---

## Task 4: Require explicit service mapping during profile import

**Files:**

- Modify: `app/setup-profile/SetupProfileConfirmation.tsx`
- Modify: `app/setup-profile/SetupProfileImportPanel.tsx`
- Modify: `app/workspace/sign-in/SignInPanel.tsx`
- Modify: `lib/auth/service.ts`
- Modify: `lib/auth/repository.ts`
- Modify if request typing changes: `app/api/auth/setup/route.ts`
- Modify: `app/globals.css`
- Modify: `tests/setup-profile-import.test.tsx`
- Modify: `tests/auth-service.test.ts`
- Modify: `tests/auth-routes.test.ts`
- Modify: `tests/staff-account-repository.test.ts`

- [ ] **Step 1: Write failing confirmation and active-service mapping tests**

Extend `tests/setup-profile-import.test.tsx` with `WorkspaceService` fixtures and mocked `GET /api/workspace/services?workspace=...` responses. Cover:

- confirmation labels catalogue vs page-specific and Floating vs Inline;
- catalogue import posts `{ action, code, serviceId: null }` without fetching services;
- one active service is fetched and visibly preselected for a page profile;
- multiple active services leave the service choice blank until the administrator deliberately selects one;
- inactive services are excluded;
- zero active services blocks Import and links to `?view=services` in the chosen workspace;
- changing workspace immediately clears the old service ID before loading the new list;
- a load failure keeps the reviewed profile available for retry and performs no POST;
- cancel performs no mutation;
- page import posts the stable selected service ID, never its slug.

Use `DM2-P-I-2Y6D` as the canonical page-specific Inline code.

- [ ] **Step 2: Write the failing unclaimed-install continuation tests**

Add tests proving an unclaimed page-specific Inline import behaves as follows:

1. confirmation reveals first-time setup;
2. setup POST carries the canonical profile separately from the private installer code;
3. authentication creates an ordinary temporary `floating/all/null` preference, not a service mapping and not a partial Inline import;
4. after setup, navigation returns to `/setup-profile/import?code=DM2-P-I-2Y6D`;
5. the now-authenticated import page must review again and choose the real service.

Retain catalogue first-install behavior: V1 and V2 catalogue profiles may create `all/null` with their requested layout and open Embed directly.

Run:

```powershell
npm run unit -- tests/setup-profile-import.test.tsx tests/auth-service.test.ts tests/auth-routes.test.ts tests/staff-account-repository.test.ts
```

Expected: FAIL because confirmation is catalogue-only, import has no service loader, setup applies every profile immediately, and initial preferences lack `defaultServiceId`.

- [ ] **Step 3: Render both imported properties and canonicalize without losing intent**

Change `SetupProfileConfirmation` to derive its journey label from `profile.journey`:

```tsx
<dd>{profile.journey === "page-service"
  ? "Page-specific service"
  : "Full service catalogue"}</dd>
```

In the import panel's `review`, canonicalize with `encodeSetupProfile(profile)`, not layout-only encoding. This preserves a normalized V1 code and all V2 journey information.

- [ ] **Step 4: Load and clear workspace services safely**

For a pending page profile only, fetch:

```ts
`/api/workspace/services?workspace=${encodeURIComponent(selectedWorkspace)}`
```

Maintain explicit `servicesLoading`, `servicesError`, `activeServices`, and `selectedServiceId` state. On every workspace change, clear `selectedServiceId` synchronously, invalidate prior results with an effect cancellation flag/request token, load the new workspace, filter `active === true`, and preselect only when exactly one service remains.

If several services exist, render `Choose a service`. If none exist, block confirmation and link to:

```tsx
<a href={`/workspace/${encodeURIComponent(selectedWorkspace)}?view=services`}>
  Manage services
</a>
```

The mutation must be exactly:

```ts
JSON.stringify({
  action: "import-profile",
  code: pending.code,
  serviceId: pending.profile.journey === "page-service"
    ? selectedServiceId
    : null,
})
```

- [ ] **Step 5: Preserve incomplete page intent through first setup**

Keep passing `setupProfileCode` to `/api/auth/setup` so the server validates it. Decode once in `lib/auth/service.ts` and derive:

```ts
const initialPreference = profile?.journey === "catalogue"
  ? {
      defaultMode: profile.layout,
      defaultServiceScope: "all" as const,
      defaultServiceId: null,
    }
  : {
      defaultMode: "floating" as const,
      defaultServiceScope: "all" as const,
      defaultServiceId: null,
    };
```

The V2 page profile stays unapplied until a real service can be written atomically. Update the first-workspace repository input/insert to include `defaultServiceId`.

When an unclaimed page profile enters `SignInPanel`, pass a canonical return path built from the confirmed code. Make a supplied `redirectPath` win after successful setup as well as sign-in. Do not supply that return path for catalogue setup, which can still complete immediately.

- [ ] **Step 6: Style, rerun, and commit**

Add Daymark-consistent service-select, loading, error, and management-link styles beside the existing setup-profile rules. Preserve focus-on-confirmation, Escape cancel, visible disabled state, live errors, and narrow stacking.

Run:

```powershell
npm run unit -- tests/setup-profile-import.test.tsx tests/auth-service.test.ts tests/auth-routes.test.ts tests/staff-account-repository.test.ts
npm run lint -- --quiet
git diff --check
```

Expected: PASS.

Commit:

```powershell
git add -- app/setup-profile/SetupProfileConfirmation.tsx app/setup-profile/SetupProfileImportPanel.tsx app/workspace/sign-in/SignInPanel.tsx lib/auth/service.ts lib/auth/repository.ts app/api/auth/setup/route.ts app/globals.css tests/setup-profile-import.test.tsx tests/auth-service.test.ts tests/auth-routes.test.ts tests/staff-account-repository.test.ts
git commit -m "Require service mapping for setup imports"
```

Omit unchanged optional paths from staging.

---

## Task 5: Restore and save the complete default in Embed

**Files:**

- Modify: `app/workspace/EmbedPanel.tsx`
- Modify if prop assembly requires it: `app/workspace/WorkspaceClient.tsx`
- Modify if server loading requires it: `app/workspace/[workspaceSlug]/page.tsx`
- Modify: `tests/workspace-ui.test.tsx`

- [ ] **Step 1: Write failing persisted-default component tests**

Extend `tests/workspace-ui.test.tsx` with catalogue and service preferences that include `defaultServiceId`. Prove:

- catalogue restores Inline, `Show all services`, `data-service="all"`, and the base direct URL;
- camera restores Floating, page-specific journey, camera by stable ID, only qualified calendars, its current slug in the public output, and a complete saved-default summary;
- changing layout/scope/service edits generated output immediately but not the saved summary until Save;
- Save posts all exact keys with `serviceId: null` for catalogue or the internal ID for page-specific;
- successful response replaces the saved tuple; failure retains it and allows retry;
- a persisted missing or inactive service displays a blocking alert and produces neither snippet nor direct link;
- an invalid persisted mapping never falls back to the first active service or to `all`;
- choosing a new active service and saving repairs the blocked state.

Run:

```powershell
npm run unit -- tests/workspace-ui.test.tsx
```

Expected: FAIL because the panel initializes only layout and posts only `defaultMode`.

- [ ] **Step 2: Use IDs for protected state and slugs only for public output**

Replace the slug-valued service state with `selectedServiceId`. Derive:

```ts
const selectedService = activeServices.find(
  (candidate) => candidate.id === selectedServiceId,
) ?? null;
const configuredServiceSlug = journey === "preselected"
  ? selectedService?.slug ?? ""
  : "all";
```

Initialize journey and selected ID from all persisted fields. For a catalogue preference, keep a harmless first-active draft for later experimentation. For a persisted service preference, preserve its exact ID even when unresolved; do not replace it with `activeServices[0]`. Continue filtering calendars through the resolved service's current active qualifications.

- [ ] **Step 3: Track and save the whole tuple**

Replace `savedDefaultMode` with `savedPreference`, compute dirty/valid state from all fields, and post:

```ts
body: JSON.stringify({
  action: "set-default",
  defaultMode: mode,
  defaultServiceScope: journey === "preselected" ? "service" : "all",
  serviceId: journey === "preselected" ? selectedService?.id ?? null : null,
}),
```

Disable Save and public output while page-specific selection is unresolved. Explain that an unavailable saved service must be reconfigured. On success, store the returned full preference.

Keep `buildEmbedSnippet` and `buildDirectBookingLink` backward-compatible for validated input. Enforce no fallback in `EmbedPanel` by withholding a configured slug until a real active mapped service resolves.

- [ ] **Step 4: Rerun and commit**

Run:

```powershell
npm run unit -- tests/workspace-ui.test.tsx tests/embed-preferences.test.ts
npm run lint -- --quiet
git diff --check
```

Expected: PASS.

Commit:

```powershell
git add -- app/workspace/EmbedPanel.tsx app/workspace/WorkspaceClient.tsx app/workspace/[workspaceSlug]/page.tsx tests/workspace-ui.test.tsx
git commit -m "Restore service scoped embed defaults"
```

Stage only paths that actually changed.

---

## Task 6: Make the smart-home demonstration controllable and resettable

**Files:**

- Modify: `lib/booking/demo.ts`
- Modify: `app/demo/DemoBookingFlow.tsx`
- Modify: `tests/booking-transport.test.ts`
- Modify: `tests/widget-integration.test.tsx`

**Interface:**

```ts
export type DemoServiceKey = "camera" | "alarm";

export function demoScenario(service: DemoServiceKey): {
  service: PublicService;
  employees: PublicEmployee[];
};

export function DemoBookingFlow(props: {
  journey?: "catalogue" | "page-service";
  demoService?: DemoServiceKey;
}): JSX.Element;
```

- [ ] **Step 1: Write failing selector and controlled-flow tests**

In `tests/booking-transport.test.ts`, prove `demoScenario("camera")` returns Camera, 90 minutes, Maya/Jon and `demoScenario("alarm")` returns Alarm, 120 minutes, Theo/Priya, using the same canonical data as the transport.

In `tests/widget-integration.test.tsx`, render page-specific Camera and prove it starts at Person, shows the fixed service/duration, and excludes Alarm staff. Advance one step, rerender as Alarm, and prove it returns to Person, focuses the new stage heading, announces the reset, and excludes Camera staff. Retain default catalogue and no-real-write completion coverage.

Run:

```powershell
npm run unit -- tests/booking-transport.test.ts tests/widget-integration.test.tsx
```

Expected: FAIL because `demoScenario` and controlled props do not exist.

- [ ] **Step 2: Centralize eligibility in a synchronous selector**

Export `DemoServiceKey` and `demoScenario` from `lib/booking/demo.ts`. Keep one eligibility map; make both `demoBookingTransport.loadEmployees` and `demoScenario` call the same pure lookup so staff lists cannot drift.

- [ ] **Step 3: Remount only for scope/sample-service changes**

In `DemoBookingFlow`, derive the scenario and render:

```tsx
<BookingFlow
  key={`${journey}:${demoService}`}
  initialServices={fixed ? [scenario.service] : DEMO_SERVICES}
  initialServiceId={fixed ? scenario.service.id : undefined}
  initialEmployees={fixed ? scenario.employees : []}
  transport={demoBookingTransport}
  demonstration
/>
```

Wrap it in a ref-owned element. After a scope/sample change (not initial mount), set a polite live message and focus the newly mounted `.stage-title h3` on the next frame/timer. Layout is deliberately absent from both key and props.

- [ ] **Step 4: Rerun and commit**

Run:

```powershell
npm run unit -- tests/booking-transport.test.ts tests/widget-integration.test.tsx tests/booking-flow.test.ts
git diff --check
```

Expected: PASS.

Commit:

```powershell
git add -- lib/booking/demo.ts app/demo/DemoBookingFlow.tsx tests/booking-transport.test.ts tests/widget-integration.test.tsx
git commit -m "Control the homepage service demonstration"
```

---

## Task 7: Build the unified Daymark-styled homepage experience

**Files:**

- Modify: `app/home/HomepageSetupBuilder.tsx`
- Modify: `app/home/WidgetOptionsShowcase.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/homepage-showcase.test.tsx`

**Shared draft:**

```ts
type HomepageSetupDraft = {
  journey: "catalogue" | "page-service";
  demoService: "camera" | "alarm";
  layout: "floating" | "inline";
};
```

- [ ] **Step 1: Replace static-showcase assertions with failing unified-state tests**

Update `tests/homepage-showcase.test.tsx` to assert one setup region, one host-browser preview, one interactive booking flow, and semantic scope/layout fieldsets. Cover all four transferable combinations:

| Journey | Layout | Code | Summary |
| --- | --- | --- | --- |
| catalogue | floating | `DM2-C-F-36UR` | Full service catalogue · Floating widget |
| catalogue | inline | `DM2-C-I-2SPS` | Full service catalogue · Inline widget |
| page-service | floating | `DM2-P-F-34D6` | Page-specific service · Floating widget |
| page-service | inline | `DM2-P-I-2Y6D` | Page-specific service · Inline widget |

For each, assert the native link and portable code match. Prove changing the sample Camera/Alarm choice does not alter a page-specific code.

Add interactions proving catalogue begins at Service; Camera reaches only Maya/Jon; Floating-to-Inline preserves the current Person step and selected Camera; page-specific Camera begins at Person with 90 minutes; switching an advanced page-specific flow to Alarm resets to focused Person with 120 minutes and Theo/Priya; and no setup choice invokes `fetch` or a production write. Retain copy success/failure and self-hosted artwork/font checks.

Run:

```powershell
npm run unit -- tests/homepage-showcase.test.tsx
```

Expected: FAIL because scope does not exist and the demo/showcase are separate.

- [ ] **Step 2: Make `HomepageSetupBuilder` the only state owner**

Initialize one `HomepageSetupDraft` and render:

1. `What should customers see?` fieldset with `Show all services` and `Use this page's service`;
2. a conditional labelled demonstration-service control for Camera/Alarm, explicitly described as sample-only;
3. `How should the widget appear?` fieldset with Floating/Inline;
4. one shared live presentation;
5. one summary/transfer card.

Derive transfer output only from journey and layout:

```ts
const profileCode = encodeSetupProfile({
  journey: draft.journey,
  layout: draft.layout,
});
const appLink = buildSetupProfileUri(profileCode);
```

Clear stale copy feedback on setup changes. Announce layout changes politely without moving focus or resetting the flow. In page-specific mode, explain that the administrator will choose the real workspace service in Daymark.

- [ ] **Step 3: Turn the showcase into one interactive host presentation**

Refactor `WidgetOptionsShowcase.tsx` into a controlled presentation accepting `layout` and `children`. Keep the self-hosted artwork, live wordmark, and Cedar House host chrome, but use one stable live-surface tree position:

```tsx
<div className="widget-presentation" data-layout={layout}>
  <HostBrowser>
    <HostHero inline={layout === "inline"} />
    <div className="widget-live-surface">{children}</div>
    <div className="widget-daymark-fab" aria-hidden="true">
      <span>D</span> Book an appointment
    </div>
  </HostBrowser>
</div>
```

CSS alone changes the presentation: Floating overlays the host page with launcher treatment; Inline participates as a dedicated page section. Do not put the interactive booking flow inside `aria-hidden`. Keeping its React position stable is what preserves progress on layout changes.

- [ ] **Step 4: Replace the two homepage sections without breaking anchors**

Remove the standalone `<DemoBookingFlow />` from `app/page.tsx` and render one unified builder. Preserve both navigation targets: `#demo` reaches the introduction/live demonstration and `#widget-options` reaches the controls inside that same region. Keep the privacy notice, transfer explanation, contact note, footer, ordinary internal `<a>` navigation, and Get Daymark behavior.

- [ ] **Step 5: Apply Daymark styling and responsive behavior**

Refactor existing demo/widget/setup CSS instead of adding a separate visual language. Retain paper colours, ink borders, coral/sage/lilac/sky accents, editorial display type, offset shadows, and the existing focus ring. Selected scope/layout must remain visible in text and not rely on colour. At narrow widths stack controls and preview, turn Floating into safe static flow placement, keep every control/focus ring visible, and prevent horizontal page overflow.

Remove static dual-preview CSS only after confirming it is unused.

- [ ] **Step 6: Rerun homepage/rendered gates and commit**

Run:

```powershell
npm run unit -- tests/homepage-showcase.test.tsx tests/widget-integration.test.tsx tests/booking-flow.test.ts
npm run lint -- --quiet
npm test
git diff --check
```

Expected: PASS; rendered HTML retains both anchors and ordinary internal navigation.

Commit:

```powershell
git add -- app/home/HomepageSetupBuilder.tsx app/home/WidgetOptionsShowcase.tsx app/page.tsx app/globals.css tests/homepage-showcase.test.tsx
git commit -m "Unify homepage booking setup options"
```

---

## Task 8: Advance packaged-runtime migration expectations to 0006

**Files:**

- Modify: `tests/runtime-health.test.ts`
- Modify: `tests/local-runtime/migrations.test.ts`
- Modify: `tests/local-runtime/integration.test.mjs`
- Modify: `desktop/daymark-control/src/main.tsx`
- Modify: `desktop/daymark-control/src/App.test.tsx`
- Modify: `desktop/daymark-control/src/runtime.test.ts`
- Modify: `desktop/daymark-control/src-tauri/src/status.rs`
- Modify: `desktop/daymark-control/src-tauri/tests/tunnel_contract.rs`
- Modify other current-latest assertions found by `rg`, while retaining historical migration sequences

- [ ] **Step 1: Update latest-migration tests first and observe failures**

Change current health fixtures to `0006_service_scope_widget_defaults.sql`. Update `tests/local-runtime/migrations.test.ts` to expect seven migrations and `appliedCount: 7`. Extend the integration backfill test to apply `0005`, preserve an existing Inline/all row, then apply `0006` and assert null service ID plus clean foreign keys.

Run:

```powershell
npm run unit -- tests/runtime-health.test.ts tests/local-runtime/migrations.test.ts
npm --prefix desktop/daymark-control test -- --run
cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml status
```

Expected: FAIL wherever production still pins `0005`.

- [ ] **Step 2: Update only current-latest production values**

Set the desktop fallback and Rust `EXPECTED_MIGRATION` to `0006_service_scope_widget_defaults.sql`. `lib/runtime-health.ts` must continue deriving its expectation from `drizzle/meta/_journal.json`; do not add a second TypeScript hard-code.

Run `rg -n "0005_daymark_embed_preferences" lib runtime desktop tests` and review every match. Historical apply/backfill references may remain; current health/readiness/latest assertions may not.

- [ ] **Step 3: Rerun runtime/desktop/Rust gates and commit**

Run:

```powershell
npm run unit -- tests/runtime-health.test.ts tests/local-runtime/migrations.test.ts
node --test tests/local-runtime/integration.test.mjs
npm --prefix desktop/daymark-control test -- --run
npm --prefix desktop/daymark-control run build
cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml
git diff --check
```

Expected: PASS.

Commit:

```powershell
git add -- tests/runtime-health.test.ts tests/local-runtime/migrations.test.ts tests/local-runtime/integration.test.mjs desktop/daymark-control/src/main.tsx desktop/daymark-control/src/App.test.tsx desktop/daymark-control/src/runtime.test.ts desktop/daymark-control/src-tauri/src/status.rs desktop/daymark-control/src-tauri/tests/tunnel_contract.rs
git commit -m "Expect service scope preference migration"
```

---

## Task 9: Complete repository, packaged-runtime, browser, and GitHub verification

**Files:**

- Modify only from new evidence: implementation/test files already listed
- Create transient evidence only in ignored artifact/evidence paths

- [ ] **Step 1: Run all source gates from a clean PowerShell session**

Run in order:

```powershell
npm run unit
npm run lint
npm test
npm --prefix desktop/daymark-control test -- --run
npm --prefix desktop/daymark-control run build
cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows/installer-contract.test.ps1
git diff --check
```

Expected: every command exits 0. Any new failure requires a focused regression test before production changes.

- [ ] **Step 2: Rebuild and validate the staged Windows runtime**

Run:

```powershell
npm run windows:stage
npm run windows:verify-runtime
npm run windows:test-staged-migration
```

Verify the staged payload includes migration 0006 and its journal, but contains no `.daymark`, setup codes, credentials, or local logs.

- [ ] **Step 3: Restart the exact packaged runtime on port 3000**

Stop the currently managed runtime session cleanly, confirm `127.0.0.1:3000` is released, and start the local runtime CLI against `C:\Users\Lloyd\Files\Daymark\artifacts\windows-stage`, the existing protected setup-code environment (never print it), normal `.daymark` data/backup/log paths, host `127.0.0.1`, and port `3000`.

Wait for:

```json
{"status":"ok","appVersion":"0.1.1","latestMigration":"0006_service_scope_widget_defaults.sql"}
```

The cold restore point remains untouched.

- [ ] **Step 4: Browser-verify the unified homepage at desktop and narrow widths**

Using the user-approved Chrome/in-app browser capability at `http://localhost:3000/`:

1. confirm `#demo` and `#widget-options` both reach the unified builder;
2. exercise all four scope/layout combinations and compare summary, app link, and code to the frozen vectors;
3. complete Camera and Alarm catalogue demonstrations and verify staff plus 90/120-minute durations;
4. exercise both page-specific samples and confirm Service is skipped and the fixed service is visible;
5. change layout mid-flow and confirm the current step/input survives;
6. change scope/sample service and confirm reset announcement and focused first step;
7. verify copy success/manual fallback, keyboard focus, responsive stacking, and no overflow;
8. inspect console/network for no link errors, uncaught errors, demo booking request, or unexpected write.

- [ ] **Step 5: Browser-verify mapping and persisted Embed output**

In an administrator QA workspace with explicit Camera and Alarm services:

1. import V1 and V2 catalogue codes and verify all/null compatibility and persistence;
2. review a V2 page code, change workspace if available, and confirm stale service choice clears;
3. select the real Camera service and inspect that POST carries the internal ID, not slug;
4. confirm Embed restores requested layout, page journey, mapped service, and qualified staff;
5. confirm snippet/direct link use the current explicit slug/query;
6. save Alarm as an alternate mapping and verify after reload;
7. exercise unavailable-service blocking only through the QA UI/test path, confirm no fallback to all, then restore QA state;
8. verify zero-service/load-failure guidance where safely reproducible.

Do not manually edit `.daymark` for evidence.

- [ ] **Step 6: Verify native v1/v2 protocol behavior**

After source/staged gates pass, run `npm run windows:installer` and use the existing disposable Windows evidence workflow. Verify registry ownership; invoke one V1 catalogue URI, one V2 catalogue URI, and both V2 page-layout URIs; accept Chrome's `Open Daymark?` prompt; confirm only the loopback import page opens; and reject malformed, duplicate-query, percent-encoded, oversized, unknown-version, and wrong-checksum inputs without navigation or sensitive error text.

- [ ] **Step 7: Audit Git and protected data scope**

Run:

```powershell
git status --short
git diff --stat restore-2026-08-10-before-service-scope-builder..HEAD
git diff --name-only --cached
git ls-files -- .daymark
git rev-parse "restore-2026-08-10-before-service-scope-builder^{}"
```

Require `.daymark/` to remain untracked, the tag to resolve to `d41a95c511054c2d365f96b29f3049256a9d4862`, no cold backup/runtime business data/log/secret/unrelated path to be staged, no real service identity in setup vectors, and all feature commits to remain on `codex/homepage-setup-handoff`.

- [ ] **Step 8: Request review and verify fixes before completion**

Use `superpowers:requesting-code-review`. Address each verified issue with a focused failing test, rerun affected gates, then invoke `superpowers:verification-before-completion`. If review fixes remain, stage only their explicit paths, inspect the staged diff, and commit them as `Complete unified service scope builder`.

- [ ] **Step 9: Update GitHub only with the reviewed branch**

Use `github:yeet` because the user explicitly requested a GitHub update. Confirm the connected repo is `lloyd-kay/daymark`, inspect the remote branch/PR relationship, push `codex/homepage-setup-handoff`, and update or open the appropriate draft PR with the restore point, migration/backward-compatibility notes, test evidence, packaged health, browser/native results, and confirmation that `.daymark` was never tracked.

Do not merge, release, publish an installer, or repurpose an unrelated pull request. Report the pushed commit and PR URL.
