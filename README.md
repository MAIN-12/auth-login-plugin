# @main12/auth-login — hardened password-login candidate

This working branch contains **ticket 01**, a breaking base-auth/configuration change. It is not a claim that the complete hardening spec or the remaining tickets are finished, and is not ready for publication until the PR gates pass.

## Supported flow and explicit limits

- Password login delegates to Payload's real local login operation: existing passwords, hooks, verification, lockouts and field-read filtering remain authoritative. Native `collection.access.read` controls `/me`/CRUD, not whether valid credentials can log in; use rejecting login hooks for host login policy.
- **OTP, Google, signup, recovery and password changes are temporarily unavailable.** Enabling one fails at startup; legacy endpoints and native forgot/reset/first-register routes deny access. Public account discovery is removed.
- The target collection requires explicit `auth.useSessions: true`, `auth.verify: true`, email local strategy, and no API keys/custom authentication strategies. A verified account must have trustworthy `_verified: true` evidence. Do not mark legacy accounts verified by default.
- Initial JWT lifetime is `min(auth.tokenExpiration, session.maxAge)`. `maxAge` defaults to 7200 **seconds**. Refresh cannot exceed `session.createdAt + lifetime`; it cannot lengthen a smaller host token lifetime. Logout revokes the native server session.
- Host CORS, CSRF and cookie settings remain effective. `removeTokenFromResponses` is honored by login/refresh. The proxy only canonicalizes paths; a cookie is never proof of authentication.
- Demonstrated stack is Node 22, Payload 3.90.2, Next 16.3.6, React 19.2.6, SQLite and Chromium. Node 24/PostgreSQL are not certified by this change. The package's engine range is Node 22 only.

## One configuration per application instance

```ts
// auth-plugin.ts — server-side composition root
import { authLoginPlugin } from '@main12/auth-login'

export const authPlugin = authLoginPlugin({
  collection: 'customers',
  apiPrefix: '/backend',             // must match Payload routes.api
  authEndpointPrefix: '/access',    // relative to the API prefix
  basePath: '/account',             // your AuthPages mount
  passwordLogin: true,
  otpLogin: false,
  providers: { google: false },
  allowSignup: false,
  recovery: false,
  session: { maxAge: 7200 },
  modalLogin: true,
  style: 'tailwind',
  logo: '/brand.svg',
})
```

Add `authPlugin` to `buildConfig({ plugins: [authPlugin], routes: { api: '/backend' }, ... })`. Configure `customers` with `auth: { useSessions: true, verify: true, removeTokenFromResponses: true, ... }`. Preserve collection access/hooks. Privileged account provisioning remains the consumer's responsibility; anonymous CRUD creation is denied by the plugin. Until ticket03 implements recent reauthentication, password/confirmPassword/hash/salt writes through native REST/GraphQL create/update are also disabled, even with a current cookie. Server maintenance must use an explicit Local API call, not an HTTP request forwarded with access overrides:

```ts
await payload.create({
  collection: 'customers',
  data: { email: 'owner@example.com', password: trustedPassword, _verified: verifiedEvidence },
  overrideAccess: true,
  context: { authLoginCredentialProvisioning: true },
  disableVerificationEmail: true,
})
```

This escape hatch requires all three: native `req.payloadAPI === 'local'`, `overrideAccess === true`, and the explicit server context marker. Omitting the marker, using `overrideAccess: false`, or forwarding a REST/GraphQL request remains denied. The marker is not a client grant and is never read from an Origin header. Credential maintenance, verification evidence and coordinated session revocation are the authorized server operator's responsibilities, not a public password-change flow.

The factory returns a callable Payload plugin and `authPlugin.publicConfig`: a frozen, scalar, serializable whitelist. No server secrets, verifier functions, OAuth credentials, global mutable defaults or environment-variable bridge are involved. Keep the factory in a server-only consumer module; pass only `publicConfig` to client components.

```tsx
// Server layout — explicit RSC bridge
import { AuthProvider } from '@main12/auth-login/rsc'
import { authPlugin } from './auth-plugin'

export default function Layout({ children }) {
  return <AuthProvider publicConfig={authPlugin.publicConfig}>{children}</AuthProvider>
}
```

The client export has the same explicit `publicConfig` prop. For standalone cards/forms use `<AuthConfigProvider publicConfig={...}>`; RSC `AuthCard` and `AuthPages` also require this prop. `AuthClientInit` is now an alias for this **tree provider**, not a render-time initializer. Presentation (`locale`, translations, React logo, style and attribution) remains scoped to provider/card overrides. React logo components belong on UI props, not serializable plugin configuration.

```ts
// proxy.ts — explicit configuration in separately bundled Next runtimes
import { createAuthProxy } from '@main12/auth-login/proxy'
export const proxy = createAuthProxy({ basePath: '/account', modalLogin: true })
export const config = { matcher: ['/login', '/signup'] }
```

## HTTP contract

With the example prefixes:

| Surface | Result |
|---|---|
| `POST /backend/access/login` | Bounded JSON `{ email, password }`; normalized email; Payload password login |
| `POST /backend/customers/login` | Same guarded implementation, not a bypass |
| `GET /backend/customers/me` | Authoritative current session via native Payload |
| `POST /backend/customers/refresh-token` | Native refresh with absolute expiry enforcement |
| `POST /backend/customers/logout` | Native server-session revocation |
| `GET /backend/access/credentials` | Authenticated self-only non-secret capabilities |
| `POST /backend/access/check-email` | `403 METHOD_DISABLED`; never account discovery |
| Disabled method endpoints | `403 METHOD_DISABLED`; no credential/email effects |

Failures use `{ success: false, code }` with `INVALID_INPUT`, `AUTH_FAILED`, `METHOD_DISABLED`, `UNAUTHENTICATED`, `AUTH_UNAVAILABLE` or `ORIGIN_DENIED`. Password login uses one generic response for an unknown account, wrong password, locked or unverified account; it never publishes internal exceptions. Requests are limited to 4096 body bytes, 254 email characters and 1024 password characters; the latter is an input bound, **not** a new legacy-password complexity rule. Login accepts no unrelated properties.

The credential adapter reads native hash/salt only within protected server storage for the authenticated account and reduces them to `available`, `unavailable` or `unknown`. Neither hashes nor existence/provider state is exposed anonymously. UI selection depends on enabled methods, never on an email lookup.

## Migration and rollback boundaries

1. Back up accounts, native sessions and OTP storage before deployment. Preserve hashes/salts and account identifiers.
2. Apply the explicit options and RSC/client/proxy props above. Remove `pluginConfig`, `initClientConfig`, `AUTH_LOGIN_*` and implicit Google environment detection. API/base paths must be configured explicitly across boundaries.
3. Establish trustworthy email-verification evidence through your existing authorized process; unknown/unverified accounts remain denied. This ticket does not implement signup verification or repair passwords destroyed by legacy OTP.
4. During the announced security cutover, revoke all legacy native sessions and delete legacy OTP challenges through an authorized maintenance process. Do not delete accounts or change passwords. The complete migration/rollback rehearsal belongs to ticket 06; this ticket provides the session/auth base only.
5. A rollback must retain the revocations and disabled unsafe flows. Do **not** restore revoked sessions/codes or silently redeploy legacy OTP password substitution. Restore availability through the last security-equivalent artifact or keep access disabled; restoring a database backup must not restore security artifacts as valid.

The package version is intentionally not a release promise on this branch. Publish only as a major change after review and the remaining applicable acceptance gates.

## Maintainer boundaries and evidence

- `src/config.ts`: pure instance/public contract, no React/Next/Payload imports.
- `src/auth/domain/login.ts`: input/method policy and login use case with explicit authentication dependency, no transport/framework imports.
- `src/endpoints/authEndpoints.ts`: HTTP validation, translation and Payload-bound adapter composition.
- `src/auth/server/sessionPolicy.ts` and `credentialEvidence.ts`: declared Payload-specific native storage/session seams; not a general portable authentication framework.
- `src/components/AuthConfigContext.tsx`: isolated per-tree client settings. Client entrypoint must not import the server session/credential adapters.
- `src/exports/client.ts`, `rsc.ts`, `src/proxy.ts`: consumer surfaces; do not infer settings from another bundle's globals.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint                         # src and tests, not a no-op
pnpm test:unit                    # includes real Payload/SQLite HTTP acceptance
pnpm build                        # cleans dist before generating JS/declarations/assets
pnpm exec playwright install chromium
pnpm test:consumer                # packs, installs a fresh Next consumer, real browser + SQLite
```

The consumer harness cleans its own temporary directory. It is not a mock auth server. Node 24/PostgreSQL/concurrent OTP and full ES/EN mobile/accessibility certification remain outside this ticket; unit mocks are not evidence for those claims. TypeScript lint uses an explicitly TS6-compatible parser instead of an unrelated vendor repository's formatting config. Existing non-critical `any`/dormant UI warnings are reported, not hidden.
