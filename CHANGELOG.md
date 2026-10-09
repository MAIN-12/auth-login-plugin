# Changelog

## Unreleased — issues01–06 hardening candidate

- Preserve legacy credentials while verifying public-account email ownership through a verification-only OTP purpose: no password replacement or automatic login.
- Add offline `migrateAuthLogin` for account-preserving native-session/legacy-code cutover and collection-scoped proof invalidation without global key rotation; document safe restore/rollback.
- Pin runtime peers to the exact integration target; map every requirement/scenario to evidence without advertising pending runtime passes.
- Version the Node22/24 and SQLite/PostgreSQL CI target; configured jobs are not a claim of successful remote execution.
- Keep human screen-reader/real-device acceptance pending rather than substituting automated axe/browser results.

- Share forms/workflows across card/page/modal and Tailwind/HeroUI; mount a single responsive form tree.
- Preserve configured route prefixes and safe local query/hash destinations across signup/recovery/login.
- Validate scoped HTTP responses, retain stable error codes and eliminate critical `any` form contracts.
- Add positional accessible OTP editing, recoverable malformed links and single-flight manual/automatic verification.
- Make locale explicit with EN fallback; dispatch supported UI locale to escaped per-instance email rendering.
- Harden all RSC email generator exports, validate HTTPS/contact/colors, remove OTP previews and implicit environment helpers.
- Add sanitized correlated password/infrastructure events, concrete import checks and packed-browser axe acceptance.

Breaking migrations and rollback limits: [plugin contracts](docs/plugin-contracts.md). This is a candidate, not a publication or completed manual accessibility certification.

## 2.2.1

- Scope auth cards and HeroUI dialogs to the light theme so host dark mode does not mix dark surfaces with light-theme text.
- Apply the same theme across desktop, mobile, and modal layouts without changing the host page theme.

## 2.2.0

- Match Payload's native OTP login cookie configuration, including custom prefixes, expiry, domain, SameSite, Secure, and token-response suppression.
- Preserve request/session context when setting passwords and reject principals from other auth collections.
- Restrict public access to OTP records.
- Show a shared loading state and reduced-motion-aware entrance animation for auth cards.
- Handle failed or malformed email lookups without incorrectly reporting a missing account.

### Upgrade notes

Install `framer-motion` for both Tailwind and HeroUI styles; it is now a required peer dependency. Payload remains supported on the declared `^3.90.0` range, with this release built and tested against 3.90.2.

Consumers upgrading Payload should regenerate types and create/apply their database migrations, including `resetPasswordRequestedAt` and session schema as applicable. This plugin does not migrate consumer databases.

The compatibility fixes do not redesign OTP authentication: it still replaces passwords during OTP verification. Additional OTP concurrency/throttling and OAuth policy findings are documented in `reports/payload-3.90-compatibility-review.md` in the repository.
