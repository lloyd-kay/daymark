# Daymark Private Team Calendar — Design Specification

## Summary

Daymark is a privacy-first scheduling website for a small team. Employees sign in to manage only their own calendar and availability. Administrators can view and manage the whole team. Clients use a public booking flow to choose a specific employee and reserve one of that employee's available time slots without seeing calendar contents, busy periods, or other client information.

The first release will be a complete responsive web application with durable shared data, ChatGPT-backed employee and administrator sign-in, real-time conflict prevention, and automatic removal of appointment records more than 30 days old.

## Product goals

- Let clients book a specific employee in a few clear steps.
- Keep employee calendars private from other employees.
- Give administrators enough visibility to coordinate the full team.
- Reveal only discrete bookable slots to clients, never underlying calendar data.
- Keep the interface calm, distinctive, and immediately understandable.
- Retain appointment information only for the operationally useful 30-day window.

## Roles and permissions

### Client

- Does not sign in.
- Can view the public employee directory with names, roles, short biographies, and service specialties.
- Can view only an employee's available appointment slots.
- Cannot infer the reason a time is unavailable, view busy periods, or access any calendar or client details.
- Can create an appointment by providing a name, email address, and optional note.

### Employee

- Signs in to a private workspace with ChatGPT and enrols using a single-use team invitation code.
- Can view and edit only their own availability and appointment details.
- Can block time, create recurring weekly availability, and cancel their own appointments.
- Cannot view or query another employee's calendar, availability rules, blocked time, appointment counts, or client details.

### Administrator

- Signs in to the same private workspace with additional controls. The first administrator claims the site with a deployment-only setup code; later access is stored against that authenticated identity.
- Can view all employee calendars, availability, and appointment details.
- Can filter the team calendar by employee.
- Can invite, activate, and deactivate employee accounts.
- Can edit availability and appointments on behalf of employees.

Authorization is enforced on the server for every protected read and write; hidden interface controls are not treated as a security boundary.

## Information architecture

### Public booking experience

The public home page is the booking experience rather than a marketing landing page.

1. Choose a person from a compact employee roster.
2. Choose a date from a focused two-week strip.
3. Choose an exact available time.
4. Enter contact details and an optional note.
5. Review and confirm the booking.
6. See a clear confirmation with employee, date, time, and reference.

The public interface never renders a full free/busy calendar. It receives only the discrete slots that are safe to book.

### Employee workspace

- A personal week view focused on the current date.
- A concise "Today" column with the next appointment and remaining open time.
- Upcoming appointment cards with client details.
- An availability editor for weekly working patterns, appointment duration, buffer time, and one-off blocked periods.
- A past view limited to the previous 30 days.

### Administrator workspace

- A team week view with employee-specific colour markers.
- A roster filter that can show one employee or the entire team.
- Appointment detail access and schedule editing.
- Basic account management for employee access.
- No analytics or reporting in the first release.

## Visual direction

Daymark should feel like an editorial planning desk, not a generic SaaS calendar.

- Brand name: **Daymark**.
- Palette: warm parchment, deep ink blue, burnt coral, and small employee-specific accents in sage, lilac, ochre, and sky.
- Typography: expressive, oversized date numerals paired with a clean humanist interface face.
- Layout motif: a vertical "daymark" rail anchors the active date, while appointments sit like labelled paper tabs beside it.
- Calendar structure: generous whitespace, crisp rules, slightly offset card edges, and compact handwritten-style micro-labels used sparingly for warmth.
- Motion: a short sliding marker when changing dates and gentle slot selection feedback; no decorative animation that delays booking.
- Privacy cues: small lock labels and plain-language explanations appear where users may wonder what others can see.
- Icons come from the established icon library; the finished site will not use hand-authored SVG illustrations.

The interface remains familiar enough to scan quickly, but avoids the standard dense grid, generic left navigation, and blue-on-white dashboard appearance.

## Responsive behaviour

- Desktop uses a split planning-desk layout with the date rail, schedule, and contextual panel visible together.
- Tablet collapses secondary details into a slide-over panel.
- Mobile presents the booking steps sequentially and turns the private week view into a day-by-day agenda.
- All primary actions remain reachable without hover and meet comfortable touch-target sizes.

## Architecture and boundaries

The application will use the Sites starter's Vinext structure and Cloudflare-compatible server output.

### Public booking module

Owns employee discovery, safe slot retrieval, booking details, and confirmation. It depends only on server endpoints that return public employee fields and computed bookable slots.

### Authentication and session module

Uses the hosting platform's ChatGPT sign-in flow to identify employees. It owns administrator and employee enrolment, role checks, single-use invitation codes, sign-out links, and protected-route enforcement. Application code never stores passwords.

### Schedule module

Owns weekly availability rules, one-off blocked periods, appointment duration, buffer time, timezone conversion, and slot computation.

### Appointment module

Owns creation, cancellation, conflict protection, client details, and 30-day retention.

### Administration module

Owns team-wide calendar queries and employee account lifecycle operations. Its server queries require the administrator role.

### Data storage

Durable records will use the Sites-provided relational store. The minimum model comprises team memberships, employee profiles, single-use invitations, availability rules, blocked periods, and appointments. Authentication sessions are owned by the platform. Times are stored in UTC and displayed in Europe/London for the first release.

## Data and privacy rules

- Public slot responses contain employee identifier, start time, end time, and no calendar-entry metadata.
- Client names, email addresses, and notes are never included in availability responses.
- Appointment creation rechecks availability on the server immediately before saving.
- A database uniqueness rule prevents two active appointments from claiming the same employee and start time.
- Protected queries are scoped to the signed-in employee unless the session has the administrator role.
- Appointment and associated client data are hard-deleted 30 days after the appointment ends.
- Reads always exclude expired records. A lightweight cleanup runs during normal authenticated and booking activity so expired records are removed without depending on a separate scheduler.
- Deactivating an employee removes them from public booking but preserves appointments still inside the retention window for administrator handling.

## Booking data flow

1. The client selects an employee.
2. The server combines that employee's availability rules, blocked periods, buffers, and existing appointments to return safe slots.
3. The client submits a chosen slot and contact details.
4. The server validates the fields, recomputes availability, and atomically creates the appointment.
5. If another client has just claimed the slot, the client receives a friendly conflict message and refreshed alternatives.
6. A successful booking returns a non-sensitive confirmation reference and removes the slot from future results.

## Error handling

- Signed-out visitors to the workspace are returned to the platform sign-in flow with a safe same-origin return path.
- Authenticated people without a valid team membership see an enrolment screen that does not expose employee or appointment data.
- Booking conflicts preserve entered contact information locally while asking the client to select a new time.
- Empty availability states explain that no slots are open and offer another employee or later date.
- Network failures keep the current step and provide a retry action.
- Destructive actions such as cancellation and employee deactivation require confirmation.
- Server errors expose no private data or implementation details.

## Accessibility

- Every flow is usable by keyboard and touch.
- Date and slot controls use semantic buttons with complete accessible names.
- Focus order follows the visible booking sequence.
- Colour is never the only way employees, states, or appointments are identified.
- Status messages and booking errors are announced to assistive technology.
- Text and controls meet WCAG AA contrast targets, including employee accent colours.
- Reduced-motion preferences disable sliding transitions.

## Validation strategy

- Unit tests cover slot calculation, buffer handling, timezone boundaries, role authorization, and 30-day retention.
- Integration tests cover successful booking, simultaneous booking conflict, employee data isolation, administrator visibility, unauthorised identities, single-use invitations, and deactivated employees.
- A production build must complete successfully before publishing.
- The implementation will be checked for realistic empty, loading, success, and error states across desktop and mobile layouts.

## First-release scope

Included:

- Public employee-specific booking.
- Employee and administrator sign-in.
- Isolated employee calendars.
- Team-wide administrator visibility.
- Recurring availability and one-off blocked time.
- Booking, viewing, and cancellation.
- Durable data with 30-day appointment retention.
- Responsive and accessible layouts.

Not included:

- External Google or Outlook calendar synchronisation.
- Email or SMS notifications.
- Payments.
- Client accounts.
- Reporting and analytics.
- Multiple office timezones or locations.

These exclusions keep the first release focused on secure scheduling and booking while leaving clean module boundaries for later additions.
