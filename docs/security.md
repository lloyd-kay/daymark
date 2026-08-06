# Daymark security notes

## Identity and company access

Staff identity is global, but company access is a separate invitation-only membership. A person may belong to several companies. Administrators see only membership details for their own company and are not told that another membership exists.

Booking pages, booking APIs, widgets, schedules, availability, blocks, profiles, and appointments are scoped by the resolved company ID. Anonymous requests never supply that internal ID. Unknown companies and foreign employee identifiers receive generic unavailable responses.

## Credentials and sessions

- Store `DAYMARK_SETUP_CODE` only in the runtime secret store.
- Use unique administrator passwords of at least 12 characters.
- Password verification uses a slow derived verifier; session tokens are stored as hashes.
- Sessions have idle and absolute expiries and are sent in secure, HTTP-only cookies.
- Removing access to one company must not reset a global password or revoke sessions for unrelated companies.
- Invitation codes are hashed, expire, match the invited email, and are single-use.

## Operational controls

Restrict D1, deployment, backup, and secret-store access to named operators. Encrypt backups, log administrative changes without client appointment content, patch dependencies, and monitor repeated authentication or booking failures. Do not place database files, `.env` files, Wrangler state, logs, backups, clipboard images, or private keys in the repository.

## Incident response

If credentials or setup material may be exposed:

1. Remove public access and preserve relevant logs.
2. Rotate the setup code and affected infrastructure credentials.
3. Revoke affected Daymark sessions.
4. Inspect company memberships and invitations for unauthorised changes.
5. Restore from a verified backup if integrity is uncertain.
6. Notify affected organisations according to applicable policy and law.
7. Record the cause, scope, response, and prevention work before reopening access.

Treat appointment addresses and contact methods as personal data. The application removes appointment records older than 30 days; backups and external logs need matching retention rules.
