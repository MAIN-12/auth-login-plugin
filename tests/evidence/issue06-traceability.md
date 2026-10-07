# Issue06 — requirement, scenario and audit traceability

**Automatic local validation completed; not a release approval.** Baseline: `6f785199`. All R01–R40/S001–S060 below map to executed automatic seams on FINAL5 candidate `c8dcac5a`; human/external portions remain explicitly pending. [Root-owned issue06 evidence](issue06.md) is authoritative for full immutable lineage, commands and versions; [22 scoped receipts](issue06-acceptance.json) record actual outcomes. [Failed/partial attempts](issue06-attempts.json) are retained, not relabeled as final successes.

## Evidence and command key

- **H1**: [issue01](issue01.md), native password/config/session and packed consumer.
- **H2**: [issue02](issue02.md), [packed OTP](issue02-acceptance.md), real SQLite/PostgreSQL concurrency.
- **H3**: [issue03](issue03.md), [password acceptance](issue03-acceptance.md), [blocklist](issue03-blocklist.md).
- **H4**: [issue04](issue04.md), [controlled OIDC/Admin acceptance](issue04-acceptance.md).
- **H5**: [issue05](issue05.md), [browser acceptance](issue05-acceptance.md), scoped SQLite/PostgreSQL JSON receipts.
- **U**: `pnpm test:unit` (197 tests / 26 files passed on FINAL5); focused seam: `pnpm exec vitest run tests/<name>`.
- **P**: `pnpm test:password:sqlite && pnpm test:password:postgres`.
- **O**: `AUTH_CONSUMER_DB=sqlite pnpm test:otp:acceptance` and repeat with `postgres`; real two-process OTP including native-storage outage, not every browser/device permutation.
- **G**: `pnpm test:oauth:sqlite && pnpm test:oauth:postgres`; controlled signed OIDC, **not live Google**.
- **I**: `AUTH_CONSUMER_DB=sqlite pnpm test:integration:acceptance` and repeat with `postgres`.
- **C**: `pnpm test:consumer`; clean build/pack/install, native browser and consumer declaration checks.
- **Q**: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm build`.
- **M**: `pnpm test:migration:acceptance`; versioned packed two-process SQLite/PostgreSQL harness; root-exported collection-scoped epoch cutover API; full cutover/backup/restore receipts passed with unchanged host keys (no global key rotation).

**Verified automatic** means the listed executed commands passed for the immutable FINAL5 source/fixture/harness, not that every possible flow or human gate was tested. H1–H5 remain historical context only. Native SQLite tests use real Payload endpoints; framework-free tests verify use-case rules separately.

## Final candidate scope

U: 197 tests/26 files; Q: frozen install, typecheck, lint and build passed. Each Node runtime passed 11 packed scopes: P/O/G/I/M on both SQLite/PostgreSQL plus C on SQLite. Receipt files are `issue06-acceptance/node{22,24}-{flow}-{db}.json`. Node versions are 22.23.2/24.21.0, Payload 3.90.2, Next 16.3.6, React 19.2.6, PostgreSQL 17.8 and Chromium. Two-process SQLite scopes assert WAL/1,000 ms timeout on both instances; integration checks its single instance; the plain baseline does not preflight PRAGMAs.

I contains **24 password presentation cells and 74 zero-violation axe scans per runtime/database**, plus six scoped signup/recovery/OTP shell/style combinations, not a full cross-product for those flows. M rehearses verification-only ownership, target cutover and actual backup restore with fresh recutover. Unit/HTTP tests additionally prove rollback on real native transaction failure, legacy-token clearing and generation-read outage logging.

Source `f9833a914fa8758ca6c3a3758dc8e76e7a5add8e2b1a68a55d88eb9887656908`, fixture `235889a71d28fb480cf94d52c89fca3b1a5457bf3054096220bfaf80eda76228`, harness `ab9e18dda05dd090c37015c4a73eeca2a3edf2e9134b5924f2794851b55f7040`, tested tarball `bcea231a80d22b9a52fd063b772ead089a53025e273246cfdde17c3478fee089`. This later prose-only index update is not a new runtime execution or a relabeling of that artifact.

## Complete requirements/scenarios index

| Requirement | Scenarios | Actual seam/check | Command | Verified automatic: Command |
|---|---|---|---|---|
| R01 server method policy | S001, S002 | `plugin-config`, `auth-endpoints`, `password-http` | U, P, G | Verified automatic: U, P, G |
| R02 non-secret capabilities | S003 | `auth-http`, `password-http`; native hash/salt adapter | U, P | Verified automatic: U, P |
| R03 strict input/error contract | S004 | `auth-http`, `otp-http`, `password-http`, `integration-contracts` | U, P, O | Verified automatic: U, P, O |
| R04 non-mutating OTP login | S005, S006 | `otp-flow`, `otp-http`, `otp-browser.mjs` | U, O | Verified automatic: U, O |
| R05 bound encrypted OTP | S007, S008 | `otp-flow`, `otp-http`; private SQL store | U, O | Verified automatic: U, O |
| R06 atomic attempts/consumption | S009, S010 | `otp-http`, `otp-browser.mjs`; two processes | U, O | Verified automatic: U, O |
| R07 shared issuance/resend budget | S011, S012 | `otp-flow`, `otp-http`, `otp-browser.mjs` | U, O | Verified automatic: U, O |
| R08 trusted origin limit | S013 | `otp-flow`, `otp-http`; explicit resolver failure | U, O | Verified automatic: U, O |
| R09 bounded failclosed failures | S014, S015 | `otp-flow`, `otp-http`; mail/storage/session failures | U, O | Verified automatic: U, O |
| R10 closed/non-admin signup | S016, S017 | `password-http`, `oauth-application`, `oauth-browser.mjs` | U, P, G | Verified automatic: U, P, G |
| R11 pending ownership signup | S018, S019 | `ownership-application`, `password-http`, `password-browser.mjs` | U, P | Verified automatic: U, P |
| R12 OIDC browser correlation | S020, S021 | `oauth-application`, `oauth-browser.mjs` | U, G | Verified automatic: U, G |
| R13 explicit stable-subject linking | S022, S023 | `oauth-application`, `google-client-actions`, `oauth-browser.mjs` | U, G | Verified automatic: U, G |
| R14 explicit method addition | S024 | `password-http`, `password-browser.mjs`; passwordless recovery denial | U, P | Verified automatic: U, P |
| R15 limited recovery permit | S025, S026 | `password-lifecycle`, `password-http`, `password-browser.mjs` | U, P | Verified automatic: U, P |
| R16 reset revokes all sessions | S027 | `password-http`, `password-browser.mjs`; native session replay | U, P | Verified automatic: U, P |
| R17 fresh voluntary change/link | S028, S029 | `password-http`, `password-browser.mjs`, `oauth-browser.mjs` | U, P, G | Verified automatic: U, P, G |
| R18 new-password/legacy policy | S030, S031 | `password-lifecycle`, `password-http`, `legacy-verification-http`; blocklist | U, P, M | Verified automatic: U, P, M |
| R19 native capped session lifecycle | S032 | `auth-http`, `otp-http`, `password-browser.mjs`, `oauth-browser.mjs` | U, P, O, G | Verified automatic: U, P, O, G |
| R20 server Admin policy | S033, S034 | `admin-policy`, `otp-http`, `oauth-browser.mjs` | U, O, G | Verified automatic: U, O, G |
| R21 privacy/no enumeration | S035 | `auth-http`, `password-http`, `integration-browser.mjs` | U, P, I | Verified automatic: U, P, I |
| R22 sanitized correlation | S036 | `auth-http`, `otp-http`, `oauth-browser.mjs`, `integration-browser.mjs` | U, O, G, I | Verified automatic: U, O, G, I |
| R23 local safe return | S037, S038 | `redirect-safety`, `integration-ui`, `integration-browser.mjs` | U, I, G | Verified automatic: U, I, G |
| R24 prefix/proxy not authentication | S039, S040 | `proxy`, `integration-ui`, packed `proxy.ts` | U, C, I | Verified automatic: U, C, I |
| R25 recoverable positional OTP | S041, S042 | `integration-ui`, `integration-browser.mjs` | U, I | Verified automatic: U, I |
| R26 shared typed presentation | S043 | `integration-contracts`, `integration-ui`, `review-corrections` | U, I, Q | Verified automatic: U, I, Q |
| R27 plugin accessibility | S044 | `integration-browser.mjs`; keyboard/focus/axe | I + human matrix below | Verified automatic I only; human matrix pending |
| R28 explicit ES/EN | S045 | `integration-contracts`, `integration-ui`, `integration-browser.mjs` | U, I | Verified automatic: U, I |
| R29 escaped branded email | S046 | `integration-contracts`, `integration-browser.mjs`; RSC generators | U, I | Verified automatic: U, I |
| R30 isolated config | S047 | `plugin-config`, `auth-provider`, `presentation-resolution` | U, C, I | Verified automatic: U, C, I |
| R31 public whitelist/native token policy | S048 | `auth-http`, `plugin-config`, packed secret-negative checks | U, C, P, O, G, I | Verified automatic: U, C, P, O, G, I |
| R32 explicit workflow dependencies | S049 | `otp-flow`, `ownership-application`, `oauth-application`; native adapter tests | U, Q | Verified automatic: U, Q |
| R33 concrete reusable config | S050 | custom `customers`/`backend`/`access` consumer, host fields/hooks | C, I, P, G | Verified automatic: C, I, P, G |
| R34 local docs/import/exports | S051 | `build-imports`; ESLint barriers; plugin/client/RSC/proxy | U, Q, C | Verified automatic: U, Q, C |
| R35 preserve legacy/unknown | S052 | `legacy-verification`, `legacy-verification-http`; ownership-only API | U, M | Verified automatic U/M; destroyed passwords unrecoverable |
| R36 cutover/secure rollback | S053 | `migrateAuthLogin`, `migration-http.test.ts`, native sessions/private epochs, backup/restore rehearsal | U, M | Verified automatic U/M; real adapter cutover/restore rehearsal |
| R37 demonstrated stack | S054 | Node22/24 × SQLite/PostgreSQL fresh packed consumer | C, P, O, G, I, M per runtime | Verified automatic: C, P, O, G, I, M per runtime |
| R38 reproducible deps/lint | S055 | lockfile, actual src/tests ESLint, audit reachability | Q + dependency evidence | Verified automatic Q; residual host prerequisites in dependency triage |
| R39 clean consumable package | S056 | stale-dist sentinel, fresh tarball installs/declarations | Q, C | Verified automatic: Q, C |
| R40 gated delivery/CI | S057, S058, S059, S060 | real DB/browser/two-process commands, `.github/workflows/ci.yml`, manual matrix | Q, U, C, P, O, G, I, M | Verified local automatic checks; remote CI/human/operator gates pending |

## Audit findings: disposition is not a recommendation repeated

Each row identifies the tested correction behind historical closure. Listed automatic commands passed on FINAL5; no blanket security certificate follows. Independent review disposition remains in root-owned evidence.

| Source audit IDs | Correction owner / historical proof | Issue06 disposition |
|---|---|---|
| S01, U01 | Native OTP session adapter and credential capabilities; H1–H3 | Verified U/M: verification-only migration preserves original password |
| S02 | Transactional encrypted store, durable budgets/single consume; H2 | Verified U/O/M on recorded adapters |
| S03, S09, U11 | Server method/signup policy and original Admin composition; H1/H3/H4 | Verified U/P/G |
| S04 | Browser-bound OIDC/PKCE, one-use callback, explicit subject linking; H4 | Verified controlled G; live Google unverified |
| S05, U10 | Common local-return validation preserves allowed query/hash; H4/H5 | Verified I/G |
| S06 | Generic issuance, strict HTTP errors, no public discovery; H1/H3/H5 | Verified U/P/I; absolute timing indistinguishability excluded |
| S07 | Purpose/account/version-bound permits, recent reauth; H2/H3/H4 | Verified U/P/G |
| S08, A05, U07 | Cryptographic codes + escaped, configured ES/EN emails; H2/H5 | Verified U/I |
| U02, U03, A04 | Explicit configured routes and proxy canonicalization; H1/H5 | Verified U/C/I |
| U04 | Associated labels/errors, contrast, modal keyboard/focus; H5 | Verified scoped automatic I; genuine screen-reader/real-device gate pending |
| U05, U08 | Recoverable links, positional OTP and one in-flight request; H5 | Verified U/I |
| U06 | Shared new-password policy, exact local blocklist; H3 | Verified legacy short-password migration U/M |
| U09, A06 | Shared workflows/typed contracts/style adapters, import barriers; H5 | Verified U/Q/I |
| A01, A02 | Frozen factory/scalar whitelist + per-tree config; H1/H5 | Verified U/C |
| A03 | Explicit application/domain owners; native seams declared Payload-bound; H2–H5 | Verified U/Q; no portable-auth claim |
| Q01 | Declared TS6 parser and actual src/tests lint; H5 | Verified Q, not no-op lint |
| Q02 | Narrowed Node22 support; exact historical stack; H1/H5 | Verified exact Node22/24 combinations; no wider stack claim |
| Q03, Q04 | Prior unused runtime removals; audit requires reachability classification | [Current reachability/patch triage](../../reports/issue06-dependency-triage.md); recorded packed validation passed; residual host prerequisites remain, no advisory-only exploit claim |
| Q05 | Versioned real packed DB/browser suites and CI; H1–H5 | Local 22-scope matrix passed; remote Actions not executed |
| Q06 | Clean build sentinel + packed exports/browser/declarations; H1/H5 | Verified Q/C |
| Q07 | Independent historical scoped fixes and pinned evidence; H1–H5 | Final candidate outcomes passed; independent review disposition in root evidence |

## Manual and external gates — do not promote automatic proof

The user accepted these pending human/external boundaries; acceptance of the boundary is not a passed check or certification.

| Variant/flow | Existing automatic scope | Genuine human/external status |
|---|---|---|
| Card/page/modal × Tailwind/HeroUI × ES/EN × desktop/mobile viewport | FINAL5 I: 24 password cells, keyboard/focus and 74 axe scans per runtime/DB | Screen reader, zoom and real-device checks **pending for every variant** |
| Signup/recovery/login OTP | FINAL5 I: six shell/style initial combinations with alternating ES/EN/viewport, not full 24-cell cross-product | Full variant reader/mobile flow matrix **pending** |
| Google | Controlled signed OIDC browser/provider protocol | Live Google callback registration/production consent **unverified** |
| Node22/24 × SQLite/PostgreSQL CI | Versioned jobs, FINAL5 local Node22/24 receipts | Remote GitHub Actions **not executed by this session** |
| Production cutover/restore | FINAL5 M: disposable two-process cutover/backup/restore rehearsal | Actual consumer writer shutdown, backups and recovery **operator-owned/unverified** |

The goal remains WCAG 2.2 AA for plugin surfaces; axe cannot certify it. No row certifies the consuming application, all peer-range versions, exactly-once mail, MFA, MongoDB, username-only, another provider or remember-me.
