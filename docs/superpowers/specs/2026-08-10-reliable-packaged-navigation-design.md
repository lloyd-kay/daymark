# Reliable Packaged Navigation Design

## Problem

Daymark's packaged local runtime renders pages correctly, but clicking a `next/link` navigation element fails inside Vinext's generated client router. The browser reports `TypeError: e is not a function` from the generated link chunk, and the URL does not change. The destination route itself returns HTTP 200 when requested directly.

## Decision

Replace Daymark's app-wide `next/link` components with ordinary HTML anchor elements. Full-page navigation is appropriate for this local, server-rendered application and avoids the failing Vinext client-router path while retaining standard browser behavior.

## Scope

- Convert every `next/link` import and `<Link>` use under `app/` to an equivalent `<a>` element.
- Preserve existing destinations, CSS classes, labels, icons, accessibility text, and dynamic workspace URLs.
- Do not change buttons, forms, booking behavior, authentication, database state, or visual styling.
- Do not modify or commit `.daymark/` runtime data.
- Do not upgrade Vinext as part of this fix.

## Navigation Behavior

Internal route changes will use normal browser document navigation. Hash links already implemented as anchors remain unchanged. Dynamic workspace links will continue to use their existing validated route strings.

## Error Handling

No new client-side error handling is required. If a destination is unavailable, the browser will display the server's normal response instead of failing silently in the client router.

## Testing

- Add a source regression test that fails when `next/link` imports or `<Link>` components remain under `app/`.
- Keep the existing rendered-page assertions for `/`, `/get-daymark`, booking routes, and sign-in routes.
- Run the complete production build and unit suite.
- Restart the packaged local runtime and verify that clicking the hero **Get Daymark** link reaches `/get-daymark` without console errors.

## Success Criteria

1. The homepage **Get Daymark** button navigates to `/get-daymark` in the packaged runtime.
2. All other app navigation links remain visually and semantically unchanged.
3. No `next/link` dependency remains in `app/`.
4. Existing tests, the new regression test, and the production build pass.
5. Local Daymark business data remains untouched.
