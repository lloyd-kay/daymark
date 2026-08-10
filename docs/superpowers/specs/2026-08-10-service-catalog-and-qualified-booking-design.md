# Service Catalogue and Qualified Booking Design

**Date:** 2026-08-10
**Status:** Approved for implementation

## Objective

Make Daymark service-first so a company can publish a catalogue of bookable products or services, preselect the relevant service from a host web page, and show only employees who are currently qualified to perform it.

The first release supports two public entry modes:

1. **Full catalogue:** the client chooses an active service before choosing a qualified employee.
2. **Preselected service:** a direct link or embedded widget supplies a stable Daymark service identifier, skips the catalogue, and begins with the employees qualified for that service.

Payment-gated booking is deliberately deferred. Its proposed design is retained in this specification so the current data model does not block it later.

## Restore points

Before implementation, the tested `master` commit is pushed to GitHub and protected by the annotated tag `restore-2026-08-10-before-service-catalog`.

The local packaged runtime data is also copied while the runtime is stopped to:

`C:\Users\Lloyd\Files\Daymark-restore-points\2026-08-10-before-service-catalog\.daymark`

The snapshot is verified file by file against the source. The repository-local `.daymark/` directory remains untracked and must never be staged or committed.

## Reference model

Happy Smart Homes demonstrates why a brand, product URL, or broad employee role is insufficient. A technologist may be able to install cameras but not alarms, while products from the same brand can require different knowledge, equipment, duration, and setup work. Daymark therefore owns its service and qualification records instead of inferring them from a host URL.

Reference examples:

- [Ring Doorbell Installation](https://www.happysmarthomes.com/collections/smart-doorbell-installation-services/products/ring-doorbell-installation)
- [Eufy Alarm Installation](https://www.happysmarthomes.com/products/eufy-alarm-installation)

Each distinct bookable option is a Daymark service. A company may create broad options such as **Camera installation**, or granular variants such as **Eufy alarm installation — 4–6 sensors**. Daymark does not impose a product taxonomy; the company controls its names, categories, descriptions, and durations.

## Terminology

- **Service:** one public bookable item, product-install variant, consultation, or other unit of work.
- **Service slug:** a stable, workspace-scoped public identifier used by direct links and widgets.
- **Manual approval:** an administrator directly marks an employee as able to perform a service.
- **Certificate-backed approval:** an administrator records the certificate name, optional reference and issue date, and required expiry date for an employee-service pairing.
- **Qualified employee:** an active employee with a current active approval for an active service in the same workspace.
- **Entry mode:** either the full catalogue or one preselected service.

## Service catalogue data

Add a workspace-owned `services` table with:

- stable internal ID;
- workspace ID;
- immutable public slug unique inside the workspace;
- public name;
- category;
- public description;
- duration in minutes;
- active state;
- sort order; and
- created and updated timestamps.

Service duration is between 15 and 480 minutes in 15-minute increments. Availability rules continue to determine offered working windows, start cadence, and buffers. Slot calculation uses the selected service duration for the appointment end time and shows only starts for which the entire service fits in the working window.

Services are deactivated rather than deleted. This preserves existing direct links, qualification history, and appointment snapshots.

## Employee-service qualifications

Add a workspace-owned `employee_service_qualifications` table with one record per employee-service pair:

- stable internal ID;
- workspace ID;
- employee profile ID;
- service ID;
- approval method: `manual` or `certificate`;
- certificate name;
- optional certificate reference;
- optional issue date;
- certificate expiry date;
- active state; and
- created and updated timestamps.

Manual approval requires no certificate fields and remains current until an administrator removes it, the employee is deactivated, or the service is deactivated.

Certificate-backed approval requires a certificate name and a valid expiry date. The optional issue date and reference let a company retain useful evidence without exposing it publicly. The certificate is valid through the recorded expiry date in the workspace's Europe/London business timezone. It becomes ineligible automatically on the following date; the record remains visible to administrators as expired.

The two approval methods may coexist across a company's services and employees. An administrator can replace one method with the other for a given employee-service pair.

## Eligibility rule

An employee is publicly eligible only when all of the following are true at the time of the request:

1. the workspace is active;
2. the service belongs to that workspace and is active;
3. the employee belongs to that workspace and is active;
4. the employee-service qualification belongs to the same workspace and is active; and
5. the approval is manual, or its certificate has not expired.

This rule is evaluated when services are listed, when employees are listed, when slots are requested, and again when a booking is submitted. A stale browser cannot book an employee whose approval was removed or expired after the page loaded.

The full public catalogue includes only services with at least one currently eligible employee. A valid preselected service with no eligible employees displays a clear unavailable state instead of silently falling back to another service or the full catalogue.

No certificate name, reference, issue date, or expiry date is included in anonymous responses. Public responses reveal only the services offered and the employees currently available for the selected service.

## Public booking journey

The standard journey becomes:

`Service → qualified employee → date → time → client details → confirmation`

In preselected mode, the service is locked and the visible journey begins at the qualified-employee step. The selected service remains visible in the booking summary, duration label, details step, and confirmation.

The client cannot change a preselected service without leaving that entry point. In catalogue mode, Back from the employee step returns to the service catalogue.

The existing optional employee preselection remains supported:

- with the full catalogue, Daymark shows only services that employee is currently qualified to perform;
- with a preselected service, Daymark accepts the combination only if that employee is currently qualified for it; and
- invalid or cross-workspace combinations return a generic unavailable response.

The marketing demonstration remains non-transactional. It receives one fixed demonstration service so the existing person-first demonstration stays concise while exercising the service-aware booking contract.

## Direct links and embedded widgets

Daymark never parses the host page URL, product title, or path to decide which service is being booked.

The administrator's Embed area adds a **Booking journey** choice:

- **Show all services**; or
- **Preselect a service**, followed by a service selector.

The generated integration uses an explicit service slug:

```html
<script
  src="https://booking.example/daymark-widget.js"
  data-workspace="happy-smart-homes"
  data-service="ring-doorbell-installation"
  data-mode="inline"
  data-employee="all"
  data-label="Book an appointment"
></script>
```

Catalogue widgets use `data-service="all"`. The host script validates the value and passes it to the frame. Direct links use:

- catalogue: `/book/{workspaceSlug}`;
- preselected service: `/book/{workspaceSlug}?service={serviceSlug}`.

The service slug is public routing context, not proof of permission or payment. The server resolves it inside the workspace and applies the normal eligibility rules.

An invalid, inactive, or cross-workspace slug produces a generic unavailable/not-found response. It never falls back to the full catalogue because doing so could let a customer unknowingly book the wrong service.

If the host page is generated dynamically, its template may emit the administrator-selected Daymark service slug. If the website cannot supply any context, the administrator uses catalogue mode. No route inspection is required in either case.

## Administrator experience

Administrators receive a **Services** workspace section. Employees cannot open the section or its API.

The section provides:

- a create-service form for name, category, description, and duration;
- stable generated service slugs;
- editing of public service details without changing the slug;
- service activation and deactivation;
- one employee qualification row per service;
- manual or certificate-backed approval controls;
- certificate detail and expiry fields shown only for certificate-backed approval; and
- clear **Current**, **Expires soon**, **Expired**, **Not qualified**, and **Inactive** states.

Removing a qualification requires an explicit confirmed action. Deactivating a service requires confirmation and immediately removes it from public catalogue and preselected booking responses.

All administrator mutations use same-origin protection, authenticated workspace membership, administrator-role checks, workspace-scoped repository predicates, bounded text fields, strict date parsing, and no-store responses.

## Appointment persistence and schedule display

Appointments store both the service relationship and an immutable snapshot:

- nullable service ID for historical resilience;
- service name snapshot; and
- service duration snapshot.

The snapshot prevents later service renames or duration edits from rewriting historical bookings. Existing appointments are migrated to a **General appointment** snapshot.

The protected schedule shows the service name and actual duration. Public booking confirmation also includes the service name but continues to mask contact information.

Booking insertion must reject any newly overlapping booked appointment for the same workspace employee, not only an appointment with an identical start time. The final insert rechecks service eligibility and overlap atomically so variable-duration services do not weaken concurrency protection.

## Migration and backward compatibility

The migration:

1. creates the service and qualification tables with workspace-scoped foreign keys and indexes;
2. adds service relationship and snapshot fields to appointments;
3. creates one active **General appointment** service for every existing workspace;
4. manually qualifies every existing active employee for their workspace's General appointment service;
5. attaches existing appointments to the matching General appointment and backfills their snapshot; and
6. runs foreign-key and integrity checks.

Seed repair ensures the legacy example roster receives General appointment qualifications even when the profiles are created after migrations. Newly created workspaces receive the default General appointment service during initial setup.

The migration must be proven against a temporary copy or fresh database before it is applied to the packaged business data. The pre-change cold snapshot remains outside the repository as the rollback source.

## Privacy and security boundaries

- Every service and qualification query requires a server-derived workspace ID.
- A client-provided workspace, service, or employee identifier is never sufficient without a matching workspace-scoped row.
- Anonymous APIs exclude certificate and membership data.
- Protected schedule entries remain visible only under the existing administrator/own-employee rules.
- Qualification changes never expose another workspace's employees, services, or certifications.
- Unknown identifiers use generic responses that do not confirm foreign records.
- Public slot and booking responses remain no-store.
- `.daymark/`, database files, exports, logs, setup codes, and backup files are never staged or committed.

## Deferred payment design

Payment is not implemented in this release.

The retained future design connects Daymark to a merchant's existing checkout instead of accepting unverified browser flags:

1. map an external provider's stable product or variant ID to a Daymark service;
2. verify a signed paid-order webhook server-side;
3. create a booking entitlement containing the paid service, quantity, customer, order, and payment state;
4. expose **Book your installation** from the provider's post-checkout surface;
5. exchange authenticated order context for an opaque Daymark redemption token;
6. lock booking to the paid service and consume the entitlement on confirmation; and
7. revoke unused entitlements on cancellation or refund.

Shopify is the intended first adapter, followed by a provider-neutral interface for Stripe, WooCommerce, and others. Payment requires a stable continuously reachable HTTPS Daymark endpoint. No `paid=true`, price, service name, URL handle, or other client-controlled value will ever prove payment.

## Testing and verification

Automated tests must prove:

- service, qualification, and appointment snapshot schema constraints;
- migration creation, backfill, and foreign-key integrity;
- manual approvals make an employee eligible;
- current certificate-backed approvals make an employee eligible;
- expired, inactive, cross-workspace, and missing approvals do not;
- public APIs never return certificate details;
- the catalogue lists only active services with current eligible employees;
- preselected service slugs resolve only inside the requested workspace;
- service duration controls slot end times and working-window fit;
- booking submission revalidates service eligibility and rejects overlap;
- appointments retain service name and duration snapshots;
- employees cannot use administrator service APIs;
- administrator validation and same-origin mutation protection work;
- the booking UI supports both catalogue and fixed-service journeys;
- the widget emits, validates, forwards, and safely falls back with `data-service`;
- fixed employee and fixed service combinations are validated together; and
- the demonstration remains non-transactional.

Final verification includes the complete unit suite, lint, production build, rendered-route tests, temporary migration integration, packaged-runtime migration, and browser checks for:

1. catalogue service selection;
2. preselected direct link;
3. preselected widget;
4. qualified employee filtering;
5. an expired certificate disappearing from public eligibility; and
6. no console or network errors.

## Out of scope

- Taking or refunding payments.
- Shopify, Stripe, WooCommerce, or other commerce-provider connections.
- Inferring a service from a URL, page title, DOM text, or product handle.
- Uploading certificate documents.
- Third-party certificate verification.
- Qualification requirements shared across multiple services as a separate capability taxonomy.
- Pricing, tax, deposits, quantities, or invoices.
- Multiple locations or travel-area matching.
- Publishing or deploying Daymark beyond the explicitly requested GitHub update.

## Acceptance criteria

The feature is complete when:

1. an administrator can create and manage active services;
2. an administrator can manually approve an employee or record a certificate-backed approval with expiry;
3. full-catalogue booking starts with service selection;
4. a generated direct link or widget can lock booking to one service without inspecting the host URL;
5. only currently qualified employees can expose slots or receive a booking for that service;
6. appointments use and retain the selected service's name and duration;
7. existing data migrates to General appointment without losing appointments or availability;
8. the tested packaged runtime supports both entry modes;
9. `.daymark/` remains untracked and uncommitted; and
10. all tested source changes are committed and pushed to GitHub without publishing a release.
