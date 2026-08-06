# Daymark Company Workspaces and Distribution Design

**Date:** 2026-08-06  
**Status:** Approved design awaiting written-spec review

## Objective

Make Daymark safe for multiple companies while supporting both embedded widgets and dedicated external booking pages. Replace the homepage's direct live-booking entry with a deployment-choice page for a private self-hosted release and a future managed Daymark service.

This design keeps the current homepage demonstration non-transactional, keeps clients anonymous, and makes company boundaries explicit in every public and staff workflow.

## Delivery stages

The work is divided into four ordered stages:

1. Company data isolation and approved multi-company staff memberships.
2. Company-specific external booking and widget routes.
3. The Get Daymark deployment-choice page.
4. A private GitHub repository for the self-hosted release.

The company-isolation foundation must be completed before the new booking routes or distribution link are treated as functional.

## Terminology

- **Workspace:** the internal record representing one customer company.
- **Company slug:** the unique, human-readable portion of a company booking URL, such as `cedar-house`.
- **Account:** a person's global Daymark sign-in identity.
- **Membership:** an administrator-approved relationship between an account and a workspace.
- **Self-hosted:** Daymark installed on infrastructure controlled by the customer.
- **Daymark Hosted:** the future managed Daymark service operated by the product owner.

## Company workspace model

Add a durable workspace record with a stable internal ID, company name, unique slug, active state, and timestamps. Company slugs are lowercase, URL-safe, and unique across one Daymark installation. Reserved route names cannot be selected.

Every company-owned record must be scoped to a workspace. This includes memberships, employee profiles, invitations, availability, blocked periods, appointments, and any future company settings. Queries must derive or require the workspace scope server-side rather than trusting a client-supplied company ID.

The first-time setup flow asks for the company name and preferred company slug. It creates the initial workspace and grants the first administrator membership in one atomic operation. Duplicate or invalid slugs are rejected with a clear inline error.

A self-hosted installation normally begins with one workspace. The same data model supports multiple workspaces so the future hosted service can run the same application code without weakening isolation.

### Existing data migration

Existing single-company data is assigned to one initial workspace during migration. The migration preserves staff accounts, employee profiles, availability rules, appointments, invitation state, and authentication sessions where safe. It adds required workspace references only after the legacy rows have been attached to the initial workspace.

The local development dataset uses a stable demonstration workspace slug. Production first-time setup collects the real company name and slug rather than exposing a fabricated customer identity.

## Accounts, memberships, and staff privacy

An account identifies a person globally by their sign-in credentials. A membership grants that account a role inside one workspace. The same account may hold approved memberships in multiple workspaces.

Membership is invitation-only:

- A company administrator may invite an email address as an employee or administrator.
- A visitor cannot self-join a workspace.
- Accepting an invitation creates or attaches the approved workspace membership.
- Administrators may revoke only memberships in their own workspace.

Multi-company membership is private to the individual:

- Administrators see only the person's membership, profile, and role in the administrator's current workspace.
- Admin pages and APIs never expose other workspace names, other roles, or a total membership count.
- Invitation responses remain neutral whether the email already belongs to a Daymark account or not.
- Only the signed-in person's private workspace chooser lists all workspaces they can access.
- Audit and activity information remains workspace-scoped.

### Staff route behaviour

Company staff routes use the company slug, for example `/workspace/cedar-house`.

- A signed-out visitor is sent to Cedar House's company-specific sign-in page with a safe same-origin return destination.
- A signed-in account without Cedar House membership is denied access and offered a way to sign in with a different account.
- A signed-in account with Cedar House membership enters that workspace with the permissions of its Cedar House role.
- A generic staff sign-in may show the signed-in person's private workspace chooser when more than one membership exists.

Authentication establishes identity; every protected request performs a separate server-side workspace-membership authorization check.

## Client booking surfaces

Clients do not need an account. Both booking surfaces use the same workspace slug and the same scoped booking service.

### Dedicated external booking page

Each company receives a shareable booking address such as:

`/book/cedar-house`

The page loads only Cedar House's public employee profiles and available slots. It uses Cedar House's slug for all subsequent slot and booking requests.

Plain `/book` does not load a default company's data. It explains that a company-specific booking link is required. This prevents an omitted slug from silently selecting the wrong company.

### Embedded widgets

Both floating and inline widgets require the same workspace slug. The embed configuration includes the slug explicitly and may also include an employee ID. The embed validates that any requested employee belongs to the selected workspace before returning public information.

The staff workspace includes a company-scoped area for copying:

- the dedicated external booking link;
- the floating widget snippet; and
- the inline widget snippet.

### Public API scoping

Public employees, slots, and booking endpoints include the company slug in their route or an equally mandatory route-level scope. They never fall back to a global employee list.

The server resolves the slug to an active workspace ID, then performs all repository operations within that workspace. A submitted employee ID must belong to the resolved workspace. Unknown or inactive slugs, foreign employee IDs, and cross-workspace appointment attempts return generic not-found or unavailable responses without revealing whether the foreign record exists.

## Get Daymark page

The homepage's **Start real booking** action opens `/get-daymark`. The existing homepage demonstration remains unchanged, and company-specific booking links remain separate from the marketing entry point.

The page headline is **Choose how Daymark runs.** It uses Daymark's paper texture, coloured file-tab shapes, editorial typography, and restrained motion rather than generic pricing cards.

### Self-hosted

Label: **Self-hosted**  
Description: **Run Daymark on infrastructure you control.**  
Action: **View private repository**

The page states that GitHub access is invitation-only while the repository is private. The action opens the real GitHub repository. When the repository becomes public later, the same destination can remain in place and the invitation note can be removed.

### Daymark Hosted

Label: **Daymark Hosted**  
Description: **A managed Daymark service, maintained for you.**  
Status: **Coming soon**

The early-access message reads: **Interested in early access or joining the trial programme?** The disabled action reads **Enquiries opening soon**. It does not collect contact details or imply that an enquiry channel exists before a Daymark domain and contact system are ready.

## Private GitHub distribution

Create a private GitHub repository for the self-hosted release under the user's authenticated GitHub account. Before any push:

- review tracked and untracked files for credentials, setup codes, local databases, runtime state, logs, temporary assets, and generated secrets;
- ensure local-only and secret-bearing files are excluded;
- retain the existing local repository history and backup protections;
- add self-hosted installation, configuration, upgrade, backup, and security guidance; and
- verify the application builds from a fresh checkout using documented prerequisites.

Repository creation and the initial private push are external actions and require confirmation at action time. No public repository, domain, hosted deployment, or enquiry service is created as part of this scope.

## Error handling and safe defaults

- Unknown, inactive, or malformed company slugs reveal no company or employee data.
- Missing workspace scope never falls back to a default company.
- Cross-workspace identifiers are handled as unavailable rather than confirming that another company's record exists.
- Invalid or reserved slugs receive a clear setup error without partial workspace creation.
- Duplicate invitations and invitations for existing accounts return neutral company-scoped results.
- Unauthorized staff access does not reveal whether the account belongs to other companies.
- Widget configuration errors show a safe, non-transactional message and do not load another workspace.
- Migration failure leaves the previous schema and records recoverable rather than partially scoped.

## Testing and verification

Automated tests must prove:

- Company A cannot list, inspect, or book Company B's employees or slots.
- A Company A administrator cannot discover an employee's Company B membership or role.
- An account cannot join a workspace without an approved invitation.
- The same account can enter multiple approved workspaces through its private chooser.
- Company-specific staff links enforce membership even when another workspace session is active.
- Unknown and inactive company links disclose no public employee data.
- Widget and external booking routes resolve the same workspace and employee scope.
- Plain `/book` does not select a company.
- Existing single-company records survive the workspace migration.
- First-time setup creates the workspace and first administrator atomically.
- The Get Daymark page exposes the approved self-hosted and coming-soon choices without a false enquiry action.

Verification includes the full unit suite, schema and migration checks, linting, a production build, rendered-route checks, and focused browser checks for the new public and protected flows.

## Out of scope

- Publishing the GitHub repository publicly.
- Registering or configuring a Daymark domain.
- Launching Daymark Hosted.
- Building an enquiry backend or collecting trial applications.
- Customer billing or subscriptions.
- Custom customer domains.
- Allowing public self-registration into company workspaces.

## Acceptance criteria

The design is complete when:

- company data is durably and consistently workspace-scoped;
- approved accounts may belong to multiple workspaces without exposing that fact to company administrators;
- staff routes authorize against the company named in the URL;
- both widgets and dedicated external booking pages use a mandatory company slug;
- `/book` cannot accidentally show the wrong company;
- the homepage setup action opens the approved Get Daymark page;
- the self-hosted option can point to a reviewed private repository; and
- the hosted option honestly remains a non-functional coming-soon invitation.
