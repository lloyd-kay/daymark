# Unified service scope and widget setup builder

**Date:** 2026-08-10
**Status:** Awaiting written-spec review
**Restore point:** `restore-2026-08-10-before-service-scope-builder` at `d41a95c511054c2d365f96b29f3049256a9d4862`
**Cold data backup:** `C:\Users\Lloyd\Files\Daymark-restore-points\2026-08-10-before-service-scope-builder\.daymark`

## Summary

Daymark will combine the homepage booking demonstration and widget-layout chooser into one Daymark-styled setup builder. A visitor will choose both:

1. what the widget should let customers book: **all services** or **this page's service**; and
2. how the widget should appear: **Floating** or **Inline**.

The live demonstration, setup summary, app link, and portable setup code will all reflect the same shared selection. Page-specific booking will never be inferred from a product URL. During import, a Daymark administrator will explicitly map page-specific intent to an active service in the selected workspace.

## Goals

- Let a website owner configure full-catalogue or page-specific booking per widget.
- Keep service scope and Floating/Inline layout independent and combinable.
- Make the homepage demonstration visibly reflect every selected option.
- Preserve Daymark's existing editorial palette, typography, borders, offset shadows, focus treatment, and responsive behavior.
- Transfer service-scope intent and layout safely to the packaged Daymark runtime on the same or another machine.
- Require an explicit workspace-service mapping for page-specific widgets.
- Keep existing version 1 catalogue setup codes and existing widget snippets working.

## Non-goals

- Paid-service checkout or payment-provider integration.
- Reading, scraping, or guessing a service from a website URL, title, product handle, or page content.
- Encoding a real workspace service, private identifier, customer detail, or secret in the public homepage setup code.
- Connecting the public homepage demonstration to a live workspace or creating a real appointment.
- Restricting a workspace to one widget configuration; the saved preference remains only a starting default.

## User experience

### One unified setup area

The current standalone demonstration and separate widget-layout showcase will become one client-side setup experience. It will retain the homepage's existing section anchors and editorial hierarchy while presenting two numbered control groups beside a live preview:

1. **What should customers see?**
   - **Show all services**
   - **Use this page's service**
2. **How should the widget appear?**
   - **Floating widget**
   - **Inline widget**

The selected controls use the same high-contrast treatment as Daymark's existing widget options. The live area always displays visible selection labels and a plain-language setup summary such as:

> Full service catalogue · Floating widget

or:

> Page-specific service · Inline widget

No selection is repeated later on the homepage.

### Full-catalogue demonstration

When **Show all services** is selected:

- the demonstration begins at Service;
- Camera installation and Alarm installation are displayed;
- selecting Camera shows only Maya Chen and Jon Bell and uses a 90-minute duration;
- selecting Alarm shows only Theo Brooks and Priya Shah and uses a 120-minute duration; and
- completion remains local and explicitly states that no appointment was created.

### Page-specific demonstration

When **Use this page's service** is selected, a homepage-only demonstration-service control appears with Camera installation and Alarm installation. It exists to make the behavior understandable and is not transferred as a real customer service.

The live demonstration then:

- keeps the chosen service name and duration visibly fixed;
- skips the Service step;
- begins at Person;
- shows only currently qualified people for the selected demonstration service; and
- continues through date, time, details, and the same no-write completion.

Changing service scope or the demonstration service invalidates the current booking draft, so the demonstration resets with a polite live announcement and moves focus to the new first step. Changing only Floating/Inline layout does not invalidate booking data and preserves the current demonstration step.

### Floating and Inline presentation

The existing Floating and Inline choices remain independent from service scope. The same interactive booking demonstration is presented in a Daymark-styled host-page frame:

- Floating places the booking surface over the host page with a launcher treatment.
- Inline places the booking surface as an intentional section within the host page.

At narrow widths, both remain fully operable in a stacked presentation. The selected layout stays visible in text even where the responsive layout reduces the spatial difference.

## Component architecture

### Shared homepage state

A focused client component will own one draft:

```ts
type HomepageSetupDraft = {
  journey: "catalogue" | "page-service";
  demoService: "camera" | "alarm";
  layout: "floating" | "inline";
};
```

The homepage server component will render this unified experience where the current demonstration and widget-options content live. The client boundary will coordinate four isolated responsibilities:

1. **Setup controls** update the shared draft and expose accessible selected states.
2. **Controlled demonstration** derives its starting service list and qualified people from the draft.
3. **Widget presentation** applies Floating or Inline styling without owning a second layout selection.
4. **Setup transfer** derives the summary, app link, and portable code from journey plus layout.

The sample `demoService` influences only the local demonstration. It is deliberately absent from the transfer profile.

### Demonstration transport

The existing deterministic smart-home demonstration data remains the source of sample services, eligibility, slots, and durations. A small pure selector will expose the initial service and eligible employees needed for page-specific mode. The demonstration remains network-free and never invokes the production booking mutation.

### Existing Embed builder

The protected Embed panel already generates either `data-service="all"` or an explicit service slug. It will be updated so its initial journey, selected service, and layout all come from the persisted workspace preference. Administrators may still change any choice without saving, generate an alternate snippet, or save the current combination as the new workspace default.

## Setup profile contract

### Version 2 profile

New homepage transfers use a version 2 profile:

```ts
type SetupProfileV2 = {
  version: 2;
  journey: "catalogue" | "page-service";
  layout: "floating" | "inline";
};
```

The compact code retains the existing fixed-length, checksum-protected structure:

| Segment | Meaning |
| --- | --- |
| `DM2` | Daymark setup profile version 2 |
| `C` or `P` | Catalogue or page-specific intent |
| `F` or `I` | Floating or Inline layout |
| four safe characters | checksum over the preceding body |

The encoder emits version 2 codes for all four combinations. The decoder continues accepting the two existing version 1 catalogue codes and normalizes them to catalogue profiles. Exact canonical vectors for all supported codes are frozen in the shared TypeScript/Rust JSON contract.

The code contains no workspace identifier or real service selection. Older Daymark versions reject version 2 with the existing update guidance instead of partially interpreting it.

### Native app links

The native URI remains:

```text
daymark://import-setup?code=<canonical-code>
```

Rust and TypeScript continue to enforce exact scheme, host, query, code length, checksum, and canonical reconstruction. Malformed, extended, duplicated, or oversized values are rejected before any loopback navigation. Setup codes remain absent from routine logs and manifests.

## Import and service mapping

### Review

The confirmation screen displays both imported properties:

- Booking journey: Full service catalogue or Page-specific service
- Default layout: Floating widget or Inline widget

Cancel performs no mutation.

### Catalogue import

A confirmed catalogue import stores:

- the imported layout;
- service scope `all`; and
- no default service identifier.

Success opens the selected workspace's Embed area with the catalogue snippet ready.

### Page-specific import

The setup code carries page-specific intent but not a real service. Once an administrator and workspace are known, Daymark loads that workspace's active services and requires an explicit service selection before confirmation can mutate the preference.

- A workspace with one active service will preselect it visibly, but the administrator still sees the mapping before confirmation.
- A workspace with multiple active services requires a deliberate choice.
- A workspace with no active services cannot complete the import and receives a direct explanation and route to service management.
- Changing the selected workspace clears any service chosen for the previous workspace.

For an unclaimed installation, the pending version 2 page-specific code survives administrator setup and returns to the import route after the authenticated workspace exists. It is not silently mapped to the seeded general service. The administrator then reviews and selects the real service.

Success opens Embed with page-specific journey, mapped service, qualified people, and imported layout selected.

## Workspace preference persistence

The workspace preference expands from layout plus the fixed `all` scope to:

```ts
type WorkspaceEmbedPreference = {
  workspaceId: string;
  defaultMode: "floating" | "inline";
  defaultServiceScope: "all" | "service";
  defaultServiceId: string | null;
};
```

A new migration rebuilds the SQLite preference constraint safely, adds the nullable service reference, and backfills every existing row as `all` with `defaultServiceId = null`.

The stored invariants are:

- scope `all` requires a null service identifier;
- scope `service` requires a non-null service identifier; and
- a non-null service must belong to the same workspace.

The protected preference API uses these exact request shapes:

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

Catalogue requests require `serviceId: null`; page-specific requests require a service identifier. The API validates these exact keys, administrator membership, password-change state, workspace ownership, active service state, and the scope/service combination before writing. Page-specific imports and `Save as workspace default` both persist layout, scope, and service atomically.

The preference stores the stable internal service identifier. The Embed panel resolves the current public slug from protected workspace service data when it generates a snippet or direct booking link.

## Universal website integration rule

Generated integration remains explicit:

- full catalogue uses `data-service="all"` and the workspace booking URL without a service query;
- page-specific booking uses the selected service slug in `data-service` and in the direct booking URL.

The host website's own route can be anything. A Shopify product handle, a CMS path, a static HTML filename, or a page with no useful URL structure behaves the same because the mapping lives in the generated Daymark integration, not in URL inference.

Different pages may use different generated service mappings, and a general booking page may use the full catalogue. Saving a workspace default changes only the starting state of the protected Embed builder; it does not invalidate previously generated snippets or prevent alternate configurations.

## Error handling and safe fallbacks

- Invalid or mistyped setup codes keep the existing specific, non-sensitive guidance.
- Version 1 codes import as catalogue setups.
- Version 2 page-specific profiles cannot be applied without a valid active workspace service.
- A failed service load or preference write leaves the current preference unchanged and keeps the reviewed profile available for retry.
- If a persisted mapped service is later inactive or unavailable, Embed displays a blocking configuration message and requires another service. It never falls back to all services silently.
- Existing public page-specific widgets continue to show the existing service-unavailable state if their configured service cannot be booked; they never broaden to the catalogue.
- Scope/service changes reset only the harmless homepage demonstration draft.
- Layout changes preserve demonstration progress.
- Clipboard failure keeps codes/snippets visible and supplies manual-copy guidance.

## Accessibility and responsive behavior

- Scope and layout controls use semantic fieldsets with legends and visible selected states.
- The conditional demonstration-service selector has an explicit label and explanatory text.
- Changing scope or demonstration service announces the new setup and places focus at the reset booking step.
- Layout-only changes announce the selected presentation without discarding entered demonstration data.
- Keyboard operation, Escape/back behavior, labelled progress, focus outlines, and live copy status remain intact.
- The builder stacks controls and preview at narrower breakpoints without hiding either selected value.
- Colour is never the only indication of selection, service scope, qualification, or error.

## Migration and compatibility

- Add `0006_service_scope_widget_defaults.sql` after `0005_daymark_embed_preferences.sql`.
- Preserve all existing workspace preferences as Floating/Inline plus all services.
- Continue decoding version 1 catalogue setup codes and deep links.
- Emit only version 2 codes from the updated homepage.
- Preserve existing `data-service="all"`, explicit-service snippets, direct booking links, and public booking behavior.
- Do not modify, stage, or package `.daymark/` business data.
- Keep Vinext and current pinned Windows runtime dependencies unchanged unless a separate evidenced issue requires otherwise.

## Test strategy

### Unit and component tests

- Freeze version 1 compatibility and all four version 2 canonical code vectors.
- Share the vectors with Rust and reject malformed, duplicated, extended, and oversized native URIs.
- Prove the unified builder updates scope, sample service, layout, summary, app link, and portable code from one state object.
- Prove scope/service changes reset the demonstration while layout changes preserve its step and entered data.
- Prove catalogue mode starts at Service and page-specific mode starts at Person with a fixed visible service.
- Prove Camera and Alarm retain their distinct eligible people and durations in both journeys.
- Prove the homepage demonstration performs no booking request or write.
- Prove import requires a workspace-owned active service only for page-specific profiles.
- Prove workspace changes clear stale service selections and cancel writes nothing.
- Prove repository/API authorization, exact-key validation, cross-workspace rejection, inactive-service rejection, and atomic preference writes.
- Prove migration backfill and database invariants.
- Prove Embed initializes, saves, reloads, and generates correct snippets for both service scopes and layouts.

### Build, packaged runtime, and browser verification

- Run the complete unit, lint, rendered HTML, desktop Control, Rust, migration, installer-contract, and production build gates.
- Rebuild and restart the exact staged Windows runtime and require the new migration in `/api/health`.
- In Chrome, exercise all four scope/layout combinations at desktop and narrow widths.
- Complete Camera and Alarm catalogue demonstrations and page-specific demonstrations.
- Verify visible selected-state summaries, keyboard focus, copy feedback, console output, and network activity.
- Import one catalogue and one page-specific code as an administrator and prove persistence after reload.
- Build the installer and repeat native-protocol checks on the disposable Windows evidence path.

## Acceptance criteria

1. The homepage presents service scope and widget layout as one Daymark-styled setup experience.
2. All four scope/layout combinations visibly update the same live demonstration and setup summary.
3. Full catalogue starts at Service; page-specific starts at Person with a fixed service shown.
4. Camera and Alarm always filter to their qualified people and correct durations.
5. Layout changes preserve demonstration progress; scope/service changes reset it safely.
6. New setup codes transfer scope intent and layout but never a homepage sample service.
7. Existing version 1 setup codes continue to import as full catalogue.
8. Page-specific import requires an explicit active service from the chosen workspace.
9. Persisted defaults restore layout, scope, and mapped service without silent fallback.
10. Generated page-specific widgets work on arbitrary website URLs because the service mapping is explicit.
11. No demonstration creates an appointment or sends customer data.
12. `.daymark/` remains untracked, uncommitted, and absent from staged/runtime artifacts.
