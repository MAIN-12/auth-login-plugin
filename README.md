# @main12/auth-login — hardened password/OTP/ownership candidate

This working branch contains **tickets 01–03**, a breaking base-auth/configuration change. It is not a claim that the complete hardening spec or the remaining tickets are finished, and is not ready for publication until the PR gates pass.

## Supported flow and explicit limits

- Password login delegates to Payload's real local login operation: existing passwords, hooks, verification, lockouts and field-read filtering remain authoritative. Native `collection.access.read` controls `/me`/CRUD, not whether valid credentials can log in; use rejecting login hooks for host login policy.
- Google remains unavailable; enabling it fails at startup. Signup is closed by default in the explicit configuration. Signup, recovery and managed password changes are available only through the ownership-proof flows below; legacy native forgot/reset/first-register and raw credential CRUD still deny access. Public account discovery stays removed.
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

Add `authPlugin` to `buildConfig({ plugins: [authPlugin], routes: { api: '/backend' }, ... })`. Configure `customers` with `auth: { useSessions: true, verify: true, removeTokenFromResponses: true, ... }`. Preserve collection access/hooks. Privileged account provisioning remains the consumer's responsibility; anonymous CRUD creation is denied by the plugin. Raw password/confirmPassword/hash/salt writes through native REST/GraphQL create/update are also disabled, even with a current cookie. Public writes to native session-authority fields (`sessions`, `_sid`, `_strategy`, `authLoginMethod`) are also denied to prevent session resurrection. Ordinary authorized profile updates such as email retain native behavior. Server maintenance must use an explicit Local API call, not an HTTP request forwarded with access overrides:

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

## Signup, recovery and password management

Enable `allowSignup: true` and/or `recovery: true` with `passwordLogin: true` and the same explicit `otp` server options above. Recovery works with `otpLogin: false`; enabling recovery never enables OTP application login. Google remains disabled. Public registration needs a frontend-only `access.admin: () => false` policy: creation rolls back if host defaults/hooks make the new account admin eligible. Native account creation is still denied anonymously, and arbitrary fields/roles are rejected by the managed signup contract. Consumer hooks can intentionally deny provisioning; unknown required consumer fields must be provisioned by an authorized host flow instead of accepting arbitrary public input.

No user, name, password or session is reserved during signup. Only a short-lived, purpose/browser-bound email challenge is stored. Another browser cannot replace a live challenge; its bounded TTL prevents an indefinite reservation. Verification issues an **opaque, AEAD-encrypted completion permit valid for ten minutes**, not an application token or cookie. Only then does the owner choose a password. Duplicate signup requests have the same accepted issuance contract; an existing account is never overwritten. Completing signup requires a fresh login.

Recovery issues the same limited ten-minute permit, bound to the original account, email, credential version and purpose. It only replaces an existing native hash/salt: passwordless/unknown credentials are not inferred from public fields and do not gain a password through recovery. Requesting or verifying recovery does not revoke sessions. Confirming a valid password changes the native credential, establishes email verification from that ownership proof, revokes **all** sessions and invalidates all outstanding credential-version-bound permits/OTP proofs in one native transaction. No automatic login occurs. Existing unknown-verification password accounts can use this explicit ownership reset; other unknown-verification accounts require an authorized verification process. Lost legacy passwords are not reconstructible.

Voluntary change or explicit password addition requires an authenticated current session and a five-minute reauthentication permit bound to that SID/account. Password reauthentication runs native Payload permission, password, lockout and login hooks. An unforgeable request-local capability suppresses the new native SID, so even a token observed by login hooks cannot authenticate; no new session/token/cookie is returned. An OTP-enabled account can instead prove email ownership with purpose `reauth`, including a passwordless account adding its first password while password login is enabled. The proof never enables a disabled method. Confirmation revokes all other sessions and replaces the current SID, preserving its original `createdAt` and absolute cap; refresh cannot turn the rotation into an unlimited extension. Hook errors roll back credential/session/permit consumption together; the owner can retry the unconsumed, still-current permit.

| Managed HTTP surface | Bounded JSON / result |
|---|---|
| `POST /backend/access/otp/send` | `{ email, purpose: 'signup' \| 'recovery' \| 'reauth', context? }`; generic accepted issuance contract |
| `POST /backend/access/otp/verify` | `{ email, purpose, context, otp }`; `{ success: true, permit, expiresAt }`, never a login cookie/token |
| `POST /backend/access/forgot-password` | `{ email, context? }`; convenience alias for recovery issuance |
| `POST /backend/access/signup` | `{ permit, password }`; commit the verified owner's account, no session |
| `POST /backend/access/reset-password` | `{ permit, password }`; atomic credential/reset/revoke-all, then fresh login |
| `POST /backend/access/reauthenticate` | `{ password }` plus authenticated native cookie; five-minute limited permit |
| `POST /backend/access/set-password` | `{ permit, password }` plus the exact authenticated SID; capped rotated cookie/token honoring `removeTokenFromResponses` |

Every permit is one use via a durable nonce-consumption record committed with the credential, so deleting an account cannot make signup permits reusable. Extra account/email/role fields cannot retarget a permit. The public UI completes signup/recovery through email → verify → set password → login. The existing `set-password` form offers password or enabled-email reauthentication for voluntary change/addition. Its per-tab `sessionStorage` continuation is scoped by API/endpoint/collection, cleared on success/expiry, and never put in a URL; it is not session authority or protection against XSS. Closing the tab/restarting the flow is safe. A mounted permit expires back to its purpose-specific signup/recovery start or reauthentication screen; authoritative `AUTH_FAILED` clears the invalid continuation. Transient `AUTH_UNAVAILABLE` and correctable `INVALID_INPUT` keep the still-valid proof for retry. Legacy `onSignup` callbacks are retained as deprecated prop types but no longer create accounts: the managed form uses the configured ownership API directly.

New passwords require **15 Unicode characters**, allow phrases/Unicode/paste without composition rules, and use the same client/server rule. Legacy password login is not revalidated against this new rule. A versioned, exact-match local SecLists common/compromised-derived 100,000-password corpus is included with its MIT notice; this is not exhaustive breach screening. Provenance, hashes, limitations and deterministic update/rollback checks live in `tests/evidence/issue03-blocklist.md`. Updating it changes new-password policy only, never invalidates stored legacy credentials.

Private tables `auth_login_credential_locks` and `auth_login_password_permits` have no Payload CRUD surface. All instances must share the supported native SQLite/PostgreSQL database and secrets. Preserve these and `auth_login_otp_security` through schema push/migrations: Payload does not manage their schema and may propose deleting them. Do not accept that deletion. Consumption records can be deleted only after their `expires_at` millisecond deadline; live records must survive rollback/restore or permits could replay. Email lock rows are keyed, not email plaintext, and currently have no automatic cleanup: quiesce all instances before maintenance. OTP/security state retention and table growth remain consumer operator responsibilities. Security-key rotation invalidates old proofs; restoring an old key/state snapshot must not revive revoked credentials/sessions/permits.

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
3. Establish trustworthy email-verification evidence through your existing authorized process; unknown/unverified accounts remain denied. The ownership-proof signup/reset flows below establish verification only after email control is proved; legacy unknown accounts are not marked verified automatically. Passwords destroyed by legacy OTP cannot be reconstructed.
4. During the announced security cutover, revoke all legacy native sessions and delete legacy OTP challenges through an authorized maintenance process. Do not delete accounts or change passwords. The complete migration/rollback rehearsal belongs to ticket 06; this ticket provides the session/auth base only.
5. A rollback must retain the revocations and disabled unsafe flows. Do **not** restore revoked sessions/codes or silently redeploy legacy OTP password substitution. Restore availability through the last security-equivalent artifact or keep access disabled; restoring a database backup must not restore security artifacts as valid.

The package version is intentionally not a release promise on this branch. Publish only as a major change after review and the remaining applicable acceptance gates.

## Maintainer boundaries and evidence

- `src/config.ts`: pure instance/public contract, no React/Next/Payload imports.
- `src/auth/domain/login.ts`: input/method policy and login use case with explicit authentication dependency, no transport/framework imports.
- `src/endpoints/authEndpoints.ts` and `passwordEndpoints.ts`: HTTP translation and Payload-bound adapter composition; `authSchemas.ts` declares strict Zod interfaces without duplicating authorization policy.
- `src/auth/application/ownershipVerification.ts`: purpose-specific account eligibility with explicit native account/evidence/principal/grant dependencies; no transport or Payload imports.
- `src/auth/domain/proofBinding.ts`: shared named proof-reference codec; quotas preserve durable account identity rather than positional serialization.
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
