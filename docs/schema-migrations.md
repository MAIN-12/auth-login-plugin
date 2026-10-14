# Generate auth tables with Payload migrations

The plugin extends the configured authenticated collection and registers five internal Payload collections. The consumer generates, reviews, versions and executes migrations for the complete configured schema; no separate auth SQL migration or readiness command is required.

## Fresh database

1. Keep the plugin enabled in the application's Payload configuration.
2. Run `payload migrate:create initial` through the application's configured Payload runner.
3. Review and commit the generated TypeScript migration and JSON snapshot.
4. Apply with `payload migrate` before serving authentication traffic.

Development can use Payload schema push. The local demo and disposable acceptance fixtures use native schema push, without custom `CREATE TABLE` bootstrap code.

## Internal collections

| Collection slug               | Database table                | Constraints                                                                    |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| `auth-login-otp-security`     | `auth_login_otp_security`     | Unique key; optional encrypted value                                           |
| `auth-login-credential-locks` | `auth_login_credential_locks` | Unique key                                                                     |
| `auth-login-password-permits` | `auth_login_password_permits` | Unique key; numeric millisecond expiration                                     |
| `auth-login-identities`       | `auth_login_identities`       | Unique collection + provider + subject; unique collection + account + provider |
| `auth-login-cutovers`         | `auth_login_cutovers`         | Unique collection; required generation                                         |

All five are registered regardless of enabled login methods because credential coordination and runtime proof validation share their state. They use Payload-generated IDs, no timestamps or document editing locks, hidden Admin entries, disabled REST and GraphQL endpoints, and denied ordinary collection access. Trusted server-side Local API calls using `overrideAccess: true` can still access them; this is not an authorization boundary against trusted application code. Runtime coordination retains native transactions, row locks, encryption and unique arbitration.

Collection slugs and database names are reserved. Registration fails on collisions rather than silently reusing consumer-defined collections. Consumer auth collection names remain configurable.

## Existing databases and upgrades

Existing manually created `auth_login_*` tables are not automatically adopted. Their schema differs from Payload-managed collections (including generated IDs and numeric expiration). Use a new empty database for this initialization flow. Applications with existing durable auth data must prepare an explicit preservation migration; never drop replay-protection or subject-mapping data as an incidental upgrade. Previously applied migration history remains immutable.

### Preserve existing Google identities

The shared `auth-login-identities` collection replaces `auth-login-google-identities`; its table is `auth_login_identities`. Every identity now requires `provider`. Google login reads and writes only `provider = 'google'`.

For an existing database, **do not accept a generated drop/create that discards Google mappings**:

1. Back up the old table and pause authentication writes for the migration window.
2. Generate the consumer migration, then review/edit it to rename or copy the old table into the new schema while preserving every collection, subject and account association (and existing generated IDs where applicable).
3. Backfill existing rows with `provider = 'google'` before enforcing the required field. Replace the old unique indexes with `(collection, provider, subject)` and `(collection, account, provider)`.
4. Verify row counts and original mappings, test login/link/reauthentication, and coordinate rollback with the old schema and code. Never reconstruct missing mappings from email.

The plugin supplies the new collection schema, not a migration runner or automatic data conversion. Older manually provisioned tables may need ID/schema adaptation as described above.

### Adding providers progressively

The shared storage accepts provider keys without a fixed enum; only Google authentication is currently implemented. Each future provider needs its own validation, configuration and flow, and must pass its provider key explicitly to identity storage. One local account may have identities from several providers, but at most one identity per provider in an auth collection.

For OIDC, subjects are unique within their issuer, not across issuers. A future provider key must identify one validated issuer, or storage must be extended to include issuer before supporting multiple issuers under the same key. Do not identify or link accounts by matching email.

After changing plugin versions, generate and review a consumer migration normally. Do not disable the plugin while generating schema changes: that would remove its collections from the configured schema.

The previous `@main12/auth-login/schema` readiness API and `@main12/auth-login/migrations` entry points are not exported. The root package also has no data-migration or offline cutover API. Data conversion, legacy cleanup and [operational cutover](migration.md) belong to the consumer.
