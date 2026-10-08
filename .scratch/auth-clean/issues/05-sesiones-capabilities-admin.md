# 05 — Sesiones, capabilities y autorización admin

**What to build:** El principal consulta únicamente sus capacidades y usa refresh/logout nativos sin prolongar la vida absoluta de su sesión. Guards de credenciales/provisioning y acceso admin conservan la política del host, sin bypass por ownership, flags o transporte.

**Blocked by:** 01 — Login por contraseña y contratos base. Puede avanzar en paralelo con 02–04.

**Status:** completed

**Referencia:** «Separar la política de autenticación de Payload, HTTP y React», §§4–8, 10–11. Requisitos ARC-01–04, APP-01–02, TX-01/04/05, HTTP-01/03, CLI-01–03, CMP-01/02, SEC-01/02/10–12, TST-02, COMP-01/02. Escenarios SC-14–16, SC-18–20.

**Alcance:** Una unidad interna revisable; no exige un PR separado ni autoriza implementación. Migra estas rutas y bootstrap propios, sin esperar permisos OTP/Google ni inventar endpoints de sesión. Mantener interfaces compatibles para los tickets paralelos.

- [x] Capabilities usa una operación own-only ligada al principal autenticado de la collection; ningún body puede seleccionar cuenta/collection ni fabricar principal (SC-14).
- [x] Repository entrega evidencia mínima: available/unavailable/unknown y verification explícitos, nunca hash/salt/documentos completos; campos omitidos/malformed no habilitan autoridad (SEC-02/12).
- [x] Refresh y logout conservan rutas y engine nativos; refresh no extiende lifetime absoluto y logout mantiene revocación y coordinación actual (SC-15, SEC-01).
- [x] Aplicación conoce intención/resultados angostos; hooks, native session writes, guards y traducción Payload permanecen en adapters operacionales sin trasladar req/SQL al dominio (ARC-01/02).
- [x] Bootstrap compone políticas/hooks/access originales y coordinación nativa como instalación, no como caso de uso de autenticación (CMP-02).
- [x] Writes de credenciales/email por REST/GraphQL/Local API están protegidos por guard común; extraer handlers no abre una vía nativa paralela que omita la política.
- [x] Trusted provisioning exige origen Local API, overrideAccess y context explícitos conjuntamente; flags forwarded desde REST/GraphQL/cookie no conceden privilegio (SEC-10, SC-15).
- [x] No introducir overrideAccess genérico: documentar alcance, owner y evidencia de reads/writes privilegiados sin equiparar privilegio interno con autorización del usuario.
- [x] Admin UI/resources conserva eligibility original y autorización explícita del host; rechazo o throw falla cerrado y la decisión original se ejecuta exactamente una vez (SC-16, SEC-11).
- [x] Email ownership/verificación y flags del cliente no elevan admin; no inferir autenticación o autorización desde React, email o proxy.
- [x] Request scope mantiene req real, aislamiento por instancia/request, markers y native session coordination; finally limpia en success y rechazo asíncrono con bindings y reglas de retry compatibles (TX-01/04/05, SC-19/20).
- [x] Configuración privada immutable y publicConfig segura conservan overloads del plugin; disabled factory es totalmente inert sin instalar efectos o consultar stores (CMP-01/02).
- [x] AuthProvider deja de hacer fetch directo: sesión/logout/capabilities pasan por métodos internos de la misma instancia del único authService, conservando contratos públicos y rutas nativas (CLI-01).
- [x] Hooks/context de estos flujos quedan fuera de application; conservan guards de respuestas malformed, errores/retry, locale e in-flight único, sin singleton de fetch/config (CLI-02/03, SC-18).
- [x] Tests con doubles de principal/request/native adapters y host policies cubren SC-14–16 y SC-18–20: own-only, unknown, deadline/revocación, tres condiciones de provisioning, deny/throw admin, original decision única, cleanup y zero secrets (TST-02).
- [x] Conservar API/schema/cookies/wire/status/exports explícitos y shims necesarios por migraciones paralelas; registrar eliminación en 06. Revertir código no revive sesiones ni grants (HTTP-03, COMP-01/02).
- [x] Pasan test:unit y gates estáticos/formato sin Chromium ni nuevas suites DB/E2E. Fixtures históricos no se eliminan ni se presentan como doubles; no declarar certificación de cookies/DB runtime.


## Evidencia de implementación — 2026-10-08

- Slice exclusivo 05 sobre `chore/audit`, base real
  `f86c2ea95baa4d7ebb939c20a8b045fc6eeaba00`. Dependencia 01 completed
  (`8bf2a3a`), 02–04 completed y presentes. Tracked limpio al inicio;
  archivos ajenos untracked conservados. Node 22.23.2 / pnpm 10.19.0 y
  dependencias instaladas verificadas contra manifest: Payload/SQLite 3.90.2,
  TS 6.0.3, Vitest 4.1.6, jose 6.2.12, zod 4.6.5. Sin cambios de lock/manifest.
- Se siguió `~/.agents/skills/implement/SKILL.md`, TDD en las seams autorizadas
  por este ticket y Code Review de dos ejes. No hay AGENTS raíz/ancestro;
  `dev/AGENTS.md` no aplica porque dev no se modifica. Autoridad local:
  `docs/CONTEXT.md`, `docs/plugin-contracts.md`, `docs/architecture/auth-clean-spec.md`.
- OwnCapabilities es un puerto sin selector/command, compuesto por request y
  collection autenticados. Repository privilegia solo el read seleccionado del
  propio principal, reduce hash/salt a evidencia y revalida bindings tras await.
  Dos null explícitos demuestran unavailable; omitted/partial/malformed es unknown.
  HTTP no consulta body ni permite account/collection/principal del cliente.
- Refresh application devuelve solo expiry; tokens/receipt permanecen privados
  en NativeRefresh. Un scope usa req/principal/SID/payload/headers reales, una sola
  llamada nativa y sin retry de hooks; HTTP conserva ruta, respuesta y cookie.
  Hooks capan la vida absoluta desde createdAt y rechazan sesiones expiradas,
  revocadas o malformed. Logout y la coordinación de deltas/locks DB nativos
  existentes permanecen vigentes. No nuevo engine de sesiones ni JWT paralelo.
- Guards comunes siguen instalados para credential/email/session writes de todos
  los transports. Trusted provisioning sigue exigiendo Local API + overrideAccess
  + context explícito; doubles cubren combinaciones y REST/GraphQL/cookie flags.
  Reads privilegiados mantienen owner/evidencia estrechos; no overrideAccess genérico.
- Bootstrap se trasladó a composition/plugin como instalación Payload. Conserva
  hooks/access originales, overloads, publicConfig seguro y disabled inert.
  Admin settings privados se copian/congelan; original eligibility se evalúa
  una vez por decisión y explicit authorize sigue requerido. Deny/throw y cambio
  async de principal/evidencia fallan cerrado; predicados de recurso se conservan.
  Email/ownership/OTP/flags del cliente no elevan autorización Admin.
- AuthProvider ya no hace fetch; usa authService de su árbol para native me/logout,
  el mismo owner HTTP que capabilities/form actions, con instancias por locale.
  AuthConfigProvider comparte scopes compatibles y aísla transports/configs
  extranjeros; snapshots públicos whitelist no incluyen claves extra/secretos.
  Me valida user nullable presente e ID válido y conserva campos del host;
  session/logout tienen in-flight único, malformed/network falla seguro y retry
  está disponible. Hooks/context se mantienen fuera de application y sus shims
  anteriores quedan para 06. UI no se convierte en autoridad de sesión.
- TDD red→green documentado en transcript: omitted credentials interpretados como
  unavailable; recurso Admin async throw; cambio de principal durante authorize;
  native refresh redirigido a otra identidad; parser session inexistente/malformed;
  native sessions malformed; cleanup de proof con headers sustituidos. Tests
  nuevos con doubles cubren SC-14–16/18–20; fixtures históricos intactos.
- Dispose limpia receipt, deadline temporal y authentication evidence con los
  bindings originales capturados; success/rechazo y cambios de headers/payload
  fueron verificados. Los tests de credential transactions previos preservan req,
  SQL bindings y finally de transactionID/session registry/markers sin rehacer
  límites transaccionales por la extracción.
- Gates finales: `pnpm test:unit`: **52 archivos / 353 tests pasan**, 8.74 s.
  Log local `/tmp/auth-clean-05-unit-final.log`. `pnpm typecheck` incluyendo scripts,
  `pnpm lint`, Prettier del slice y whitespace pasan. Warn preexistente del override
  consumer fixture fuera del root sin error. Hooks de commit ejecutan Prettier y
  ESLint; frozen-lockfile no aplica porque manifest/lock no cambian.
- Code Review paralelo desde base 04: Standards encontró una frase documental
  antigua, corregida; final **0 pendientes**. Spec encontró cleanup con headers
  actuales en vez de originales, reproducido con tests en rojo y corregido mediante
  closure payload/headers capturados; revisor confirmó success/reject con ambos
  bindings cambiados; final **0 pendientes**. `docs/agents/issue-tracker.md` ausente;
  el ticket local autorizado es la fuente de revisión.
- Shims explícitos conservados para eliminación/caller inventory en 06:
  server/credentialEvidence, server/adminPolicy, server/sessionPolicy y refresh
  endpoint reexport. No cambio de exports públicos, options/schema, wire/status,
  formatos o namespaces. No implementación maintenance/cutover ni enforcement 06.
- Solo 05 se marca completed y se crea su commit individual. Sin push, deploy,
  cambios de acceso en servicios reales, Chromium ni nuevas suites DB/E2E.
  06 permanece sin modificar y sus dependencias 01–05 quedan satisfechas;
  el padre coordina su siguiente chat estrictamente secuencial.

Límites: doubles y happy-dom no certifican cookies/browser, Payload DB multiproceso,
locks/runtime ni despliegue. Fixtures SQLite/HTTP históricos siguen en test:unit y
no se presentan como doubles aislados. Refresh conserva commit/rollback nativos;
rechazar un receipt tras un hook no inventa una revocación o rollback adicional.
Rollback de código no recupera sesiones/grants revocados ni reduce generation.
Engram leído pero herramientas ausentes en ALL_TOOLS; no se altera configuración
persistente del host para instalarlas. Esta evidencia conserva el contexto local.
