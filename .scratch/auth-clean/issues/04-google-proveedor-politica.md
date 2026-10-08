# 04 — Google con separación de proveedor y política

**What to build:** El usuario completa login, linking explícito y reautenticación con Google mediante redirect/popup existentes. La aplicación decide la operación; el proveedor verifica identidad y adapters nativos finalizan cuenta/sesión sin autolink por email.

**Blocked by:** 03 — Ownership y ciclo de contraseñas, por los permisos de linking y reautenticación.

**Status:** completed

**Referencia:** «Separar la política de autenticación de Payload, HTTP y React», §§4–8, 10–11. Requisitos ARC-01–04, APP-01–02, TX-01–05, HTTP-01–03, CLI-01–03, CMP-01, SEC-01/02/04/05/09/12, TST-02, COMP-01/02. Escenarios SC-02/03, SC-12/13, SC-18–20.

**Alcance:** Una unidad interna revisable; no exige un PR separado ni autoriza implementación. No añadir providers, métodos nuevos, autolink por email o un engine de sesiones.

- [x] Start login/link/reauth y callback ejecutan comandos angostos y autorización desde casos de uso; método disabled desde caller interno se rechaza antes de provider, correlation o account effects (SC-02/03).
- [x] Separar política pura de cuenta, orquestación, provider exchange/verificación, correlation crypto/storage y commit operacional nativo; ports no exponen SDK, Payload/req o SQL a aplicación (ARC-01/02, APP-01).
- [x] Provider solo devuelve identidad verificada: no decide provisioning/linking ni inicia sesión; secretos permanecen privados en adapters/composición (SEC-12).
- [x] Correlations conservan formatos, AAD, namespaces y TTL de diez minutos; mantienen binding browser/origin/collection/purpose/principal/SID/version/epoch y returnTo local (SEC-04).
- [x] Callback válido consume correlation, luego exchange, política/commit de cuenta y sesión nativa en ese orden; native auth continúa siendo la autoridad (SC-12, SEC-01).
- [x] Correlation se quema antes de exchange; fallo de provider/commit/sesión no la resucita. Documentar límites irreversibles y rollback asociado sin uniformar transacciones (TX-03, SEC-05).
- [x] Wrong browser/state/expiry/binding/principal niega autoridad y limpia cookies según fase; falla storage sin fallback en memoria (SC-13).
- [x] Cuenta se identifica por sub estable verified y collection; coincidencia de email nunca autoriza autolink, y duplicate sub/cuenta se niega (SEC-09).
- [x] Linking requiere permiso reciente explícito; reauth exige exact principal/SID y cambios stale se rechazan bajo commit, no solo por comprobación previa (TX-02, SEC-04).
- [x] Adapter conserva uniqueness bajo lock, req real, SQL bindings e identificadores confiables; finally limpia transacción/markers/sesiones/user temporal en success y throw asíncrono, sin retry de efectos iniciados (TX-04/05, SC-20).
- [x] HTTP conserva métodos/rutas, aliases POST deshabilitados inert, origin/CORS, no-store, flags/lifetime/callback cleanup y removeTokenFromResponses; no ensambla provider/store ni decide account policy (HTTP-01–03).
- [x] Google actions usan el adapter HTTP único por instancia; navegación/popup se mueven junto a sus helpers sin duplicar requests en hooks/forms, fuera de application (CLI-01/02).
- [x] Cliente preserva guards ante malformed/error/expired proof, binding popup, continuation/retry e in-flight único; no usa flags React como autoridad de cuenta/sesión (CLI-03, SC-18).
- [x] Tests directos y HTTP/client con doubles cubren SC-02/03, SC-12/13 y SC-18–20: orden consume/exchange/finish, no autolink, uniqueness/stale denial, aislamiento, cleanup y ausencia de sesión/secret leak en fallos (TST-02).
- [x] Mantener API/schema/mapping de sub, proof formats/TTL y exports explícitos; identificar shims para 06. Rollback de código no recupera correlations, permisos o sesiones quemados (COMP-01/02).
- [x] Pasan gates unitarios/estáticos/formato sin Chromium ni nuevas suites DB/E2E; conservar fixtures históricos y explicitar que doubles no certifican provider runtime, popup real o locks multiproceso.

## Evidencia de implementación — 2026-10-08

- Slice exclusivo 04 en `chore/audit`; base y dependencia 03 completed en
  `61bf393aecaf0185bd2280acff2c2263b78ad657`. Estado inicial tracked limpio;
  todos los archivos ajenos sin seguimiento se preservan. Node 22.23.2,
  pnpm 10.19.0, dependencias instaladas; manifest/lockfile sin cambios.
  No root/ancestor AGENTS.md aplicable; dev/AGENTS.md fuera del slice.
- Implement y TDD de Matt Pocock aplicados en seams autorizados por el ticket:
  caso de uso directo, HTTP/client y commit nativo con doubles. Red/green
  observados: caso de uso ausente, popup duplicado, auth_time no finito, cambio
  de SID tras espera bajo commit, mapping semántico HTTP y binding cruzado con
  store compartido/epoch vacío. El fixture histórico del cliente detectó la
  precedencia disabled ante llamadas paralelas; corregida sin cambiar el fixture.
- `application/use-cases/googleFlow` posee admisión interna antes de efectos,
  comandos start/callback y orden de autorización, reservation, consume,
  exchange y finish. Puertos seleccionados no exponen SDK, Payload, req o SQL.
  La política pura de login/link/reauth reside en domain/googleAccountPolicy.
  Linking exige permiso reauth explícito y reciente, exact principal/SID/version;
  decode no concede autoridad de commit. Reauth exige asociación exacta y
  auth_time finito dentro de la ventana histórica.
- Provider OIDC movido a infrastructure/providers. Conserva oauth4webapi,
  discovery per instancia, PKCE, nonce, issuer/audience y firma RS256; solo
  devuelve identidad verificada. Config/secretos quedan privados en composition
  y adapters. Crypto y durable correlations tienen owners separados, conservando
  entropy, keys SHA256/namespaces, encrypted store/AAD y TTL de diez minutos.
- Corrección SEC-04: binding privado adicional collection/origin/generation
  también para epoch vacío. Un store compartido no admite callbacks entre
  collections u origins. Filas históricas pendientes sin binding se rechazan
  en el flujo actualizado y expiran con el TTL existente; no cambia API pública,
  formatos de permits, keys, AAD ni esquema/mapping de sub.
- Correlation se quema y confirma antes del exchange. Provider/commit/session
  failure nunca la resucita. Wrong browser/expiry/state/binding niega antes de
  exchange; fallo storage no usa fallback. Callback HTTP limpia cookie según
  fase y conserva Host/path, origin/CORS, no-store, cookie flags/lifetime,
  redirect/popup y aliases POST disabled inert. Tokens nunca se serializan en
  el callback login (body vacío), incluido removeTokenFromResponses.
- `googleAccountCommit` mantiene collection/sub y collection/account UNIQUE,
  credential/account locks, mismo req real y SQL values parametrizados.
  Matching email no permite autolink. Relectura bajo commit valida principal,
  SID, email, versión, verificación y sesión vigente después de esperas de
  permisos/generation, con cleanup también en throw asíncrono. No retry de
  efectos iniciados. Provisioning nativo borra bootstrap password dentro de la
  misma transacción y revalida cuenta tras callbacks de access; ningún credential
  snapshot/token/user nativo entra en el resultado application.
- Scope de request acepta una operación, restaura user/headers temporales y
  guarda receipt nativo consumible una vez fuera de application. Sesión login
  sigue siendo creada por el adapter nativo existente, con guard de generation
  y relecturas de versión, hooks y cleanup. Reauth/link no crean sesión.
- Google actions/navigation/popup/helpers viven juntos en interface/client,
  usando el único HTTP adapter de la instancia. Hooks/form usan service estable;
  in-flight deniega popup/link duplicados. Popup exige source/origin exactos y
  proof vigente; malformed/expired no concede autoridad. Cleanup y retry tras
  fallo transitorio probados, sin usar flags React para conceder cuenta/sesión.
- Doubles directos/HTTP/client/native demuestran burn-before-exchange/finish,
  no autolink, rechazo de constraint UNIQUE, asociación rival post-INSERT,
  stale SID/version, no-session/receipt ante fallo, req real, bindings y cleanup.
  Factories/scopes y store compartido prueban aislamiento de collection/origin.
  Fixtures históricos conservados; ninguna nueva suite DB/E2E o Chromium.
- Gates finales: `pnpm test:unit` **49 archivos / 322 tests pasan**, 7.83 s;
  log local `/tmp/auth-clean-04-unit-final.log`. `pnpm typecheck` (incluye scripts),
  `pnpm lint`, Prettier del slice y whitespace pasan. Los hooks Prettier/ESLint
  se ejecutan en el commit; frozen-lockfile no aplica porque manifest no cambió.
  Warn preexistente pnpm overrides del consumer fixture fuera del root, sin error.
- Code Review paralelo desde la base 03: Standards **0 pendientes**. Spec detectó
  evidencia parcial de uniqueness: añadidos double de INSERT rechazado y rival,
  no sesión/receipt/replay tras fallo. Spec final **0 pendientes**. Ambos ejes
  revisaron además la corrección de binding baseline y el delta final de tests.
  `docs/agents/issue-tracker.md` ausente; ticket local es autoridad de revisión.
- Compatibilidad temporal explícita con retiro asignado a 06: application
  googleFlow/googleAccountPolicy, contracts/googleCompatibility, server
  googleProvider/googleAccount/googleAuthentication y endpoint googleEndpoints.
  No cambios de exports públicos, Google options/schema o APIs de consumidores.
- Solo 04 se marca completed y se consolida en un commit individual sobre la
  misma rama. Sin push, despliegue, credenciales reales, cambios de acceso
  persistente, implementación 05/06 ni descarte de trabajo ajeno.

Límites: los doubles no certifican provider runtime, popup/cookies reales,
locks/uniqueness multiproceso ni rollback físico. La asociación nativa puede
quedar committed si falla la sesión posterior: un nuevo Google login la utiliza.
Consumo de permiso linking y asociación comparten rollback; ese rollback puede
preservar el permit, pero nunca revive la correlation previamente quemada.
Rollback de código no recupera correlations, permisos o sesiones quemados ni
reduce generation; solo es compatible un artefacto que conserve estas garantías.
Engram leído, pero sin herramientas disponibles en el catálogo del entorno;
no se altera configuración persistente del host para instalarlas.

05, «05 — Sesiones, capabilities y autorización admin», depende únicamente de
01 y sigue lista. 06, «06 — Migración segura y cierre arquitectónico», tiene su
dependencia 04 satisfecha, pero espera 05. El padre coordina el siguiente chat
estrictamente secuencial; este chat no inicia ninguna de esas tareas.
