# Issue05 packed-browser acceptance

Executable candidate: `ecd700b1a3851de61bd3524045b1487ab4279696`, tree
`b8bd620a39cba9d4e572a919da23e519765e46fb`, baseline `7d854c7`.

## Frozen full runs

| Database | Result | Password matrix | axe scans | Other checks |
|---|---|---:|---:|---:|
| Real SQLite | EXIT0 | 24 | 74, zero violations | 19 |
| PostgreSQL 17.8 (Homebrew) | EXIT0 | 24 | 74, zero violations | 19 |

Both runs also passed the newly installed consumer's TypeScript declarations and
verified unchanged source, fixture and executable harness snapshots after all
browser checks. JSON receipts: [SQLite](issue05-acceptance-sqlite.json),
[PostgreSQL](issue05-acceptance-postgres.json). Node 22.23.2, Payload 3.90.2,
Next 16.3.6, React 19.2.6, maintained axe 4.13.0, actual Chromium.

- Source SHA256: `01b18a53c3014b652411bdc32c199eb3215719ac6084ecff57808655671a866e`
- Fixture SHA256: `d51e640d3a46aa4a78cf4bd394cab689bfc813660852a8415364f338f73a89ca`
- Harness SHA256: `65a231f4651cceb0391d3bef6e20e9b0d417c9ba4cff6d20d66853119c278309`
- Packed tarball SHA256: `76761a32c7c701796e4d02e2060c401da1e186353e8b5dfd7d83998fcd469c9c`

```sh
AUTH_CONSUMER_DB=sqlite AUTH_CONSUMER_KEEP=1 \
  AUTH_CONSUMER_EVIDENCE_PATH=/tmp/issue05-final-sqlite.json pnpm test:integration:acceptance
AUTH_CONSUMER_DB=postgres \
  AUTH_CONSUMER_EVIDENCE_PATH=/tmp/issue05-final-postgres.json pnpm test:integration:acceptance
```

Logs: `/tmp/issue05-final-default-sqlite.log`,
`/tmp/issue05-final-default-postgres.log`. SQLite KEEP was stopped gracefully
with SIGTERM after inspection; final exit was zero. Each command builds, packs,
installs a fresh consumer and uses real Payload/native storage and cookies.

## Coverage boundaries

The 24-cell matrix is **password login**: card/page/modal × Tailwind/HeroUI ×
EN/ES × desktop 1280×900/touch-mobile 390×844. Every cell proves actual wrong
password 401, localized associated error, keyboard edit/retry 200, hidden response
token, native HttpOnly/SameSite cookie, custom customers/backend/access/basePath,
and safe destination query/hash. Modal cells also check initial focus, ten Tabs,
Escape, exact trigger restoration and keyboard reopening.

Six further initial surface/style combinations exercise signup, ownership OTP,
password completion and recovery; six exercise failed/successful login OTP.
These alternate Tailwind/EN/desktop and HeroUI/ES/mobile, **not** another complete
24-cell cross-product. They prove positional deletion, paste, overlapping manual
and automatic single-flight, localized branded real email, configured HTTPS
contact precedence, no OTP in subject/preheader, no pre-proof password/cookie,
real session revocation and successful replacement credentials.

Other controls: correct-code Admin-eligible OTP rejection (preserved issue04
policy), indistinguishable unknown/existing failure shape, sanitized logger
correlation, external/encoded/backslash return rejection, proxy relative redirect
query/hash, eight incomplete-link cases, four configured Google/signed controlled
OIDC flows, both independent LoginPage adapters, and standalone email reauth
query/hash continuity plus native session rotation. Controlled OIDC is **not live
Google**. Public assets/HTML are checked for server secrets.

## Instrumentation and accessibility limits

Login/verify HTTP observation forwards each request once using `route.fetch`, then
fulfills the original response unchanged (bytes, status, headers and cookies).
It buffers the real response before document navigation can evict Chromium's
network body. Authentication/storage outcomes are never fabricated. A separate
single-flight gate delays, then continues, one actual verification request.

Fixture-only React-effect markers observe hydration of concrete routed forms;
actual visible controls and public card reveal opacity are awaited before
interaction. The marker resets for routed form identity. Targeted real POST
proofs validated page/individual/change compositions. This is not a guarantee
for arbitrary lazy descendants or evidence of pre-hydration/no-JavaScript support.
Settled axe scans use WCAG 2 A/AA, 2.1 AA and 2.2 AA tags without rule exclusions.

Root agent-driven in-app-browser inspection observed final-source Spanish
Tailwind modal branding/layout, initial close focus, ShiftTab→signup and
Tab→close boundary wrapping, Escape→exact trigger restoration. Earlier Hero ES
inspection observed localized labels and valid focused dialog container.
These are agent-driven observations, **not human screen-reader validation**.
Human screen-reader announcement/reading order, complete visual/zoom/target-size
review, real mobile hardware and live Google remain outstanding. Automated checks
are evidence, not WCAG certification of consumer applications.

## Failure lineage

Exploratory runs were not an untouched baseline. Real maintained-axe/browser REDs
exposed persistent contrast failures, Hero native-validity retry lockout, native
modal toolbar Tab boundary, password-toggle target size, and vendor pending
announcements referencing unmounted labels. Production corrections were separately
frozen/reviewed by the parent. Harness corrections distinguished valid dialog-self
focus and asynchronous exact restoration, transparent pre-hydration SSR controls,
configured contact URL precedence, Next's legitimate global route alert, an
Admin-eligible account incorrectly chosen for positive OTP, and valid relative Location headers.

Explicit diagnostic mode skips the password matrix, reports `passed:false` and
`diagnosticSubset:true`, and cannot write final JSON evidence. Its successful tail
run did not count as final acceptance; both receipts above are default full runs.
Preserved consumer regression results are tracked in the parent aggregate
[issue05 evidence](issue05.md), not inferred from these receipts.

The first preserved OAuth SQLite regression reached its final correlation check
then failed: its helper collected headers from all rejected endpoints but required
every ID to match only the Google callback event. Focused real callback 401 and
native refresh 401 established distinct valid namespaces: callback
`auth_login_google_callback_rejected.requestId` versus generic
`auth.request.rejected` / `auth.infrastructure.failed.correlation`. The bounded
OAuth-only harness correction partitions by the actual requested route, retaining
strict callback matching and all raw-secret negative checks. Wrapped Node HTTP
responses retain observed URL metadata without changing HTTP outcomes.

This later executable correction is pinned at
`c5edce82caf1a43d198adb992c6ddb476f71de10` (tree
`7e79ee830fbb004b93cdad1309523b3319c305d8`). OAuth browser SHA256:
`31498b1e0a677fc8ad43278ff17d5d9f610cae315f1747b9248e7205b3eca131`.
The issue05 receipts remain the actual earlier `ecd700` runs: source, fixture,
and their scoped runner/integration harness hashes are unchanged, not a claim
that the entire later tree was tested by those earlier runs. Affected OAuth
SQLite/PostgreSQL reruns are recorded separately in the parent aggregate.
