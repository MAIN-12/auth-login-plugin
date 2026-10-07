# Issue06 — migration and package validation

This is a local package implementation and validation record, not a release, production deployment, live Google verification or security/accessibility certification of a consuming application. No `/dev` secrets or consumer production variables were changed. The approved human screen-reader/device and remote-CI boundaries remain explicit.

## Approved implementation and public seams

Baseline: `6f785199788a7c4fbdaf6295232cb3f21dc189aa` (issues01–05).
The user approved verification-only legacy ownership, maintenance cutover preserving accounts/passwords, a security-equivalent rollback, HTTP/native DB/packed-browser seams, Node22/24 × SQLite/PostgreSQL validation and a 1,400–2,400-authored-line forecast exception on the current branch/same hardening PR.

`verify-email` uses the existing purpose-bound, budgeted OTP service. Success verifies an eligible existing non-admin account without changing its password or creating a password permit, application cookie or session. Unknown states are not marked verified by migration. Host hooks cannot silently replace credentials or session authority during verification. A real HTTP reproduction exposed writable `_verified`; the credential guard now also protects `_verified` and `_verificationToken` while retaining explicit trusted Local API provisioning. The shared verification UI returns to login rather than treating this proof as authentication.

`migrateAuthLogin` is an offline package export, not an HTTP endpoint. It requires the operator to stop all writers. A single native transaction preserves account IDs, hash/salt, verification evidence and provider associations; clears target native sessions/reset/verification tokens; removes only explicitly inventoried legacy codes; and advances a private collection generation. OTP challenges, OAuth correlations and signup/recovery/reauthentication permits use that generation. Account/origin budgets and other collections remain untouched; old encrypted rows and consumption ledgers are retained. No global Payload/OTP key rotation is required.

A restored backup must remain offline until a security-equivalent build reruns cutover with a fresh generation. A database-resident epoch cannot protect a database restored directly into live traffic. See [the operational guide](../../docs/migration.md); this rehearsal is not authorization to deploy.

## Immutable verification lineage

- Runtime/source review checkpoint: `fefcc83fb050ec8b39b70e1093c02ee6177608a9`, tree `3f94e275c1c3cf48afb0eba8e8b09e8701aa8ee0`.
- Scoped CI-only correction: `9e1738d60f762461fd1bee30c930365177b67406`, tree `8681c08adcd98b4f25f1aa11a8297f34f5d053b8`.
- Failed FINAL2 checkpoint: `42b81602e8a3e0f478e4f1e004ae9b090734a8a3`, tree `078129ec664cee6c989d9eb88e5572d9e9a054aa`.
- Partial FINAL3 checkpoint: `9ff5654797172e89100b2e6d31c63b999cc48a3b`, tree `361d54f70a34321b4f07a2d9cbf42b7bbe909d51`.
- Failed FINAL4 checkpoint: `900eccbd5ab9dfb087f595ba907d003ae0595b65`, tree `d55b2c7fdcd1dedaed3bf2014969c2acde3b650a`.
- Passing FINAL5 runtime checkpoint: `c8dcac5ab18ff96acf049a964c443d5a433c131a`, tree `60ce1b81817d1bd07e5f7c4c83d0fe2142bcbf7c`. Runtime receipts belong to their original checkpoint and are never relabeled as executions of a later tree. Delivery follow-up changes only documentation/evidence; production, fixture, harness, manifest and lockfile bytes remain identical.
- The CI correction changes only `.github/workflows/ci.yml`. FINAL2 adds typed generation-read availability errors, installed migration/contract guides, strict wire-cookie expiry checks and explicit concurrent SQLite consumer configuration. FINAL3 changes only fixture source-generation settings and a previously asserted SQLite configuration receipt field; production source and authentication assertions are unchanged from FINAL2.
- An earlier successful Node24/SQLite migration diagnostic excluded the later OAuth extension and is not substituted for the final full acceptance matrix. Preliminary lint while a new test was still being written failed `prefer-const`; the corrected frozen checks below supersede it without hiding that development failure.

## Failed attempts and bounded corrections

The initial Node22 matrix passed both migrations then failed a browser-cookie expiry assertion. Forty real browser samples showed server `Expires` exactly equal to signed JWT expiry, while Chromium applies HTTP `Date` clock correction; the old assertion failed one sample. The replacement enforces exact response/stored token identity and strict wire `Expires <= JWT exp`, separately bounding browser correction by measured client receipt timing (2ms timestamp quantization). Numeric replay passes all 40 samples; deliberate server overshoot, stale-token and outside-window controls reject. Both OTP and baseline harnesses retain this strict contract. See [Chromium's expiry normalization](https://chromium.googlesource.com/chromium/src/+/2b7a08671c5e3ce4cf50b42e8a33cd5abda96c89/net/cookies/canonical_cookie.cc).

The initial Node24 matrix passed migrations and SQLite OTP, then the real PostgreSQL outage returned `401 AUTH_FAILED` rather than `503 AUTH_UNAVAILABLE`: the native generation read preceded the OTP storage boundary. The boundary now normalizes native schema/read failures without a baseline fallback; a real broken SQLite relation exercises the public HTTP regression. PostgreSQL outage acceptance must pass on the corrected candidate.

A separate two-process logout/OTP diagnostic reproduced native SQLite `database is locked` under DELETE journal/zero timeout (logout500/OTP200; an earlier400 `No User` is retained, not claimed identically reproduced). With explicit consumer `wal:true, busyTimeout:1000`, 35/35 fresh-account races return200/200 with no native errors. The plugin does not mutate global DB settings or retry authentication hooks. The full harness checks effective PRAGMAs in both processes; WAL requires a compatible shared local filesystem and is not advertised for arbitrary network filesystems.

FINAL2 stopped at the first job on both runtimes: Node24 storage preflight returned Next HTML404; Node22 passed preflight and cutover/restore but a native reset request returned Next500 `Manifest file is empty` (E328). Subsequent Node24 diagnostics produced28/28 successful fixture queries across seven cold starts, so no generic retry was added. FINAL3 disables unnecessary Payload automatic type/import-map generation. One isolated migration control passed, but its repeat failed E328 despite95 observations with no generated Payload files: these knobs are **not** represented as the manifest fix. The FINAL3 Node22 matrix was stopped at a job boundary after one passing migration receipt; the other10 jobs and the Node24 matrix were not run.

A targeted shared-root control captured Next rewriting the same `next-env.d.ts` from primary `.next/dev` references to secondary `.next-secondary/dev` references, then reproduced E328/login500 during the unchanged migration flow. Distinct build directories had not isolated Next-generated application-root files. Two complete controls with separate app roots and the same absolute SQLite database passed all original authentication, backup/restore and browser assertions. FINAL4 isolates each process's application root, shares only installed immutable dependencies and native storage, supplies the same SQLite URL to both processes/operator/restarts, and checks declarations in both roots. It adds no authentication retry or relaxed response assertion. The earlier standalone Node24 HTML404 remains a recorded startup failure, not a separately proven instance of this cause.

FINAL4 passed both migrations and SQLite OTP on both runtimes, then PostgreSQL OTP failed the unchanged logging assertion: generation-read failure now returned503 correctly but occurred before the domain emitted `auth.otp.unavailable`. FINAL5 catches only that read boundary, emits a fresh64-hex sanitized correlation and preserves503 even if the logger throws. A real SQLite public HTTP regression exercises send/verify and throwing-logger behavior (red0 events → green2). The final matrices run PostgreSQL OTP first, then every remaining full job; no authentication retry or diagnostic subset substitutes for a passed job. [Historical attempts](issue06-attempts.json) retain failed/partial lineage and diagnostic digests; raw debug/server logs are deliberately not committed and require redaction before sharing.

## Checks already executed

| Check | Result / scope |
|---|---|
| Focused ownership/verification/cutover | Earlier15-test development checkpoint passed; final full suite includes all maintained seams and both availability/logging regressions |
| Real rollback-on-error control | SQLite DELETE trigger aborts after account writes; old session/code/permit and legacy rows remain valid, proving atomic rollback |
| Native legacy token control | Old reset/verification tokens cleared, native verification/reset denied, unverified login still denied |
| Fresh `pnpm install --frozen-lockfile` | Both isolated Node22 and Node24 snapshots EXIT0; no preexisting node_modules |
| Frozen typecheck and lint | Both runtimes EXIT0; zero lint warnings |
| Root clean `pnpm build` | EXIT0; packed runs independently rebuild and test stale-dist exclusion |
| Final root `pnpm test:unit` | **197/197 tests, 26/26 files GREEN** on FINAL5, Node22.23.2 |
| Dependency audit | Production 0; full 34 remaining findings individually triaged, not 34 proven exploits |

Runtime versions: Node22.23.2 / Node24.21.0, pnpm10.19.0; exact consumer peers Payload3.90.2, Next16.3.6, React19.2.6, optional HeroUI3.2.2 and framer-motion12.43.0. PostgreSQL17.8 and real SQLite use disposable databases. Node24's official Darwin-arm64 binary SHA256 was verified before execution. Exact peer declarations avoid advertising untested version combinations.

## Packed runtime matrix

**22/22 full jobs passed**, 11 each on Node22.23.2 and Node24.21.0, with no retries or source edits. Each independently rebuilds from zero, rejects stale dist, installs a fresh tarball consumer, validates all export/declaration targets and runs real Chromium/native database behavior. Both application roots pass declaration checks for two-process flows. The [aggregate](issue06-acceptance.json) records exact commands, runtime candidate/tree, versions, log/receipt digests and all22 [raw receipts](issue06-acceptance/).

| Full flow | Node22 | Node24 |
|---|---|---|
| Dedicated OTP — SQLite / PostgreSQL | PASS / PASS | PASS / PASS |
| Migration, cutoff, real backup restore and fresh cutoff — SQLite / PostgreSQL | PASS / PASS | PASS / PASS |
| Password lifecycle — SQLite / OTP-enabled PostgreSQL | PASS / PASS | PASS / PASS |
| Controlled OIDC/linking/Admin — SQLite / OTP-enabled PostgreSQL | PASS / PASS | PASS / PASS |
| Integration UI — SQLite / PostgreSQL | PASS / PASS | PASS / PASS |
| Plain Turbopack packed baseline — SQLite | PASS | PASS |

Each integration receipt contains24 password surface/style/locale/viewport cells and74 zero-violation axe scans; other flow variants remain scoped as recorded, not a fabricated full cross-product. Chromium145.0.7632.6, PostgreSQL17.8 (Homebrew), real SQLite. Shared-process SQLite scopes assert effective WAL/1000ms timeout; the plain baseline does not run the PRAGMA preflight. All22 receipts have identical hashes: source `f9833a914fa8758ca6c3a3758dc8e76e7a5add8e2b1a68a55d88eb9887656908`, fixture `235889a71d28fb480cf94d52c89fca3b1a5457bf3054096220bfaf80eda76228`, harness `ab9e18dda05dd090c37015c4a73eeca2a3edf2e9134b5924f2794851b55f7040`, tested tarball `bcea231a80d22b9a52fd063b772ead089a53025e273246cfdde17c3478fee089`. Final documentation changes may change the delivery tarball hash, never these recorded execution identities. The [delivery package check](issue06-package.json) records the docs-only tarball `19c0fad2a35425beefe7f95759d1325051a94da06c02eaf0048b51eb1a425dc1`: all exports/types and normative guides exist, source/tests/dev/stale dist are excluded, and packed dist bytes match the final build. This is static packaging verification, not an additional runtime run or publication.

## Independent review

Initial independent Standards/Spec review: **0 hard breaches**, one optional/nonblocking duplicated real-host test-fixture heuristic. Spec found a **P2** PostgreSQL CI omission of OTP-enabled password/OAuth branches; conditional adapter flags close it, confirmed independently. Spec inspected each immutable correction through FINAL5 and reports **0 actionable findings**. The separate Standards actor rechecked the complete correction from `fefcc83` to FINAL5: **0 actionable findings**, with an optional duplicated cookie-test heuristic. Intermediate combined delta assessments used one actor and are not fabricated fresh independent pairs. No speculative fixture refactor was introduced during validation. Independent final evidence reviews of `94844c33` report0 actionable Standards findings; Spec closed one low-severity storage-scope wording finding on `fbd8e1a4`, leaving0 actionable findings. The final review-status sentence records these results only; it does not change executed source or fabricate approval. Static inspection is not execution evidence.

CI supplies matching PostgreSQL17 client tools from the signed official repository, following [PostgreSQL's Ubuntu guidance](https://www.postgresql.org/download/linux/ubuntu/). Node22/24 × SQLite/PostgreSQL jobs version clean install, typecheck, lint, unit, build, baseline, OTP, password, OAuth, integration and migration acceptance. Actual remote GitHub Actions remains unexecuted locally.

## Dependency and release boundaries

[Dependency triage](../../reports/issue06-dependency-triage.md) records targeted Sharp0.35.5 / Payload→Undici7.29.1 patches and removal of unused Iconify/eslintrc/next-intl declarations. Libsql/drizzle/jose/oauth4webapi/zod remain runtime imports. Installed package consumers do not inherit this repository's pnpm overrides: the host must apply compatible patches or disable the affected remote-upload/image paths. Remaining compiler/config/admin/logging advisories are dispositioned by reachability/environment; production audit0 is not a host-wide security certificate.

Human screen-reader announcements/order, real mobile-device assessment, full manual zoom/contrast/target review, live Google deployment and remote CI are not claimed. Automatic ES/EN/style/shell/viewport/keyboard/axe results do not replace those checks. No MongoDB, username-only, new provider, own MFA, remember-me or framework-independent portability is added. A release stays gated by its consuming application's configuration, patching, manual acceptance and rollout signoff.

## Rollback and delivery

Retain a security-equivalent build and the collection cutover semantics; never revert to password-mutating OTP/account discovery or serve a restored authorization database before a fresh cutover. Reverting presentation or package compatibility must not restore old session/proof authority. This work is committed only after local checks, full runtime matrix and independent review; no push, PR creation or publication is authorized here. Existing untracked audit/spec/foreign-reference files remain outside this work unit. The user-approved size exception permits this single local issue06 work unit (forecast1,400–2,400 authored changed lines); actual authored additions/deletions total1,386, plus594 lockfile lines and3,230 generated JSON lines counted separately. `gentle-ai review mode status` reports enabled, decided by default, unchanged: local inspection and acceptance evidence are not fabricated merge/release authorization.
