# Plugin contracts and issue05 migration

This is the local normative integration guide for `@main12/auth-login`. The approved hardening specification remains the product authority. Copied AOP architecture documents in this checkout are historical reference, **not normative instructions for this plugin**; their cross-repository paths and claims do not describe this package.

## Quick integration

1. Create `authLoginPlugin` in a server-only module with an email-auth collection, API prefix, auth endpoint prefix, and UI `basePath`.
2. Configure the target Payload collection with verified email evidence, sessions, native access policies, and `removeTokenFromResponses` as appropriate.
3. Pass only `.publicConfig` to client/RSC tree providers. Render `AuthCard`, `AuthPages`, or `AuthProvider` modal with explicit presentation overrides.
4. Run the packed acceptance commands. Automated browser/axe evidence does not replace human screen-reader verification.

## Concrete configuration

| Concern | Real interface and responsibility |
| --- | --- |
| Collection | `collection: 'customers'`; native Payload email-auth fields remain native. Username-only is excluded. |
| Routes | `apiPrefix: '/backend'`, `authEndpointPrefix: '/access'`, `basePath: '/members'`; API prefix must match Payload. Component basePath overrides scope all workflow navigation. Proxy is optional, never a session validator. |
| Profile/permissions | No fixed `name/role` requirement or hypothetical field port. Consumer fields/hooks and `admin.authorize({ req, evidence })` express actual permissions. Public provisioning never accepts elevated roles. |
| Locale | Plugin `locale: 'es'|'en'`, otherwise OTP email locale, otherwise `en`. Provider/card/form explicit locale takes precedence. Supported request locale is sent via `Accept-Language`; other values use configured email fallback. Custom UI dictionary locales fall back to EN for email. |
| Presentation | Tailwind/HeroUI adapt the same forms, positional OTP and HTTP contracts; card/page/modal change composition, not authentication policy. |
| Branding | `projectName` and HTTPS `logo` are public serializable branding. Relative local UI logos remain supported. Server `otp.email` can override projectName/logoUrl and configure domain/contactUrl/contactEmail/colors. HTTPS URLs reject credentials; supported colors are six-digit hex. All server email strings are escaped. |
| Secrets | OTP key, Google credentials, clock/origin callbacks and email sender configuration never enter publicConfig. Private option snapshots include nested colors. |

Ambient cookie/header/document locale detectors remain exported convenience functions, **not automatic defaults**. A consumer that deliberately wants detection should call the detector and pass its result explicitly. Malformed locale cookies do not throw.

## Workflow and HTTP contracts

`createAuthService(publicConfig, locale?)` is a scoped HTTP adapter. Successful responses are validated before delivery; public failures use `AuthRequestError` with a stable `AuthErrorCode` and numeric status. Transport/non-JSON/malformed responses become safe failures, never raw infrastructure text. Response models discriminate `success: true` from `success: false`; successful OTP emission requires context and retryAfter. Limited proofs derive purpose from the explicit operation, not arbitrary response data.

Login, signup, OTP, reset and Google share local-safe destination handling. Local query/hash destinations survive intermediate routes; external, protocol-relative and repeatedly encoded bypasses use `/`. External allowlisting is not implemented. Successful signup/recovery completes password establishment and returns to **login**, preserving destination; it does not authenticate automatically.

OTP UI stores six positions, with spaces representing blank slots internally. Send only `/^\d{6}$/` complete values to the server. Borrar/backspace and out-of-order edits preserve later positions. Paste/autofill supports complete codes; automatic/manual verification share one in-flight guard. A missing/malformed context renders a localized recovery action, not an empty screen. Responsive presentation mounts a single live form tree.

## Safe email exports

RSC generator export names remain stable (`generateOtpEmail`, `generatePasswordResetEmail`, `generateWelcomeEmail`, `generatePasswordChangedEmail`, `wrapInBaseTemplate`). Dynamic inputs are escaped by generators; URL/color/contact validation is shared with plugin configuration. **`wrapInBaseTemplate(content)` accepts trusted template HTML**, not untrusted user markup. Callers composing custom HTML must escape their own content.

Supply real HTTPS `domain`/`loginUrl` to welcome/password-changed templates; the placeholder `https://example.com/login` is not your application destination. `getBaseUrl(base?)` and `getSenderEmail(sender?)` no longer read environment variables. Pass consumer configuration explicitly. OTP never appears in subject/preheader. Standalone template expiry copy uses the approved five-minute default; consumers customizing server TTL must communicate their own policy separately.

Email contact uses the validated `contactUrl` with a localized label when configured; otherwise it uses `contactEmail` as a mailto link. Configuring both intentionally gives the URL precedence.

## Migration before removing legacy forms

| Previous behavior | Required migration |
| --- | --- |
| Global/ambient locale selection | Pass `locale` explicitly through plugin/provider/form. |
| Optional OTP success context | Narrow success/error unions; successful emission always has context/retryAfter. Handle `AuthRequestError`, not arbitrary text. |
| Verify response exposes token in client type | Use native cookie/session; do not extract tokens from UI workflows. Server `removeTokenFromResponses` remains authoritative. |
| Environment-derived email config | Pass domain/sender/branding explicitly. Correct unsafe generator usage before removing legacy wrappers. |
| Duplicate style-specific page workflows | Use shared forms or exported page adapters; do not reimplement HTTP/auth transitions in a shell. |
| Disabled global `checkEmail/sendOtp/verifyOtp/signup/setUserPassword` exports | Migrate to scoped `createAuthService`; disabled names remain inert compatibility stubs and never discover accounts. |
| `onSignup({ name, email })` callbacks | Ownership signup is server-driven. Legacy callback types remain for source migration but cannot bypass ownership proof. |

No database credential/session migration is introduced by issue05. Reverting UI/contracts does **not** authorize restoring historical password-mutating OTP, unsafe email previews or account discovery. Preserve security migrations from issues01–04 and their rollback guides.

## Dependency seams and evidence

- `src/auth/domain`: no React/Next/Payload, HTTP adapters, components, application services or implicit environment reads. Server cryptography in existing domain modules is deliberate; this is not a claim of browser portability.
- `src/auth/application`: existing workflows and the explicit HTTP/client adapter; no Payload/server/endpoint imports.
- `src/auth/server` and endpoints: declared Payload-bound adapters, real transaction/session policies.
- `src/components`: presentation, shared forms and concrete style adapters; no server/endpoint imports.
- Stable published surfaces: root plugin, `/client`, `/rsc`, `/proxy`. ESLint checks concrete import barriers; packed-consumer acceptance validates actual exports and bundling.

Logger events include safe codes and server-generated correlation IDs. Failed requests expose `X-Auth-Request-ID`; password rejection, limits, callback rejection and infrastructure events exclude email, password, OTP, tokens and full bodies. Consumer logger failure cannot grant access. Retention, transport and access policy belong to the consumer; the plugin has no external telemetry default.

## Accessibility verification scope

The goal is WCAG 2.2 AA for plugin surfaces. Automatic axe checks, viewport/style/locale/shell behavior and real keyboard/modal interaction have a maintained packed harness: `pnpm test:integration:acceptance`. Human verification must independently record screen-reader announcements, OTP positions/error association, focus order/trapping/restoration, Escape, zoom and mobile behavior for each variant. Do not mark a manual cell passed because Playwright or axe passed. These results do not certify the consuming application.
