# Daymark Widget and Staff Sign-In — Design Specification

## Summary

This specification extends the approved Daymark private team calendar with two embeddable booking presentations, staff-owned email/password authentication, richer anonymous client details, and a product-oriented demonstration homepage.

It supersedes two decisions in the original Daymark specification:

- The root page becomes a non-transactional product demonstration instead of the live booking page.
- Staff use Daymark email/password accounts instead of ChatGPT sign-in.

All existing privacy boundaries remain: clients see only discrete bookable slots, employees see only their own schedule, and administrators can view and manage the whole team.

## Product goals

- Let a business add Daymark to another website with one small script snippet.
- Offer both a floating launcher and an inline booking panel without maintaining two booking implementations.
- Give prospective teams a convincing Daymark homepage that cannot accidentally create real appointments.
- Let staff sign in with familiar email/password credentials while preventing public registration.
- Require enough client information to support an appointment: service address and at least one contact method.
- Preserve the existing 30-day hard-deletion policy for all client and appointment data.

## Product structure

### Product homepage — `/`

The root page becomes a polished homepage for businesses considering Daymark. It explains the privacy model, demonstrates the employee selection and booking experience with fixed sample data, previews both widget modes, and directs staff to sign in.

The demonstration is intentionally separated from production booking:

- It uses local sample people, dates, times, and confirmation content.
- It never calls public availability or booking endpoints.
- It labels itself as a demonstration and states that no appointment will be created.
- Its final action says “Complete demonstration” rather than “Confirm booking.”
- Reloading or resetting restores the same harmless sample state.

Primary homepage calls to action are “See the demonstration,” “View embed options,” and “Staff sign in.” The page retains Daymark’s parchment, ink, coral rail, and paper-tab visual system.

### Standalone live booking — `/book`

The real client booking experience moves to `/book`. It retains the person, date, time, details, and confirmation sequence. It is suitable for direct sharing and is also the content rendered by embedded widgets.

The client does not create an account or sign in. Before confirming, the client provides:

- Name.
- Appointment or service address.
- Email address, phone number, or both. At least one is required.
- Optional note.

The confirmation repeats the employee, date, time, address, and a masked contact destination. Public responses never reveal another client or the reason a slot is unavailable.

### Staff sign-in — `/workspace/sign-in`

Staff sign in with email and password. There is no public registration route. Successful sign-in returns the staff member to the private workspace. Staff who are issued a temporary password must replace it before any schedule or client data is shown.

The existing `/workspace` role behavior remains:

- Employees can access only their own calendar, availability, blocked time, and appointments.
- Administrators can access the full team and account management.

### Account setup

The first administrator claims the installation using the deployment-only `DAYMARK_SETUP_CODE`, then provides their email and creates a permanent password. The setup code cannot be reused after an administrator exists.

Administrators create staff accounts by entering the staff member’s name, role, and email. Daymark generates a temporary password once and shows it to the administrator for secure handoff. The temporary password is not retrievable later. At first sign-in, the staff member must choose a new password before entering the workspace.

Administrators can deactivate an account and issue a new temporary password. Deactivation immediately revokes active sessions and removes that employee from public booking while preserving appointments inside the retention window.

## Embeddable widget

### Integration contract

Businesses add one external script to their website. The base form is:

```html
<script
  src="https://daymark.example/daymark-widget.js"
  data-mode="floating"
  data-employee="all"
  defer
></script>
```

Supported configuration is deliberately small:

`daymark.example` is an illustrative reserved domain. The administrator’s generated snippet uses the installation’s exact hosted Daymark origin.

- `data-mode="floating"` or `data-mode="inline"`.
- `data-employee="all"` or a public employee identifier.
- Optional `data-label` for the floating button’s accessible text.

Daymark does not expose arbitrary CSS or raw HTML configuration in the first release. This keeps embeds predictable, accessible, and safe. The widget inherits the Daymark identity rather than attempting to mimic every host website.

The administrator workspace includes an “Embed Daymark” panel. The administrator chooses floating or inline mode, chooses all employees or one employee, previews the result, and copies the generated snippet.

### Floating mode

The script adds a compact “Book an appointment” launcher near the lower page edge. Activating it opens a responsive Daymark panel above the host page. On narrow screens the panel becomes a full-height sheet. Escape closes it, focus remains inside while open, and focus returns to the launcher after closing.

Floating mode is intended for site-wide availability. The host can position the script once in its common layout.

### Inline mode

The script inserts the Daymark booking panel at the script location. The panel expands vertically as the client progresses and remains within the host page’s document flow. It is intended for contact, services, or dedicated booking sections.

### Isolation and messaging

Both modes render the same `/embed` experience inside an iframe hosted by Daymark. This isolates Daymark from host-page styling and prevents the host website from reading booking form values or confirmation data.

Only `/embed` permits framing by external HTTPS websites. Daymark’s homepage, booking page, sign-in pages, and workspace reject external framing. The generated iframe uses a restrictive sandbox that permits the booking form and Daymark scripts but not top-level navigation, downloads, or popups.

Cross-window messages are limited to a small allowlist:

- Daymark may report its required height.
- Daymark may request that the floating panel close after completion.
- The host wrapper may request close or reset.

Messages validate the expected Daymark origin and contain no client details, employee calendar data, appointment references, or form contents. The wrapper also validates that messages come from its own iframe window and match a per-instance channel identifier, so multiple widgets on one page cannot control each other.

## Authentication architecture

### Credentials

Each active staff membership has one normalized, unique email credential. Passwords are processed on the server with a per-account random salt and a deliberately expensive password-based derivation function available in the Cloudflare runtime. Only the derived password verifier, salt, algorithm version, and work-factor metadata are stored.

Password rules favor usable passphrases: at least 12 characters, with no arbitrary composition rules. Passwords, temporary passwords, and session tokens are never logged.

### Sessions

Successful authentication creates a random opaque session token. The browser receives it in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie. The database stores only a hash of the token, with membership identity, creation time, last-use time, and expiry.

Sessions expire after 12 hours of inactivity and seven days absolutely. Signing out, changing a password, resetting a password, or deactivating an account revokes affected sessions. Protected requests resolve the session on the server before invoking the existing role-scoped workspace service.

### Abuse protection

- Login responses do not reveal whether an email address exists.
- Repeated failed sign-ins are throttled per account and request fingerprint, followed by a temporary lockout.
- State-changing routes verify same-origin requests in addition to `SameSite` cookies.
- Authentication and enrolment errors expose no credential, session, membership, or database details.
- Server-side role checks remain the authority for every protected read and write.

## Data model changes

### Staff authentication records

Add a credentials table associated one-to-one with a membership. It stores normalized email, password verifier metadata, forced-password-change state, failed-attempt state, and timestamps.

Add a sessions table containing token hash, membership identifier, creation and expiry timestamps, last-use timestamp, and revocation timestamp. Expired and revoked sessions are excluded from reads and removed during normal authentication activity.

The membership remains the source of truth for role and active status. Authentication identifies a membership; it does not duplicate authorization rules.

### Appointment details

Appointments add:

- `client_address`, required for new bookings.
- `client_email`, nullable.
- `client_phone`, nullable.

Server validation requires a non-empty normalized address and at least one valid contact field. Existing optional notes remain. Address, contact details, notes, appointment data, and confirmation reference are all hard-deleted 30 days after the appointment ends.

## Data flows

### Widget loading

1. The host website downloads `daymark-widget.js` from the Daymark origin.
2. The script validates its supported data attributes and creates a floating or inline wrapper.
3. The wrapper loads `/embed` in an iframe with the optional public employee identifier.
4. The iframe retrieves employees and slots directly from Daymark. The host page never proxies or receives them.
5. Height and close events travel through the restricted message channel.

### Anonymous booking

1. The client chooses an employee, date, and discrete slot.
2. The client enters a name, address, and email, phone, or both.
3. The server validates and normalizes the fields, recomputes availability, and attempts the existing conflict-protected appointment insert.
4. A conflict keeps the client’s locally entered information in the iframe and offers refreshed slots.
5. Success returns a non-sensitive confirmation for display only inside Daymark.

### Staff sign-in

1. A staff member submits email and password to the sign-in route.
2. The server applies throttling, finds the active credential, and verifies the password in constant-time-compatible server logic.
3. A valid result creates a hashed session record and secure cookie.
4. A temporary credential is sent to the password-change gate; a permanent credential enters the role-scoped workspace.
5. Every later protected request resolves the session and active membership before accessing data.

## Error handling

- Unsupported widget configuration falls back to safe defaults and emits one non-sensitive browser console warning.
- If the iframe cannot load, the wrapper shows a direct “Open booking page” link.
- Inline height messages are capped to a reasonable range to prevent layout abuse.
- Floating mode remains dismissible by keyboard even after a network error.
- Invalid contact or address fields show specific inline guidance without discarding other values.
- Booking conflicts preserve client input locally and refresh only the slot step.
- Invalid sign-in attempts use a generic error. Rate-limited responses state when the current request may be retried without distinguishing whether an account exists or is locked.
- Expired sessions return to sign-in with a short “Your session expired” message and no private data in the URL.
- Demonstration-page failures remain local because the demonstration performs no network writes.

## Accessibility and responsive behavior

- Widget launchers and panels have complete accessible names and visible focus states.
- Floating mode traps focus only while open and restores it to the launcher on close.
- Inline mode follows normal document order and announces step and error changes.
- Both widget modes support keyboard, touch, reduced motion, and WCAG AA contrast.
- The iframe title identifies it as “Daymark appointment booking.”
- Mobile floating mode uses a full-height sheet; mobile inline mode remains in document flow without horizontal scrolling.
- The homepage demonstration is explicitly labelled as a demonstration for screen-reader and sighted users.

## Validation strategy

Automated tests will cover:

- Password hashing and verification without storing readable credentials.
- Temporary-password enforcement, password change, logout, expiry, reset, and session revocation.
- Generic invalid-login responses, throttling, and temporary lockout.
- Employee isolation and administrator visibility under the new session resolver.
- Disabled-account denial and session revocation.
- Address normalization and the requirement for at least one valid contact method.
- Confirmation masking and 30-day deletion of every new client field.
- Floating and inline widget configuration, employee preselection, origin validation, height limits, and safe fallbacks.
- Proof that homepage demonstration interactions never invoke booking or availability endpoints.
- Duplicate-booking conflict behavior in standalone and embedded contexts.
- Keyboard behavior and accessible naming for the launcher, iframe, modal sheet, sign-in form, and password-change gate.

Before a hosted version is saved, the full unit suite, lint checks, production build, server-rendered route checks, migration inspection, and clean-worktree check must pass.

## Migration and rollout

The current site has not been publicly deployed and contains no production staff accounts, so the ChatGPT identity path can be replaced directly without an end-user migration. The existing membership and authorization services are retained; only identity resolution and enrolment are replaced.

The deployment keeps `DAYMARK_SETUP_CODE` as a secret Sites environment variable. No password, temporary credential, or session secret is stored in source control or hosting metadata.

The new hosted version remains unpublished until explicit approval for public access. Public access is required for `/`, `/book`, the widget script, and `/embed`; `/workspace` remains protected by Daymark authentication and role checks.

## First-release scope

Included:

- Product demonstration homepage.
- Standalone anonymous booking at `/book`.
- Floating and inline iframe widget modes from one script.
- Administrator embed configurator and copyable snippet.
- Staff-only email/password sign-in with temporary-password onboarding.
- Secure server-side sessions and login abuse controls.
- Required service address and at least one client contact method.
- Existing employee privacy, administrator visibility, conflict protection, and 30-day retention.

Not included:

- Client accounts or client sign-in.
- Email delivery, magic links, password-reset email, booking emails, or SMS.
- Arbitrary widget theming or host-page access to booking events and client data.
- Multiple Daymark organizations in one deployment.
- External calendar synchronization, payments, reporting, or analytics.

These exclusions keep the extension focused on portable booking, familiar staff access, and the already approved privacy model.
