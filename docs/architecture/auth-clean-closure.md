# Auth-clean 06 — cierre y evidencia

Implementación autorizada en un chat separado el 2026-10-08 sobre `chore/audit`,
base `8f1522e3ab833a396ff331d3c0fa04fe31d6759a` (05). Dependencias 01–05 completed.
Autoridad: plugin-contracts, auth-clean-spec y ticket 06; los documentos AOP y los
planes auth-atomic-design/auth-hardening no amplían este alcance.

## Propietarios efectivos y caracterización del inventario

| Entrada                                                        | Owner actual                                                                                                                       | Caracterización vigente                                                                                 |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| POST login propio y login nativo REST/GraphQL/Local            | application/passwordLogin; composition/passwordLogin; nativePasswordAuth y sessionPolicy                                           | password-login-application/scope/mapping; auth-http; password-http                                      |
| OTP send/verify login                                          | application/otpLogin + otpProtocol; composition/otpLogin; ledger/codec/nativeOtpLogin                                              | otp-login-application/native/mapping; otp-flow; otp-http                                                |
| OTP signup/recovery/reauth/verify-email                        | application/ownership + ownershipVerification; composition/ownership; passwordAdapter                                              | ownership-policy/application/native/mapping; legacy-verification; email-identity-http                   |
| signup/reset-password/set-password                             | misma ownership policy + CredentialCommit nativo                                                                                   | password-lifecycle; ownership-native; password-http; legacy-verification-http                           |
| forgot-password y reauthenticate                               | ownership policy: comando recovery/native reauth, sin invocar otro handler HTTP                                                    | ownership-policy/mapping/native; password-http                                                          |
| credentials own-only                                           | application/session OwnCapabilities; credentialEvidence; composition/session                                                       | session-capabilities                                                                                    |
| GET Google login/link/reauth/callback                          | application/googleFlow; domain/googleAccountPolicy; composition/google; provider/correlations/native account commit                | google-flow-application/scope/native/http; oauth-application; google-client-actions                     |
| refresh-token/logout y session writes                          | application/session refresh; nativeRefresh/sessionPolicy; native logout/otpSession coordinación; authService cliente               | session-native/client; auth-provider; auth-http; credential-transaction                                 |
| credential/email/session writes, native REST/GraphQL/Local API | credentialIntent/sessionPolicy/otpSession guards comunes del bootstrap                                                             | session-native; email-identity-http; password-http                                                      |
| trusted provisioning                                           | guard operacional: Local API + overrideAccess + context explícitos conjuntamente                                                   | session-native; email-identity-http (incluye forwarding HTTP/GraphQL)                                   |
| admin UI/resources/evidence                                    | infrastructure/payload/adminPolicy, original host eligibility y authorize explícito                                                | admin-policy; legacy-verification-http; session-native                                                  |
| migrateAuthLogin offline                                       | application/migrateAuthLogin admite intención; composition/migration; infrastructure/payload/maintenance posee toda la transacción | migration-application/native doubles; migration-http fixture histórico                                  |
| POST check-email/Google/callback aliases inert                 | composition/authEndpoints instala stubs HTTP METHOD_DISABLED; ningún store/provider                                                | auth-endpoints; auth-http; google-http                                                                  |
| enabled/disabled plugin factories                              | composition/plugin instala config/hooks/access originales; disabled devuelve config intacta, sin efectos                           | plugin-config; auth-endpoints; password-login-scope                                                     |
| createAuthService, hooks, pages, card/modal/provider           | interface/client/authService único HTTP; interface/react coordina UI; components presenta                                          | password/otp-login-client/react; session-client; auth-provider; integration-contracts/ui; continuations |
| globals client legacy inert                                    | authService conserva exports deshabilitados y ningún fetch                                                                         | integration-contracts; google-client-actions                                                            |
| RSC email y proxy                                              | templates explícitos browser/server-safe según superficie; proxy solo rutas                                                        | presentation-resolution; integration-contracts; proxy; architecture-graph                               |

La tabla cubre todas las entradas de §4; las vías nativas permanecen protegidas por
hooks/guards compartidos. `overrideAccess` no sustituye autorización: reads seleccionados
poseen evidencia ligada a la identidad; provisioning requiere la conjunción explícita.
Los adapters de commits mantienen req/locks/rechecks/bindings y su unidad de commit.
El mantenimiento sigue siendo un bypass nativo deliberado, sin hooks de provisioning
ni rehash. No se extrajeron transacciones para uniformar carpetas.

## SC-01–20: evidencia acumulada reutilizada

| Escenario | Evidencia directa/mapping existente o añadida                                                                                       | Límite                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| SC-01     | password-login-application: legacy password, native llamada única, principal; scope/mapping receipt/cookie                          | doubles                                                                                              |
| SC-02     | password-login-application, otp-login-application, ownership-policy, google-flow-application: disabled antes de efectos             | doubles; sin autoridad HTTP implícita                                                                |
| SC-03     | password-login-application, ownership-policy, password-lifecycle, otp-login-application: comandos inválidos y corpus                | inputs de dominio/application; transport mapping aparte                                              |
| SC-04     | otp-login-application/native/mapping: burn único, session exacta sin password write                                                 | doubles; otp-http histórico sigue vigente                                                            |
| SC-05     | otp-flow y otp-login-application/native: expiry/attempts/bindings/replacement account/stale commit                                  | storage/session doubles                                                                              |
| SC-06     | otp-login-application y otp-flow: fallo mail/store, generic accepted y budgets/cooldown                                             | no SMTP real                                                                                         |
| SC-07     | ownership-policy/native/mapping y password-lifecycle: ausencia autorizada, password del owner, sin auto-login                       | doubles y fixture password-http existente                                                            |
| SC-08     | ownership-application/policy: missing/deleted/passwordless/unknown; mapper conserva evidencia                                       | passwords no reconstruibles                                                                          |
| SC-09     | ownership-native: generation/version/principal/SID cambian después de decode; commit niega                                          | native doubles                                                                                       |
| SC-10     | legacy-verification + ownership-native/mapping: solo verified y sin nuevas credenciales/sesión                                      | legacy-verification-http histórico                                                                   |
| SC-11     | ownership-native + credential-transaction: async hook cambia password/evidence, rollback/cleanup; proof burn                        | rollback double, no certificación física                                                             |
| SC-12     | google-flow-application/scope/native/http: consume/exchange/commit, stable sub y receipt                                            | provider y native doubles                                                                            |
| SC-13     | google-flow-application/native, oauth-application, google-http: wrong browser/stale/provider fault/no autolink                      | no Google runtime ni popup real                                                                      |
| SC-14     | session-capabilities: own-only, unknown/unavailable y datos mínimos, principal changed tras await                                   | DB double                                                                                            |
| SC-15     | session-native: deadline/revocation/malformed y tres condiciones provisioning; session-client logout                                | auth/email-identity-http históricos                                                                  |
| SC-16     | admin-policy: eligibility única, deny/throw y principal/evidence cambiados                                                          | no certifica políticas de hosts                                                                      |
| SC-17     | migration-application/native: attestation/inventory, aggregate-only, fresh scoped generation, native bypass, async rollback/cleanup | migration-http preserva cuotas y aislamiento en SQLite histórico; doubles no prueban DB multiproceso |
| SC-18     | password/otp-login-client/react, session-client, continuations, auth-provider: malformed/in-flight/retry/transient proof            | fetch doubles / happy-dom                                                                            |
| SC-19     | plugin-config; password-login-scope, ownership-native, google-scope, session-capabilities y providers hermanos                      | aislamiento por plugin/request sin singleton                                                         |
| SC-20     | credential-transaction, otp-login-native, ownership-native, google-native, session-native, migration-native                         | req real capturado, bindings y finally; no nuevo test de DB multiproceso                             |

Los tests históricos que usaban shims ahora ensamblan codec/ledger/ports actuales.
No queda una segunda política legacy de password/Google/OTP. Sus assertions originales
se conservan sobre los propietarios actuales; el grant usa la admisión única de ownership.

## Retirada y equivalencia pública

Retirados tras migrar callers: domain/login, otp y passwordLifecycle; los cinco
contracts *Compatibility; application hooks/services/AuthFlowContext/googleFlow/
googleAccountPolicy/ownershipVerification; server adminPolicy/sessionPolicy/
credentialEvidence/googleProvider/googleAccount/googleAuthentication y migration;
forwarders endpoints/authEndpoints/passwordEndpoints/googleEndpoints. authSchemas
vive en interface/http, el agrupamiento de factories en composition/authEndpoints.
No se retiraron módulos server operacionales ni stubs públicos inert.

DTOs de UI/workflows viven en contracts/clientModels y GoogleCorrelation en
application/ports/google. Dominio mantiene PasswordStrengthResult, GoogleIdentity y
GooglePrincipal (binding puro). PublicAuthConfig y AuthStyle se declararon en
contracts/publicConfig; config conserva sus reexports/signatures públicos. Cliente y
proxy no atraviesan opciones privadas; RSC conserva su tipo público de opciones por
config sin atravesar root/bootstrap. La excepción de tipos Payload queda limitada a
OtpOptions/AdminOptions del contrato RSC preexistente; ningún adapter/ledger/crypto
server se exceptúa. HTTP consume scope types y operaciones construidas; solo
composition construye factories concretas de application e infraestructura.

Comparación explícita contra 05 con TypeScript checker: exports públicos, tipos,
propiedades y call signatures/overloads en root/client/rsc/proxy. Se normalizan solo
IDs internos de Symbol.iterator y orden de unions literales; no es un test de bundling.
Los JSON/logs locales se guardan en `/tmp/auth-clean-06-api-{before,after}.json` y
`/tmp/auth-clean-06-api-diff.log`. Los paths internos de declaración cambian, como
requiere la retirada; no hay export star ni nuevos exports publicados.

Schema/compatibilidad revisados explícitamente: bootstrap/plugin difiere solo en
imports, sin cambios de fields/auth/options/access/hook instalación; config solo
mueve declaraciones públicas; package.json/lock/options permanecen intactos. Cutover
conserva tabla auth_login_cutovers y SQL, sessions/reset/verification cutoff y legacy
where explícito dentro de la misma transacción. otpStore/methodPermitLedger/
credentialRequest/otpSession/codec/account commit solo cambian imports donde aplica:
no cambios de tablas, AAD/formats/namespaces/TTL/hashing/signing, corpus ni bindings.
Los tests HTTP/mapping conservan rutas/métodos/status/CORS/cookies y response shapes.

## Rollback y riesgos operacionales

Revertir código requiere un slice completo compatible con las garantías actuales:
no bajar generation ni revivir permits/correlations/sessions. Un backup pre-cutover
requiere maintenance con todos los writers detenidos y un re-cutover fresco antes de
servir requests. Las cuotas/consumed rows no se purgan ni reinician. Schema DDL de
inicialización puede persistir tras fallo sin conceder acceso. Errores operacionales
de maintenance se propagan al caller server como antes, no son resultados para HTTP.

Correlations Google antiguas sin binding exacto de principal se rechazan: drenar
flujos elegibles o comenzar un flujo nuevo tras el rollout, nunca rescatar autoridad
con un principal inventado ni restaurar proof consumido. La documentación de migración
conserva este límite conocido de 04; retirar shims no amplía la compatibilidad.

No se ejecutaron Chromium/Playwright/E2E, cutover/restore en servicios reales,
publicación/push/despliegue ni aceptación DB nueva. La suite actual conserva fixtures
SQLite/HTTP reales en proceso; no se presentan como doubles aislados. Locks físicos,
rollback multiproceso, cookies/provider runtime, shutdown de writers y retención
necesitan una decisión/validación operacional separada. Los receipts históricos de
otros candidatos no certifican este cambio.

## Gates y revisión del candidato

`pnpm test:unit`: 55 archivos / 373 tests pasan (9.93 s), incluyendo los fixtures
SQLite/HTTP históricos. `pnpm typecheck` y `typecheck:scripts`, `pnpm lint`, Prettier
del slice y whitespace checks pasan. Logs locales `/tmp/auth-clean-06-*-final.log`.
API diff estático normalizado vacío contra 05. Revisión paralela antes del commit:
Standards 0 hallazgos y Spec 0 hallazgos. Checklist final de spec/ticket completada
con esta evidencia; el commit individual se entrega en el chat sin push/deploy.
