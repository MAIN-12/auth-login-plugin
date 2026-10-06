# Ticket 01 — acceptance evidence (2026-10-06)

## Scope and authority

Delegated-direct implementation, approved factory / Payload real HTTP / provider-UI seams. Fixed review baseline: `ea4155da4d80ea6d4aa0fe746d72352b77b3e71f`. This report is evidence for ticket 01 only, not SDD, not a full-spec/release approval. Root performs the full suite once and the requested final review/commit; no commit was created by the writer.

Approved breaking boundaries: explicit method/recovery options, `factory.publicConfig` per tree, revocable native local sessions with default 7200s absolute lifetime and shorter host expiry preserved. Unsafe OTP/Google/signup/recovery/password-change flows are failclosed pending tickets 02–04. Collection `auth.verify: true` and trustworthy `_verified` evidence are required, not inferred or invented. Anonymous provisioning is denied; privileged provisioning remains consumer-owned.

## TDD tracer bullets

1. **Factory**: new test failed with `publicConfig` undefined; minimal instance resolver/factory then passed. Old OAuth import also exposed an ESM dependency failure and was removed from active runtime.
2. **Actual HTTP login**: real Payload/SQLite credentials at custom `/backend/access/login` returned **404 RED**; native `loginOperation` adapter made the same test **GREEN**, including custom cookie prefix, hooks, CORS and hidden response token.
3. **Refresh**: real HTTP refresh returned an `exp` one second beyond original **RED**; request-local beforeOperation guard plus final explicit JWT expiration made **GREEN**, followed by native logout and old-cookie replay rejection.
4. **Verification startup**: factory accepted a collection lacking required verification **RED**; explicit verify requirement and unknown/unverified deny guard made **GREEN** without modifying stored passwords.
5. **Disabled factory**: `{ enabled: false }` threw a required-method error **RED**; fully inert disabled factory with `publicConfig: null` made **GREEN**.
6. **Browser seam**: packed Next consumer started but input label lookup failed; real Tailwind labels lacked `htmlFor`/input ID. `useId` association and correct translated label lookup made the browser login **GREEN**. This is not a general accessibility certification.

7. **Read-access discovery**: a test incorrectly expected `collection.access.read=false` to prevent password login. Native Payload returned login200 because login applies field-read pipeline/hooks, not collection.read. Native semantics retained: login remains200 with private field filtered, `/me` and collection CRUD deny403. This was a corrected test assumption, **not** a Payload bug or a new login-policy decision.

Later behavior matrices are regression/characterization tests, not claimed as separate red-green cycles. Legacy mocked OTP/signup/lookup tests were migrated to failclosed/public-method behavior; those flows are not presented as verified implementations.

## Executed acceptance

- `pnpm typecheck`: passed regularly (`src`, strict TS6).
- `pnpm exec vitest run tests/auth-http.test.ts`: **13/13**, real SQLite, Payload 3.90.2, no mocked credential/login/session adapter. Covers normalized actual existing password, host before/after login hooks and rejection, custom collection/API/cookie prefix, hidden response token, absolute JWT refresh expiry and expiration, native logout, authenticated self-only available/unavailable/unknown native credential evidence, invalid/malformed/oversized inputs, generic unknown/wrong-password failures, pending/native disabled methods, lockouts, verification, effective CORS/CSRF and two independent Payload instances. A second instance proves host `tokenExpiration=2` is not lengthened by `maxAge=7200`.
- Factory/provider focused regression: **40/40** together after runtime-option, inert-disable, native-auth validation and sibling collection/branding/order coverage.
- UI/presentation/proxy/disabled-method/loading focused run: **59/59** before the added sibling case; presentation **26/26**. Root's final full run is the authoritative aggregate.
- `pnpm lint`: actual `src/tests` lint, **0 errors, 10 warnings** (`any` in pre-existing UI/translation/dormant signup surfaces); hook warnings fixed. TS6-supported parser 8.71.1; concrete domain/client import restrictions enabled. Vendor missing dependency was not silently ignored or replaced with a no-op lint.
- `pnpm install --frozen-lockfile`: passed. Root install emitted ignored optional `@parcel/watcher` build-script warning. Consumer performs its own clean dependency install with pinned tested direct versions.
- `pnpm build`: passed; stale dist file injected and proven absent after clean build, real package generated.
- `pnpm test:consumer`: passed using the packed tarball installed into a fresh temporary Next project. Node **22.23.2**, Payload/SQLite **3.90.2**, Next **16.3.6**, React **19.2.6**, actual **Chromium**. Imports plugin/client/RSC/proxy, authenticates an actual provisioned verified password account, checks cookie prefix/HttpOnly/SameSite=Lax/expiry, no public lookup/OTP traffic, hidden JSON token, logout and old-cookie replay rejection, consumer `tsc`, absence of private test secret in HTML and fetched client script chunks, and stale dist removal. No mock auth server or fixture user.password evidence. Harness cleans only its own temporary directory.

Source of executable evidence: `tests/auth-http.test.ts`, `tests/plugin-config.test.ts`, `tests/auth-provider.test.tsx`, `scripts/test-consumer.mjs`, `tests/consumer/`. CI is versioned in `.github/workflows/ci.yml` for Node22/SQLite/browser; CI execution itself was not claimed.

## Architecture/rollback map

- Pure instance contract: `src/config.ts`; no singleton/env bridge, explicit whitelist and frozen factory config.
- Use case/input policy: `src/auth/domain/login.ts`; authentication dependency explicit. HTTP validates/delegates/translates in `src/endpoints/authEndpoints.ts`.
- Native Payload adapters: `src/auth/server/sessionPolicy.ts`, `credentialEvidence.ts`; privileged storage reads scoped to authenticated identity/session, native hooks and field-read filtering retained; collection read permission is applied on `/me`/CRUD, not used as an invented login gate. JWT auth version/header preserved from Payload-issued token. JWT expiration set explicitly, avoiding rounding/time-boundary extension; stored expiry bounded too.
- UI tree boundary: `src/components/AuthConfigContext.tsx`; client receives whitelist only. RSC and proxy use explicit arguments across module runtimes. Proxy never authorizes from cookie presence.
- Package/build/dependencies: runtime OAuth2/axios/Brevo/server-only unused or unsafe imports removed; actual Iconify runtime use declared; clean build plus tarball consumer. Supported engine narrowed to Node22.
- Rollback: preserve accounts/hashes/salts; preserve revocations and disabled unsafe flows; never restore legacy codes/sessions from backups as valid. Detailed backup/cutover/rehearsal belongs to ticket06. No account migration, credential rewriting, code resurrection or secret rotation was run on the developer's database.

## Remaining limits / no overclaim

- Full spec and tickets 02–06 remain open. Independently enabled OTP/Google/recovery are not implemented here; attempting to enable them intentionally stops startup.
- Node24, PostgreSQL, concurrent OTP/storage races, full UX/accessibility/mobile/ES+EN certification and production migration/rollback rehearsal remain unverified, not advertised.
- Host must preserve plugin `onInit` lifecycle and must not deliberately replace authentication strategies after initialization. Custom target strategies/API keys are rejected. Arbitrary hostile consumer hooks/configuration are not an authentication trust boundary.
- Broader dependency audit and peer warnings (`vite`/`esbuild`, optional WASM peers) remain maintenance work, not asserted as exploits. The browser consumer proves the tested Linux/macOS-independent APIs only on this local macOS/Node22 execution; CI runner result is pending.
- Independent review identified the native password-mutation P1 documented below. Its scoped correction requires independent recheck and the final full suite; this evidence is not an approval receipt.

## Independent review correction — native password mutation P1

The independent spec actor reproduced authenticated native `PATCH /api/users/{id}` changing the password with only an old/current session and leaving its prior session valid. This contradicted the approved failclosed password-change boundary and R17. It was an actual enabled-surface P1, not deferred as ticket03 work.

- HTTP real SQLite tracer: expected native authenticated PATCH403, observed200 **RED**. The shared Payload `beforeOperation` guard for create/update now denies supplied password/confirmPassword/hash/salt unless the call is explicitly privileged **server-only** Local API provisioning. The same HTTP test is **GREEN**; replacement password does not authenticate, original password remains intact, no replacement cookie is issued and the preexisting session is not incidentally revoked by a rejected request.
- Privilege is the conjunction of native `req.payloadAPI === 'local'`, `args.overrideAccess === true`, and `req.context.authLoginCredentialProvisioning === true`. The server operator opts in deliberately. Neither a cookie, an Origin header, default Local API access override, nor a context marker alone grants it.
- Real Payload create/update acceptance checks omitted context denied, overrideAccess=false denied, explicit server Local API create/update succeeded with a newly authenticated real password, and native REST/GraphQL requests forwarded to Local API with overrideAccess=true and the marker still denied. This verifies the shared operation boundary under real Payload request sources; it is **not** claimed as an independently hosted GraphQL-network acceptance test.
- Consumer fixture provisioned account now uses the explicit server-only marker. No public reauthentication/change-password implementation from ticket03 was added.
- Rollback must retain this create/update guard along with disabled password-change endpoints and existing session/code revocations. Do not restore the earlier revision that permitted authenticated native password PATCH without recent reauthentication. Authorized offline/server maintenance must coordinate its own session revocation if rotating credentials.
- Read-access wording above reflects internal coordination and native evidence, not a separate human confirmation.

Post-fix verification: `tests/auth-http.test.ts` **13/13** real SQLite; `pnpm typecheck` GREEN; `pnpm lint` **0 errors / 10 existing warnings**; `git diff --check` GREEN. `pnpm test:consumer` rerun after the guard: clean build and tarball install, actual Next/Payload SQLite/Chromium login, cookies, logout replay rejection and consumer declarations **GREEN**.

## Final candidate validation

- After the bounded native-password-write correction, root ran `pnpm test:unit`: **108/108 tests, 10/10 files**. `pnpm typecheck`, `pnpm lint` (**0 errors / 10 existing warnings**) and staged diff whitespace validation passed.
- Root independently reran frozen-lockfile installation and the packed browser consumer before the correction; the writer reran the same packed build/Next/SQLite/Chromium consumer after the provisioning contract changed, also passing.
- Independent **Standards** review and scoped correction recheck: **0 actionable findings**.
- Independent **Spec** review found one P1 native password-update bypass. Its read-only real SQLite recheck confirmed **PATCH 403**, replacement-password login **401**, original-password login **200**, and denied forwarded REST/GraphQL-origin privilege. **Original P1 closed; no new actionable correction finding.**
- These reviews are not an RDD approval receipt or publication authorization. Remaining ticket, matrix and concurrency limitations above remain unchanged.
