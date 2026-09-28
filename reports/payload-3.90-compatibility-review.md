# Payload 3.90 compatibility review

Reviewed 2026-09-27 against the supplied upgrade report, installed Payload 3.90.2 and payload-oauth2 1.0.21, and official release notes. Existing uncommitted UI/package changes were preserved.

## Verdict

The report's cookie fix is warranted, but its diagnosis is incomplete. The plugin cannot yet be certified fully compatible across all authentication flows. Focused compatibility fixes are implemented below; the remaining architectural issues require follow-up and real database/browser integration coverage.

## Report comparison and implemented fixes

- **OTP cookie:** replaced the hardcoded cookie with Payload's exported `generatePayloadCookie`, matching its cookie prefix, expiry, domain, Secure, and string/boolean SameSite handling. Use configured settings instead of inferring trust from `x-forwarded-proto`. Added Payload's CORS response helper.
- **Login context:** use exported `loginOperation` with the incoming request, as Payload's REST login handler does. Unlike the suggested Local API call, this retains the token long enough to set the cookie when `removeTokenFromResponses` is enabled. The JSON response still honors that option. Sessions remain managed by Payload.
- **Missing `req` is not proof of missing sessions:** Payload's Local API creates a local request and creates sessions itself. Forwarding the original request is appropriate for context/transactions/hooks, but a manually emitted cookie does not itself erase the JWT's session ID.
- **Set password does need changes:** forward `req` to the update so Payload 3.90 can preserve `req.user._sid` while revoking other sessions. Reject principals from other auth collections, preventing an identically numbered account from being changed.
- **OTP collection access:** hiding the collection in Admin is not access control. Explicitly deny public collection CRUD. Trusted Local API calls retain their default access override.
- **Migration:** 3.90 adds `resetPasswordRequestedAt`, not just session-related schema requirements. The existing consumer handoff also reports this missing column. Sessions were already enabled by default before 3.90; attributing that default specifically to this release is inaccurate.

## Remaining findings, ordered by impact

1. **High: OTP verification replaces the stored password before login.** Existing passwords stop working; Payload 3.90 also revokes sessions on password changes. A failure or lockout after the update can leave the password changed without a successful login. This was pre-existing and is not solved by cookie changes. Replace this design with a dedicated passwordless authentication implementation that enforces account lock/verification policy, persists a session, signs with Payload's supported JWT helper, and has rollback/concurrency coverage. Do not restore password hashes around a temporary login or disable sessions as a workaround.
2. **High: OTP lifecycle is not atomic and issuance is not throttled.** Verification uses separate read/increment/delete operations; simultaneous verifications can race. Resending deletes the previous record and resets its attempt budget. Payload's native forgot-password throttling does not protect this custom OTP recovery flow. Add durable per-account issuance throttling and atomic single-use consumption with adapter-specific integration tests.
3. **High: Google signup policy is not enforced.** `allowSignup: false` guards the custom signup endpoint, but is not passed to or enforced around OAuth user provisioning. The option's documentation promises more than the implementation delivers.
4. **Medium: OAuth cannot be assumed native-compatible.** payload-oauth2 1.0.21 creates sessions but signs with `SignJWT` and only an `alg` header. Payload 3.90.2's native JWT strategy requires `authVersion`. Its custom OAuth strategy can still authenticate these tokens, so this is not proof that OAuth login fails. Audit that strategy against current Payload checks and integration-test login, refresh, logout, expiry, and session revocation before certifying it. Prefer an upstream release using Payload's `jwtSign`; do not edit node_modules or blindly re-sign unverified callback tokens.
5. **Medium: password-presence detection is inconsistent.** Check-email uses `user.password`, which Payload does not return as a readable credential; OTP verification instead uses `user.hasPassword`, which this plugin neither registers nor maintains. This can route password users into OTP incorrectly. Define and migrate a consistent non-secret password-setup indicator, including existing users and native password reset paths.
6. **Configuration limits:** the implementation assumes an email-authenticated `users` collection and `/api` routes. Username-only auth, disabled local auth, custom auth collection slugs, and custom API route prefixes are not supported end-to-end. These are not newly introduced by 3.90.

## Consumer upgrade steps

Keep all first-party Payload packages on matching versions (review target: 3.90.2). In the consuming app, regenerate types, generate and inspect a migration, and apply it through the normal deployment process:

```sh
pnpm payload generate:types
pnpm payload migrate:create payload-3-90-auth
pnpm payload migrate
```

For relational databases, verify session tables and `resetPasswordRequestedAt` exist. The exact names depend on the adapter/schema. Do not treat `PAYLOAD_DB_PUSH=true` as a universal Payload migration command; development schema push is adapter/project configuration. No consumer database was modified in this review.

## Validation

- Production build passed (TypeScript declarations, SWC, ESM import rewriting).
- Full Vitest suite passed: 85 tests in 9 files, including the OTP collection access regression.
- `git diff --check` passed. Lint could not run because the existing ESLint configuration imports the missing `@payloadcms/eslint-config` package.
- Endpoint regression tests use the real Payload cookie helper and mock the login operation; they cover sessions on/off, request context, configured cookies, JSON token suppression, and cross-collection password-update rejection. They do not demonstrate real session persistence or browser cookie acceptance.
- Live Google OAuth, a production database upgrade, concurrent OTP consumption, and multi-device session behavior were not exercised.

## Sources

- https://github.com/payloadcms/payload/releases/tag/v3.90.0
- https://github.com/payloadcms/payload/releases/tag/v3.90.2
- https://payloadcms.com/docs/authentication/overview
- Installed Payload sources: `dist/auth/operations/local/login.js`, `dist/auth/operations/login.js`, `dist/auth/endpoints/login.js`, `dist/auth/cookies.js`, `dist/auth/strategies/jwt.js`, `dist/collections/operations/utilities/update.js`.
- Installed payload-oauth2 sources: `dist/callback-endpoint.js`, `dist/auth-strategy.js`, `dist/auth-sessions.js`.
