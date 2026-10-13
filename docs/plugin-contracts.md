# Plugin contracts and security migration

This is the local normative integration guide for `@main12/auth-login`. The approved hardening specification remains the product authority. Copied AOP architecture documents in this checkout are historical reference, **not normative instructions for this plugin**; their cross-repository paths and claims do not describe this package.

## Quick integration

1. Create `authLoginPlugin` in a server-only module with an email-auth collection, API prefix, auth endpoint prefix, and UI `basePath`.
2. Configure the target Payload collection with verified email evidence, sessions, native access policies, and `removeTokenFromResponses` as appropriate.
3. Pass only `.publicConfig` to client/RSC tree providers. Render `AuthCard`, `AuthPages`, or `AuthProvider` modal with explicit presentation overrides.
4. Run the packed acceptance commands. Automated browser/axe evidence does not replace human screen-reader verification.

## Concrete configuration

| Concern             | Real interface and responsibility                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collection          | `collection: 'customers'`; native Payload email-auth fields remain native. Username-only is excluded.                                                                                                                                                                                                                                                                                                                                                       |
| Routes              | `apiPrefix: '/backend'`, `authEndpointPrefix: '/access'`, `basePath: '/members'`; API prefix must match Payload. Component basePath overrides scope all workflow navigation. Proxy is optional, never a session validator.                                                                                                                                                                                                                                  |
| Profile/permissions | No fixed `name/role` requirement or hypothetical field port. Consumer fields/hooks and `admin.authorize({ req, evidence })` express actual permissions. Public provisioning never accepts elevated roles.                                                                                                                                                                                                                                                   |
| Locale              | Plugin `locale: 'es'` or `'en'`, otherwise OTP email locale, otherwise `en`, is the immutable fallback. Effective precedence: local override → provider → plugin default → `en`, including custom hooks/forms. Regional ES/EN tags normalize to their base language for built-in UI, `Accept-Language` and email. Unsupported tags retain the installed fallback; exact custom UI dictionaries remain available without adding unsupported email languages. |
| Presentation        | Tailwind/HeroUI adapt the same forms, positional OTP and HTTP contracts; card/page/modal change composition, not authentication policy.                                                                                                                                                                                                                                                                                                                     |
| Branding            | `projectName` and HTTPS `logo` are public serializable branding. Relative local UI logos remain supported. Server `otp.email` can override projectName/logoUrl and configure domain/contactUrl/contactEmail/colors. HTTPS URLs reject credentials; supported colors are six-digit hex. All server email strings are escaped.                                                                                                                                |
| Secrets             | OTP key, Google credentials, clock/origin callbacks and email sender configuration never enter publicConfig. Private option snapshots include nested colors.                                                                                                                                                                                                                                                                                                |

Ambient cookie/header/document locale detectors remain exported convenience functions, **not automatic defaults**. A consumer that deliberately wants detection should call the detector and pass its result explicitly. Malformed locale cookies do not throw.

## Email identity updates

Public/native account updates cannot change email until a dedicated reauthenticated ownership-change workflow is implemented. REST, GraphQL and untrusted Local API updates containing `email` return `METHOD_DISABLED` (403), including unchanged values and bulk updates. Omit `email` when updating unrelated profile fields; account reads and plugin ownership-signup creation are unaffected.

Trusted host provisioning remains explicit: Local API **and** `overrideAccess: true` **and** `context.authLoginCredentialProvisioning: true`. Forwarding a REST/GraphQL request with those flags is not trusted. The host must establish ownership evidence for the new address or explicitly clear `_verified`; the plugin does not assert new ownership or implement email-change UX on the host's behalf.

## Workflow and HTTP contracts

`createAuthService(publicConfig, locale?)` is a scoped HTTP adapter. Successful responses are validated before delivery; public failures use `AuthRequestError` with a stable `AuthErrorCode` and numeric status. Transport/non-JSON/malformed responses become safe failures, never raw infrastructure text. Response models discriminate `success: true` from `success: false`; successful OTP emission requires context and retryAfter. Limited proofs derive purpose from the explicit operation, not arbitrary response data.

Login, signup, OTP, reset and Google share local-safe destination handling. Local query/hash destinations survive intermediate routes; external, protocol-relative and repeatedly encoded bypasses use `/`. External allowlisting is not implemented. Successful signup/recovery completes password establishment and returns to **login**, preserving destination; it does not authenticate automatically.

OTP UI stores six positions, with spaces representing blank slots internally. Send only `/^\d{6}$/` complete values to the server. Borrar/backspace and out-of-order edits preserve later positions. Paste/autofill supports complete codes; automatic/manual verification share one in-flight guard. A missing/malformed context renders a localized recovery action, not an empty screen. Responsive presentation mounts a single live form tree.

## Email customization (3.1.0)

`AuthLoginPluginOptions.emails` captures per-template server callbacks at factory
creation. Omitted templates retain built-ins. `renderAuthEmail` from `/rsc`
exposes the same async rendering contract for previews and manual delivery;
`AuthEmailOverrides`, `AuthEmailParams`, and `AuthEmailResult` are exported types.
OTP callbacks receive request locale, flow purpose, configured expiry and branding.
Welcome/password-changed/manual password-reset renderers do not introduce new
notifications into native credential transactions. Consumers deliver these after
successful operations using their Payload email adapter.

## Safe email exports

RSC generator export names remain stable (`generateOtpEmail`, `generatePasswordResetEmail`, `generateWelcomeEmail`, `generatePasswordChangedEmail`, `wrapInBaseTemplate`). Dynamic inputs are escaped by generators; URL/color/contact validation is shared with plugin configuration. **`wrapInBaseTemplate(content)` accepts trusted template HTML**, not untrusted user markup. Callers composing custom HTML must escape their own content.

Supply real HTTPS `domain`/`loginUrl` to welcome/password-changed templates; the placeholder `https://example.com/login` is not your application destination. `getBaseUrl(base?)` and `getSenderEmail(sender?)` no longer read environment variables. Pass consumer configuration explicitly. OTP and password-reset subjects start with the code, including custom renderer results unless they already contain it; built-in preheaders remain code-free. Standalone template expiry copy uses the approved five-minute default; consumers customizing server TTL must communicate their own policy separately.

Email contact uses the validated `contactUrl` with a localized label when configured; otherwise it uses `contactEmail` as a mailto link. Configuring both intentionally gives the URL precedence.

## Migration before removing legacy forms

| Previous behavior                                                             | Required migration                                                                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Global/ambient locale selection                                               | Pass `locale` explicitly through plugin/provider/form.                                                                         |
| Optional OTP success context                                                  | Narrow success/error unions; successful emission always has context/retryAfter. Handle `AuthRequestError`, not arbitrary text. |
| Verify response exposes token in client type                                  | Use native cookie/session; do not extract tokens from UI workflows. Server `removeTokenFromResponses` remains authoritative.   |
| Environment-derived email config                                              | Pass domain/sender/branding explicitly. Correct unsafe generator usage before removing legacy wrappers.                        |
| Duplicate style-specific page workflows                                       | Use shared forms or exported page adapters; do not reimplement HTTP/auth transitions in a shell.                               |
| Disabled global `checkEmail/sendOtp/verifyOtp/signup/setUserPassword` exports | Migrate to scoped `createAuthService`; disabled names remain inert compatibility stubs and never discover accounts.            |
| `onSignup({ name, email })` callbacks                                         | Ownership signup is server-driven. Legacy callback types remain for source migration but cannot bypass ownership proof.        |

The issue05 presentation change alone introduced no database credential/session migration. The issue06 migration below is separate; reverting UI/contracts does **not** authorize restoring historical password-mutating OTP, unsafe email previews or account discovery. Preserve security migrations from issues01–04 and their rollback guides.

## Legacy email verification without password replacement

Configure the same private `otp` options (key, trusted origin resolver, email sender) even when `otpLogin: false`. Send `POST <apiPrefix><authEndpointPrefix>/otp/send` with `{ email, purpose: 'verify-email', context? }`; preserve the generic accepted response's context. Verify with `{ email, purpose: 'verify-email', context, otp }` on `/otp/verify`. Success is exactly `{ success: true }`: **no token, cookie, completion permit, password change or new session**. The existing verification form accepts an explicit `purpose=verify-email` continuation with email/context and returns to login on success; the consumer owns the migration entry/send action. Signup/recovery do not silently become verification-only flows.

The native transaction rechecks the original account/email/credential/verification version, runs host update hooks, sets only `_verified: true` and preserves password/session authority. The original host `access.admin` must explicitly deny that account before and after the update; verification alone cannot unlock an administrative account. Direct REST/GraphQL writes to `_verified`/`_verificationToken` require the same explicit trusted Local API provisioning conjunction as credential/session authority; a cookie cannot manufacture verification evidence. A host hook attempting credential/session mutation rolls back; consumed OTP is not reusable. Request a new proof after cooldown instead of retrying the consumed code. Deleted/already-verified/unknown accounts keep the generic issuance contract without confirmed delivery.

This is distinct from recovery: recovery explicitly replaces an existing password and revokes sessions when confirmed. It cannot reconstruct a password destroyed by legacy OTP, add a first password to a passwordless account or activate a disabled login method. Preserve short legacy passwords; the 15-character rule applies only to newly established credentials. Accounts without trustworthy verification evidence remain denied until an authorized process proves ownership. Admin migration belongs to the trusted host process, not email-only public verification.

## Coordinated security cutover and rollback

**The consumer owns data migration, operational cutover and rollback.** The plugin does not export a data-migration helper, convert historical records, delete legacy codes or revoke every account's sessions as an upgrade task. The [account guide](migration.md) describes preservation and security requirements; [schema setup](schema-migrations.md) describes consumer-generated Payload migrations.

1. Stop all application/database writers and back up native accounts, credentials, verification evidence, provider mappings and security ledgers.
2. Generate and review the application's schema migration with the plugin enabled. Preserve account identity and trustworthy evidence; unknown verification is not verified.
3. Implement and test application-specific invalidation of old sessions, reset/verification tokens, legacy codes and host grants. The consumer must also establish a fresh collection-scoped proof generation as described in the [security-state contract](migration.md#consumer-owned-security-state), without dropping shared ledgers or resetting quotas.
4. Verify preservation and rejection of stale sessions/codes/permits before resuming traffic. After a backup restore, repeat the consumer-owned security cutover while writers remain stopped. Never revive unsafe OTP, lost provider mappings or consumed authority.

Historical issue06 receipts describe the old candidate and its former helper, not the current package surface or proof that a consumer has performed its production migration. Runtime ownership verification and scoped generation checks remain authentication safeguards, not migration orchestration.

## Auth-clean task 01 approval and contract inventory

The user explicitly authorized implementation of task 01 on 2026-10-08. This approves
only the password-login slice of [the plugin adaptation](architecture/auth-clean-spec.md),
not tasks 02–06. Existing security/product contracts above remain authoritative.
The copied AOP collection layout, aliases and generated entity types are historical
examples: this plugin separates collection owners under `src/collections`, workflows under `src/authentication` and owner-independent infrastructure under `src/shared`, and configures the host's
collection without importing a generated host model. Relative imports and explicit
package exports remain the package convention.

Preserved contracts: `authLoginPlugin` enabled/disabled overloads and publicConfig;
`createPasswordLoginEndpoint(settings, path?)` and `createAuthEndpoints(settings,
otpOptions?, assertPublicAccount?)`; POST configured auth prefix `/login` and native
collection `/login`; strict `{ email, password }`, normalized email, 1–1024 password
characters, 254 email characters and 4096 HTTP body bytes. Legacy short passwords
remain valid inputs. Success keeps `{ success, user, exp, capabilities, token? }`,
Payload cookie prefix/options/lifetime, CORS and removeTokenFromResponses. Expected
failures retain 400 INVALID_INPUT, 401 AUTH_FAILED, 403 METHOD_DISABLED/ORIGIN_DENIED
and a server-generated X-Auth-Request-ID. Unexpected native failures deliberately
close as 503 AUTH_UNAVAILABLE under the approved slice requirement.

Native login is called once with the real request; native hooks, verification,
lockout and session coordination remain authoritative. No password hashing, JWT,
proof/schema/TTL change or alternate session engine is introduced. New internal
results carry only a principal; native user/token/exp remain in a request-bound
adapter receipt. Direct invocation is a trusted internal server seam, never a
public caller-selected collection or principal.

Task 06 retired the temporary domain/login bridge, application client/hook/context
paths, old endpoint factory forwarding paths and contracts compatibility owners.
All production and test callers use the current seams; published exports remain
explicit with the same names. See the closure inventory below.

Rollback means reverting compatible code; it never restores revoked sessions or
consumed proofs. Doubles prove delegation, mapping, isolation and cleanup protocols,
not native lock behavior, physical transaction rollback or browser cookie handling.
Historical SQLite/HTTP tests stay in test:unit and are reported separately from
isolated use-case evidence; no Chromium/E2E or new DB acceptance suites are required.

## Dependency seams and evidence

- `src/collections/ConfiguredAuthCollection/domain`: credential capabilities and password policy; native account/session
  persistence and hooks live in its infrastructure, exposed through explicit server seams.
- `src/authentication/domain`: deterministic workflow rules and pure binding evidence;
  no workflows, HTTP/UI models, crypto or ambient dependencies.
- `src/authentication/application`: portable use-cases/ports, including operator maintenance
  intent; no Payload/SQL/HTTP/React/Next/crypto. Adapters select evidence.
- `src/authentication/infrastructure`: concrete Payload/security/provider adapters and
  cross-owner commits, not configured auth collection repositories. SQL drivers stay inside storage seams.
- `src/authentication/interface/http`: transport parsing, origin/CORS/cookies and mapping of
  constructed operations. `wiring` alone assembles concrete policy/adapter factories.
- `src/authentication/interface/client/authService`: sole browser HTTP owner for forms,
  Google, capabilities, native me/logout. Hooks/context live in interface/react.
- Stable root/client/rsc/proxy exports use explicit declarations. Public config types
  live in contracts/publicConfig; browser/proxy imports no longer traverse private config.
  RSC preserves its existing server option _type_ export via config, not root bootstrap;
  no concrete server runtime or credentials cross that surface. Email APIs stay explicit.
- `scripts/auth-architecture.ts` resolves syntax with TypeScript and checks transitive
  imports including types, alias barrels, dynamic import/require. ESLint uses the same
  graph; tests exercise valid and forbidden fixtures. This is static evidence, not
  packed/browser/runtime validation.

Logger events include safe codes and server-generated correlation IDs. Failed requests expose `X-Auth-Request-ID`; password rejection, limits, callback rejection and infrastructure events exclude email, password, OTP, tokens and full bodies. Consumer logger failure cannot grant access. Retention, transport and access policy belong to the consumer; the plugin has no external telemetry default.

## Dependency and support limits

[Dependency reachability triage](../reports/issue06-dependency-triage.md) distinguishes patched root/fixture paths from residual host/tooling prerequisites. Sharp 0.35.5 and `payload>undici` 7.29.1 are pinned for this repository and its consumer fixture; **installed consumers do not inherit pnpm overrides**. Hosts must apply compatible patches or disable the exposed remote-upload/SVG surfaces. A zero package-production audit is not a host-wide zero-vulnerability result; residual admin sanitizer/custom logging paths require host review. The manifest now pins Payload 3.90.2, Next 16.3.6, React 19.2.6, Framer Motion 12.43.0 and optional HeroUI 3.2.2 to the tested integration target. The [issue06 receipts](../tests/evidence/issue06-acceptance.json) demonstrate that exact target on Node 22.23.2/24.21.0, SQLite WAL/1,000 ms timeout and PostgreSQL 17.8. They do not prove Linux execution, remote CI or a different candidate.

## Accessibility verification scope

The goal is WCAG 2.2 AA for plugin surfaces. Automatic axe checks, viewport/style/locale/shell behavior and real keyboard/modal interaction have a maintained packed harness: `pnpm test:integration:acceptance`. Human verification must independently record screen-reader announcements, OTP positions/error association, focus order/trapping/restoration, Escape, zoom and mobile behavior for each variant. Do not mark a manual cell passed because Playwright or axe passed. These results do not certify the consuming application.

**Concurrent SQLite host requirement:** configure `sqliteAdapter({ wal: true, busyTimeout: 1000, ... })` on every instance. The demonstrated two-process setup uses WAL plus a 1,000 ms native read busy timeout; default DELETE journal/zero timeout can fail native authentication/logout during overlapping OTP writes. The plugin does not silently change the host journal mode or retry authentication hooks. Local file/WAL requires a filesystem that supports SQLite shared-memory/locking; multi-host network filesystems are not established support.

## Auth-clean task 02: OTP login policy and commit boundary

The user authorized only task 02 in its dedicated chat. Login send/verify now use
narrow commands and the same method gate for HTTP and trusted internal callers.
The application OTP protocol depends on an atomic challenge/budget ledger, account
evidence, a codec, mail delivery, clock and native-session capability; it imports
no Node crypto, Payload, HTTP or ambient clock. Node codecs preserve HMAC inputs,
AES-GCM formats/AAD, namespaces and generation binding. The Payload adapter selects
explicit unknown/unverified/deleted/verified evidence. Missing or malformed evidence
cannot become an eligible identity. Composition captures private options per instance;
publicConfig receives no secrets or server capabilities.

`otp.secret` is an optional server-only override, unchanged when supplied (minimum
32 characters; malformed values fail closed). When absent, composition derives a
32-byte HKDF-SHA256 key from the current request's `payload.secret` (minimum 32
characters), with salt `auth-login/otp/hkdf-salt/v1` and info `auth-login/otp/v1`,
encoded as hex for the existing codec. No ambient/global key or environment
fallback is used. Login and every ownership OTP purpose share this resolution.
Keep existing overrides on upgrade; removing/changing one, or rotating Payload's
key with the default, invalidates live challenges and changes quota identifiers.
Stop issuance until challenge expiry and the one-hour sliding quota window have
passed, retain security state and coordinate every instance's switch. Derivation gives domain separation,
not independent compromise/rotation or extra root entropy; storage still uses
Payload's key.

The durable reservation commits before delivery. Failed mail never resets cooldown,
quota, expiry or attempts, and accepted never asserts delivery or account existence.
Verification commits its irreversible burn before opening the separate native session
transaction. Session writes and transactional host-hook writes commit or roll back
together; the already committed burn does not roll back with them. The adapter locks
the proven account, rechecks email, credential version, verification/deletion and
cutover generation under the native transaction, including after asynchronous hooks.
A failed hook/session cannot resurrect a proof. SQLite retries acquisition only before
the callback begins; incompatible existing transactions fail without implicit commit.
SQL account locks use bound values and trusted, quoted adapter table identifiers.
Request transaction/session/proven markers are cleaned by the native adapter; the
request-bound login adapter restores temporary user/evidence and keeps token/user/exp
in a private, consumable receipt outside application. HTTP materializes that receipt
and preserves cookie/CORS/lifetime/token-removal behavior with no-store responses.

OTP React verification lives in interface/react and uses the shared HTTP client.
Task 06 removed the application hook and domain/otp/compatibility bridges after
moving all callers to the one protocol owner. No ownership authorization, API/schema,
proof TTL or public export changes are introduced. Compatible code rollback retains
consumption/revocation history rather than restoring grants.

Direct and HTTP/client/React doubles demonstrate ordering, interleaved consumption,
cleanup, evidence changes and filtered secrets; they do not certify multiprocess
locks, physical database rollback or browser cookies. Existing historical SQL/HTTP
fixtures remain in test:unit; task 02 adds no DB/E2E suite and runs no Chromium.

## Auth-clean task 03: ownership and password lifecycle

The user authorized task 03 in its dedicated sequential chat. Ownership method
admission and typed send/verify/completion/password-reauthentication commands now
belong to application/use-cases/ownership. HTTP and trusted internal callers use
that same policy before storage, delivery or native authentication. Forgot-password
invokes the shared recovery operation rather than another HTTP handler. Native
collection aliases remain disabled. Method-disabled precedence is preserved for
password completion, recovery alias and password reauthentication.

Selected ownership evidence contains only ID/email, explicit account/password/email
verification states and an opaque version. Raw native hash/salt stop at the server
mapper. The portable ownership protocol uses the OTP codec/ledger/delivery seams
from 02. Missing/deleted/passwordless/unknown recovery remains generic and cannot
establish a first password. Reauth binds a verified exact principal and current SID;
password reauth calls native login and rechecks version before its native transaction
commits, without adding a session or returning a login token. Incorrect-password
attempts retain Payload's deliberately external lockout writes before acquiring
session/credential locks. A conditional native legacy rehash is tracked before
login hooks; hooks cannot register a second upgrade. A change during hooks denies
reauth; legacy password login and its validation are unaffected. When native auth
does not open its own transaction, session coordination holds a borrowed native
transaction through hooks/final evidence checks and releases or rejects it exactly
once after the native operation settles. No authentication callback is retried.

Permit issuance, credential completion and verification-only commits re-read under
native credential/account locks. Decode alone does not grant authority. Generation
and the captured principal are rechecked under the commit, including after async
callbacks. Permit codec v1 preserves AES-GCM layout, AAD, encryption namespace,
nonces and ten-minute signup/recovery versus five-minute reauth TTL. Native credential
writes, permit consumption and session revocation remain one transaction; OTP burn
commits earlier and never revives on failure. A transactionally rolled-back password
completion can retry its still-valid permit, as required by the historical fixture.

Owner password intent is private per request. A final beforeChange guard prevents
host substitution of the chosen password; DB write observation captures the first
native hash/salt before afterChange callbacks, and completion rechecks that evidence.
Native hooks still run once; final rejection rolls back their transactional writes.
Finally clears intent, credential/reauth markers, temporary user and native transaction
registry on asynchronous failure. SQL permit/credential values are bound; trusted
native table resolution and acquisition-only retry rules are preserved. Signup
creates only after ownership and never auto-logins. Recovery revokes sessions and
older version-bound permits without auto-login. Verify-email still changes only
verification, preserves credential/session state and returns exactly success true.

Password continuation and forgot-password hooks and proof storage live under
interface/react and interface/client, using the one HTTP client. Editable password
and bounded proof remain on transient failures; expiry/consumption restart ownership.
Task 06 removed the ownership/password-lifecycle, client proof/hook and endpoint
forwarding paths after migrating test composition and production Google callers.
There is one ownership policy owner and the existing native commit adapter. No published
exports, schema, password corpus or login policy changed. Code rollback preserves
revocations, consumed proofs and the current generation.

Doubles exercise portable admission, native interleaving, request isolation, safe
HTTP mapping and cleanup; they do not establish physical rollback or multiprocess
locks. Historical SQL/HTTP tests remain in test:unit. Task 03 introduces no new DB
acceptance suite and runs no Chromium/E2E.

## Auth-clean task 04: Google provider and account policy

The user authorized only task 04 in its dedicated sequential chat. The portable
Google flow owns method admission, typed start/callback inputs, explicit recent
link permission, local continuation and consume/exchange/finish ordering. Disabled
internal calls fail before generation reads, provider or correlation effects.
Node entropy/key namespaces live in googleCorrelationCrypto; durable reservation
and burn live in googleCorrelations. Historical 32-byte base64url values, SHA256
keys, collection/generation namespaces and ten-minute TTL are preserved, along
with store encryption/AAD. An additive private binding ties rows to collection,
configured callback origin and epoch even at the empty baseline generation. Old
unbound rows cannot authorize upgraded flows; they expire within the existing TTL. A storage error cannot fall back to process memory.

The OIDC adapter retains oauth4webapi discovery, PKCE, nonce, issuer/audience,
RS256 signature checks and private transport/config; it returns only a verified
stable subject/identity. Expected protocol rejection is semantic AUTH_FAILED;
unexpected transport/storage failure maps to AUTH_UNAVAILABLE. Pure account
policy selects existing/associate/provision and explicit link/reauth eligibility.
Association by matching email requires a verified, non-deleted local account and
Google authority (`email_verified=true` with Gmail or a valid signed Workspace `hd`).
Unverified local accounts must complete prior email verification; email coincidence
and external Google emails alone never grant an association. Existing credentials,
sessions and privileges are not rewritten. Native commit retains trusted table
identifiers, bound SQL values, collection/subject and collection/account uniqueness,
real request propagation and credential/account locks. It rechecks exact current
principal/SID, version, verification and live native session under the commit,
including after asynchronous permit/generation work. Reauth requires recent finite
provider authentication time and emits only the existing five-minute permit.

### Diagnose Google failures

Google failures retain existing `code` and HTTP status, adding an optional stable
`reason`. Callback JSON also includes `requestId`, identical to `X-Auth-Request-ID`
and the `auth_login_google_callback_rejected` log entry (`code`/`reason`). Client
`AuthRequestError` exposes these optional fields and ignores unknown reason text.
Do not branch on raw exception messages; other auth response shapes are unchanged.

| Reason                                                   | Consumer action                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `OAUTH_CALLBACK_INVALID`                                 | Check configured public callback host/path.                                                |
| `OAUTH_STATE_INVALID`                                    | Restart Google login in the same browser; old correlations cannot be reused.               |
| `GOOGLE_IDENTITY_REJECTED` / `GOOGLE_EMAIL_UNVERIFIED`   | Retry with a valid, verified Google identity.                                              |
| `GOOGLE_LINK_REQUIRED`                                   | Sign in using an existing method, then explicitly link Google with recent proof.           |
| `SIGNUP_DISABLED`                                        | Use an existing account or contact the operator.                                           |
| `ACCOUNT_NOT_VERIFIED` / `ACCOUNT_UNAVAILABLE`           | Complete local verification or contact the operator.                                       |
| `ACCOUNT_LOGIN_DENIED`                                   | Native login checks rejected the account; review lockout/verification policy.              |
| `ACCOUNT_STATE_CHANGED`                                  | Restart authentication; account/session evidence changed.                                  |
| `ACCOUNT_NOT_FOUND`                                      | Account disappeared during commit; correlate the request with native account/storage logs. |
| `ACCOUNT_EMAIL_CHANGED` / `ACCOUNT_CREDENTIALS_CHANGED`  | Restart login; email or credential evidence differed on the locked account reread.         |
| `GOOGLE_ASSOCIATION_NOT_PERSISTED`                       | Operator: inspect identity write/read visibility in the native transaction.                |
| `GOOGLE_ASSOCIATION_CONFLICT`                            | Operator: resolve conflicting Google subject ownership; never overwrite a link.            |
| `AUTH_CONFIGURATION_CHANGED`                             | Restart login after the authentication cutover/configuration generation changed.           |
| `PUBLIC_ACCOUNT_PRIVILEGE_DENIED`                        | Public signup produced an admin-eligible account; review host defaults/access policy.      |
| `PUBLIC_ACCOUNT_STATE_INVALID`                           | Public Google signup retained credentials or sessions; review native host hooks.           |
| `SESSION_LOGIN_DENIED`                                   | Review native login hooks, access policy and session prerequisites.                        |
| `AUTHENTICATION_REJECTED` / `AUTHENTICATION_UNAVAILABLE` | Correlate `requestId` with operator logs; unavailable remains HTTP 503.                    |

Reasons are allowlisted diagnostics, never raw errors, emails, subjects, tokens or
secrets. External email claims cannot disclose local verification/deletion status.
This changes observability only: verified existing Gmail/Workspace accounts still
associate without rewriting passwords, privileges or sessions. Query `hd` alone
is not authority; Google authority comes from the validated signed ID token.

Native provisioning still creates a Payload account and removes the discarded
bootstrap credential in that same transaction. Final account evidence after host
access callbacks must remain verified, passwordless and without sessions. The
sub/account mapping commits before the separate native session operation. A native
session/hook failure burns correlation and leaves an already committed association
intact; a fresh Google login can use that association. Linking permit consumption
and association write share a transaction: their rollback can preserve the permit,
but cannot revive the earlier correlation burn. Reauth creates no session. The
native session adapter remains authority for login hooks, lockout, access, signing,
version/generation rechecks and cleanup; no alternate session engine is introduced.

Request scopes accept one operation, restore temporary user/headers on settlement,
and retain session tokens/users only in a private consumable receipt. HTTP owns
existing routes/strict schemas, Origin/CORS, no-store, correlation/native cookie
flags, callback phase cleanup and popup HTML. Login callback still redirects with
an empty body, so tokens never appear in JSON, including with
removeTokenFromResponses. Disabled POST aliases remain inert. Client Google actions
and navigation/popup helpers live together in interface/client, share the per-tree
HTTP adapter, and allow only one active Google link/popup operation per instance.
Exact popup/origin checks, malformed/expired grant rejection, cleanup and retry
after transient failure are preserved; React state grants no authority.

Task 06 removed the Google legacy flow/account-policy paths, contracts bridge,
server forwarding modules and old endpoint factory path. Tests compose the current
portable flow with explicit admission/ports; live composition retains native guards.
Public package exports, Google options/schema, subject mapping and permit
proof formats are unchanged. Compatible code rollback never restores consumed
correlations, revoked sessions or old generation authority.

Direct/application, HTTP/client and native transaction doubles prove ordering,
rechecks, safe mappings, SQL bindings, isolation and cleanup. They do not certify
provider runtime, real popup/cookie handling, multiprocess uniqueness locks or
physical database rollback. Historical fixtures remain; no new DB/E2E suite or
Chromium run is part of task 04.

### Auth-clean 05: capabilities, native lifecycle and Admin

Capabilities is a no-argument own query built for the authenticated request and
configured collection. Its repository selects only hash/salt/verification evidence
for that principal and reduces it before returning to application: two explicit
null credentials mean unavailable; omitted, partial or malformed credentials mean
unknown. Neither a body nor React can select the account or grant authority.
Privileged DB reads are owned by the Payload adapter, bypassing document read
access solely to inspect the authenticated principal's hidden native evidence;
this does not authorize other user resources. No generic overrideAccess is added.

Refresh application sees only expiry. A single-use native adapter holds the native
receipt/token privately, preserves the real request, invokes Payload refresh once,
and clears receipt, temporary deadline and authentication evidence in disposal.
The HTTP adapter keeps `/refresh-token`, its wire/cookie policy and native engine.
The installed session hooks cap expiry by original session creation; the existing
DB coordination keeps session deltas under the same row lock, so refresh cannot
resurrect a logged-out session. Logout remains Payload's native endpoint/engine.
Credential/email/session authority writes keep the shared hooks on every native
transport. Trusted provisioning still requires Local API, overrideAccess and
explicit context together. Host forwarding of REST/GraphQL flags remains denied.

Plugin installation is composed in `src/wiring/plugin.ts`, including original
hooks/access and native session coordination. Admin requires native authentication
evidence, original host eligibility and explicit authorization. Each decision
calls original eligibility once; false or throw denies. Password, OTP and Google
can authenticate existing administrative accounts without a required password;
roles/permissions, not the login method, decide Admin access. Authentication,
ownership proof and client flags alone do not grant Admin. Public provisioning
still rejects new admin-eligible accounts. Async host callbacks must retain the bound principal/evidence;
resource access predicates are preserved, with rejected callbacks failing closed.
Private Admin settings are copied/frozen and disabled factories remain inert.

AuthProvider uses its tree's authService for native `/me` and logout, sharing the
same service with capabilities and form actions at each explicit locale. Scopes
are per tree/transport configuration; changing language selects a cached language adapter
without changing transport scope or rewriting configuration. Nested foreign transport
configurations get their own scope.
`/me` validates a present nullable user and a finite/nonempty ID, preserving host
user fields. Duplicate in-flight session/logout requests share one transport;
malformed/network failures do not become authentication and permit retry.

Task 06 removed server credentialEvidence/adminPolicy/sessionPolicy forwarding and
endpoint refresh reexport after updating callers. Public entrypoints, overloads, options, routes, schema and cookies are
preserved. A code rollback cannot restore revoked sessions/grants or lower epochs.
Doubles prove policy and adapter coordination, not browser cookies, native DB
multiprocess locks or deployment behavior; no new DB/E2E certification is claimed.

## Auth-clean 06: maintenance and architectural closure

The earlier offline maintenance implementation has been removed. Data preservation,
legacy cleanup and deployment cutover now belong exclusively to the consuming
application; no maintenance use case, adapter or public helper remains in the plugin.
Runtime proof-generation reads, account-scoped credential operations and collection
schema remain in their existing owners.

The consumer-owned cutover must use a fresh generation and preserve account/origin
budgets and consumed permit records. Code rollback must retain bindings/revocations. Backup restoration still
requires stopped writers and a fresh maintenance/re-cutover before serving traffic.
Old Google correlations without principal binding are rejected; drain/finish eligible
flows before rollout or require a fresh login/link/reauthentication after rollout.
Do not downgrade checks or deserialize a legacy principal from browser state to rescue
an in-flight callback. A failed later native effect does not resurrect consumed proof.

In addition to the retired internal forwarding paths, the public data-migration helper
has now been removed. Inert published global client functions and POST check-email/Google
aliases remain deliberately disabled for source and wire compatibility. Authentication
root/client/rsc/proxy exports, native hooks/settings,
HTTP/status/cookies, native/private schema, formats/AAD/namespaces/TTL and password corpus
retain their owners. See [closure evidence](architecture/auth-clean-closure.md) for
operation inventory, SC-01–20 mapping, static API/schema comparison and limits.

Historical packed/multiprocess receipts referenced above concern older candidates;
this auth-clean candidate has unit/static checks only. SQLite/HTTP fixtures remain in
test:unit and are not isolated doubles or current multiprocess certification. No
Chromium/E2E, external integration, production migration, backup restore or deployment
was run for this closure. Host writer shutdown, physical rollback/locks, real cookies,
provider interop and native retention remain separate operational validation decisions.

## Authentication and collection-owned storage

With `collection: 'customers'`, the logic in
`src/collections/ConfiguredAuthCollection/` acts on the consumer's existing `customers`
collection: credentials/password policy, native account queries/writes, row locks,
sessions and native integration hooks. It registers no collection/table and never
fixes the consumer's auth slug. Portable evidence
and injected native-account ports live behind `domain.ts` and `application.ts`;
`index.ts` exposes its server seam.

`src/authentication/` coordinates cross-owner signup/recovery/login and OAuth,
plus endpoints and client/React flows. It consumes configured auth collection and auxiliary
collection interfaces. Its `wiring/` composes portable workflow ports with concrete adapters.
Configured auth collection code never depends back on those workflows.

The five real `AuthLogin*` collections own their schema and storage:

| Owner           | Storage seam                                                                      | Semantics                                                                                |
| --------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| CredentialLocks | `infrastructure/repositories/credentialLock`                                      | Acquire conflict-safe key and Postgres row lock inside caller transaction                |
| Identities      | `infrastructure/queries/identityAssociation`, `repositories/identityAssociations` | Local API lookup; native insert/conflict arbitration on collection/provider/subject      |
| Cutovers        | `infrastructure/queries/cutoverGeneration`                                        | Fail-closed runtime epoch read; consumer-owned cutover publishes state                   |
| OtpSecurity     | `infrastructure/repositories/otpStore`, `otpLedger`                               | Ordered durable locks, encrypted state, commit/rollback; acquisition-only SQLite retries |
| PasswordPermits | `infrastructure/repositories/methodPermitLedger`                                  | Unique nonce burn in caller credential transaction; no independent commit                |

Configured auth collection queries expose native credential/session evidence rather than
Local API read presentation. Password create/update/verify use Local API so host hooks
and native hashing run. Session snapshots and provider password clearing use native
storage to avoid rehash/provisioning hooks. User row locks and the common credential transaction belong to `ConfiguredAuthCollection`: both
password and Google workflows use that seam, not a password-specific adapter.
The transaction acquires the CredentialLocks collection through its public interface;
that real collection retains ownership of lock storage.
Native session coordination still wraps Payload's database methods: this integration
adapter owns snapshots/deltas and hooks, not auxiliary repositories.

Cross-owner imports use explicit seams (`index.ts` for server/config; `domain.ts`,
`application.ts`, `client.ts` for portable/browser capabilities). Deep imports into
other owner implementations are rejected, including type-only imports and alias barrels. Portable/client seams never reexport
server storage. `shared/` contains genuinely common contracts, transport, email,
locale/redirect policy and native transaction infrastructure; it depends on neither
collections nor authentication. Reuse alone does not justify moving owner
policy into shared. `src/wiring/plugin.ts` composes plugin registration.

Architecture and Atomic Design gates cover `authentication/`, every collection owner and
`shared/`. SQL drivers are restricted to repository/query seams and the shared native
transaction implementation. Public npm root/client/rsc/proxy exports, registered fields,
indexes and denied public collection access are unchanged. This source-only refactor
includes no consumer installation, schema migration, remote database or publication.
