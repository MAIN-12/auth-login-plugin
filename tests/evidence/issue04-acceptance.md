# Issue 04 — real packed OAuth and Admin acceptance

**Corrected frozen candidate: GREEN.** On 2026-10-06, the complete sequential command below exited **0**. Both OAuth runs build/pack the plugin, install its tarball into a disposable Next consumer, start **two independent Payload processes** sharing a real database, run native HTTP and headless Chromium, and typecheck the consumer. No authentication or storage result is mocked.

## Reproduce and actual results

```sh
pnpm test:oauth:sqlite > /tmp/issue04-oauth-sqlite-corrected.log 2>&1 && \
  pnpm test:oauth:postgres > /tmp/issue04-oauth-postgres-corrected.log 2>&1 && \
  pnpm test:consumer > /tmp/issue04-consumer-corrected.log 2>&1 && \
  pnpm test:password:sqlite > /tmp/issue04-password-sqlite-corrected.log 2>&1 && \
  pnpm test:otp:acceptance > /tmp/issue04-otp-corrected.log 2>&1
```

| Command | Observed result |
|---|---|
| `test:oauth:sqlite` | Real file SQLite, two processes, login OTP disabled; OAuth matrix and declarations GREEN |
| `test:oauth:postgres` | Real temporary PostgreSQL cluster, two processes, login OTP enabled; OAuth matrix and declarations GREEN |
| `test:consumer` | Preserved packed consumer/proxy/password SQLite smoke GREEN |
| `test:password:sqlite` | Preserved issue03 password ownership/recovery/browser matrix and declarations GREEN |
| `test:otp:acceptance` | Preserved real PostgreSQL OTP/browser matrix and declarations GREEN |

`test:oauth:acceptance` reproduces the two OAuth commands sequentially. Runtime: Node `v22.23.2`, Payload/both adapters/`@payloadcms/next` `3.90.2`, Next `16.3.6` Webpack, React/React DOM `19.2.6`, Playwright `1.58.2` headless Chromium, PostgreSQL `17.8 (Homebrew)`. The temporary PostgreSQL helper defaults to `/opt/homebrew/opt/postgresql@17/bin`, overridable with `AUTH_TEST_POSTGRES_BIN`. Cleanup removes disposable apps/clusters. Local `/tmp` logs are execution receipts, not committed artifacts.

## Exact tested inputs

Corrected immutable review candidate `cd34cf05f0423f805f3cfd803ccf7f276d2f343d`, tree `5b235b9a929d916cae8c2a3200f84d9c7fadd25d`. Both OAuth runs and the preserved password run emitted identical source, copied-fixture and tarball hashes. Source-tree hashing includes sorted relative paths and file bytes; the runner verifies source did not change during build/pack and fixture did not change while copying.

| Input | SHA-256 |
|---|---|
| Production `src` tree | `e5e58305386f2ccde98f6814a5b6e6ed44e64e8b97092e1431144c8e53a547a3` |
| Copied `tests/consumer` tree | `051f9e023b1c429e784b94e8ee394646c3fa22a1235d662cdba3e84285704d90` |
| Installed `main12-auth-login-2.2.1.tgz` | `ed30b613acc9cca58dbd3f00bca9048ef10b1b6ac7c0af122b9b5a23d9e87b5d` |
| Repository `package.json` | `b753141323c50adbd17eefbc40f5488a89b7a5afee9c0778d31b889230f1536a` |
| Repository `pnpm-lock.yaml` | `b8b9289bbe663de828e7ff1f0ca1f596ad3968ae50c95215fc812fbba24edbad` |
| Consumer manifest | `50db4294b69b829383af1661ea7f36e022d5b055a1a1150cc7aa8402024be31a` |
| OAuth assertions | `5ac2fd2eacf60308abd878dd9477f511aa0c726d6f02d0a4c762b3b6bc549137` |
| Controlled provider | `497ba66683a66f044a87a35d87c789ec3c519aa521b0034459b54ca755160856` |
| Packed runner | `ed395c94df62cead77fa280ec94498e5626c00ff87ee9fed6d3c8c3e9dafc89a` |

The copied consumer manifest pins the native runtime above, `@libsql/client 0.14.0`, `@heroui/react 3.2.2`, `framer-motion 12.43.0` and TypeScript `6.0.3`; only its disposable `@main12/auth-login: PACKAGE_TARBALL` entry is replaced with the freshly packed file URL. Manifest/lock/script hashes were captured separately with `shasum -a 256`.

## Observed boundaries

| Boundary | Actual assertions |
|---|---|
| OIDC/browser correlation | Real Chromium authorization → code → token/JWKS verification → native cookie; S256 verifier; nonce; replay/missing/tampered/cross-browser state; wrong literal public Host; ten-minute expiry; cross-process callback and exactly-one concurrent consumption. Foreign browser rejection does not burn the initiator's valid state. |
| Provider/provisioning failures | Signed wrong nonce/issuer/audience/signature/expiry, code failure and authorization denial reject before account/session effects; burned state cannot replay. Existing local email collision never auto-links; closed signup rejects new identities but accepts existing stable subject. Changed provider email preserves existing account identity/email. |
| Linking | Explicit confirmation, five-minute permit and exact native SID required; different/revoked SID, consumed/expired proof and conflicting identities reject. Concurrent independent-process same-subject requests produce one winner/one rejection; subsequent login resolves that winner. No claim of deterministic SQL interleaving. |
| Public client actions | Real cross-site localhost provider → 127.0.0.1 consumer link action preserves native SID. Google-only popup rejects absent `auth_time`, accepts signed fresh evidence through exact-origin opener, then explicit password addition rotates SID and revokes old native session. |
| Native lifecycle | Custom-prefix HttpOnly SameSite=Lax cookie, native hooks/field read filtering, native collection read denial, strict CSRF and wrong prefix, omitted response tokens, refresh method/evidence and absolute expiry bound; logout revokes original/refreshed session, refresh cannot resurrect it. Real newly issued one-second native session expires and cannot refresh. Invalid/revoked/expired cookies do not block local basePath login. |
| Admin resources | Actual REST CRUD, native `@payloadcms/next` GraphQL and Local API with `overrideAccess:false`. Public/anonymous, missing/copy-forged proof, unmet/unavailable explicit policy, and independently original Admin false/throw all deny. Eligible native password administrator succeeds; existing collection read denial composes; trusted `overrideAccess:true` maintenance remains possible. Consumer role field blocks public privilege updates. PostgreSQL additionally rejects Admin OTP issuance and public native OTP access to protected resources. |
| Public privilege closure | New Google account with elevated stored default hidden by an `afterRead` presentation hook rejects/rolls back even when composed policy masks eligibility; the same identity later provisions only an ordinary customer. |
| Safe output | Allowed local query/hash preserved; external/protocol-relative/encoded external targets fall back locally. Client bundles omit server secrets; random UUID callback failure header matches sanitized log event, with no raw state/code/native cookie/client secret in captured application logs. |

## TDD receipts and limits

Earlier real packed runs exposed callback public-Host/internal-URL disagreement and native GraphQL verified-proof loss; these were corrected before this exact frozen matrix. GraphQL's actual eligible-positive was RED, then GREEN with proxy-compatible exact native object-bound proof shared across server bundles; copied-principal negatives remain GREEN. Root also recorded focused native password RED for an elevated stored default hidden by `afterRead`, then GREEN after authoritative fresh-row eligibility checking. Timeout/listener and relative-Location assertion corrections were harness defects, not production RED claims.

- This is a **controlled OIDC protocol server, not live Google**: real RSA-signed tokens, code exchange and JWKS, fixed Google issuer, private server-only `customFetch` mapping HTTPS token/discovery/JWKS requests to the fixture. Discovery advertises a real localhost authorization URL, so browser redirects are genuinely cross-site; there is no browser route fulfillment, public bypass or production insecure transport option.
- Provider `amr`/`auth_time` are optional. Missing claims establish neither MFA nor recent authentication. The disposable consumer's explicit Admin role/method/resource policy is not a universal production Admin/MFA rule.
- Fixture controls logical proof time, email capture, consumer hook/policy faults and new native session lifetime. Authentication, hashing, native access, transactions and storage remain real. The 600-second cap is checked against native creation time and signed JWT expiry; this is not a 600-second wall-clock wait. Real expiry is separately exercised at one second.
- Root, separately, reports final full suite **20 files/153 tests passed**, frozen install/typecheck/lint exit0 (zero errors/seven baseline warnings), and independent corrected Standards/Spec rechecks with no remaining findings. Those are parent-run evidence, not additional runs by this acceptance worker.
- CI adds the OAuth SQLite command but remote CI was **not executed**. Node24, hosted PostgreSQL/production migrations, live Google consent/delivery and full responsive consumer styling are not certified here. Earlier baseline/tracer logs do not replace these corrected final receipts.
