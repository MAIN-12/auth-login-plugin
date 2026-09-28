# Changelog

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
