# Issue 03 — packed, real-database and browser acceptance

**Final reviewed source: GREEN on SQLite and PostgreSQL.** Each run builds and packs the plugin, installs the tarball into a disposable Next consumer, starts two independent Payload processes sharing one real database, executes native HTTP and Chromium flows, and typechecks the consumer. These results do not replace root's full suite, independent reviews or aggregate delivery evidence in `issue03.md`.

## Reproduce

Actual final command, executed from the repository root on 2026-10-06:

```sh
pnpm test:password:sqlite > /tmp/password-sqlite-review-final.log 2>&1 && \
  pnpm test:password:postgres > /tmp/password-postgres-review-final.log 2>&1
```

**Combined exit: 0.** Both consumer declaration checks passed. The scripts expand to:

```sh
AUTH_CONSUMER_PASSWORD=1 AUTH_CONSUMER_DB=sqlite AUTH_CONSUMER_BUNDLER=webpack node scripts/test-consumer.mjs
AUTH_CONSUMER_PASSWORD=1 AUTH_CONSUMER_OTP=1 AUTH_CONSUMER_BUNDLER=webpack node scripts/test-consumer.mjs
```

`pnpm test:password:acceptance` runs the same two scripts sequentially. PostgreSQL defaults to `/opt/homebrew/opt/postgresql@17/bin`; `AUTH_TEST_POSTGRES_BIN` can override its executable directory. The runner starts a temporary cluster and removes it and the disposable app during cleanup. The `/tmp` logs are local execution evidence, not committed artifacts.

| Runtime | Actual version / mode |
|---|---|
| Node | `v22.23.2` |
| Payload / both adapters | `3.90.2` |
| Next | `16.3.6`, Webpack |
| React | `19.2.6` |
| PostgreSQL | `postgres (PostgreSQL) 17.8 (Homebrew)` |
| Browser driver | Playwright `1.58.2`, headless Chromium |
| SQLite run | Real file database; two processes; `otpLogin:false` |
| PostgreSQL run | Real temporary cluster; two processes; `otpLogin:true` |

SQLite demonstrates recovery independent of login OTP. PostgreSQL additionally exercises pre-issued login OTP invalidation and explicit password addition to an OTP-only account.

## Exact tested inputs

Both final runs reported identical source, fixture and package hashes. The runner hashes every file below `src`, asserts that production source did not change during build/pack, and asserts that the copied fixture equals its source before modifying the disposable manifest.

| Input | SHA-256 |
|---|---|
| Production `src` tree | `0f321415015ad9a84da06ff6a80808c0932d56650cd53f9bf650eb2aa9ae6058` |
| Copied `tests/consumer` tree | `486f12af23e0b77766aae8dc44f81c330df7dc45e22a19cd530a171b3ac87641` |
| Installed `main12-auth-login-2.2.1.tgz` | `77ce410f25e85a11c8934a854ea7a16cbfe931851140a7ae67b53c89f3563f24` |
| Repository `package.json` | `60f626243fda79c52e361c908d76835c7a7ea318a9437ea6a4355dd01c19a8a9` |
| Repository `pnpm-lock.yaml` | `16ecd52cb50960310706e294d4d156835a2896e8dc84fcf5dd7a0694f7bdff3d` |
| `tests/password-browser.mjs` | `b82499d08f98a9912afd51ba1aadc396461798b9f65805e500bd1d80c2e3f59c` |

Manifest, lock and acceptance-script hashes were captured separately with `shasum -a 256`. The source-tree hash includes the corrected ownership application policy, typed binding codec, Zod schemas and mounted-proof restart implementation.

## Observed scenarios

| Boundary | Actual assertions |
|---|---|
| Malicious preregistration | No account or password before ownership proof; an expired initial challenge does not reserve the address; owner chooses credentials only afterward; no automatic session. |
| Direct HTTP bypass | Short and 15-character breached `Mailcreated5240` passwords reject without spending a valid permit; role/email injection rejects, then clean completion succeeds with the fixture's ordinary role; native forgot/reset and authenticated password PATCH remain blocked. |
| Single-use and binding | Wrong purpose, consumed grants and expired grants reject; signup completion → real account deletion → same-grant replay rejects; recovery proof cannot transfer to a replacement account with the same email. |
| Recovery lifecycle | Request/verify preserve existing sessions and password; limited permit is not an application cookie; confirmed reset revokes all sessions and another outstanding recovery permit, rejects the old password, and requires a new login. |
| Real rollback | A disposable Payload `beforeChange` hook throws on final credential write. Password and existing sessions remain valid, and the same permit succeeds after the fault is removed. Root's aggregate evidence covers other transaction-boundary checks. |
| Cross-process races | One reset wins competing consumption; overlapping native refresh cannot resurrect revoked sessions; an old-password login paused after real password verification but before native session write rejects after reset commits on the other process. PostgreSQL also rejects a pre-issued login OTP after reset. |
| Legacy / unavailable method | A short legacy password still logs in; unknown and passwordless recovery requests remain generic and deliver no recovery proof; recovery cannot add a password. |
| Voluntary change | Missing, expired and other-session reauth proof reject; five-minute proof allows rotation to a different SID, revokes other/current old sessions, preserves the original expiry cap and cannot replay. |
| Chromium public flows | Packed modal signup and recovery complete from email proof to owner-selected phrase without auto-login. Public standalone password form performs current-password reauth and voluntary change. PostgreSQL's permitted email reauth explicitly adds a password to an OTP-only account. |
| Mounted proof expiry | Fresh browser clocks align with the fixture clock; after mounting signup/recovery SetPassword, both clocks advance beyond ten minutes. The UI returns to the same-purpose request form, a fresh OTP/permit completes successfully, and no early account creation or session revocation occurs. |

## Instrumentation and limits

- Authentication, hashing, sessions, transactions, database reads/writes and HTTP handlers are real. Only email capture, logical ownership-proof time, controlled hook failure and scheduling belong to the disposable fixture.
- **The pending-login barrier is not a native host hook.** Payload's `beforeLogin` runs after `addSessionToUser`, so the fixture wraps the already-installed `db.updateOne` coordinator only to delay the selected login before calling the original operation with unchanged arguments. It does not fabricate an authentication result or storage result.
- Passwordless provisioning uses real Payload creation followed by a real native database write clearing hash/salt. It is not a mocked capability response.
- Standalone change/add flows use exported public forms. Full responsive `AuthPages`/Hero/Tailwind layout and consumer styling are **not** certified by this fixture; it does not install a complete consumer Tailwind setup.
- No claim is made for Node 24, Google/OAuth linking, full Admin policy, a production migration rehearsal, external provider delivery or host-specific deployment behavior. Original password/OTP regression runs are root-owned and reported separately.

## Actual RED and harness corrections

The first packed SQLite run was **RED at startup**: baseline configuration refused signup/recovery (`unavailable until their hardened implementations ship`). Later real runs exposed fixture/test assumptions, corrected before the final runs:

1. Payload create requires a password, even for the fixture's intended passwordless identity; provisioning now clears credentials in the real database afterward.
2. Secondary SQLite `push:true` prompted to delete the runtime OTP security table. It now uses `push:false`, matching the existing PostgreSQL secondary process.
3. Hook failure returned generic `AUTH_FAILED`, not the test's assumed 5xx; the fault test now permits the actual fail-closed contract while retaining all rollback and same-permit retry assertions.
4. Successful signup keeps the login modal open; the next browser flow explicitly closes it instead of clicking behind it.
5. A standalone page without consumer Tailwind CSS exposed both responsive card copies. The fixture now composes one exported public form rather than claiming full layout certification.

One disposable PostgreSQL startup also failed resolving `ws` through the Next/Payload external module path; its cause was not established. Fresh packed runs passed, including the final matrix. Earlier GREEN checkpoints were superseded by review corrections and are not the final source evidence above.
