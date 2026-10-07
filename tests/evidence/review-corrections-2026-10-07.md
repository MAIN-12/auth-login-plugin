# Review corrections — 2026-10-07

Three reviewed defects are fixed; the additional Webpack smoke failure was corrected in fixture setup, not production UI. Changes are local against HEAD `894c3e9b650673257fb8a1ed6553adf5c5ee2205`; no commit, push, PR, publication or release approval is implied.

## Changes and regression seams

| Concern | Correction | Proof |
|---|---|---|
| Email ownership (R11) | Deny untrusted email updates, including no-op/bulk; retain explicit trusted Local API provisioning | Real REST/GraphQL/Local API tests in `email-identity-http.test.ts`; unrelated profile updates continue |
| OAuth rejection (R03) | A throwing consumer logger cannot interrupt safe response, correlation or cookie cleanup | Callback regression in `auth-endpoints.test.ts` |
| Native ESM (R39/S056) | SWC retains JSON import attributes; installed tarball imported before Next startup | Actual compiled-module Node import test and native root/migration export probe |
| Webpack smoke | Initialize Payload/SQLite before opening the form; require response JSON in both bundlers | Identical control failed; warmed Webpack smoke passed without auth retry or relaxed success checks |

Email changes are not a new public feature. Profile update payloads must omit email, including unchanged values. Trusted provisioning must prove ownership or clear verification; the consumer reassignment fixture explicitly clears `_verified`. See [integration contract](../../docs/plugin-contracts.md#email-identity-updates).

## Executed checks

- Five focused regressions failed before fixes; 22 focused tests passed afterward.
- `pnpm test:unit`: **202 tests / 27 files passed** on Node **22.23.2** and **24.8.0**.
- `pnpm lint` and `pnpm typecheck`: exit 0 on both runtimes.
- `pnpm build`: exit 0; each packed run also independently rebuilds and installs its tarball.
- Native root import exposes `authLoginPlugin` and `migrateAuthLogin` on both runtimes.
- `AUTH_CONSUMER_BUNDLER=webpack pnpm test:consumer`: failed control, then passed after fixture warmup.
- Independent read-only Standards and Spec checks: no new scoped findings; Spec independently reran 11 regressions and the native import. This is not formal merge/release authorization.

### Current packed runs

All rows passed with Chromium and real databases, native packed import, declarations and unchanged source/fixture/harness checks. Node22 runs use `AUTH_CONSUMER_BUNDLER=webpack`; Node24 plain uses default Turbopack. Each command is `pnpm test:consumer` with the flags below, plus a temporary output path. PostgreSQL ran in a disposable local PostgreSQL 17.8 cluster.

| Scope | Node | Flags | Raw result |
|---|---|---|---|
| OTP / SQLite | 22.23.2 | `AUTH_CONSUMER_DB=sqlite AUTH_CONSUMER_OTP=1` | [result](review-corrections-2026-10-07/otp-sqlite.json) |
| OTP / PostgreSQL | 22.23.2 | `AUTH_CONSUMER_DB=postgres AUTH_CONSUMER_OTP=1` | [result](review-corrections-2026-10-07/otp-postgres.json) |
| Controlled OAuth/Admin / SQLite | 22.23.2 | `AUTH_CONSUMER_DB=sqlite AUTH_CONSUMER_OAUTH=1` | [result](review-corrections-2026-10-07/oauth-sqlite.json) |
| Password lifecycle / SQLite | 22.23.2 | `AUTH_CONSUMER_DB=sqlite AUTH_CONSUMER_PASSWORD=1` | [result](review-corrections-2026-10-07/password-sqlite.json) |
| Migration/backup/restore / SQLite | 22.23.2 | `AUTH_CONSUMER_DB=sqlite AUTH_CONSUMER_ISSUE06=1 AUTH_CONSUMER_OTP=1` | [result](review-corrections-2026-10-07/migration-sqlite.json) |
| Plain consumer / SQLite | 24.8.0 | Default flags | [result](review-corrections-2026-10-07/plain-node24.json) |

## Frozen runtime identity

All six raw results have identical hashes, independently checked against current source and consumer fixture. Build configuration is additionally identified below because the legacy harness digest does not include `.swcrc`.

- Source: `d200448eea135d327bca54adc7084f2c15779e8600525425122c193f26caaad4`
- Fixture: `671b680aaa79adcf5e9539207c49bbad3bd397d080bb3854008f741696a33f31`
- Harness/manifest/lock: `9340d36da212d4b29a5fa7dbbec9fff71cc6e9eab3de84d1871b85eded09b3fa`
- Packed artifact: `a78d359d372e2bb462893675dd57eb0131fb3a5e4a82a2c56c14b0ac0a91f3bb`
- SWC configuration: `227a84270ab93aa689f50e09433b95d2c30282870a27c479e175af1f001fec70`

## Limits and rollback

### Commit preparation

The installed pre-commit hooks subsequently normalized the staged files with Prettier/ESLint. The six packed results and hashes above identify the **pre-hook executed snapshot**, not the final formatted commit. They were retained without relabeling or rewriting. No packed matrix rerun is claimed after formatting.

The exact staged code was exported with `git checkout-index` into a disposable directory, excluding concurrently edited UI/tooling and earlier untracked audit/reference files. On that isolated snapshot, `pnpm test:unit` passed **202 tests / 27 files** on Node **22.23.2** and **24.8.0**; lint, typecheck, build and native import of the built root/migration exports passed. Installed dependencies were shared, not freshly installed. A shared-worktree Node24 run during concurrent UI edits had two style-test failures; it is not substituted for or labeled as passing snapshot validation.

The historical 22-run issue06 matrix remains unchanged and historical, not reclassified as execution of these changes. This correction did **not** rerun PostgreSQL password/OAuth/migration/integration or the complete Node24 matrix. Manual accessibility, live Google, remote Linux CI, host patching and production rollout remain pending. Root dependencies were reused; packed consumers were freshly installed. No optional architecture refactoring, account migration, or new public email-change workflow was added.

Rollback boundaries: logger and native ESM build/probe fixes are independent of email policy; the Webpack warmup is fixture-only. Do not remove the email guard or restore public reassignment with retained verification as a safe rollback. An alternative requires an explicitly verified ownership-change workflow.
