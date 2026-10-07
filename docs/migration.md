# Migrating existing accounts

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

### Offline package API

```ts
import { migrateAuthLogin } from '@main12/auth-login'

// Run only after all instances and writers are stopped and a native backup exists.
const report = await migrateAuthLogin(payload, {
  collection: 'customers',
  maintenance: true,
  // Optional, explicitly inventoried legacy collection and target-only filter:
  legacyOtpCollection: { slug: 'auth-otps', where: { scope: { equals: 'customers' } } },
})
```

This is a trusted server-only operational API, not an endpoint. `maintenance: true` attests the operator has actually stopped writers; the helper cannot stop deployments. Its result is `{success: true, collection, accounts, legacyCodesDeleted, generation}`. It requires SQLite/PostgreSQL plus native sessions/verification. It does not require changing Payload or OTP secrets, environment variables or `/dev`.

One native transaction preserves target accounts, hash/salt, verification evidence and provider associations while clearing native sessions, `resetPasswordToken`, `resetPasswordExpiration` and `_verificationToken`, deleting only explicitly inventoried legacy codes and storing a fresh cryptographically random collection generation. Direct native storage writes bypass host change hooks intentionally: migration is not credential provisioning. Failure rolls back all effects; retry preserves accounts and generates another cutoff rather than restoring authority. Schema initialization may remain after failure but grants no access.

The collection generation binds OTP challenge keys, Google correlation state and the encryption key for signup/recovery/reauthentication permits. No process-local cache serves stale generations, and a failed generation read is not treated as the baseline. Existing security rows remain encrypted and inert rather than globally purged; consumed-permit records are retained. Account and trusted-origin quota keys/budgets are **not** reset, other collections are untouched, and provider associations are not deleted. Plan adapter-native storage retention separately; this API does not promise garbage collection. An empty legacy filter is appropriate only when that collection is exclusively dedicated to the target; absent configuration does not claim arbitrary host authorization has been inventoried.

### Rollback rehearsal and deployment

1. Keep all writers stopped and public traffic in maintenance.
2. Restore the backup into the isolated rehearsal environment or intended rollback database.
3. Run a security-equivalent hardened build and **rerun `migrateAuthLogin`** against the restored database before serving requests. Use the same inventoried legacy filter. Each call chooses a fresh random generation, even after restoring an older backup and with unchanged host keys.
4. Check account counts/credential preservation, stale sessions/codes/permits rejected, unrelated collections intact, and verified/unverified accounts follow the expected login/ownership policies.
5. Resume only after those checks and the release gates pass.

Restoring an old database and immediately serving it can revive its old sessions/codes/permits; no database-resident epoch can magically protect that unsafe sequence. Likewise, an insecure prior plugin is **not** a safe rollback target. Rehearsal is not deployment approval and does not claim recovery of destroyed passwords.

**Concurrent SQLite host requirement:** configure `sqliteAdapter({ wal: true, busyTimeout: 1000, ... })` on every instance. The demonstrated two-process setup uses WAL plus a 1,000 ms native read busy timeout; default DELETE journal/zero timeout can fail native authentication/logout during overlapping OTP writes. The plugin does not silently change the host journal mode or retry authentication hooks. Local file/WAL requires a filesystem that supports SQLite shared-memory/locking; multi-host network filesystems are not established support.
