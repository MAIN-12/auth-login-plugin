# Auth presentation boundary

Language, dictionaries, logos, attribution, and UI style are presentation concerns,
not authentication domain rules.

- `types.ts` describes presentation inputs.
- `resolvePresentation.ts` resolves precedence without React, IO, or global mutation.
- `clientDefaults.tsx` and `serverDefaults.tsx` adapt browser/request/plugin defaults.
- `AuthPresentationContext.tsx` adapts these values to React consumers, independently
  of the session provider, authentication use cases, navigation, and API calls.

`AuthProvider` composes presentation and session contexts. `AuthCard` creates a local
presentation scope and renders its branding. `AuthLayout` only arranges the page.
Server wrappers pass defaults through a fallback boundary rather than turning them
into explicit component props. This preserves component > provider > defaults
precedence across the React server/client boundary.
