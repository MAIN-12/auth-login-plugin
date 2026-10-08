# 03 — Ownership y ciclo de contraseñas

**What to build:** El usuario completa signup, recovery, reautenticación y verify-email mediante los flujos existentes, con elegibilidad en casos de uso reutilizables y finalización nativa indivisible. HTTP deja de decidir quién obtiene un permiso o qué credencial puede establecerse.

**Blocked by:** 02 — OTP con política independiente del transporte.

**Status:** completed

**Referencia:** «Separar la política de autenticación de Payload, HTTP y React», §§4–8, 10–11. Requisitos ARC-01–04, APP-01–02, TX-01–05, HTTP-01–03, CLI-01–03, CMP-01, SEC-01–08/12/14, TST-02, COMP-01/02. Escenarios SC-02/03, SC-07–11, SC-18–20.

**Alcance:** Una unidad interna revisable; no exige un PR separado ni autoriza implementación. Usa los seams OTP ya expandidos, sin cambiar métodos públicos, añadir email-change UX o partir los commits para ajustarlos a carpetas.

- [x] Signup/recovery/reauth/verify-email tienen comandos y política en casos de uso; allowSignup, recovery y admisión de reauth se evalúan también desde caller interno antes de efectos (SC-02, APP-01, HTTP-01).
- [x] El repository devuelve evidencia seleccionada con capacidad/versión opaca y estados explícitos; hash/salt/documentos nativos no salen del mapper server ni se esconden dentro de unknown (SEC-02/12).
- [x] Puertos de permit/credential commit/native reauth expresan intención; codecs conservan formato, AAD, TTL y namespaces. Parsear un grant no concede por sí solo autoridad (SEC-04/05).
- [x] Signup solo admite ausencia autorizada con proof vigente, elige el password el owner y realiza un create nativo; no precrea cuenta ni inicia sesión automáticamente (SC-07).
- [x] Recovery exige password existente: missing/deleted/passwordless/unknown no recibe permiso válido ni primer password; send conserva respuesta genérica y completar revoca sesiones/permits sin auto-login (SC-08, SEC-03/07).
- [x] Reauth exige principal verificado exacto y liga SID/version; password reauth usa verificación nativa y grant limitado de cinco minutos, no un login alternativo (SEC-01/04).
- [x] Cambiar principal/SID/version después de la lectura orientativa deniega completion bajo el commit; no quedan credencial/sesión nuevas (SC-09, TX-02).
- [x] Verify-email cambia solo verificación: preserva password y sesiones, devuelve exactamente success true y no emite cookie, token o permiso adicional (SC-10, HTTP-02, SEC-08).
- [x] El adapter mantiene relectura bajo locks, consumo, escritura de credencial y revocación/native update en los límites indivisibles existentes; application no recibe ni abre transacción nativa (TX-01–03).
- [x] Hook que lanza o cambia credenciales durante verify/completion causa rollback de los writes asociados; proof quemado no revive, error no filtra infraestructura y finally limpia también en rechazo asíncrono (SC-11/20, TX-03/04).
- [x] Conservar req real en Local API/DB calls, SQL parametrizado, resolución confiable de identificadores y reglas de retry/transacción incompatible sin repetición de efectos (TX-04/05).
- [x] Nuevos passwords conservan corpus versionado, mínimo Unicode y reglas existentes; esta validación no endurece retroactivamente login legacy (SC-03/07, SEC-14).
- [x] Forgot-password invoca la operación de recovery compartida y no otro handler; aliases deshabilitados permanecen inert sin lookup/mail, con errores/status/origin/cookies equivalentes (HTTP-01–03).
- [x] Formularios y continuación de password usan el único cliente HTTP; hooks/context fuera de application conservan editable password y proof limitado para retry transitorio, y niegan uso expired/consumed sin convertir estado React en autoridad (CLI-01–03, SC-18).
- [x] Tests directos y mapping HTTP/UI con doubles cubren SC-02/03, SC-07–11 y SC-18–20, asserts sin efectos, narrow mappings/zero secrets y cleanup. No fabricar permisos por default para ocultar ausencia de política (TST-02).
- [x] Mantener API/schema/proof formats/TTLs/exports explícitos y compatibilidad temporal de callers no migrados; registrar retiro en 06, sin doble owner. Rollback de código no restaura permisos/sesiones ni baja generation (COMP-01/02).
- [x] Pasan test:unit y gates estáticos/formato sin Chromium ni nuevas suites DB/E2E; preservar fixtures históricos y declarar que doubles no certifican locks ni rollback físico.

## Evidencia de implementación — 2026-10-08

- Slice exclusivo 03 en `chore/audit`, base `7aac1c150205f7c392172a288c425ca37665822b`.
  Dependencia 02 completed; 01 presente en `8bf2a3a300422115fd7b9a1222e202150e6348a9`.
  Estado inicial tracked limpio; se preservan todos los archivos ajenos sin seguimiento.
  Node 22.23.2, pnpm 10.19.0, dependencias instaladas/lockfile sin cambios.
- Implement y TDD de Matt Pocock aplicados. Seams autorizados por este ticket:
  comandos/casos de uso directos, boundaries nativos y mapping HTTP/client/React
  con doubles; no se solicitó otra autorización ni se implementaron 04–06.
- `application/use-cases/ownership` posee comandos tipados y admisión compartida
  para signup/recovery/reauth/verify-email; `ownershipVerification` usa los puertos
  codec/ledger/delivery de 02. `server/ownershipAccount` selecciona evidencia
  explícita con versión opaca; hash/salt/documentos nativos quedan en mapper/adapters.
  La admisión interna disabled precede lookup/mail/native auth. Forgot-password
  invoca recovery compartido, sin delegar a otro handler HTTP.
- `infrastructure/crypto/passwordPermitCodec` conserva formato v1, AAD/namespaces,
  nonce y TTL 10/5 minutos. Parsear no otorga autoridad: emisión revalida ausencia
  o ID/version/credencial/SID bajo locks; completion revalida generation y principal
  dentro del commit. Signup hace create solo después del proof y no auto-login;
  recovery exige password existente y revoca sesiones/permisos por versión;
  verify-email preserva password/sesiones y devuelve únicamente success true.
- El owner elige el password. Intent privado por request valida el último
  beforeChange y registra el primer hash/salt nativo; sustituciones posteriores
  en hooks deniegan completion bajo rollback. Finally limpia intent, markers,
  transactionID, registry y user temporal también en rechazo asíncrono.
- Password reauth conserva verificación/lockout nativos. No toma lock previo que
  pueda bloquear el contador externo de intentos incorrectos. El write de sesión
  nativo coordina locks y suprime SID nuevo; si Payload no abrió transacción,
  mantiene una prestada hasta acabar hooks y guard final, luego commit/reject.
  Snapshot privado permite solo el rehash legacy nativo condicional anterior a
  beforeLogin; sellarlo impide que los hooks etiqueten sustituciones como rehash.
  Principal exacto/SID/version se revalidan antes de conceder un permit de 5 minutos.
- SQL de permisos ahora parametrizado; req real, resolución de identificadores,
  retries solo de adquisición y rechazo de transacciones incompatibles conservados.
  El corpus versionado/mínimo Unicode de nuevos passwords y login legacy no cambian.
- Hooks/passwordProof migrados a interface/react/client, con reexports explícitos
  temporales. Un solo HTTP client valida contexts y permits vigentes; inFlight
  evita double submit; expiry/consumed reinicia ownership y fallo transitorio
  conserva proof limitado/password editable. No se amplían exports públicos/schema.
  Retirement de bridges ownership/password-lifecycle/endpoint/UI queda asignado
  documentalmente a 06; Google conserva su bridge hasta su tarea 04.
- Red/green observados: caso de uso inexistente; evidencia unknown; generation
  invalidada antes del commit; proof stale antes de emitir grant; sustitución
  asíncrona de credencial; identidad malformed; alias disabled con input malformed;
  receipt expirado; submits duplicados de completion/recovery. Tests directos
  adicionales validan purpose/expiry/Unicode sin writes. Doubles con coordinator
  real cubren lockout previo sin locks, rehash válido, cleanup y dos factories
  reales con colecciones/secretos/config independientes y permits cruzados negados.
- `pnpm test:unit`: **44 archivos / 294 tests pasan**, ejecución completa 9.70 s.
  Log de esta ejecución local: `/tmp/auth-clean-03-unit.log`. Incluye fixtures
  SQL/HTTP históricos; no nuevas suites DB/E2E y no Chromium.
- `pnpm typecheck` (incluye scripts), `pnpm lint`, Prettier del slice y
  `git diff --cached --check`: pasan. Advertencia preexistente de pnpm sobre
  overrides del consumer fixture fuera de root, sin errores.
- Code Review paralelo: Standards 0 violaciones/0 heurísticas accionables;
  Spec 0 pendientes. Spec detectó lockout externo y rehash legacy; se corrigieron
  con evidencia request-private y settlement nativo, y ambos ejes se revisaron
  nuevamente. Último delta client/UI/admisión revisado sin hallazgos.
- Sin push, despliegue, cambio de rama o descarte de trabajo. Se crea un commit
  exclusivo de 03 tras gates; únicamente este ticket se marca completed.

Límites: doubles prueban orden, relecturas/mapping/aislamiento y cleanup, no
locks multiproceso, rollback físico ni cookies de navegador. Los receipts DB
históricos no certifican todos los fallos de adapters reales o una deployment.
Rollback de código nunca restaura permisos consumidos, sesiones revocadas ni baja
generation. El permiso de completion cuyo consumo se revierte con la transacción
puede reintentarse mientras sea vigente; el OTP ya quemado no revive.

Desbloqueada por 03: `.scratch/auth-clean/issues/04-google-proveedor-politica.md`,
«04 — Google con separación de proveedor y política» (dependencia: 03).
05, «05 — Sesiones, capabilities y autorización admin», depende de 01 y ya estaba
lista. 06, «06 — Migración segura y cierre arquitectónico», sigue bloqueada por
04 y 05. El padre coordina el siguiente chat estrictamente secuencial.

Engram fue leído; no hay herramientas Engram disponibles en el catálogo del
entorno. No se alteró la configuración del host para instalarlas durante 03.
