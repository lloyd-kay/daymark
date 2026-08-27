# Homepage catalogue demonstration and setup-profile handoff

**Date:** 2026-08-10

**Status:** Approved design

## Goal

Make the Daymark homepage demonstrate the new service-aware booking model and turn the existing Floating/Inline layout choice into a meaningful installation preference.

The homepage will show a harmless full service catalogue inspired by a smart-home installation business. After trying it, a visitor can choose a widget layout and transfer that choice to Daymark in either of two ways:

1. on the same Windows machine through an operating-system `daymark://` app link; or
2. on another machine through a compact, self-contained setup code.

Both paths carry the same non-secret profile, display the same confirmation before applying it, and configure only a workspace's default Embed presentation. They do not install anything into the customer's website or prevent an administrator from generating other widget layouts later.

## Restore point

The following restore point was created and verified before this specification or any implementation file changed:

- Git tag: `restore-2026-08-10-before-homepage-handoff`
- Restored commit: `c622b49ecf1af428eed317be3434fdd4f3b92e15`
- Remote: the annotated tag is pushed to `origin`
- Cold business-data snapshot: `C:\Users\Lloyd\Files\Daymark-restore-points\2026-08-10-before-homepage-handoff\.daymark`
- Snapshot verification: 37 files and 26,753,687 bytes matched the stopped source state file-for-file by SHA-256

The repository's `.daymark/` directory remains untracked. It must never be edited by hand, deleted, staged, or committed. Normal packaged-runtime writes remain permitted.

## Current problem

The homepage currently has two disconnected demonstrations:

- its interactive booking flow is fixed to one generic 30-minute consultation, so it does not show service-specific employee eligibility or duration; and
- its Floating and Inline cards use `aria-pressed` selection controls, but that state is deliberately presentational and disappears when the visitor leaves the page.

The second behavior makes “Choose this layout” and “Selected” misleading. A prospective administrator must select the same layout again after installing Daymark.

The installed Embed screen also has no persisted workspace default. It can generate either kind of snippet, but opening it starts from component defaults rather than an imported preference.

## Product decisions

- The homepage demonstration starts in **full catalogue** mode.
- The catalogue uses fixed local smart-home service examples, not a live workspace or production API.
- The homepage remains non-transactional: it creates no appointment and performs no live availability or booking writes.
- The layout builder produces a **default**, not a permanent restriction. A workspace can still create both Floating and Inline snippets.
- A setup profile contains no customer, employee, credential, service-record, URL, or executable data.
- Cross-machine import does not require a Daymark cloud account or hosted handoff service.
- Every import requires an explicit confirmation. Existing installations additionally require administrator authentication.
- The paid-first booking journey remains deferred.

## Homepage catalogue demonstration

### Sample catalogue

The demonstration will replace its single `General consultation` with exactly these two version 1 examples:

- **Camera installation** — ID `service-demo-camera-installation`, slug `camera-installation`, 90 minutes
- **Alarm installation** — ID `service-demo-alarm-installation`, slug `alarm-installation`, 120 minutes

The fixed demonstration uses Daymark's existing Maya, Theo, Priya, and Jon identities with this exact eligibility mapping:

- Camera installation: Maya Chen and Jon Bell
- Alarm installation: Theo Brooks and Priya Shah

Choosing a service therefore replaces the employee choices rather than showing the same roster twice. These are local demonstration qualifications only; they do not read or imitate a real workspace's stored qualification records.

### Demonstration transport

The existing shared `BookingFlow` remains the UI boundary. Its demonstration wrapper supplies:

- all sample services with no fixed initial service, which starts the flow on the Service step;
- a demonstration transport that filters employees by `serviceId`;
- deterministic local slots whose end times reflect the selected service's duration; and
- a demonstration-only confirmation snapshot containing the selected service, duration, and employee.

The demonstration transport must not call `fetch`, read a production workspace, write a booking, or emit widget host events. “Complete demonstration” continues to finish with a clear statement that no appointment was created.

### Page copy

The demo heading and notice continue to identify the experience as safe and non-transactional. Supporting copy should explain the new point of the example: clients choose a service first, and Daymark then offers only people qualified to deliver it.

## Meaningful layout builder

### Selection state

The existing Floating and Inline preview cards remain visually available together. Their selection state becomes the source for a setup profile rather than a local-only visual flourish.

The builder has two inputs in version 1:

- booking journey: `catalogue` (fixed by the approved homepage direction); and
- default widget layout: `floating` or `inline`.

It displays a live summary, for example:

> **Your Daymark setup**
>
> Full service catalogue · Floating widget

### Transfer actions

The summary provides two explicit actions:

- **Open in Daymark** invokes the same-machine app-link handoff.
- **Use on another machine** reveals the portable code with an accessible Copy action.

The portable code remains available even when the visitor tries the app link. The page must not claim it can reliably detect whether a browser accepted or rejected a custom-protocol launch. Instead, nearby fallback copy says that if Daymark does not open, the visitor can install it or use the setup code.

Selecting a layout or revealing/copying a code makes no network request and writes no booking or business data.

## Version 1 setup profile

### Canonical fields

Version 1 carries exactly three allowlisted values:

| Field | Values | Meaning |
| --- | --- | --- |
| version | `1` | Decoder and compatibility version |
| journey | `C` | Full service catalogue |
| layout | `F`, `I` | Floating or Inline default |

No optional or free-form fields are allowed. Future versions must use a new version identifier rather than silently extending version 1.

### Human-readable form

The canonical code has a compact form such as:

```text
DM1-C-F-2ZE7
```

The segments contain the Daymark/version prefix, catalogue marker, layout marker, and a checksum. The checksum detects transcription errors and corruption; it is not an authenticity or authorization mechanism.

The canonical body is the first three segments joined with hyphens, for example `DM1-C-F`. Its ASCII bytes are checksummed with CRC-16/CCITT-FALSE using polynomial `0x1021`, initial value `0xFFFF`, no input/output reflection, and final XOR `0x0000`. The unsigned 16-bit result is left-padded and encoded as four base-32 characters using this exact alphabet:

```text
23456789ABCDEFGHJKLMNPQRSTUVWXYZ
```

This produces `DM1-C-F-2ZE7` for Floating and `DM1-C-I-355C` for Inline. CRC is used only for transcription-error detection.

After trimming surrounding Unicode whitespace, the decoder normalizes ASCII `a`–`z` to uppercase. The normalized code must then be exactly 12 ASCII characters in four hyphen-separated segments. Internal whitespace is never ignored. Decoding is strict:

- trim surrounding whitespace only;
- normalize ASCII lowercase to uppercase before validation;
- enforce the exact 12-character length and four-segment structure;
- reject unknown versions, journeys, layouts, characters, or trailing data; and
- verify the checksum before producing a typed profile.

### Security boundary

The profile is deliberately non-secret and non-privileged. Anyone could construct a valid preference, so safety must not depend on the checksum or on the website that launched the link.

Protection comes from:

- a tiny field allowlist;
- no executable, filesystem, network, HTML, credential, or customer fields;
- an explicit import confirmation;
- administrator authorization on an existing installation; and
- workspace-scoped persistence.

If a future profile needs privileged or sensitive fields, it must use a different signed design. Those fields must not be added to version 1.

## Same-machine app-link handoff

### Protocol

The Windows installer registers a single Daymark custom protocol. The homepage invokes a URI shaped like:

```text
daymark://import-setup?code=DM1-C-F-2ZE7
```

The native Daymark control process accepts only the `import-setup` host/action and exactly one `code` query parameter. The complete URI is capped at 256 characters before parsing, and the decoded code must pass the same exact 12-character codec rules. Duplicate parameters, fragments, user information, alternate hosts/actions, extra path segments, and unknown query parameters are rejected. The process must never interpret profile content as a command, executable argument, file path, registry path, web destination, or shell input.

Windows/browser behavior supplies the familiar “Open Daymark?” permission prompt. Daymark must not mimic that browser-owned prompt inside the webpage.

### Native-to-local handoff

After strict native parsing, Daymark starts or focuses the local runtime and opens `/setup-profile/import` on the runtime's configured loopback origin. The normalized code is transferred to that local route. Logs may record that a version 1 import was requested, but must not record the complete URI or code.

The native process does not directly alter workspace data. The local web application owns the confirmation and protected preference write.

For an unclaimed installation, the confirmed normalized profile remains in the first-administrator setup flow and is submitted with that setup request. No preference is written before the workspace exists. The workspace, default preference, initial roster, administrator, membership, and credential are created in the same atomic setup operation. If setup fails, neither the workspace nor preference exists. If the visitor abandons or cancels the flow, nothing is persisted and the portable code can be entered again later.

For an existing installation, Daymark requires normal administrator sign-in. If the administrator can manage multiple workspaces, the confirmation requires an explicit workspace choice before applying the preference.

## Cross-machine code handoff

The first-run setup surface includes an optional **Import setup code** control. Pasting a valid version 1 code shows the same summary and confirmation used by the app-link path.

An existing administrator can also import a code from the Embed area. The request is protected by the existing session, administrator-role, company-scope, and same-origin rules.

Both handoff paths call the same decoder, validation service, confirmation model, and persistence operation. They must not develop separate interpretations of the code.

## Confirmation experience

No valid code is applied immediately. The confirmation states:

> **Import this setup?**
>
> Booking journey: Full service catalogue
>
> Default layout: Floating widget

Available actions are **Import setup** and **Cancel**.

- Cancel makes no workspace change and clears the pending import from the current flow.
- Import is idempotent. Reapplying the workspace's current preference succeeds without duplicate records.
- Success opens or returns to the Embed area with the imported layout selected and its full-catalogue snippet ready.
- The administrator can subsequently change the selected default or generate a different snippet.

## Workspace preference persistence

Add one `workspace_embed_preferences` record per workspace rather than treating the imported layout as global process configuration.

The record contains:

- workspace identifier, unique and foreign-keyed to the workspace;
- default widget mode: `floating` or `inline`;
- default service scope: `all` for version 1;
- creation/update timestamps as required by the existing schema conventions.

The stored record contains normalized preference fields, not the original setup code. The migration inserts `floating` plus service scope `all` for existing workspaces, matching the Embed screen's current initial behavior. The normal first-workspace setup path inserts the same default when no imported profile is present.

The Embed panel reads this record as its initial selection. Changing the default through the protected workspace UI updates the same record, but generated snippets remain self-contained through their existing `data-mode`, `data-service`, and employee attributes.

## Component boundaries

Keep the work divided into focused units:

1. **Profile codec** — pure canonical encoding, checksum, strict decoding, and typed errors.
2. **Demonstration catalogue** — fixed services, service-to-employee eligibility, duration-aware slots, and no-write confirmation.
3. **Homepage setup builder** — layout choice, summary, app link, code reveal, copy feedback, and fallback copy.
4. **Preference repository/service** — workspace-scoped defaults and role-aware protected writes.
5. **Import confirmation UI** — a shared presentation for app-link and pasted-code flows.
6. **Native protocol adapter** — Windows registration, bounded URI parsing, and local-app launch/focus behavior.

The codec must not depend on React, the database, Tauri, or browser globals. The native adapter and web UI must consume the same canonical format rather than reimplementing its meaning independently.

## Failure behavior

Every failure is non-destructive:

- **Malformed or mistyped code:** explain that the setup code is invalid and request a fresh copy.
- **Checksum mismatch:** identify the code as incomplete or mistyped without guessing corrections.
- **Unsupported version:** tell the user that this Daymark installation must be updated.
- **Unknown value or oversized input:** reject it before any persistence or protocol side effect.
- **Daymark not installed or not opened:** leave the code visible and provide installation/manual-import guidance.
- **Unauthenticated existing installation:** preserve the intended return destination through sign-in, without applying the profile.
- **Non-admin membership:** deny the write without revealing other workspace details.
- **Multiple eligible workspaces:** require a deliberate selection rather than choosing one silently.
- **Cancelled confirmation:** clear the pending flow and write nothing.
- **Database failure:** retain the prior preference and show a safe retry message.
- **Duplicate import:** return the existing effective preference as a successful idempotent result.

Errors must never echo credentials, customer information, internal database details, raw shell arguments, or unrelated local paths.

## Accessibility and responsive behavior

- The catalogue preserves the shared BookingFlow's labelled step progression, focus movement, and keyboard operation.
- Floating/Inline controls retain `aria-pressed`, visible focus, and meaningful descriptions.
- The setup summary is exposed as normal text, not only through colour or preview styling.
- Copy feedback uses an `aria-live` status without replacing the code visually.
- Import errors and success messages use the existing status/error conventions.
- Confirmation focus begins on its heading, Escape/cancel behavior is predictable, and destructive-looking language is avoided because the action changes only a default.
- At narrow widths, the two previews may stack, but the summary, code, and actions remain fully visible without horizontal scrolling.

## Verification strategy

Implementation follows test-driven development.

### Automated coverage

- Add codec tests for deterministic round trips, both layouts, checksum corruption, mistyped characters, unknown versions/values, whitespace policy, trailing data, and length limits.
- Add demonstration tests proving that the catalogue starts on Service, Camera and Alarm produce different employee lists, slot/confirmation duration follows the selected service, and no network request or booking write occurs.
- Add homepage component/render tests for the live setup summary, both layout selections, app-link construction, portable-code reveal/copy, and fallback language.
- Add schema, migration, repository, service, and route tests for workspace defaults, existing-workspace backfill, admin-only writes, company scoping, same-origin enforcement, idempotency, and failed-write preservation.
- Add import-flow tests for first-run pending behavior, existing-session redirect/return, multiple-workspace choice, confirmation, and cancellation.
- Add Rust/native tests for exact protocol-action parsing, input bounds, rejected alternate actions/parameters, and safe argument handling.
- Add Windows staging/installer assertions proving that the approved `daymark` protocol registration is present and points only to the packaged Daymark control executable.

### Packaged and browser verification

- Run the complete unit suite, lint, production build, rendered-route suite, local-runtime integration suite, migration smoke tests, staged-runtime audit, native tests, and `git diff --check`.
- Rebuild and restart the exact staged packaged runtime on port 3000.
- In a browser, complete both smart-home catalogue paths and verify the service-specific employee filtering, duration, safe confirmation, keyboard behavior, responsive layout, console, and relevant network activity.
- Exercise Floating and Inline selection, verify code changes deterministically, copy/import each code, cancel once, and confirm once.
- On Windows, invoke the registered app link and verify the browser-owned permission prompt, native launch/focus behavior, Daymark confirmation, and resulting Embed default.
- Confirm that the live `.daymark/` directory remains untracked and absent from staged/committed output.

## Out of scope

- Paid booking or payment-provider entitlements.
- Automatically editing or deploying the customer's website.
- Carrying actual service records, employee qualifications, accounts, or customer data in a profile.
- Making preselected-service mode part of version 1; a pre-install profile cannot safely name a workspace service that does not yet exist.
- Enforcing one widget layout across every page.
- A hosted setup-profile database, expiring code service, Daymark cloud account, or cross-device synchronization.
- Registering native protocols on platforms other than the current Windows package in this change.
- Merging or releasing the feature without a separate completion review.

## Acceptance criteria

1. The homepage demonstration begins with Camera and Alarm services and filters employees differently for each.
2. Demonstration slots and confirmation use the selected service's real sample duration without creating an appointment or calling live booking endpoints.
3. Floating/Inline selection updates a visible full-catalogue setup summary and deterministic version 1 code.
4. The same code is accepted through manual cross-machine entry and the Windows `daymark://` handoff.
5. Both transfer paths display an explicit confirmation and apply nothing on Cancel.
6. Existing installations require an authenticated administrator and an explicit workspace choice when ambiguous.
7. A confirmed import persists a workspace default and opens Embed with the correct full-catalogue snippet selected.
8. The administrator can later change the default or generate another layout.
9. Invalid, corrupt, unsupported, oversized, or unauthorized imports make no state change and expose no sensitive details.
10. No setup profile contains secrets, customer data, employee data, arbitrary text, URLs, paths, or executable input.
11. The Windows package registers only the approved import protocol behavior and passes staged/native verification.
12. All automated, migration, packaged-runtime, browser, accessibility, console, and relevant network checks pass.
13. The pre-change Git tag and cold `.daymark` snapshot remain intact and verifiable.
