# Issue 05 — Reusable integration and consistent experience

This work implements configurable authentication presentation on top of issues 01–04. It is a local implementation deliverable, not a release, production Google verification, WCAG certification or completed human accessibility assessment. The issue checklist is not marked complete: genuine screen-reader/manual validation remains outstanding.

## Approved scope and seams

The approved TDD seams were HTTP/configuration, safe navigation, rendered forms/OTP, email/logging/import boundaries and a packed consumer in a real browser. Card, page and modal share their workflows in Tailwind and HeroUI. The consumer fixture uses a non-default collection, API prefix and routes; it preserves actual Payload email fields and the existing `admin.authorize` policy rather than inventing field-mapping ports. Username-only and portability outside Payload/Next remain excluded.

- `createAuthService` owns validated, discriminated HTTP outcomes. The client exports typed `AuthRequestError` with stable code/status; UI translates codes rather than showing raw backend errors.
- Explicit per-provider locale selects ES/EN, with documented EN fallback and request `Accept-Language`. Configuration snapshots isolate consumers and keep private options out of public context.
- All presentations derive navigation from configured routes and the same local-return validator. Authorized query/hash survives login, signup, OTP, reset and signed controlled-provider OAuth.
- OTP editing preserves six positions, deletion and out-of-order entry. Paste/autofill and manual/automatic verification preserve the single-flight guard. Missing context offers recovery instead of an empty screen.
- Legacy RSC emails now delegate safe shared presentation: contextual escaping, validated HTTPS links/colors/contact, localized content and no OTP in subject/preheader. Explicit `contactUrl` takes precedence over `contactEmail`.
- Consumer logging uses generated correlation identifiers and minimal sanitized events. No default external telemetry is introduced; consumer retention/access remain operational responsibilities.
- Concrete import boundaries protect public client/RSC/proxy and domain seams. `docs/plugin-contracts.md` is the normative guide for this plugin; preexisting copied documentation is neither overwritten nor adopted as authority.

## RED → GREEN: production defects

| Observed behavior | Correction and proof |
|---|---|
| Responsive card mounted two form trees | One shared rendered tree prevents independent invisible request owners. Rendered integration tests protect this boundary. |
| Standalone OTP reauthentication lost destination/backlink; standalone login omitted default signup navigation | Configured destinations and recovery/navigation context now reach the shared owners; targeted regression tests cover both. |
| Local guards/popup failures escaped the typed HTTP contract | Client failures use the exported stable error class rather than unrelated plain errors. |
| Locale omitted from configuration whitelist | Explicit locale survives public configuration without exposing private configuration. |
| Browser axe found Tailwind/Hero error and primary contrast failures | Scoped presentation colors changed without mutating the host theme. Full real-browser scans are recorded separately. |
| Hero backend-invalid state blocked keyboard retry via native custom validity | ARIA validation presentation separates server errors from real required/email constraints. A corrected retry reaches real HTTP. |
| Native dialog Tab boundary escaped to browser chrome/BODY | Scoped visible/enabled boundary handling wraps Tab/Shift+Tab; middle navigation, Escape and exact trigger restoration remain supported. |
| Password visibility target was 20×24 px | The shared visibility toggle has a 40×40 target and localized labels, controlling both password fields. |
| Hero pending announcement outlived its button with a dangling label reference | An exact pending→completion→unmount regression failed RED. Scoped localized polite status plus a decorative spinner/native disabled state replaces vendor pending DOM references. No `aria-busy` behavior is claimed. |

These changes preserve backend authentication, eligibility, native session, revocation and privacy invariants established by issues 01–04. No new database migration is introduced.

## Harness incidents are not production defects

Acceptance corrections distinguish framework/browser timing from actual plugin behavior:

- Selectors scope streamed forms and localized auth alerts rather than hidden Next duplicates or the framework route announcer.
- Real database prewarming avoids schema-creation HMR. Readiness waits for the fixture hydration marker and visible opacity; this does not claim JavaScript-disabled or prehydration support.
- HTTP responses are fetched and fulfilled unchanged to retain body/status/cookies across navigation; authentication/storage results are not mocked.
- Dialog focus may legitimately start on its container. Bounded focus assertions require containment and exact original-trigger restoration, allowing Hero FocusScope's animation frame but not BODY or sibling fallbacks.
- Positive OTP uses an eligible ordinary verified account. Correct-code Admin OTP has a separate 401/no-cookie denial assertion; issue 04 policy is not relaxed.
- Relative proxy Location headers are parsed against the known origin while retaining exact 307/path/query/hash assertions.
- Two preexisting unit email extractors depended on obsolete CSS. They now identify the semantic six-digit text; backend/session/privacy assertions are unchanged.
- Preserved OAuth SQLite initially failed its final correlation assertion: it collected generic refresh/OTP rejection IDs but demanded only callback events. A real callback401 and native refresh401 probe proved both logs present under distinct contracts. The bounded harness correction partitions by observed route: callback `requestId` versus generic rejection/infrastructure `correlation`. Wrapped Node responses retain actual request URL metadata separately, without changing response bytes/status/headers. No production bytes changed; all cookie, UUID, callback-specific and secret-exclusion assertions remain.

An explicitly named diagnostic subset was used during feedback. It reports `passed:false`, cannot write final acceptance JSON, and is not substituted for default full runs.

## Frozen executable and verification

Baseline: `7d854c79b273d301594d0397737431ac02e42d51`.
Executable review object: `ecd700b1a3851de61bd3524045b1487ab4279696`.
Executable tree: `b8bd620a39cba9d4e572a919da23e519765e46fb`.
These immutable objects did not move the branch. The later OAuth observation correction is pinned at `c5edce82caf1a43d198adb992c6ddb476f71de10`, tree `7e79ee830fbb004b93cdad1309523b3319c305d8`. It changes only the separate OAuth acceptance harness, outside the issue 05 source/fixture/runner+integration hash roots. The existing full issue 05 receipts therefore retain their original executable identity; they are not relabeled as whole-tree executions of the later candidate. Affected OAuth acceptance is rerun on the corrected harness. Evidence-only additions do not change either executable.

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | EXIT0; lock unchanged by installation |
| `pnpm typecheck` | EXIT0 |
| `pnpm lint` | EXIT0; zero errors and zero warnings |
| Final `pnpm test:unit` | **180/180 tests, 23/23 files GREEN** |
| Full default issue 05 SQLite acceptance | 24 matrix cells, 19 controls, 74 axe scans / zero violations; declarations and snapshots passed |
| Full default issue 05 PostgreSQL acceptance | EXIT0; 24 matrix cells, 19 controls, 74 axe scans / zero violations; declarations and snapshots passed |
| `pnpm test:consumer` | EXIT0; preserved SQLite/Turbopack/Chromium acceptance |
| `pnpm test:password:sqlite` / `pnpm test:password:postgres` | Both EXIT0; native lifecycle and browser |
| `pnpm test:otp:acceptance` | EXIT0; preserved PostgreSQL two-process acceptance |
| `pnpm test:oauth:sqlite` / `pnpm test:oauth:postgres` | Both corrected runs EXIT0; initial SQLite harness-only failure retained in lineage |
| Build/pack and packed consumer declarations | Executed inside acceptance runs, not inferred from unit tests |

Focused tests/typecheck/lint ran throughout. Earlier full unit attempts exposed brittle email extraction and were corrected; the final complete unit run covers the frozen executable. After the OAuth-only observation correction, typecheck/lint and the full 180-test/23-file unit suite passed again. Runtime commands, exact hashes, databases and regression exit codes are recorded in `issue05-acceptance.md` and its generated JSON artifacts, including `issue05-acceptance-regressions.json`. All six preserved commands ultimately passed; the initial OAuth SQLite EXIT1 remains recorded. External final source/fixture/scoped-harness and preserved browser-byte comparisons passed; the plain/OTP modes are not falsely claimed to contain newer per-job hash guards.

Independent Standards and Spec actors inspected immutable candidates and scoped corrections. Initial actionable findings were corrected; both axes report **zero remaining findings** through the frozen executable. Reviewers performed static inspection, not runtime acceptance. Both evidence-only claims and the later OAuth observation correction received scoped static checks with zero blocking findings. A minor shared-toggle wording correction was applied.

The parent inspected the final SQLite consumer in the native in-app browser: Spanish Tailwind modal layout/branding/labels, initial Cerrar focus, Shift+Tab to Regístrate, Tab back to Cerrar, and Escape restoring the exact Open login trigger. This is agent-driven visual/keyboard inspection, not human screen-reader evidence or a full manual matrix.

## Delivery boundaries and operational limits

The user approved a 2,700–4,200 authored-line forecast exception on the current branch/same hardening PR. The original executable has 2,299 additions+deletions. Final staged delivery has 3,764 changed lines: 2,529 authored code/prose and 1,235 generated JSON lines, within the approved authored ceiling. No push, PR, release, SDD artifacts or fabricated approval receipt is part of this delivery. RDD remained on by default and unchanged. Preexisting untracked `.scratch/`, audit reports and unrelated docs remain outside the commit.

The CI SQLite acceptance step is versioned; remote GitHub Actions was not executed locally. Local evidence uses Node 22/Chromium and real disposable SQLite/PostgreSQL. Node 24/Ubuntu certification, live Google, real mobile devices, human screen-reader announcements/reading order and human contrast/zoom/target inspection remain outstanding. Automated axe/keyboard success is not full WCAG 2.2 AA proof. Consumer deployment, policy/resource configuration, credentials and production migrations remain consumer/ticket 06 responsibilities.

## Rollback

Revert this issue 05 presentation/contracts/email/logging/tests/package/docs work unit coherently to baseline `7d854c7`, retaining issues 01–04 security protections. Do not restore unsafe legacy email rendering: retain the safe email corrections or disable the incompatible presentation flow while preparing a compatible artifact. Consumer locale/configuration contract changes must move with the matching plugin artifact.

Do not roll back users, passwords, native sessions, verified evidence, Google associations, challenge consumption or revocation history. Do not reactivate expired/consumed proofs or bypass Admin eligibility to recover presentation compatibility. No issue 05 data migration needs reversal. Production rollout/rollback and accessibility signoff are not certified by disposable fixtures.
