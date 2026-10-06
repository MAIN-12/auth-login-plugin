# Issue 03 — registration, recovery and password management evidence

This candidate implements ticket 03 only on the existing 01–02 base. It is not a release, complete hardening-spec certificate, production penetration test or claim about Google/Admin ticket 04–05.

## Approved seams and decisions

- Public application use case, real native SQLite/PostgreSQL transaction + Payload HTTP, packed browser flows.
- No user/credential/password is reserved before email proof. Signup completion permit is ten minutes and no login follows creation.
- Existing-password recovery works independently of OTP application login. Ten-minute purpose/account/version-bound permits cannot authenticate. Final reset revokes every native SID and all credential-version-bound pending permits/proofs.
- Reauthentication lasts five minutes and binds the current authenticated SID. Native password reauth keeps password verification, hooks and lockout without persisting any new SID. Enabled email OTP reauth permits explicit password addition; recovery never does.
- Voluntary change rotates current SID, preserves original creation time/absolute cap and revokes all other sessions. The managed request capability is a server-only WeakSet, not caller context.
- Native credential writes, exact session revocation, and durable nonce consumption share one real adapter transaction. Account/email locks serialize signup and current user locks coordinate with native session deltas. No security-state collection/CRUD endpoint exists.
- Shared new-password rule: fifteen Unicode code points, no composition mandate, paste/phrases allowed, existing login unchanged. The exact-match SecLists corpus has separately pinned provenance/license/update evidence in `issue03-blocklist.md`; coverage is not exhaustive.

## Focused RED → GREEN record

1. `tests/password-lifecycle.test.ts` signup tracer failed because the application module did not exist (2026-10-06 17:33 UTC); initial implementation passed 1/1 and typecheck.
2. Opaque/purpose-bound/ten-minute recovery tracer failed while the initial permit exposed its JSON payload; switched to collection-AAD AEAD. Focused lifecycle + existing OTP application tests passed 9/9; typecheck passed.
3. Real Payload SQLite HTTP tests exercised verified signup once/no cookie, native hook failure rolling back credential/sessions/consumption followed by the same permit succeeding, and password reauth never adding a session followed by capped rotation. Focused native tests passed 3/3; application cases passed 4/4 after corpus/Unicode and five-minute/cross-collection regressions.
4. Existing real OTP SQLite HTTP suite plus new native/application files passed 17/17 across three files; typecheck passed (2026-10-06 17:42 UTC). `pnpm lint` then reported zero errors/eight existing-compatible UI `any` warnings; subsequent edits removed one Signup warning. Root owns the final full suite and code-review/commit; no standalone full suite or commit was performed by the implementation worker.

The acceptance worker owns `tests/password-browser.mjs`, packed consumer fixtures/scripts, and real cross-process/SQLite/PostgreSQL/browser evidence. Its final outcomes and the root full-suite outcome must be added before delivery; the focused runs above are not substitutes.

## Failure and operator limits

- Proof validation failures remain generic. Hook failures deny/reset rollback; accepted email issuance never asserts delivery or account existence. Timing equivalence is not certified.
- Native ownership/reset cannot reconstruct a hash overwritten by an old unsafe release. Unknown verification remains unknown until explicit email-control evidence or authorized consumer provisioning; unknown password state is not inferred from public fields.
- Consumer defaults that make a new account Admin eligible deny and roll back public signup; no arbitrary input can override that policy. Consumer hooks and required fields can deny creation. Native raw credential mutations remain blocked.
- Private security tables must survive schema push/migration/rollback. Secondary SQLite acceptance initialization must use `push:false`; otherwise adapter introspection can ask to drop private state. Never approve that deletion. Live nonce rows cannot be restored away; only expired consumption records (`expires_at`, epoch milliseconds) can be cleaned safely. Email lock rows currently require quiesced maintenance and have no automatic cleanup.
- Browser continuation is per-tab sessionStorage scoped by API/endpoint/collection; it is limited, expiring proof, not a session. It is never placed in a URL. XSS isolation, secret rotation, consumer log retention, deployment migrations and full mobile/localization/accessibility certification remain consumer/later-ticket responsibilities.

## Scoped review correction

Root's frozen-candidate review identified two Standards requirements (strict Zod interfaces and ownership account eligibility outside HTTP), a typed-binding heuristic, and one Spec UI dead-end for mounted expired permits. The correction uses direct pinned `zod@4.6.5` (already present transitively), strict named HTTP schemas, an ownership application service with explicit dependencies, and one shared named proof-binding codec. Client continuation tests first reproduced both timer expiry and server-invalid proof dead-ends, then verify purpose-specific restart plus preservation on storage/validation errors. Native HTTP cases reject unknown fields/purposes and wrong scalar types without side effects. Focused continuation/native/presentation/auth HTTP runs passed 48/48 across four files; typecheck passed and lint reported zero errors/seven baseline UI `any` warnings. Existing OTP/native focused runs also passed 16/16 before the expanded regressions. Root/acceptance own final reruns and freeze evidence; no full-suite claim is added here.

## Final root validation and independent review

The corrected executable candidate is Git tree `a5f7e18f1ea90f6e544970d09289a6263e3926d3` (review object `54a72d4cefcb99fcd773c48118c264510d876608`, baseline `568c811b0064927cf80b0159cfb25ab139f4b508`). Subsequent evidence-only additions do not change executable source or fixtures.

| Check | Final result |
|---|---|
| `pnpm install --frozen-lockfile` | EXIT0, unchanged lockfile |
| `pnpm typecheck` | EXIT0 |
| `pnpm lint` | EXIT0, zero errors / seven preexisting-compatible UI `any` warnings |
| `pnpm test:unit` | **140/140 tests, 16/16 files GREEN** on corrected candidate |
| `pnpm test:password:sqlite` | EXIT0, real SQLite/two Payload processes/packed Chromium |
| `pnpm test:password:postgres` | EXIT0, real PostgreSQL17.8/two Payload processes/packed Chromium |
| `pnpm test:consumer` | EXIT0, preserved password-only SQLite/Turbopack/Chromium acceptance |
| `pnpm test:otp:acceptance` | EXIT0, preserved PostgreSQL/two-process/Webpack/Chromium OTP acceptance |
| `pnpm build` within packed runs | EXIT0, 92 source files compiled; stale dist removed |
| Staged and working-tree whitespace checks | GREEN |

The first aggregate caught two regressions (130/132 passing): disabled methods parsed input before denying, and new reauthentication text ignored inherited Spanish locale. A narrow correction restored 403-before-parse and resolved translations without weakening existing assertions; its affected tests passed 39/39. The subsequent pre-review aggregate passed 132/132. The single review-correction group added eight tests and required the final 140/140 aggregate above; earlier counts are historical snapshots, not final claims.

Independent **Standards** review found two P2 boundary violations and one typed-binding heuristic; all were closed on scoped correction recheck, with **zero remaining actionable findings**. Independent **Spec** review found one P2 mounted-permit UI dead-end; scoped recheck confirmed its closure and **zero remaining findings**. Source rechecks were read-only inspections, not independent execution of the root's tests. Packed runtime commands, hashes, scenarios and limitations are in `issue03-acceptance.md`.

This remains a local-only delivery on `chore/audit`: no push, PR or release. The user approved the 1,500–2,500-authored-line exception and current-branch commit. The corpus is a generated 100,000-record/981,882-byte asset, included fully in package/candidate identity and not disguised as one authored line. RDD remains enabled by default and unmodified; no approval receipt or publication authority is fabricated. Preexisting untracked audit/spec/docs/tickets remain outside the delivery.

## Rollback boundary

Rollback this ticket as one artifact/code/test/docs work unit to the secure ticket02 artifact at `568c811`; do not restore legacy password-substitution OTP or expose native credential writes. This removes ownership/password lifecycle, ownership verification, proof codec, strict new-interface schemas, managed native credential/reauth capabilities, their frontend continuation/forms/config wiring, pinned Zod/corpus assets, and corresponding tests/fixture/scripts/evidence together. Preserve ticket01–02 password/OTP/session guards.

Disable signup/recovery in consumer configuration before switching artifacts; the previous artifact rejects those flags. Do **not** roll back database passwords, created accounts, verification evidence or revoked sessions. Preserve private `auth_login_*` challenge/lock/consumed-permit tables across migration/schema push; never restore away live consumption history. Old completion permits are not accepted by the rollback artifact. Operational production migration/rollback rehearsal and legacy unknown-verification verification paths remain consumer/ticket06 work, not certified by these disposable acceptance fixtures.

## Versioned CI

The existing Node22/Ubuntu workflow now runs `pnpm test:password:sqlite` after the preserved password consumer. Unit/typecheck/lint/build and Chromium installation remain in that workflow. This local session did not push or execute remote GitHub Actions, and does not certify Ubuntu runtime outcomes. The PostgreSQL acceptance command is declared and locally proven above; the hosted PostgreSQL/OTP CI matrix and production migration rehearsal remain ticket06 work.
