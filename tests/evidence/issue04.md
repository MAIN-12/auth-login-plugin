# Issue 04 — Google OAuth and administrative authorization

This work adds Google login, explicitly confirmed linking and Google reauthentication, plus consumer-owned administrative authorization on native APIs. It preserves the secure issues 01–03 base. It is not a release, a live Google-account verification, a production penetration test or completion of tickets 05–06.

## Approved design and seams

- Google protocol adapter uses exact `oauth4webapi@3.8.8`: fixed issuer, PKCE S256, state, nonce, validated claims and explicit application-level ID-token signature verification. Every protocol request has a five-second timeout; ambiguous consumed callbacks are not retried.
- Private SQLite/PostgreSQL storage binds ten-minute, single-use correlation to an HttpOnly browser cookie. Destination and correlation are separate. Identity is the fixed provider's stable subject, never email auto-linking.
- Closed signup denies new Google accounts. Public provisioning runs native hooks/defaults, checks authoritative stored account eligibility and never grants elevated privileges. Native creation's required random bootstrap password is discarded and hash/salt cleared inside the same transaction before commit; existing credentials are never overwritten.
- Linking requires explicit confirmation plus an account/SID/version-bound five-minute proof. Google-only reauthentication requires validated recent `auth_time`; missing evidence denies. Popup continuation uses exact origin/source checks and nonce-CSP HTML; no permit is placed in a URL.
- Google sessions use native Payload hooks, lockout, verified-user checks, cookies, signed method evidence, refresh, absolute lifetime, logout and revocation. Cross-site link/reauth callbacks delegate native authentication only after browser correlation consumption and signed provider validation, using cloned internal headers and exact current SID/version checks; there is no global CSRF exception.
- Admin eligibility combines original consumer `access.admin` and explicit additional policy. Enumerated collection/global operations compose existing native access callbacks. OTP alone, missing evidence and failed/unavailable policies deny. Trusted Local API maintenance with `overrideAccess:true` remains native; untrusted operations must use `overrideAccess:false`.
- The native capability registry is partitioned by exact Payload instance, Headers and principal identities, supporting GraphQL request proxies and independent Next bundles without accepting caller context/user-field claims. It stores no global configuration or secrets.
- Returns are local-only, preserving permitted query/hash and rejecting encoded authority/backslash/control variants. Proxy delegates authentication to the server; cookie presence is not authority.
- Confirmed seams: public OAuth/application policy, native HTTP on both SQL adapters, redirect/proxy, and packed Chromium against a controlled OIDC provider across two Payload processes.

## RED → GREEN evidence

| Behavior | Observed failure and correction |
|---|---|
| Browser correlation / email collision | Missing public application owners failed tracers; explicit correlation and account rules passed them. |
| Encoded return | `/%2fevil.test` was accepted; decoded path validation now rejects it while preserving allowed query/hash. |
| Legitimate packed callback | Chromium received 401 with matching browser cookie and zero token exchanges: Next normalized the internal URL to localhost. Exact configured Host/path verification and trusted-origin reconstruction produced 303 and cross-process native authentication. Forwarded headers are not trusted. |
| GraphQL Admin positive | REST authorized but actual GraphQL returned 403: native request Proxy and separate bundles lost request-keyed proof. Instance/header/exact-principal capability storage restored the positive while copied-principal negatives deny. |
| Privileged public default | Native signup returned 200 when `afterRead` hid a stored admin role. Authoritative native reread now denies 401, rolls back and allows an ordinary retry with the same unconsumed proof. |
| Original Admin condition | Additional policy returned true despite original eligibility false/throw. The shared decision now denies UI and protected direct operations alike. |
| Existing OTP policy | Default-deny composition masked original eligibility in two existing native tests. Private original checks restored issue 02 semantics. |

Timeouts and fixture routing/assertion errors are harness incidents, not evidence of a production security defect. Focused tests and typechecking were run throughout; the full unit suite was run once after scoped review corrections.

## Frozen candidate and verification

Executable candidate: `cd34cf05f0423f805f3cfd803ccf7f276d2f343d`, tree `5b235b9a929d916cae8c2a3200f84d9c7fadd25d`, baseline `b0fe7de2aa1450d367251f10107276e3b4030302`. This is an immutable review object, not a branch move. Evidence-only additions do not alter executable source or fixtures.

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | EXIT0, lock unchanged |
| `pnpm typecheck` | EXIT0 |
| `pnpm lint` | EXIT0, zero errors / seven existing warnings |
| `pnpm test:unit` | **153/153 tests, 20/20 files GREEN** |
| `pnpm test:oauth:sqlite` | EXIT0, corrected packed Chromium/native two-process matrix |
| `pnpm test:oauth:postgres` | EXIT0, corrected packed Chromium/native PostgreSQL two-process matrix |
| `pnpm test:consumer` | EXIT0, preserved SQLite/Turbopack/Chromium acceptance |
| `pnpm test:password:sqlite` | EXIT0, preserved native password lifecycle and Chromium |
| `pnpm test:otp:acceptance` | EXIT0, preserved PostgreSQL two-process OTP/native Chromium |
| `pnpm build` within packed runs | EXIT0, clean generated artifact and consumer declarations |

Independent **Standards** review identified one hard P2 interface-owner violation and one duplicate-ledger heuristic. Independent **Spec** review identified a P1 original-Admin-policy discrepancy and P2 uncorrelatable callback events. One scoped correction group moved preparation into the named native workflow owner, centralized transactional permit consumption, composed original eligibility once in shared policy and added secret-free generated request IDs. It also checks authoritative identity ownership after conflict-tolerant insertion. Both independent immutable correction rechecks report **zero remaining actionable findings** and no correction-induced regression; they inspected code, not execution of these tests.

Exact runtime commands, artifact hashes, scenarios and limitations belong in `issue04-acceptance.md`. Node 22 SQLite OAuth acceptance is versioned in CI; remote GitHub Actions was not executed by this local session. The approved authored-line exception is 1,500–2,400; the executable candidate has 1,341 changed lines across 45 files. Delivery is local on `chore/audit`, with no push, PR, release, SDD artifacts or fabricated approval receipt. RDD remains on by default and unchanged. Preexisting untracked audit/spec/ticket/docs files remain outside this delivery.

## Operational limits and rollback

The controlled provider supplies real browser redirects, authorization-code exchange and signed OIDC responses; it is not Google's production service. Missing Google claims never imply MFA or recent authentication. Consumer policy/resource selection, public role-field protection, credentials, trusted transport/proxy deployment, production database migrations and full Node 24/Ubuntu support certification remain consumer/ticket 06 responsibilities. No plugin-owned MFA is added.

Rollback this code/test/fixture/package/docs work unit to issue 03 artifact `b0fe7de`, retaining issues 01–03 protections. Disable Google and remove new Admin configuration before switching to an artifact that rejects them; restore the consumer's equivalent original administrative access policy, not permissive public access. Remove the Google adapters/application owners/endpoints/client actions, Admin capability/policy integration, shared ledger extraction and corresponding tests/harness/dependency changes together. Keep password/OTP lifecycle behavior intact.

Do not roll back users, passwords, native sessions, verification evidence or revocations. Preserve `auth_login_google_identities` and existing private challenge/lock/consumed-permit tables through schema push and migrations; never restore away live consumption history. The previous artifact cannot authenticate Google-only users: provide an authorized alternative or finish migration before rollback. Do not repair identity associations by email matching. Production rollout/rollback rehearsal and security-state cleanup are not certified by disposable fixtures.
