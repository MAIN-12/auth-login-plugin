# Migrating existing accounts

**The consumer owns data migration, legacy cleanup, authentication cutover and rollback.** The plugin supplies collection schema and runtime authentication safeguards, not a migration runner or an offline data-conversion API. Apply the [consumer-generated Payload migrations](schema-migrations.md) first.

## Passwords and verification evidence

The hardened plugin requires `auth.useSessions: true`, `auth.verify: true` and the email local strategy. Preserve existing account IDs, native `hash`/`salt`, trustworthy `_verified` evidence and provider associations. Do not populate `_verified: true` from the presence of a password, email address or prior login. Unknown verification blocks new access until ownership is proven.

Existing short passwords remain usable for login; the new 15-character/blocklist policy applies to newly chosen passwords, not a destructive rehash or migration reset. If an earlier OTP implementation destroyed a password, the plugin cannot reconstruct it. Preserve the native state: recovery requires actual hash/salt evidence; a passwordless account needs an explicitly permitted authentication method followed by authenticated password addition. No available method means a trusted operator remediation, not invented credentials.

## Verification without password replacement

Configure the existing `otp` mail/origin/storage settings and send `POST <apiPrefix><authEndpointPrefix>/otp/send` with `{email, purpose: "verify-email"}`. Verify with `{email, purpose: "verify-email", context, otp}` at `/otp/verify`. Issuance is generic for missing, deleted, already verified and eligible accounts; only eligible accounts receive mail. This is an ownership operation, not implicit enabling of OTP login: `otpLogin`/`passwordLogin` continue controlling login methods.

A successful verification returns only `{success: true}`. It does not issue a password permit, cookie, token, login or session. The challenge binds collection, purpose, email, account identity and current native credential/verification evidence. It uses the configured OTP TTL, resend rules, account/origin budgets, attempts and durable cross-process consumption. Expiry, replay and changed native evidence fail closed. Proof is consumed before the native commit; storage/hook/policy failure burns it, requiring a fresh issuance rather than replaying an ambiguous effect.

The native transaction sets only `_verified: true`, checks hash/salt and sessions unchanged after host update hooks, and requires the original host `access.admin` to explicitly deny the account both before and after the update. Email-only proof cannot unlock an administrative account. Such accounts require trusted operator provisioning. Direct HTTP/GraphQL writes to `_verified`/`_verificationToken`, passwords and session authority are denied; trusted server provisioning uses Local API `overrideAccess: true` plus `context.authLoginCredentialProvisioning: true`.

## Operational cutover and rollback

Announce the access interruption. Stop every web instance, worker, scheduled task and other writer, not just the instance running a migration. Keep the public edge in maintenance until verification is complete. A boolean maintenance assertion cannot enforce this deployment guarantee.

Take an adapter-native backup while writers are stopped and rehearse restoring it in an isolated environment. Inventory all authentication collections, old OTP collections and host-defined grants; the previous plugin stored OTPs in `auth-otps`. Preserve accounts and passwords, invalidate native sessions and legacy OTP/reset/verification authorization, and retain provider associations. Never restore an old authorization artifact into live traffic merely because it was present in a backup.

### Consumer-owned security state

Implement and review the migration in the consuming application, using its actual schema, adapter and legacy inventory. Preserve account IDs, hash/salt, trustworthy verification evidence and provider mappings. Coordinate invalidation of native sessions, reset/verification tokens, legacy codes and host-defined grants; do not remove unrelated tenants' data or reset shared account/origin quotas. Keep consumed-proof ledgers and durable security records across upgrades.

The runtime reads the `auth-login-cutovers` collection as a collection-scoped proof generation. A missing record is the initial baseline; a stored generation must be 64 lowercase hexadecimal characters. The consumer's stopped-writer security cutover must establish a fresh cryptographically random generation for each affected auth collection together with its revocations. The plugin does not publish generations or orchestrate this work. OTP challenges, Google correlations and method permits bind that generation, and read failures fail closed. Preserve this schema/runtime safeguard rather than treating it as a data-migration service.

Test the application's migration and restore procedure against its real database before deployment. A failed migration must leave traffic disabled until the consumer can verify a consistent, security-equivalent state.

### Rollback rehearsal and deployment

1. Keep all writers stopped and public traffic in maintenance.
2. Restore the backup into the isolated rehearsal environment or intended rollback database.
3. Use a security-equivalent hardened build and rerun the **consumer-owned revocation/cutover procedure** against the restored database before serving requests. Reuse the verified inventory but establish a fresh generation; a restored epoch alone cannot prevent replay.
4. Check account counts/credential preservation, stale sessions/codes/permits rejected, unrelated collections intact, and verified/unverified accounts follow the expected login/ownership policies.
5. Resume only after those checks and the release gates pass.

Restoring an old database and immediately serving it can revive its old sessions/codes/permits; no database-resident epoch can magically protect that unsafe sequence. Likewise, an insecure prior plugin is **not** a safe rollback target. Rehearsal is not deployment approval and does not claim recovery of destroyed passwords.

**Concurrent SQLite host requirement:** configure `sqliteAdapter({ wal: true, busyTimeout: 1000, ... })` on every instance. The demonstrated two-process setup uses WAL plus a 1,000 ms native read busy timeout; default DELETE journal/zero timeout can fail native authentication/logout during overlapping OTP writes. The plugin does not silently change the host journal mode or retry authentication hooks. Local file/WAL requires a filesystem that supports SQLite shared-memory/locking; multi-host network filesystems are not established support.

## Compatibility when deploying the auth-clean refactor

The plugin no longer provides an offline account-maintenance or data-migration API.
Consumers must own and test their preservation, revocation and rollback procedures.
The collection schema and runtime generation checks remain unchanged.

Google correlations created before exact principal binding was required cannot finish
link/reauthentication after upgrade. Drain eligible flows before rollout or start fresh
login/link/reauthentication. Never accept an unbound legacy correlation or restore a
consumed permit to rescue a callback. Code rollback is safe only to a build preserving
these checks and current generation; it cannot revive sessions/correlations/permits.

Apart from the removed public migration helper, authentication exports, inert legacy client functions and HTTP compatibility stubs,
schema and proof formats remain.
A pre-cutover backup still requires the stopped-writer re-cutover procedure above.
