# Daymark Private Team Calendar — Design Specification

Daymark is a privacy-first scheduling website for a small team. Employees sign in to manage only their own calendar and availability. Administrators can view and manage the whole team. Clients choose a specific employee and book one of that employee's available slots without seeing calendar contents, busy periods, or other client information.

## Core experience

- Clients choose an employee, date, and discrete bookable slot, then confirm with their contact details.
- Employees sign in with ChatGPT and see and manage only their own schedule, availability, and appointment details.
- Administrators can view all employee calendars, appointment details, and availability, and can manage employee accounts.
- Appointment and client data is deleted 30 days after the appointment ends.

## Distinctive visual direction

The site is called **Daymark** and feels like an editorial planning desk rather than a generic dashboard. It uses warm parchment, deep ink blue, burnt coral, and employee-specific accent colours. Oversized date numerals and a vertical daymark rail anchor the schedule, while appointments look like neatly labelled paper tabs. The interaction model remains familiar and accessible, but avoids the usual dense grid and blue-on-white SaaS styling.

## Main areas

### Public booking

Clients choose a person, select from a focused two-week date strip, pick an exact available time, enter contact details, review, and confirm. Public data contains only safe employee profile fields and bookable slots.

### Employee workspace

Employees get a personal week view, a focused Today column, upcoming appointment details, recurring availability controls, buffer settings, and one-off blocked time. They cannot view or query another employee's data.

### Administrator workspace

Administrators get a team week view, employee filters, full booking details, schedule editing, and employee account management.

## Privacy and reliability

- Server-side permission checks protect every private read and write.
- Team membership uses single-use invitation codes, while a deployment-only setup code enrols the first administrator.
- Availability responses never include calendar-entry or client metadata.
- Booking availability is rechecked immediately before saving.
- A uniqueness rule prevents double-booking.
- Times are stored in UTC and initially displayed in Europe/London.
- Expired records are excluded from every read and deleted during normal application activity.

## Quality bar

The final site will be responsive, keyboard and touch friendly, WCAG AA-conscious, and complete across loading, empty, conflict, success, and failure states. Automated checks will cover slot calculation, privacy boundaries, administrator access, conflicts, sessions, and data retention.

## First-release boundaries

The first release does not include external calendar syncing, email or SMS, payments, client accounts, analytics, or multiple locations. Those capabilities can be added later without compromising the privacy model.
