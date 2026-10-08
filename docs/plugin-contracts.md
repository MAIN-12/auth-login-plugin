# Plugin contracts and security migration

This is the local normative integration guide for `@main12/auth-login`. The approved hardening specification remains the product authority. Copied AOP architecture documents in this checkout are historical reference, **not normative instructions for this plugin**; their cross-repository paths and claims do not describe this package.

## Quick integration

1. Create `authLoginPlugin` in a server-only module with an email-auth collection, API prefix, auth endpoint prefix, and UI `basePath`.
2. Configure the target Payload collection with verified email evidence, sessions, native access policies, and `removeTokenFromResponses` as appropriate.
3. Pass only `.publicConfig` to client/RSC tree providers. Render `AuthCard`, `AuthPages`, or `AuthProvider` modal with explicit presentation overrides.
4. Run the packed acceptance commands. Automated browser/axe evidence does not replace human screen-reader verification.

## Concrete configuration

| Concern             | Real interface and responsibility                                                                                                                                                                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collection          | `collection: 'customers'`; native Payload email-auth fields remain native. Username-only is excluded.                                                                                                                                                                                                                        |
| Routes              | `apiPrefix: '/backend'`, `authEndpointPrefix: '/access'`, `basePath: '/members'`; API prefix must match Payload. Component basePath overrides scope all workflow navigation. Proxy is optional, never a session validator.                                                                                                   |
| Profile/permissions | No fixed `name/role` requirement or hypothetical field port. Consumer fields/hooks and `admin.authorize({ req, evidence })` express actual permissions. Public provisioning never accepts elevated roles.                                                                                                                    |
| Locale              | Plugin `locale: 'es'                                                                                                                                                                                                                                                                                                         | 'en'`, otherwise OTP email locale, otherwise `en`. Provider/card/form explicit locale takes precedence. Supported request locale is sent via `Accept-Language`; other values use configured email fallback. Custom UI dictionary locales fall back to EN for email. |
| Presentation        | Tailwind/HeroUI adapt the same forms, positional OTP and HTTP contracts; card/page/modal change composition, not authentication policy.                                                                                                                                                                                      |
| Branding            | `projectName` and HTTPS `logo` are public serializable branding. Relative local UI logos remain supported. Server `otp.email` can override projectName/logoUrl and configure domain/contactUrl/contactEmail/colors. HTTPS URLs reject credentials; supported colors are six-digit hex. All server email strings are escaped. |
| Secrets             | OTP key, Google credentials, clock/origin callbacks and email sender configuration never enter publicConfig. Private option snapshots include nested colors.                                                                                                                                                                 |

Ambient cookie/header/document locale detectors remain exported convenience functions, **not automatic defaults**. A consumer that deliberately wants detection should call the detector and pass its result explicitly. Malformed locale cookies do not throw.

## Email identity updates

Public/native account updates cannot change email until a dedicated reauthenticated ownership-change workflow is implemented. REST, GraphQL and untrusted Local API updates containing `email` return `METHOD_DISABLED` (403), including unchanged values and bulk updates. Omit `email` when updating unrelated profile fields; account reads and plugin ownership-signup creation are unaffected.

Trusted host provisioning remains explicit: Local API **and** `overrideAccess: true` **and** `context.authLoginCredentialProvisioning: true`. Forwarding a REST/GraphQL request with those flags is not trusted. The host must establish ownership evidence for the new address or explicitly clear `_verified`; the plugin does not assert new ownership or implement email-change UX on the host's behalf.

## Workflow and HTTP contracts

`createAuthService(publicConfig, locale?)` is a scoped HTTP adapter. Successful responses are validated before delivery; public failures use `AuthRequestError` with a stable `AuthErrorCode` and numeric status. Transport/non-JSON/malformed responses become safe failures, never raw infrastructure text. Response models discriminate `success: true` from `success: false`; successful OTP emission requires context and retryAfter. Limited proofs derive purpose from the explicit operation, not arbitrary response data.

Login, signup, OTP, reset and Google share local-safe destination handling. Local query/hash destinations survive intermediate routes; external, protocol-relative and repeatedly encoded bypasses use `/`. External allowlisting is not implemented. Successful signup/recovery completes password establishment and returns to **login**, preserving destination; it does not authenticate automatically.

OTP UI stores six positions, with spaces representing blank slots internally. Send only `/^\d{6}$/` complete values to the server. Borrar/backspace and out-of-order edits preserve later positions. Paste/autofill supports complete codes; automatic/manual verification share one in-flight guard. A missing/malformed context renders a localized recovery action, not an empty screen. Responsive presentation mounts a single live form tree.

## Safe email exports

RSC generator export names remain stable (`generateOtpEmail`, `generatePasswordResetEmail`, `generateWelcomeEmail`, `generatePasswordChangedEmail`, `wrapInBaseTemplate`). Dynamic inputs are escaped by generators; URL/color/contact validation is shared with plugin configuration. **`wrapInBaseTemplate(content)` accepts trusted template HTML**, not untrusted user markup. Callers composing custom HTML must escape their own content.

Supply real HTTPS `domain`/`loginUrl` to welcome/password-changed templates; the placeholder `https://example.com/login` is not your application destination. `getBaseUrl(base?)` and `getSenderEmail(sender?)` no longer read environment variables. Pass consumer configuration explicitly. OTP never appears in subject/preheader. Standalone template expiry copy uses the approved five-minute default; consumers customizing server TTL must communicate their own policy separately.

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

The detailed [account migration guide](migration.md) records the same ownership/maintenance boundaries. The approved cutover design uses collection-scoped persistent authorization epochs, not global Payload/OTP key rotation. The root-exported `migrateAuthLogin` helper is an offline maintenance API; the frozen issue06 candidate passed packed two-process SQLite/PostgreSQL cutover and backup/restore rehearsals on Node 22.23.2 and 24.21.0. Verification-only ownership preserved the original password without a session/cookie; rerunning cutover after restore rejected old authority with unchanged host keys. See [the candidate receipts](../tests/evidence/issue06.md). No `/dev` secrets or running consumer deployment are changed by this package implementation.

1. Announce maintenance; stop **all** application instances, background jobs and authentication/database writers before backup or cutover. An online row deletion is not a deployment barrier.
2. Back up accounts, native sessions, hashes/salts, verification evidence, Google subject mappings and every private security table. Protect backups as credential material. Rehearse on a disposable restored copy; record counts, account IDs and credential digests without logging raw hashes/secrets.
3. Migrate explicit server/client/RSC/proxy configuration and native verification/session schema. Preserve users/passwords and known verification evidence; unknown is not verified. Do not let schema push delete unmanaged private tables.
4. Invalidate native sessions, legacy OTP records and all outstanding proof authority before resuming writers. Call the root-exported `migrateAuthLogin(payload, { collection, maintenance: true, legacyOtpCollection: { slug, where } })` with an explicit host-owned legacy inventory/filter. The native transaction clears target sessions/reset/verification tokens, deletes only selected legacy OTP records and advances the private collection generation. It preserves account IDs, password hashes/salts, verification evidence and Google subject associations. Outstanding OTP/OAuth correlations and method permits become unusable without deleting shared ledgers or rotating global Payload/OTP keys. The epoch changes challenge authority, **not** shared account/origin quota namespaces; a cutover cannot reset issuance budgets. Security rows and consumed-permit records stay retained (old authority inert), with retention still operator-owned. The result contains only `{ success, collection, accounts, legacyCodesDeleted, generation }`; generation is an invalidation version, not an authentication grant.
5. Start only the hardened artifact with the new configuration. Verify old-cookie/code/permit rejection and the original password's successful fresh login after ownership verification. Log only aggregate counts/correlations. Unknown credentials require an explicit supported recovery/provisioning path, never invented state.
6. Roll back only to an equally safe artifact and retain revocations/current generation/security-state consumption history. Restoring a pre-cutover database backup as live authority is **not** rollback: rerun `migrateAuthLogin` against the restored copy while writers remain stopped before resuming. Never restore password-mutating OTP, public lookup, permissive credential writes, revoked sessions/codes or missing Google mappings repaired by email autolink.

`maintenance: true` is operator attestation, not a mechanism that stops other processes. Inventory every target authentication collection and custom host grant; call the helper separately for each target. An empty legacy `where: {}` is appropriate only for a dedicated collection, never as an implicit cross-tenant cleanup. Omitting legacy inventory does not prove all historical codes were invalidated. Native target writes intentionally bypass host change hooks so a migration cannot rehash/provision credentials. Storage failure rolls back native changes; initialization DDL may remain, but grants no authority. Do not resume traffic after a failed cutover.

Migration acceptance uses disposable real databases. It does not certify that a consumer has stopped every writer, applied a production migration or rehearsed disaster recovery. [Issue06 traceability](../tests/evidence/issue06-traceability.md) distinguishes historical proof, current-candidate checks and pending gates.

## Auth-clean task 01 approval and contract inventory

The user explicitly authorized implementation of task 01 on 2026-10-08. This approves
only the password-login slice of [the plugin adaptation](architecture/auth-clean-spec.md),
not tasks 02–06. Existing security/product contracts above remain authoritative.
The copied AOP collection layout, aliases and generated entity types are historical
examples: this plugin owns auth policy under `src/auth`, and configures the host's
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

Temporary shims (retirement owner: auth-clean task 06): legacy `domain/login.ts`
(error/operation compatibility only), application `services/authService`,
`hooks/useLoginFlow`, and `AuthFlowContext`; endpoint login factory compatibility.
These shims are explicitly transitional, not claims that the legacy folders are
pure. Unmigrated OTP, ownership, Google and session paths retain their existing
owners until their own tickets. Only new login rules/use-case modules are pure.

Rollback means reverting compatible code; it never restores revoked sessions or
consumed proofs. Doubles prove delegation, mapping, isolation and cleanup protocols,
not native lock behavior, physical transaction rollback or browser cookie handling.
Historical SQLite/HTTP tests stay in test:unit and are reported separately from
isolated use-case evidence; no Chromium/E2E or new DB acceptance suites are required.

## Dependency seams and evidence

- `src/auth/domain`: no React/Next/Payload, HTTP adapters, components, application services or implicit environment reads. Server cryptography in existing domain modules is deliberate; this is not a claim of browser portability.
- `src/auth/application`: existing workflows and the explicit HTTP/client adapter; no Payload/server/endpoint imports.
- `src/auth/server` and endpoints: declared Payload-bound adapters, real transaction/session policies.
- `src/components`: presentation, shared forms and concrete style adapters; no server/endpoint imports.
- Stable published surfaces: root plugin, `/client`, `/rsc`, `/proxy`. ESLint checks concrete import barriers; packed-consumer acceptance validates actual exports and bundling.

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

OTP React verification lives in interface/react and uses the shared HTTP client;
its application hook path is a compatibility re-export for task 06. The legacy
domain/otp path delegates via contracts/otpCompatibility to the one protocol owner.
That bridge preserves ownership callers pending task 03; those callers and other
legacy modules are not declared portable. No ownership authorization, API/schema,
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
Explicit compatibility paths (retirement owner: 06) include application ownership
verification, application password/forgot hooks and proof storage, domain password
lifecycle, contracts ownership/password-lifecycle bridges and the old password endpoint
factory path. Google callers still use the password-lifecycle bridge pending 04;
this is declared compatibility, not a second live ownership owner. No published
exports, schema, password corpus or login policy changed. Code rollback preserves
revocations, consumed proofs and the current generation.

Doubles exercise portable admission, native interleaving, request isolation, safe
HTTP mapping and cleanup; they do not establish physical rollback or multiprocess
locks. Historical SQL/HTTP tests remain in test:unit. Task 03 introduces no new DB
acceptance suite and runs no Chromium/E2E.
