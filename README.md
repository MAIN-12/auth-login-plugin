# @main12/auth-login — hardened password/OTP/Google candidate

This working branch contains **the issues 01–06 hardening candidate**, a breaking authentication/configuration change. Publication remains gated on candidate-specific acceptance and the outstanding human accessibility checks; implementation is not a claim that the complete specification is accepted.

## Integration contracts and documentation authority

Read [the local plugin contracts and migration guide](docs/plugin-contracts.md) for configuration, shared card/page/modal workflows, explicit ES/EN locale, email branding, HTTP result contracts and verification scope. Existing `docs/README.md`, `docs/CONTEXT.md` and copied AOP guides describe another repository: they are **nonnormative reference here** and were preserved, not silently migrated or overwritten.

Automatic presentation acceptance uses `pnpm test:integration:acceptance`; manual screen-reader evidence remains a separate gate. No automatic pass certifies the host application.

## HeroUI theme inheritance

With `style: 'hero-ui'`, cards, forms, OTP fields, and modals inherit the host's
HeroUI light/dark/custom theme. Load HeroUI v3 styles in the host application and
place the auth components below its theme scope (`.dark`, `data-theme`, or custom
CSS variables). Modal portals stay inside that scope; no plugin-owned light mode
or primary color overrides are applied. Shared text, errors, and password-strength
indicators use HeroUI semantic tokens. Explicit caller classes still take precedence.
The `tailwind` adapter retains its standalone light palette; email colors remain
configured separately.

## Source organization

`src/components` contains only Atomic Design levels: `atoms`, `molecules`,
`organisms`, `templates`, and `pages`. Each visual component owns its folder,
including its neutral props and any `Hero.tsx` / `Tailwind.tsx` implementations.
`src/hoc/withAuthStyle/index.tsx` selects the configured style per instance;
HeroUI remains optional and lazy, and modal overrides retain their precedence.

Pure visual settings live in `src/configuration/authAppearance`; data contexts and
React settings hooks live in `src/contexts`, and tokens live in `src/theme`.
Authentication/session integration belongs to `src/auth/interface/react/providers`.
Server visual entries are `server.tsx` beside `AuthCard` and `AuthPages`; they are
not providers. `AuthLogo` and `VisualLoadingBoundary` are atoms; the loading
handshake stays in a data-only context, independent of `AuthCard`.
All dictionaries and locale utilities live in `src/i18n/{ui,email,locale}.ts`,
including overridable `common.close` modal copy. Email generation lives in
`src/auth/infrastructure/email`, outside the visual tree. Public package
entrypoints are unchanged; internal source paths are not supported API.

## Supported flow and explicit limits

- Password login delegates to Payload's real local login operation: existing passwords, hooks, verification, lockouts and field-read filtering remain authoritative. Native `collection.access.read` controls `/me`/CRUD, not whether valid credentials can log in; use rejecting login hooks for host login policy.
- Google uses browser-bound, single-use OIDC/PKCE with native Payload sessions. Explicit private configuration and provider callback registration are required. Signup is closed by default in the explicit configuration. Signup, recovery and managed password changes are available only through the ownership-proof flows below; legacy native forgot/reset/first-register and raw credential CRUD still deny access. Public account discovery stays removed.
- The target collection requires explicit `auth.useSessions: true`, `auth.verify: true`, email local strategy, and no API keys/custom authentication strategies. A verified account must have trustworthy `_verified: true` evidence. Do not mark legacy accounts verified by default.
- Initial JWT lifetime is `min(auth.tokenExpiration, session.maxAge)`. `maxAge` defaults to 7200 **seconds**. Refresh cannot exceed `session.createdAt + lifetime`; it cannot lengthen a smaller host token lifetime. Logout revokes the native server session.
- Host CORS, CSRF and cookie settings remain effective. `removeTokenFromResponses` is honored by login/refresh. The proxy only canonicalizes paths; a cookie is never proof of authentication.
- The [issue06 candidate evidence](tests/evidence/issue06.md) demonstrates Node 22.23.2 and 24.21.0 with Payload 3.90.2, Next 16.3.6, React 19.2.6 and Chromium: 22 packed acceptance runs cover SQLite (WAL/1,000 ms busy timeout) and PostgreSQL 17.8. This is the exact tested stack, not Linux/remote-CI execution or every peer-range combination. OTP adapters are restricted to Payload SQLite/PostgreSQL; other adapters are excluded. Runtime peers pin that target (Framer Motion 12.43.0 and optional HeroUI 3.2.2). Human screen-reader/device checks and live Google acceptance remain pending.

## One configuration per application instance

```ts
// auth-plugin.ts — server-side composition root
import { authLoginPlugin } from '@main12/auth-login'

export const authPlugin = authLoginPlugin({
  collection: 'customers',
  apiPrefix: '/backend', // must match Payload routes.api
  authEndpointPrefix: '/access', // relative to the API prefix
  basePath: '/account', // your AuthPages mount
  passwordLogin: true,
  otpLogin: false,
  providers: { google: false },
  allowSignup: false,
  recovery: false,
  session: { maxAge: 7200 },
  modalLogin: true,
  style: 'tailwind',
  locale: 'en',
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

Enable `allowSignup: true` and/or `recovery: true` with `passwordLogin: true` and the same explicit `otp` server options above. Recovery works with `otpLogin: false`; enabling recovery never enables OTP application login. Google-only accounts never gain a password through recovery. Public registration needs a frontend-only `access.admin: () => false` policy: creation rolls back if host defaults/hooks make the new account admin eligible. Native account creation is still denied anonymously, and arbitrary fields/roles are rejected by the managed signup contract. Consumer hooks can intentionally deny provisioning; unknown required consumer fields must be provisioned by an authorized host flow instead of accepting arbitrary public input.

No user, name, password or session is reserved during signup. Only a short-lived, purpose/browser-bound email challenge is stored. Another browser cannot replace a live challenge; its bounded TTL prevents an indefinite reservation. Verification issues an **opaque, AEAD-encrypted completion permit valid for ten minutes**, not an application token or cookie. Only then does the owner choose a password. Duplicate signup requests have the same accepted issuance contract; an existing account is never overwritten. Completing signup requires a fresh login.

Recovery issues the same limited ten-minute permit, bound to the original account, email, credential version and purpose. It only replaces an existing native hash/salt: passwordless/unknown credentials are not inferred from public fields and do not gain a password through recovery. Requesting or verifying recovery does not revoke sessions. Confirming a valid password changes the native credential, establishes email verification from that ownership proof, revokes **all** sessions and invalidates all outstanding credential-version-bound permits/OTP proofs in one native transaction. No automatic login occurs. Existing unknown-verification public accounts can use the verification-only flow below without replacing their password. Recovery is a separate explicit password replacement, not the required migration path. Lost legacy passwords are not reconstructible.

Voluntary change or explicit password addition requires an authenticated current session and a five-minute reauthentication permit bound to that SID/account. Password reauthentication runs native Payload permission, password, lockout and login hooks. An unforgeable request-local capability suppresses the new native SID, so even a token observed by login hooks cannot authenticate; no new session/token/cookie is returned. An OTP-enabled account can instead prove email ownership with purpose `reauth`, including a passwordless account adding its first password while password login is enabled. The proof never enables a disabled method. Confirmation revokes all other sessions and replaces the current SID, preserving its original `createdAt` and absolute cap; refresh cannot turn the rotation into an unlimited extension. Hook errors roll back credential/session/permit consumption together; the owner can retry the unconsumed, still-current permit.

| Managed HTTP surface                   | Bounded JSON / result                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `POST /backend/access/otp/send`        | `{ email, purpose: 'signup' \| 'recovery' \| 'reauth', context? }`; generic accepted issuance contract                   |
| `POST /backend/access/otp/verify`      | `{ email, purpose, context, otp }`; `{ success: true, permit, expiresAt }`, never a login cookie/token                   |
| `POST /backend/access/forgot-password` | `{ email, context? }`; convenience alias for recovery issuance                                                           |
| `POST /backend/access/signup`          | `{ permit, password }`; commit the verified owner's account, no session                                                  |
| `POST /backend/access/reset-password`  | `{ permit, password }`; atomic credential/reset/revoke-all, then fresh login                                             |
| `POST /backend/access/reauthenticate`  | `{ password }` plus authenticated native cookie; five-minute limited permit                                              |
| `POST /backend/access/set-password`    | `{ permit, password }` plus the exact authenticated SID; capped rotated cookie/token honoring `removeTokenFromResponses` |

Every permit is one use via a durable nonce-consumption record committed with the credential, so deleting an account cannot make signup permits reusable. Extra account/email/role fields cannot retarget a permit. The public UI completes signup/recovery through email → verify → set password → login. The existing `set-password` form offers password or enabled-email reauthentication for voluntary change/addition. Its per-tab `sessionStorage` continuation is scoped by API/endpoint/collection, cleared on success/expiry, and never put in a URL; it is not session authority or protection against XSS. Closing the tab/restarting the flow is safe. A mounted permit expires back to its purpose-specific signup/recovery start or reauthentication screen; authoritative `AUTH_FAILED` clears the invalid continuation. Transient `AUTH_UNAVAILABLE` and correctable `INVALID_INPUT` keep the still-valid proof for retry. Legacy `onSignup` callbacks are retained as deprecated prop types but no longer create accounts: the managed form uses the configured ownership API directly.

New passwords require **15 Unicode characters**, allow phrases/Unicode/paste without composition rules, and use the same client/server rule. Legacy password login is not revalidated against this new rule. A versioned, exact-match local SecLists common/compromised-derived 100,000-password corpus is included with its MIT notice; this is not exhaustive breach screening. Provenance, hashes, limitations and deterministic update/rollback checks live in `tests/evidence/issue03-blocklist.md`. Updating it changes new-password policy only, never invalidates stored legacy credentials.

Private tables `auth_login_credential_locks` and `auth_login_password_permits` have no Payload CRUD surface. All instances must share the supported native SQLite/PostgreSQL database and secrets. Preserve these and `auth_login_otp_security` through schema push/migrations: Payload does not manage their schema and may propose deleting them. Do not accept that deletion. Consumption records can be deleted only after their `expires_at` millisecond deadline; live records must survive rollback/restore or permits could replay. Email lock rows are keyed, not email plaintext, and currently have no automatic cleanup: quiesce all instances before maintenance. OTP/security state retention and table growth remain consumer operator responsibilities. Security-key rotation invalidates old proofs; restoring an old key/state snapshot must not revive revoked credentials/sessions/permits.

## Google and administrative authorization

Register exactly `<apiPrefix><authEndpointPrefix>/oauth/google/callback` with Google, then configure the server plugin (never its client props):

```ts
providers: { google: {
  enabled: true, clientId: 'server-client-id', clientSecret: 'server-secret',
  redirectURI: 'https://app.example.com/backend/access/oauth/google/callback',
} },
admin: {
  authorize: ({ req, evidence }) => req.user?.role === 'admin'
    && evidence.method !== 'otp', // add verified freshness/amr requirements here if needed
  collections: [{ slug: 'administrative-records', operations: ['read', 'create', 'update', 'delete'] }],
  globals: [{ slug: 'settings', operations: ['read', 'update'] }],
},
```

Admin defaults to denied without an explicit policy; email OTP alone is always denied. Enumerate **every administrative resource/operation**: selected native access callbacks compose the consumer callback, covering REST, GraphQL and Local API `overrideAccess:false`, not only the Admin UI. Unlisted resources keep their consumer access rules; ordinary self/service operations are not blanket-blocked. Policy exceptions or unverifiable requirements deny access. Trusted maintenance deliberately uses native Local API `overrideAccess:true`; do not forward untrusted HTTP inputs to that authority. Original `access.admin` remains an additional condition for both Admin entry and every enumerated native operation; false or exceptions deny even when the explicit policy authorizes. Configure non-privileged public account defaults/hooks: public provisioning evaluates a fresh private native storage row, not an `afterRead` presentation, and rolls back when that stored principal is admin-eligible.

`evidence` is request-local, bound to the native Payload instance, exact Headers object, exact authenticated principal object and verified identity/SID/collection. Native GraphQL request proxies preserve those object identities; fabricated Local API user copies do not. A server-only namespaced WeakMap registry survives independently evaluated Next REST/GraphQL bundles. It stores no global configuration/secrets and partitions records by the exact Payload instance, so consumers cannot borrow another instance's evidence. Evidence never comes from a client body, database method field or request context. Password login stamps signed `authenticatedAt`; Google exposes only signed provider `auth_time`/`amr` when present. Missing claims are **not** proof of freshness/MFA. `getAuthenticationEvidence(req)` is a server-only hook seam. Original consumer Admin-eligibility checks for OTP issuance and later native authentication remain enforced; the new default-deny wrapper cannot hide eligibility changes. Google and OTP share the proven native-session adapter; `isOtpSessionRequest(req)` still identifies only OTP.

| Google HTTP surface                    | Contract                                                                                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET .../oauth/google?returnTo=/local` | Start a ten-minute browser-bound correlation and redirect to Google                                                                                  |
| `GET .../oauth/google/callback`        | Consume once; validate state, S256, nonce, issuer/audience/time and RS256 signature before account effects; return native cookie and local 303       |
| `POST .../oauth/google/link`           | Authenticated current SID plus `{ permit, confirm: true, returnTo? }`; no implicit email linking                                                     |
| `GET .../oauth/google/reauthenticate`  | Authenticate the **already linked subject**, requiring signed `auth_time` within five minutes; JSON `{ success, permit, expiresAt }`, no new session |

For an explicit consumer account-settings action, use the client package's instance service:

```ts
const service = createAuthService(publicConfig)
const proof = await service.reauthenticateGoogle() // invoke from a user gesture; bounded popup
await service.completePassword(proof, ownerChosenPassword) // only when password method is enabled
// Or obtain a password/OTP reauth permit, then explicitly link:
await service.linkGoogle(reauthPermit, '/account#methods')
```

There is no new full account-settings UI: these actions compose with the consumer's own confirmed controls. Existing Google login buttons use the configured API/endpoint prefixes. Popup mode is validated and stored in the correlation; its callback has a nonce CSP, no-store/no-referrer, and sends the grant only to the configured callback origin. The client requires the exact returned popup and same-origin typed message; blocked/closed popups and a five-minute UI timeout reject. No permit appears in a URL or new storage. Direct reauthentication without popup mode retains the JSON contract. Parent and callback must share the configured public origin.

Linking accepts the same five-minute opaque reauthentication permit issued by password, enabled email OTP or linked Google. Its native SID/account/email/credential version must remain current; the shared durable nonce ledger makes link and password completion mutually one-use. Subject/account SQL uniqueness cannot overwrite conflicts; after conflict-tolerant insertion the transaction re-reads the authoritative owner, so a concurrent loser cannot report success. Provider email changes do not update local email or replace stable subject identity. Signup-closed consumers can log in existing linked accounts but never provision new ones. No matching email autolink occurs.

A verified cross-site link/reauth callback replaces Origin-CSRF proof **only after** durable browser correlation consumption and verified OIDC signature. The named native adapter clones headers for native `payload.auth`, retains the exact incoming token/cookie, then checks the original SID and live session/version under native locks. It does not mutate incoming headers or disable CSRF for other routes. This compatibility exception should retire when native Payload exposes a verified-OAuth authentication context. Google provisioning uses a discarded random bootstrap password only because Payload 3.90 native registration requires it; native hooks run and hash/salt are cleared in the same transaction before identity commit. Committed Google-only accounts have no password capability.

Only local returns are supported. Encoded authority/backslash/control variants are denied, while permitted query/hash remain unchanged. Proxy remains a path canonicalizer, never treats cookie presence as authentication and does not block login/reset for invalid or revoked cookies. Private server-only `customFetch` is a provider-transport test seam, not a client option or alternate issuer. Issuer is fixed to Google. The controlled OIDC acceptance server is not proof of live Google acceptance.

Private `auth_login_google_identities` and encrypted OAuth records in `auth_login_otp_security` must be preserved alongside native users/sessions and credential permit ledgers across deploy/rollback. Losing subject mappings must not be "repaired" by email autolink. Rejected callbacks log only a server-generated UUID request ID and a constant event; the matching `X-Auth-Request-ID` response header permits incident correlation without logging state, codes, cookies, tokens or provider errors. OAuth consumption tombstones must survive live correlation deadlines; operator-controlled retention applies as for OTP. Do not let schema push delete unmanaged security tables.

## HTTP contract

With the example prefixes:

| Surface                                 | Result                                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `POST /backend/access/login`            | Bounded JSON `{ email, password }`; normalized email; Payload password login                                                      |
| `POST /backend/customers/login`         | Same guarded implementation, not a bypass                                                                                         |
| `GET /backend/customers/me`             | Authoritative current session via native Payload                                                                                  |
| `POST /backend/customers/refresh-token` | Native refresh with absolute expiry enforcement                                                                                   |
| `POST /backend/customers/logout`        | Native server-session revocation                                                                                                  |
| `GET /backend/access/credentials`       | Authenticated self-only non-secret capabilities                                                                                   |
| `POST /backend/access/otp/send`         | `{ email, purpose: 'login', context? }`; accepted response `{ success: true, code: 'OTP_REQUEST_ACCEPTED', context, retryAfter }` |
| `POST /backend/access/otp/verify`       | `{ email, purpose: 'login', context, otp }`; native session/cookie, no password changes                                           |
| `POST /backend/access/check-email`      | `403 METHOD_DISABLED`; never account discovery                                                                                    |
| Disabled method endpoints               | `403 METHOD_DISABLED`; no credential/email effects                                                                                |

Failures use `{ success: false, code }` with `INVALID_INPUT`, `AUTH_FAILED`, `METHOD_DISABLED`, `UNAUTHENTICATED`, `AUTH_UNAVAILABLE` or `ORIGIN_DENIED`. Password login uses one generic response for an unknown account, wrong password, locked or unverified account; it never publishes internal exceptions. Requests are limited to 4096 body bytes, 254 email characters and 1024 password characters; the latter is an input bound, **not** a new legacy-password complexity rule. Login accepts no unrelated properties.

OTP issuance's accepted response is identical for unknown, limited and failed-mail accounts and **does not confirm delivery**. `context` is an opaque 64-hex challenge binding; alone it cannot authenticate. Preserve it for verification/resend. The UI displays `retryAfter` but direct HTTP is governed by shared storage. Wrong purpose/extra fields are invalid; failed verification is generic. Six digits expire at the original deadline. Infrastructure timing is not promised indistinguishable.

The credential adapter reads native hash/salt only within protected server storage for the authenticated account and reduces them to `available`, `unavailable` or `unknown`. Neither hashes nor existence/provider state is exposed anonymously. UI selection depends on enabled methods, never on an email lookup.

## Migration and rollback boundaries

1. Back up accounts, native sessions and OTP storage before deployment. Preserve hashes/salts and account identifiers.
2. Apply the explicit options and RSC/client/proxy props above. Remove `pluginConfig`, `initClientConfig`, `AUTH_LOGIN_*` and implicit Google environment detection. API/base paths must be configured explicitly across boundaries.
3. Establish trustworthy email-verification evidence without inventing it. Public accounts with unknown/false verification can prove control using `purpose: 'verify-email'` on OTP send/verify (see the guide). This sets verification only, preserving password and sessions and requiring a fresh login; administrative accounts need a trusted host verification process. Passwords destroyed by legacy OTP cannot be reconstructed.
4. During the announced security cutover, use root-exported `migrateAuthLogin` with all writers stopped, the target collection and an explicit legacy OTP collection/filter. It revokes native sessions/reset/verification tokens and advances scoped proof authority without deleting accounts, changing passwords, rotating global keys or rewriting Google mappings. Follow the coordinated cutover and rollback procedure in the guide; rerun it after a backup restore before resuming writers. Disposable-fixture rehearsal is not proof that production operators have executed it.
5. A rollback must retain the revocations and disabled unsafe flows. Do **not** restore revoked sessions/codes or silently redeploy legacy OTP password substitution. Restore availability through the last security-equivalent artifact or keep access disabled; restoring a database backup must not restore security artifacts as valid.

The package version is intentionally not a release promise on this branch. Publish only as a major change after review and the remaining applicable acceptance gates.

## Local formatting and Git hooks

Run `pnpm install --frozen-lockfile` to install dependencies and Git hooks through
`prepare`. If installation used `--ignore-scripts`, run `pnpm hooks:install` afterward.

- **Before commit:** validate a changed dependency manifest/lockfile, then run Prettier
  and ESLint `--fix` sequentially on staged files. Fixes are staged automatically;
  Lefthook temporarily hides unstaged edits in partially staged files. If those edits
  conflict with formatting, the commit stops: resolve the conflict before retrying.
- **Before push:** run `pnpm typecheck`. Database, packed-consumer and browser acceptance
  stay explicit commands below; hooks never generate Payload types or import maps.
- **Manual formatting:** `pnpm format:check` checks the repository;
  `pnpm format` rewrites it. Existing formatting debt is not migrated automatically.
  To keep a change focused, use `pnpm exec prettier --write path/to/file.ts`.

Generated files, lockfiles, captured evidence, scratch files and copied architecture
references are excluded in `.prettierignore`. ESLint keeps the existing `src`/`tests`
boundary. Lock validation uses frozen, lockfile-only mode without lifecycle scripts;
if it fails, run `pnpm install` and stage the updated manifest and lockfile together.

## Maintainer boundaries and evidence

- `src/config.ts`: pure instance/public contract, no React/Next/Payload imports. Server options are separate type-only modules; only `PublicAuthConfig` crosses client boundaries.
- `src/auth/application/googleFlow.ts` and `googleAccountPolicy.ts`: framework-free OAuth correlation and account-policy owners with explicit provider/storage/clock/account dependencies.
- `src/auth/server/googleAuthentication.ts`, `googleAccount.ts`, `googleProvider.ts`: declared Payload-integrated workflow/SQL/OIDC adapters; `src/endpoints/googleEndpoints.ts` validates/translates the HTTP interface.
- CLEAN collection-owner adaptation: this reusable plugin owns the configurable auth collection, not a fixed consumer `src/collections/Users`. Package `src/index.ts` is its explicit public seam; native-integrated session/credential/OAuth workflows are named exceptions where transaction/hooks require Payload. Retire these exceptions when Payload supplies equivalent public operations; a directory rewrite or consumer fixed-slug API would not preserve the plugin contract.
- `src/auth/domain/login.ts`: input/method policy and login use case with explicit authentication dependency, no transport/framework imports.
- `src/endpoints/authEndpoints.ts` and `passwordEndpoints.ts`: HTTP translation and Payload-bound adapter composition; `authSchemas.ts` declares strict Zod interfaces without duplicating authorization policy.
- `src/auth/application/ownershipVerification.ts`: purpose-specific account eligibility with explicit native account/evidence/principal/grant dependencies; no transport or Payload imports.
- `src/auth/domain/proofBinding.ts`: shared named proof-reference codec; quotas preserve durable account identity rather than positional serialization.
- `src/auth/server/sessionPolicy.ts` and `credentialEvidence.ts`: declared Payload-specific native storage/session seams; not a general portable authentication framework.
- `src/auth/interface/react/providers/AuthConfigProvider/index.tsx`: isolated per-tree client settings. Client entrypoint must not import the server session/credential adapters.
- `src/exports/client.ts`, `rsc.ts`, `src/proxy.ts`: consumer surfaces; do not infer settings from another bundle's globals.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint                         # src and tests, not a no-op
pnpm test:unit                    # includes real Payload/SQLite HTTP acceptance
pnpm build                        # cleans dist before generating JS/declarations/assets
pnpm exec playwright install chromium
pnpm test:otp:acceptance          # packed PostgreSQL/two-process/browser OTP acceptance
pnpm test:oauth:sqlite            # packed controlled-OIDC Chromium + native API acceptance
pnpm test:oauth:postgres          # same behavior against PostgreSQL/two processes
pnpm test:consumer                # external package install, exports and types; no app/browser
pnpm test:consumer:integration    # minimal Next/Payload host, real login/logout + SQLite
AUTH_CONSUMER_DB=sqlite pnpm test:migration:acceptance
AUTH_CONSUMER_DB=postgres pnpm test:migration:acceptance
```

`test:consumer` generates a temporary package manifest and TypeScript imports check;
it does not maintain another app fixture. `test:consumer:integration` and the specialized
acceptance commands share the single Next/Payload fixture in `tests/consumer`, with
scenario-specific behavior selected by environment flags, not overlays. Both runners
clean their temporary directories. The integration
host is not a mock auth server. See the candidate traceability for exact runtime/adapter outcomes. Human screen-reader/real-device checks and remote CI execution remain separate pending gates; unit mocks are not evidence for those claims. TypeScript lint uses an explicitly TS6-compatible parser instead of an unrelated vendor repository's formatting config. Existing non-critical `any`/dormant UI warnings are reported, not hidden.

**Concurrent SQLite host requirement:** configure `sqliteAdapter({ wal: true, busyTimeout: 1000, ... })` on every instance. The demonstrated two-process setup uses WAL plus a 1,000 ms native read busy timeout; default DELETE journal/zero timeout can fail native authentication/logout during overlapping OTP writes. The plugin does not silently change the host journal mode or retry authentication hooks. Local file/WAL requires a filesystem that supports SQLite shared-memory/locking; multi-host network filesystems are not established support.

### Repository scripts

Repository tooling in `scripts/` is TypeScript and runs through the `tsx`
development dependency. Use the package commands (for example,
`pnpm build:fix-esm-imports` and `pnpm test:consumer`) or
`pnpm exec tsx scripts/<name>.ts`. `pnpm typecheck` also checks these scripts
with their strict, no-emit configuration; they are not emitted into `dist/`.
The browser acceptance helpers in `tests/*-browser.ts` use the same TypeScript tooling.
