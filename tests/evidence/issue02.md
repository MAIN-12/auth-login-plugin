# Issue 02 — secure OTP implementation evidence

## Scope and review path

User approved TDD seams SendOtp/VerifyOtp, real Payload HTTP with two instances sharing a database, and clean packed Chromium consumer. User approved the 1,300–2,200-line size exception/current branch. This is direct delegated implementation, not SDD. No publish, push or PR is authorized here. Root owns final full-suite execution, independent Standards/Spec review and commit.

Review in order: transport-independent `src/auth/domain/otp.ts`; SQL/native session adapters; endpoint composition and explicit server options; client contract; real HTTP/browser tests. Ticket01 password-only guards and disabled signup/recovery/OAuth are retained.

## Decisions

| Boundary | Guarantee / limitation |
|---|---|
| Store | Native SQL transactions and shared row/write locks; supported Payload SQLite/PostgreSQL only; no exposed collection |
| Crypto | Six cryptographic decimal digits; original durable accountID + target collection + context/purpose keyed verifier and AEAD; no plaintext OTP persisted |
| Send/resend | Defaults TTL300s/attempts3/cooldown60s/account5-hour/origin50-hour; resend retains original code/expiry/attempts |
| Origin | Required consumer server resolver; unknown identity fails closed; no inferred trust in forwarding headers |
| Delivery | Commit reservation first; one attempt, no automatic retry; accepted is not delivered; next cooldown-bound resend reuses proof |
| Verify | Commit consume before native session; hook/session crash burns proof; at most one authorization |
| Native session | Native storage/signing/read access/hooks/verified/locks; no password mutation; session delta coordination preserves additions/removals/expiry |
| Admin | Signed OTP method evidence survives refresh; every subsequent native authenticate re-evaluates admin eligibility failclosed. Request-local evidence is only for login hooks; full R20 deferred |
| UI | Opaque context and server retryAfter contract; UI never owns enforcement; no public account discovery |
| Logger | Correlatable event + keyed ID only; no raw exception/account/code/token/body; host/DB independent logger remains consumer responsibility |

## Actual TDD execution

1. `pnpm exec vitest run tests/otp-flow.test.ts`: **RED**,1 test (`createOtpFlow is not a function`), before domain implementation. Same command **GREEN**,1 test after first vertical slice. Later focused additions reached4 passing domain tests covering resend/exhaustion/context/purpose/mail/storage/session failure.
2. `pnpm exec vitest run tests/otp-http.test.ts`: first real SQLite cross-instance tracer **RED**, expected `[200,401]`, actual `[401,503]`. Root causes were native array update requiring `email` in its SQLite upsert and libsql failed busy-BEGIN poisoning the shared client. Dedicated fresh SQLite connections and acquisition-only retries produced **GREEN**,3 HTTP tests.
3. Added overlapping native password+OTP and OTP+logout/refresh tracers: **RED**, both logins200 but one session lost; logout/refresh race `[500,401,200]`. This justified session-delta coordination rather than a naive sessions-array union (which could resurrect logout).
4. Packed PostgreSQL/Chromium trace and final exact results are in `tests/evidence/issue02-acceptance.md` (separate harness worker). No mock auth/store claims.

## Regular focused checks

- `pnpm typecheck`: repeatedly GREEN between vertical slices; temporary work-in-progress UI/type errors were corrected before subsequent builds.
- `pnpm exec vitest run tests/otp-flow.test.ts tests/plugin-config.test.ts tests/auth-endpoints.test.ts`: GREEN,32 tests across3 files before final session coordination changes.
- `pnpm lint`: GREEN with0 errors and10 existing non-critical any warnings after pure-config type boundary correction.
- `git diff --check`: GREEN.

Root-owned pre-correction final full suite: **GREEN**,120/120 tests across12 files, executed once after source freeze. Root `pnpm typecheck`: **GREEN**. Root `pnpm lint`: **GREEN**,0 errors/10 existing warnings. Independent Standards/Spec reviews remain pending; successful checks are not an approval receipt.

## Rollback boundary

Disable `otpLogin` and return to the ticket01 security-equivalent password-only artifact. Remove domain/store/session/email additions and their OTP-only config/endpoints/client wiring as one unit; preserve ticket01 password/credential/session guards and all prior revocations. Keep private-table challenges invalidated, never restore legacy OTP password substitution or revoked sessions. Dedicated runtime dependencies and test harness additions belong to this same unit. Preexisting untracked `.scratch`, `docs` and audit reports are not part of this delivery.

## Exclusions

No Node24/other DB adapter certification, external mail delivery promise, broad clock-skew guarantee, operational migration rehearsal, signup/recovery/OAuth, full admin/R20 policy, or full mobile/accessibility certification. Defaults are policy-tested; browser harness reduces cooldown to1s with server-controlled time.

## Candidate-focused final outcomes

- `pnpm typecheck`: **GREEN** after signed-method, origin resolver and native-session coordination changes.
- `pnpm lint`: **GREEN**,0 errors/10 existing warnings.
- `pnpm exec vitest run tests/otp-flow.test.ts tests/otp-http.test.ts tests/auth-endpoints.test.ts`: **GREEN**,16 tests across3 files on the frozen source.
- SQLite HTTP now **8/8**: shared issuance/attempts/consume, prior native password/session preservation, field/token privacy, hook/lock/unverified/admin denial, password+OTP session race, logout+refresh+OTP race, logout-all observed-session revocation, and signed OTP method retained after refresh with dynamic administrative eligibility rejected on native direct surfaces.
- Logout-all temporal policy: delete every session in the native operation's observed snapshot; newly authorized sessions overlapping that operation can linearize after logout and survive. Never reintroduce an observed session removed since the snapshot. Explicit privileged no-baseline clearing can clear the latest state.
- Final source includes a resolver-exception failclosed mapping to503 with sanitized correlation; see exact packed run timing/outcomes in the companion acceptance evidence.


## One scoped review correction transaction

Independent Spec review found **P1 R05**: a proof issued to accountA authorized replacementB with the same email, and could cross collections sharing store/key. Actual approved usecase **RED** reproduced both (`resolved accountB/accountA instead of rejection`). Correction stores original durable accountID, namespaces challenge by target collection, includes both in verifier/AAD, compares current account evidence before consuming, passes only originalID, and rechecks expected email under the native user lock. Missing-account contracts remain generic; origin quota stays globally shared.

The same correction discovered two related real regressions, not separate review budgets:

- Ordinary REST PATCH email returned200 but coordinator discarded the update, so replacement provisioning failed duplicate-email. Native auth snapshot classification now uses the recognized internal DB call (`updatedAt:null` plus `returning:false`) or unforgeable OTP request evidence—not client `_strategy`/`id`. Public PATCH email now persists, confirmed through public GET; an old challenge then rejects its replacement account.
- Crafted authenticated PATCH of native session-authority fields returned200 after logout. **RED** expected403/received200. Public sessions/`_sid`/`_strategy`/`authLoginMethod` writes now require the same explicit trustedLocal-maintenance conjunction as credential provisioning. Native session DB writes bypass this user-write hook; forged session/credential metadata is denied and revoked-token replay stays invalid.
- Durable same-account email rename could reset its emission quota. **RED** accountLimit1 observed2 sends. A separate target-collection + durableID quota record now survives aliases/renames; absent accounts use a privacy-preserving collection+email dummy quota. Challenge/quota/origin update together under shared locks.

Standards review's two **P3** duplication findings were corrected in this transaction: SQL store imports the domain ports instead of redeclaring them, and native adapter resolves/escapes/locks users through one private helper.

Correction-focused checks: `pnpm typecheck` **GREEN**; `pnpm lint` **GREEN**,0 errors/10 existing warnings; `pnpm exec vitest run tests/otp-flow.test.ts tests/otp-http.test.ts` **GREEN**,17 tests (7 usecase +10 realSQLiteHTTP). Earlier `pnpm exec vitest run tests/otp-flow.test.ts tests/otp-http.test.ts tests/auth-http.test.ts` **GREEN**,29 tests before the quota-rename addition. No writer reran the full suite. Exact corrected packed PostgreSQL/Chromium and root read-only recheck remain in progress;120/120 above describes the pre-correction snapshot only.

## Final root delivery validation

- Corrected source: root `pnpm test:unit` **125/125 tests, 12/12 files GREEN**. The earlier120/120 run belonged to the initial reviewed candidate; the scoped correction invalidated that candidate and required this final aggregate.
- Root `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint` (**0 errors /10 existing warnings**), `pnpm build` and staged whitespace validation **GREEN**. Build compiled84 source files and cleaned dist.
- Exact corrected packed `pnpm test:otp:acceptance` **EXIT0**, PostgreSQL17.8/two Payload processes/Chromium,12 groups; original `pnpm test:consumer` **EXIT0**, SQLite/Turbopack/Chromium. See companion acceptance evidence for versioned commands and limitations.
- Independent **Standards** source/correction/final harness-delta review: **0 remaining actionable findings**; both originalP3 smells resolved.
- Independent **Spec** source/correction/final harness-delta review: original **P1 closed**, **0 remaining confidently actionable scoped findings**. Final executable candidate reviewed at Git tree `a2ca8423e065ab2a89417b1e6017b8d198e9a530`; this final evidence append does not change executable code.
- Delivery remains local-only on `chore/audit`; no push, PR, release or RDD approval receipt is asserted. RDD switch remains enabled by default, unmodified; these independent reviews do not fabricate receipt authority. Existing untracked audit/spec/docs files stay outside the commit.
- Known limitation retained: Webpack password/modal navigation is problematic and uncertified; original Turbopack password acceptance and explicit Webpack OTP acceptance passed. Node24, full R20, remaining tickets and production migration rehearsal are not claimed complete.
