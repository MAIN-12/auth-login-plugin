# Plugin-owned Google account linking

**Status:** Draft · **Date:** 2026-10-09 · **Owner:** `@main12/auth-login`

Move reusable Google-link coordination and UI into the plugin. A consumer mounts one deep module, supplies presentation and host policy, and does not coordinate credential discovery, password reauthentication or permits. This spec requests no implementation, release, database migration or deployment approval.

## Current seam and intended ownership

The plugin already provides `createAuthService(publicConfig, locale)`, `credentials()`, `reauthenticate(password)` and `linkGoogle(permit, returnTo)`. AOP currently rebuilds their coordination in `linkGoogle.ts`, `useGoogleLink.ts` and `GoogleLinkControl.tsx`, composed by `HomePage.tsx`.

| Plugin owns                                                                                                             | Consumer owns                                                               |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Credential eligibility, reauthentication, transient proof, explicit confirmation, OAuth dispatch, state and safe errors | Placement, layout, branding, language and product-specific surrounding copy |
| Shared Tailwind/HeroUI UI and accessible interaction                                                                    | Domain authorization, including superadmin exclusions, enforced server-side |
| Cancellation/single-flight semantics and busy notification                                                              | Optional coordination with logout or other competing actions                |
| Existing native session, OAuth and subject-association security                                                         | Server-only configuration and passing only `publicConfig` to clients        |

Host eligibility is not a browser authorization grant. Original host Admin/access policies remain authoritative; the plugin must not adopt an AOP role name or weaken those policies.

## Required behavior

| ID  | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Offer the baseline flow only to an authenticated, password-backed, email-verified principal with Google enabled and host permission. Obtain credential evidence through the existing own-principal query; never infer it from public user fields. Unknown evidence fails closed. Passwordless/OTP-only and unverified users receive localized unavailable explanations, not a new verification/password-establishment workflow. |
| R2  | Opening the control presents the current-password field and explicit link-confirmation action. Submitting confirms this intention, rechecks eligibility and calls existing password reauthentication. It does not log in again or establish another session.                                                                                                                                                                    |
| R3  | Keep password and purpose/expiry-validated reauthentication permit transient. Clear password on submit, cancel and disposal; clear proof when invalidated or settled. Never place either in URLs, browser persistence, callbacks, logs or publicConfig. Existing five-minute proof, exact-principal/SID/version binding and server rechecks remain unchanged.                                                                   |
| R4  | Only after explicit confirmation and a valid proof may the module invoke `linkGoogle`. Matching email never authorizes association. Server-side subject uniqueness, atomic association/permit consumption, correlation burn, generation checks and native cookie/session policy remain intact.                                                                                                                                  |
| R5  | One submission/dispatch may be active per mounted module. Render loading, ready, confirming, reauthenticating, redirecting, unavailable and failure states without exposing proof mechanics. Safe localized errors distinguish unavailable/retryable operations from authentication rejection; infrastructure details never reach users.                                                                                        |
| R6  | Cancel, disable, unmount or account replacement before dispatch invalidates pending continuations: a late credential/reauth response must not dispatch. Mount the control with an account-bound React key; replacing accounts must not reuse old UI/password/proof.                                                                                                                                                             |
| R7  | `linkGoogle` currently has no abort primitive. After dispatch begins, do not promise cancellation or report that disabling/unmounting reversed a server action. Keep a truthful busy notification so consumers can disable logout; navigation commitment remains busy until navigation or failure. Cancellation remains available during pre-dispatch reauthentication.                                                         |
| R8  | Both presentation variants use the same workflow, ES/EN dictionaries and existing locale precedence/overrides. Supply accessible labels, keyboard operation, announced errors/loading and coherent focus handling; never mount duplicate live forms. Generic link copy belongs to the plugin; domain/product messages remain consumer-owned.                                                                                    |

## Proposed public interface

Names and final typing are proposals; behavior above is the acceptance contract. Export through `@main12/auth-login/client`, with existing appearance/localization interfaces, not private paths:

```tsx
interface GoogleAccountLinkProps extends AuthPresentationProps {
  config: PublicAuthConfig
  enabled?: boolean // host presentation gate; never server authority
  returnTo?: string // existing local-safe continuation, default '/'
  onBusyChange?: (busy: boolean) => void
}

;<GoogleAccountLink
  key={authenticatedAccountId}
  config={identityAuthPlugin.publicConfig}
  enabled={hostAllowsLink && !logoutPending}
  locale={locale}
  style="hero-ui"
  returnTo="/"
  onBusyChange={setLinkBusy}
/>
```

Resolve provider configuration consistently with existing modules; do not introduce another transport scope. Neither props nor notifications expose permits or require consumers to sequence reauthentication. No linked-status query exists today: do not infer “already linked” from credential capabilities or promise automatic linked-state loading. Handle authoritative operation failures safely.

## Acceptance scenarios

1. **GIVEN** an eligible authenticated account **WHEN** it confirms with its correct password **THEN** one reauthentication and one Google dispatch occur; verified provider subject association targets that exact account.
2. **GIVEN** a matching-email unlinked account **WHEN** ordinary Google login occurs **THEN** it still fails rather than linking automatically.
3. **GIVEN** cancellation, disable or account replacement during reauthentication **WHEN** its response resolves **THEN** no link request/navigation follows; a fresh attempt requires fresh confirmation.
4. **GIVEN** dispatch already started **WHEN** cancellation is requested **THEN** the UI does not claim rollback, and busy coordination protects competing logout.
5. **GIVEN** bad password, expired proof, provider denial, network failure or another-account subject conflict **WHEN** it occurs **THEN** safe localized failure and appropriate retry/unavailable handling preserve server invariants.
6. **GIVEN** OTP-only, unverified, unknown-evidence or host-disallowed accounts **WHEN** mounted **THEN** no reauthentication/link is initiated; forged requests remain denied server-side.

## Migration and delivery gates

1. Implement/export the plugin module and localization/presentation additions; preserve configured callback routing (`/api/auth/oauth/google/callback` in AOP), native Request compatibility and the existing headers-identity regression fix.
2. Replace AOP's generic helper/hook/control with thin Home placement and busy integration. Preserve server domain policy, Atomic Design and unrelated changes. Move tests/dependencies only when actually owned/used by the moved module.
3. Validate package public-seam UI/state tests, native Request HTTP/cookie regressions and consumer integration with mocked OAuth. Check typecheck/lint, both styles, ES/EN, keyboard/automated accessibility and packed exports. Real Google roundtrip and human accessibility verification remain explicitly separate pending checks.
4. Build/pack/install locally for consumer trials before any publication. Publishing requires subsequent explicit user authorization.

**Non-goals:** unlinking, provider management, OTP/Google reauthentication alternatives, linked-status discovery, email autolink, schema/cutover changes, alternative sessions or new Admin authority.

**References:** [plugin contracts](../plugin-contracts.md), [local context](../CONTEXT.md), [migration constraints](../migration.md). Draft review must resolve the public name/provider ergonomics; this does not block documenting the required seam.
