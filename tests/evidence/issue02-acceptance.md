# Issue 02 acceptance evidence (local execution)

User-approved seams: real two-instance shared-DB HTTP and clean packed Next/Chromium browser. No mocked authentication or security store.

## Harness

`pnpm test:otp:acceptance` builds and packs the plugin, installs the tarball in a disposable consumer app, starts a disposable loopback-only PostgreSQL17 cluster, and launches two independent Next/Payload processes sharing the PostgreSQL database. The PostgreSQL binaries are selected with `AUTH_TEST_POSTGRES_BIN` (default local Homebrew17). This never connects to a developer or production database; own processes, cluster and consumer directory are cleaned up. The fixture inbox is a real Payload email adapter, not an authentication mock. Its test-only endpoint exists only in the disposable consumer application and never in package `dist`.

## TDD tracer

- Initial packed OTP consumer run: **RED**, actual Next HTTP500 with the existing `auth-login: OTP, Google, signup and recovery are unavailable until their hardened implementations ship` error. No claim of a successful challenge/session.
- Subsequent run while source implementation was actively being written: stopped at TypeScript errors in OTP hook/pages/session adapter; these are work-in-progress build failures, not authentication evidence.

Final execution results will be appended after the implementation is ready.

## Successful acceptance executions

- `pnpm test:otp:acceptance` initial issuance tracer: **GREEN**, clean packed plugin, actual PostgreSQL17.8, both independent Next/Payload processes ready, generic request-accepted contract and opaque context.
- Cross-instance verification tracer: **GREEN**, actual delivered server-inbox code verified on the second process; existing native password and preexisting session remained valid, token omitted, native HttpOnly/SameSite cookie, and consumer declarations compiled.
- Expanded acceptance: **GREEN** with Node22.23.2, Payload/db-postgres3.90.2, Next16.3.6, React19.2.6, PostgreSQL17.8 and Chromium. Verified concurrent issuance (one email), concurrent valid consume (one200/one401), three concurrent incorrect attempts (all401), unchanged attempts/code on resend, initial five-minute TTL, shared cooldown/account-five-hourly cap, provider failure followed by cooldown-bound retry, trusted-origin50/hour across processes despite spoofed forwarding headers, password unaffected by origin quota, real modal send/failed verification/resend/login/logout, token hiding, and secrets absent from client scripts. Consumer `tsc --noEmit` passed.
- After explicit fixture admin denial and current adapter/dependency changes: **GREEN** repeated all above and physically stopped the disposable PostgreSQL server. Direct OTP verification returned **503 AUTH_UNAVAILABLE**, no Set-Cookie, and no insecure fallback; cluster then restarted and was removed by cleanup.
- `pnpm exec eslint tests/otp-browser.mjs tests/consumer/app/auth-config.ts tests/consumer/app/fixture/route.ts`: **GREEN**. `git diff --check`: **GREEN**.

## Limitations

Execution is local macOS with disposable PostgreSQL17, not production/CI certification. The server-controlled fixture overrides cooldown to one second for deterministic browser runs; this does not claim a browser measured the default60-second policy. Time advancement controls OTP policy time only; native session time remains actual time. No production IP/proxy integration is inferred from the trusted-loopback resolver. The inbox is only a test email adapter: no external provider delivery guarantee or exactly-once email claim. Node24/other DB adapters, distributed clock skew, process crash recovery, operational deployment and migration rehearsals are not verified here. Root owns the final full unit suite and independent review; this evidence is not an approval receipt.

## Strengthened native-race / logging slice

- Added actual overlap cases for password-login/OTP, logout/OTP, and refresh/OTP on distinct processes. Each returns native200/OTP200; both additions survive, previous session survives password/refresh, and logout's old token is revoked while the concurrent OTP token stays valid.
- Captured logs through Payload's configured Pino destination (not mocked auth/storage). All recorded logs are checked for password/token/OTP/security SQL leakage, with correlated `auth.otp.mail_failed` and `auth.otp.unavailable` events required.
- Context and wrong-purpose rejection now occur while the challenge is still valid (not a vacuous post-expiry assertion). Browser native cookie expiry is bounded by signed JWT expiry.
- Harness integration failures were separated from auth evidence: intermittent Turbopack external relocation missed Payload's `ws`; consumer now runs explicit Webpack. Direct app-root `@libsql/client0.14.0` allows configured native externalization. An initial hypothesis was Webpack entry-chunk fixture clock duplication (not independently proved); the disposable process now robustly shares fixture clock/inbox/logger via a test-only global reference and asserts fresh post-expiry email count. Later race failure with that count2 proved a separate fixture bug: concatenated per-process inboxes selected a stale secondary code. Captured mail dates now use policy time and merged inboxes sort chronologically. No singleton was introduced in production plugin configuration.
- Strengthened run: **all assertions and consumer typechecking GREEN**, including native session overlap and sanitized logger, but command exit1 during cleanup (`ENOTEMPTY` while Next was flushing `.next-secondary`). Harness now waits for its process groups to exit, bounds termination at three seconds, and retries recursive removal. A complete clean-exit rerun follows; do not equate assertion-green/cleanup-red with overall command success.

### Complete strengthened execution

`pnpm test:otp:acceptance` repeated after the process-cleanup correction: **EXIT0 / GREEN**, all eleven public HTTP/browser assertion groups, actual PostgreSQL17.8, consumer declarations and complete owned-process/cluster/temp cleanup. Packed source included signed OTP method metadata and native extraction/verification gates (build17:04:26; adapter source17:03:52, session-policy source17:03:58). A later source-only origin-resolver exception sanitization change17:05:13 is being rerun separately for exact final snapshot; the prior run is not presented as exercising that exception branch.

## Browser bundler diagnosis (not authentication waivers)

The original password-only consumer used Next's default Turbopack. The same current package and unchanged authenticated UI/cookie/logout identity assertions passed in explicit Turbopack comparison. When forced to Webpack, the real password request returned200, followed by full document navigation and anonymous UI; an observed `/customers/me200` did not preserve UI state through that navigation. Screenshot `/tmp/auth-password-webpack-red.png`, DOM `/tmp/auth-password-webpack-red.html` and network `/tmp/auth-password-webpack-network.json` captured the failed state. This is an observed bundle/navigation integration issue, not a proved password-body-consumption bug. No speculative password service change was made, and no claim that the issue predates this change is made (baseline104dd98 was not characterized with Webpack).

`pnpm test:consumer` therefore retains original Turbopack and its original browser response/user/hidden-token assertions. `pnpm test:otp:acceptance` explicitly sets Webpack for its tested two-process OTP fixture. **Password/modal Webpack certification remains unverified/problematic; it is not claimed here.** The original authenticated browser seam was not weakened or replaced by mocked auth.

## Independent-review correction acceptance

Independent review identified that email alone was not sufficient issuance identity and collection scope. Added actual PostgreSQL HTTP acceptance that issues to real original accountA, then uses privileged fixture-only native Local API provisioning to rename A's email and create accountB with the original address. Old challenge verification on the other process must return401 with no replacement session/cookie. Collection-isolation proof is owned by the use-case tests and independent recheck, not claimed as a hosted second-collection browser test here.

### Frozen correction verification

After source freeze17:14:42 and chronological inbox fix: `pnpm test:otp:acceptance` **EXIT0 / GREEN** on Node22.23.2, Payload3.90.2, db-postgres3.90.2, PostgreSQL17.8, Next16.3.6/Webpack and Chromium. All twelve acceptance groups passed, including actual original-account email reassignment to a newly provisioned distinct native accountID and rejection of the prior challenge on the other process. Native password/OTP, logout/OTP and refresh/OTP overlap, quota/attempt/consume/resend/TTL checks, real mail/DB failure, no secret/SQL logging, browser flow and consumer declarations remained GREEN. All owned processes/cluster/temp directories cleaned successfully.

A transient startup GET404 occurred on the previous packed attempt before any authentication ran; this is not represented as auth evidence. The successful frozen run is the final PostgreSQL/browser result.

`pnpm test:consumer` on the same frozen correction, original default Turbopack and actual SQLite/Chromium: **EXIT0 / GREEN**. Original browser login response identity/hidden-token, authenticated visible UI, modal closure, native cookie/expiry, logout/replay rejection, declarations, secret-free scripts and stale-dist clean build assertions all passed without replacement by mocked/intercepted browser authentication. `pnpm install --frozen-lockfile --ignore-scripts`, focused fixture lint, and `git diff --check` passed after final dependency/script changes. Full unit suite and independent correction recheck remain root-owned.
