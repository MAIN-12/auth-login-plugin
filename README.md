# @main12/auth-login — hardened password/OTP-login candidate

This working branch contains **tickets 01–02**, a breaking base-auth/configuration change. It is not a claim that the complete hardening spec or the remaining tickets are finished, and is not ready for publication until the PR gates pass.

## Supported flow and explicit limits

- Password login delegates to Payload's real local login operation: existing passwords, hooks, verification, lockouts and field-read filtering remain authoritative. Native `collection.access.read` controls `/me`/CRUD, not whether valid credentials can log in; use rejecting login hooks for host login policy.
- **Google, signup, recovery and password changes are temporarily unavailable.** Enabling one fails at startup; legacy endpoints and native forgot/reset/first-register routes deny access. Public account discovery is removed.
- The target collection requires explicit `auth.useSessions: true`, `auth.verify: true`, email local strategy, and no API keys/custom authentication strategies. A verified account must have trustworthy `_verified: true` evidence. Do not mark legacy accounts verified by default.
- Initial JWT lifetime is `min(auth.tokenExpiration, session.maxAge)`. `maxAge` defaults to 7200 **seconds**. Refresh cannot exceed `session.createdAt + lifetime`; it cannot lengthen a smaller host token lifetime. Logout revokes the native server session.
- Host CORS, CSRF and cookie settings remain effective. `removeTokenFromResponses` is honored by login/refresh. The proxy only canonicalizes paths; a cookie is never proof of authentication.
- Demonstrated stack is Node 22, Payload 3.90.2, Next 16.3.6, React 19.2.6, SQLite and Chromium. Node 24 is not certified by this change. OTP adapters are restricted to Payload SQLite and PostgreSQL; acceptance commands and outcomes are recorded in `tests/evidence/issue02.md`. The package's engine range is Node 22 only.

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

Add `authPlugin` to `buildConfig({ plugins: [authPlugin], routes: { api: '/backend' }, ... })`. Configure `customers` with `auth: { useSessions: true, verify: true, removeTokenFromResponses: true, ... }`. Preserve collection access/hooks. Privileged account provisioning remains the consumer's responsibility; anonymous CRUD creation is denied by the plugin. Until ticket03 implements recent reauthentication, password/confirmPassword/hash/salt writes through native REST/GraphQL create/update are also disabled, even with a current cookie. Public writes to native session-authority fields (`sessions`, `_sid`, `_strategy`, `authLoginMethod`) are also denied to prevent session resurrection. Ordinary authorized profile updates such as email retain native behavior. Server maintenance must use an explicit Local API call, not an HTTP request forwarded with access overrides:

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

## Enable secure OTP (server only)

Password and OTP can coexist, or OTP can be the sole enabled login method. Existing passwords are never replaced. Configure a dedicated random key (at least 32 characters) shared by every instance, explicit sender/locale, and a trusted host-side peer resolver:

```ts
otpLogin: true,
otp: {
  secret: consumerSecrets.otpKey,
  origin: req => trustedPeerFromHost(req),
  email: { from: 'auth@example.com', locale: 'es', projectName: 'Your project' },
  // Defaults: ttlSeconds: 300, maxAttempts: 3, cooldownSeconds: 60,
  // accountLimit: 5 per sliding hour, originLimit: 50 requests per sliding hour.
},
```

OTP does not grant Payload admin access: its session adapter denies users for whom the native `access.admin` policy allows access. Frontend-only collections should explicitly use `access: { admin: () => false }`. For consumer server login hooks, `isOtpSessionRequest(req)` is unforgeable request-local evidence during OTP login; it is not a later-session policy. Signed method evidence survives capped refresh, and every subsequent native authentication re-evaluates OTP admin eligibility failclosed. Password admin policy is unchanged; full R20 admin integration belongs to its later issue.

`trustedPeerFromHost` is consumer server code, not an HTTP header lookup. Obtain the actual connection peer from your server integration; use forwarded IPs only after checking that peer against your explicit trusted-proxy configuration. Return `null` when trust cannot be established: issuance fails closed. Never use user-controlled `x-forwarded-for` directly. The plugin cannot infer a socket address from a Fetch request.

Mail uses the current Payload instance's email adapter. Optional `logoUrl`/`contactUrl` require HTTPS; branding is escaped, the code never appears in subject/preheader, and supported locales are `es`/`en`. Public config excludes all server options. Logs contain event names and keyed correlations, never email/code/token or authentication bodies; the consumer owns log retention/access.

For Next consumers bundling/transpiling this plugin, include `@libsql/client` in `serverExternalPackages` and install `@libsql/client@0.14.0` directly in the consuming app; this avoids webpack parsing libsql native-package assets. See the packed consumer fixture.

The adapter creates a private SQL table `auth_login_otp_security` lazily. Its records use AEAD, keyed OTP verification and domain-separated keys, protecting the six-digit space from offline guessing without server keys. It is not a Payload collection and has no REST/GraphQL CRUD surface. Challenges/verifiers bind the original durable account ID and target collection; reassigned emails cannot transfer authorization. Account quotas follow that durable ID across email changes, scoped to the target collection; origin quotas remain shared across collections. All instances must share Payload/OTP secrets and the database. SQLite requires working write transactions; PostgreSQL requires the native pool. Unsupported adapters or failed atomic storage deny access.

Resend reuses the original code, context, expiry and remaining attempts. Another browser cannot replace a live challenge; it must retain its initial context or wait until expiry. Native session writes apply snapshot additions/deletions under fresh locks, never a naive union. Logout-all revokes every observed preexisting session; an overlapping newly authorized login can legally linearize after logout and survive. Mail reservations commit before delivery: a crash or SMTP failure can lose a send, but cannot reset budgets. Automatic mail retry is deliberately disabled; one resend is allowed after cooldown. Verification consumes proof before native session creation: a denying hook/session failure burns the proof, so request a new challenge after cooldown instead of replaying it. This is at-most-once authorization, not exactly-once delivery.

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
| `POST /backend/access/otp/send` | `{ email, purpose: 'login', context? }`; accepted response `{ success: true, code: 'OTP_REQUEST_ACCEPTED', context, retryAfter }` |
| `POST /backend/access/otp/verify` | `{ email, purpose: 'login', context, otp }`; native session/cookie, no password changes |
| `POST /backend/access/check-email` | `403 METHOD_DISABLED`; never account discovery |
| Disabled method endpoints | `403 METHOD_DISABLED`; no credential/email effects |

Failures use `{ success: false, code }` with `INVALID_INPUT`, `AUTH_FAILED`, `METHOD_DISABLED`, `UNAUTHENTICATED`, `AUTH_UNAVAILABLE` or `ORIGIN_DENIED`. Password login uses one generic response for an unknown account, wrong password, locked or unverified account; it never publishes internal exceptions. Requests are limited to 4096 body bytes, 254 email characters and 1024 password characters; the latter is an input bound, **not** a new legacy-password complexity rule. Login accepts no unrelated properties.

OTP issuance's accepted response is identical for unknown, limited and failed-mail accounts and **does not confirm delivery**. `context` is an opaque 64-hex challenge binding; alone it cannot authenticate. Preserve it for verification/resend. The UI displays `retryAfter` but direct HTTP is governed by shared storage. Wrong purpose/extra fields are invalid; failed verification is generic. Six digits expire at the original deadline. Infrastructure timing is not promised indistinguishable.

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
pnpm test:otp:acceptance          # packed PostgreSQL/two-process/browser OTP acceptance
pnpm test:consumer                # packs, installs a fresh Next consumer, real browser + SQLite
```

The consumer harness cleans its own temporary directory. It is not a mock auth server. Node 24 and full ES/EN mobile/accessibility certification remain outside this ticket; unit mocks are not evidence for those claims. TypeScript lint uses an explicitly TS6-compatible parser instead of an unrelated vendor repository's formatting config. Existing non-critical `any`/dormant UI warnings are reported, not hidden.
