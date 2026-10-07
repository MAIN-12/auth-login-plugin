# Finance Tracker v2 — Google login failure handoff

Date: 2026-09-27
Project: `/home/charlie/Documents/GitHub/Finance-Tracker-v2`
Web app: `apps/web`, running at `http://localhost:3000`
Installed auth plugin: `@main12/auth-login@2.1.0`
Installed Payload: `3.90.2`

## Confirmed diagnosis

The observed Google failure is a **project database-schema mismatch**, not a demonstrated redirect defect in the auth plugin.

The user returns to:

```text
/auth/login?error=Google%20login%20failed
```

This is the configured OAuth **failure** destination. It indicates the callback failed before completing login; it is not evidence that a successful login redirected back to itself.

Temporary callback diagnostics from real Google attempts recorded PostgreSQL error `42703` (undefined column) during the local user lookup. An independent read-only query using the project's actual Payload configuration reproduced the error and identified the missing column:

```text
users.reset_password_requested_at
```

The generated Payload/Drizzle users schema expects:

```text
name: reset_password_requested_at
SQL type: timestamp(3) with time zone
nullable: yes
```

A read-only `information_schema.columns` check confirmed that `payload.users` lacks this column. The existing `sub` OAuth column, `users_sessions` table, and `auth_otps` table are present.

Payload defines `resetPasswordRequestedAt` as a hidden date field used when password-reset request throttling is enabled. Since user lookup selects the configured fields, a missing password-reset column also breaks Google authentication.

The project's `apps/web/payload.config.ts` uses:

```ts
postgresAdapter({
  schemaName: 'payload',
  push: process.env.PAYLOAD_DB_PUSH === 'true',
  // ...
})
```

Automatic schema synchronization is not enabled in the observed setup. The dependency/schema changes need an explicit project migration.

## Recommended next steps for the project chat

1. Confirm the configured database is the intended target. Do not enable broad automatic schema pushing just to resolve this error.
2. Add a tracked, additive migration following the project's existing scripts/migrations convention. The proposed SQL is:

   ```sql
   ALTER TABLE "payload"."users"
     ADD COLUMN IF NOT EXISTS "reset_password_requested_at"
     timestamp(3) with time zone;
   ```

3. Dry-run transactionally, verify the resulting schema, then apply and record the migration through the project's normal process. No financial tables or existing user values need changing for this identified gap.
4. Repeat the read-only Payload user lookup. Check for any additional schema mismatch rather than assuming this resolves every possible issue.
5. Restart the dev server to discard temporary compiled diagnostics, then perform a fresh Google login. Do not replay an old Google callback URL: authorization codes are single-use.
6. Verify the full flow: Google callback succeeds, `/api/users/me` returns the authenticated user, `/account` routes to the user's account dashboard, and no return to the failure page occurs.
7. Verify dots on the login page and preserve the intended account destination for password/OTP login too.

**No database migration was applied in this chat.** The proposed migration-creation/dry-run command was interrupted before its files appeared. At handoff, neither `scripts/migrate-auth.mjs` nor `scripts/migrations/20260927_auth_password_reset.sql` exists.

## Integration findings and changes already made

The user asked to hand further project changes back to the project chat after diagnosis. Before that clarification, these focused changes were made in Finance Tracker; review and retain or revise them there:

### `apps/web/src/app/(frontend)/auth/[...slug]/page.tsx`

- Removed `texture="none"`, restoring the plugin's default dots texture.
- Set an explicit, validated post-login destination with `/account` as the fallback. Previously AuthPages omitted `redirectTo`, inheriting the plugin's `/admin` default for non-Google login.
- Normalized self-referencing/invalid `redirect` query parameters before forms read them.
- Added server-side session validation on the login route so an already authenticated user proceeds to the validated destination.

### `apps/web/src/providers/auth/domain/rules/sessionRules.ts`

- Added `resolveLoginDestination()`.
- Preserves local destinations and their query/hash.
- Falls back to `/account` for external URLs and auth-page destinations.

### `apps/web/tests/auth-redirect.test.ts`

- Added two focused tests covering the fallback, auth-page loop prevention, and preservation of valid account destinations.
- Both tests passed.

### `apps/web/scripts/diagnose-auth-schema.ts`

- Added a temporary read-only diagnostic script using the actual Payload configuration.
- It prints expected user-column metadata and the missing-column name, not user records.
- Both diagnostic processes started by this chat were stopped at handoff.
- Remove or formalize this script in the project chat as appropriate.

The app's TypeScript check passed after the integration changes. This is not an end-to-end login verification; Google login remains unverified until the schema migration is applied and the flow is retried.

## Runtime and temporary diagnostic state

- The original Finance Tracker dev server was restarted during diagnosis, on the same port 3000.
- A replacement `pnpm exec next dev --port 3000` process started by this chat remains running.
- The installed `payload-oauth2` callback source was temporarily instrumented to identify the failure. Its original source has now been restored from a backup.
- Turbopack may still have the diagnostic code in its running/compiled cache. Restart the server before final validation; regenerate its dev cache if necessary.
- Diagnostic logs may include stack/query context. Do not copy raw logs, OAuth codes, credentials, cookies, or personal data into issues or handoffs.

## Existing configuration that is already correct

Finance Tracker configures Google OAuth with:

```ts
successRedirect: '/account',
failureRedirect: '/auth/login?error=Google%20login%20failed',
```

The live authorization endpoint directed Google to the expected callback:

```text
http://localhost:3000/api/users/oauth/google/callback
```

The account entry route validates the session with `payload.auth({ headers })`, then selects/provisions the account and redirects to its dashboard. The project-owned proxy does not treat cookie presence as authentication.

## Scope and working-tree caution

- No auth plugin source fix, release, or npm publish was performed for this incident.
- Finance Tracker already had uncommitted changes when this investigation began, including its plugin integration, package files, layout, proxy, and generated types. Those must be preserved.
- At the final audit, multiple project files were staged by another actor/process. This chat did not stage, commit, or push Finance Tracker changes. Do not reset the working tree wholesale.
- The proposed schema migration and final successful Google-login verification belong in the Finance Tracker project chat.


## Follow-up: misleading “no account found” message

The user also reported that email login claimed the existing Google-linked account did not exist, while production could authenticate it against the reportedly same database.

A **separate plugin error-handling bug** was confirmed by source inspection:

1. `/api/auth/check-email` catches a failed database query and correctly returns HTTP 500 with `{ "error": "Failed to check email" }`.
2. In version 2.1.0, the client `checkEmail()` reads that JSON without checking `response.ok`.
3. The login flow evaluates `!data.exists`; since the error payload has no `exists` field, it wrongly displays “No account found”.

Consequently, that message is not reliable evidence that the user is absent. The already-confirmed local schema failure can produce it. Production using a different Payload version or configuration could work against the same database; production's runtime and database identity were not independently verified in this investigation.

A fix has been implemented locally in the auth-plugin workspace: reject unsuccessful HTTP responses and invalid lookup response shapes, leaving the form on the email step with a retryable error. Only a successful response explicitly reporting `exists: false` should show the missing-account message. This client-side fix does not repair the project's database schema and has not been installed in Finance Tracker or published as part of this investigation.

Validation of the plugin error-handling fix: all 78 tests passed, including server-failure, malformed-response, and genuine-missing-account cases; package build passed. The fix remains unpublished.
