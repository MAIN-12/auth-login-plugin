# 06 — Migración segura y cierre arquitectónico

**What to build:** El consumidor conserva la operación de maintenance/cutover con sus revocaciones y rollback actuales, ahora separada en intención y commit nativo. Con todos los flujos migrados se retira compatibilidad temporal y el paquete demuestra fronteras Clean, equivalencia pública y un solo propietario HTTP en cliente.

**Blocked by:** 04 — Google con separación de proveedor y política; 05 — Sesiones, capabilities y autorización admin. Ambos bloqueos incluyen transitivamente 01–03; el cierre no puede empezar antes de completar todas las migraciones.

**Status:** completed

**Referencia:** «Separar la política de autenticación de Payload, HTTP y React», §§2–11 y checklist de conformidad final. Requisitos ARC-01–04, APP-01–02, TX-01–05, HTTP-01–03, CLI-01–03, CMP-01/02, SEC-01–14, TST-01/02, COMP-01/02. Escenarios SC-17 y revisión de evidencia acumulada SC-01–20.

**Alcance:** Una unidad interna de cierre revisable; no exige un PR separado ni autoriza implementación. No ejecuta cutover de producción, cambia schema/API, restaura backups, hace commit/push o reactiva navegador/integraciones.

- [x] MigrateAuthLogin conserva firma y comportamiento público; un caso de uso valida intención maintenance/inventory explícita y un adapter operacional mantiene el commit/cutover nativo, sin fingir principal HTTP (SC-17, TX-01).
- [x] Cutover conserva epoch/generation scoped por collection, hashes/password/cuentas/mapping y budgets; cada repetición elige generación fresca sin resetear cuotas ni revivir grants (SEC-13).
- [x] Conservar bypass nativo deliberado de maintenance sin rehash/provisioning; no dividir ni uniformar los límites transaccionales por razones de carpetas (TX-02–04).
- [x] Failure del commit conserva rollback asociado y resultado aggregate-only sin datos secretos; documentar consumo irreversible/revocaciones y límites de evidencia de los doubles (SC-17, SEC-12/13).
- [x] Rollback de código revierte slices compatibles sin bajar generation ni recuperar permits/correlations/sessions; backup pre-cutover requiere el procedimiento maintenance/re-cutover vigente antes de writers (COMP-02).
- [x] Retirar shims y formas legacy solo después de verificar que ningún caller permanece; todos los batches migrados siguen verdes y no queda doble propietario de política ni alias activo accidental.
- [x] Auditar todas las entradas del inventario, incluidos aliases inert, native auth/REST/GraphQL/Local API, provisioning, admin, maintenance y factories disabled; cada una tiene owner y caracterización verificable, sin nueva vía de bypass (SEC-01–14).
- [x] Dominio queda sin workflows/status/modelos HTTP o UI; application sin Payload/SQL/HTTP/React/Next/crypto ni dependencias ambientales. Conservar políticas puras y códigos canónicos sin casts/unknown para esconder acoplamiento (ARC-01/02, APP-01/02).
- [x] Repositories solo devuelven evidencia seleccionada; ports operacionales mantienen native auth, misma unidad de commit, rechecks/bindings y finally. No reabrir extracción transaccional completada por tickets previos (TX-01–05).
- [x] HTTP solo adapta transporte y consume operaciones construidas; composition es el único ensamblador de factories concretas con casos de uso, aislado por request/plugin y con disabled inert (ARC-04, HTTP-01–03, CMP-01/02).
- [x] Cerrar separación cliente/React de todos los flujos: un único authService posee HTTP incluido sesión/logout; hooks/context coordinan UI fuera de aplicación y reexports compatibles no filtran server state (CLI-01–03).
- [x] Mantener entrypoints/names/signatures/overloads/config serializable, wire/status/cookies, schema/tablas privadas, formats/AAD/namespaces/TTL/corpus y ownership evidence; comparar explícitamente API/schema diff y exports sin export star (COMP-01).
- [x] Cliente/RSC/proxy no alcanzan ledger, secrets, crypto server o adapters Payload transitivamente; email templates conservan su superficie y proxy sigue sin ser validador de sesión (ARC-03).
- [x] Enforcement de lint y tests del grafo rechazan domain hacia application, application hacia infrastructure/interface y client hacia server, incluidos type imports, barrels, alias, dynamic import y require; usar fixtures válidos/negativos, no búsqueda de substrings (TST-01).
- [x] Añadir doubles de maintenance y verificar trazabilidad completa SC-01–20 con tests directos/mapping correspondientes, narrow evidence, disabled sin efectos, stale commit, cleanup y compatibilidad; reutilizar evidencia de los tickets previos sin nuevas suites de aceptación (TST-02).
- [x] Pasan test:unit, typecheck, lint arquitectónico, formato y whitespace check; fixtures SQLite/HTTP históricos siguen dentro de la suite actual, sin llamarlos pruebas aisladas ni certificación DB multiproceso. No Chromium/Playwright/E2E.
- [x] Actualizar documentación de seams/autoridad con el estado realmente implementado y checklist final respaldada por evidencia. Riesgos nativos no demostrables por doubles quedan visibles para decisión separada, no se declaran certificados ni se ejecutan integraciones contra la preferencia del usuario.

## Evidencia de implementación — 2026-10-08

- Únicamente 06, chat separado y ejecución secuencial sobre `chore/audit`, sin cambiar
  rama. Base `8f1522e3ab833a396ff331d3c0fa04fe31d6759a` (05); tracked limpio al inicio.
  Verificados tickets 01–05 completed y sus commits individuales: 01 `8bf2a3a`,
  02 `7aac1c1`, 03 `61bf393`, 04 `f86c2ea`, 05 `8f1522e`. Este ticket se consolida
  en su propio commit 06; el hash resultante se entrega en el chat.
- Se siguieron `~/.agents/skills/implement/SKILL.md`, TDD en las seams preautorizadas
  de maintenance/grafo y Code Review paralelo Standards/Spec. No AGENTS raíz ni
  ancestro; dev/AGENTS.md no aplica. Issue tracker externo ausente: ticket local
  provisto es la fuente de revisión. Autoridad local plugin-contracts/CONTEXT/spec.
- MigrateAuthLogin mantiene firma/reporte públicos. Application valida attestation
  maintenance e identidad/inventario explícito, sin Payload/Where/principal HTTP.
  Composition captura where; adapter conserva validación native engine/collection,
  createLocalReq real, native transaction completa, SQL cutoff y finally de markers,
  transactionID/registry. Native writes siguen sin hooks/provisioning/rehash. No
  extracción adicional de los commits nativos de los tickets anteriores.
- El reporte selecciona solo cinco campos aggregate; TDD rojo reprodujo filtración
  de campos extra de un port double y verde la eliminó. TDD de admisión/grafo empezó
  rojo con módulos ausentes. Ciclos posteriores cubrieron type import por alias barrel,
  callees concretos por dynamic/require y unresolved dependencies; asset CSS existente
  se acepta como asset, no como excepción de código. Doubles de maintenance verifican
  credenciales/mapping, writes limitados a cutoff/inventario, generation fresca,
  bypass Local API, rollback asociado y cleanup después de fallo asíncrono. Las cuotas
  se caracterizan con migration-http histórico, no con una assertion tautológica.
- Callers source/tests fueron migrados antes de retirar todos los shims enumerados
  en 01–05: domain/login/otp/passwordLifecycle, contracts compatibility, application
  client/hooks/context/legacy flows, server forwarding y factories endpoint antiguos.
  Los owners operacionales server existentes permanecen. Stub aliases HTTP y globals
  cliente publicados siguen inert; no se activa ni inventa una vía de autorización.
- UI/wire models pasan a contracts; correlation workflow a application ports. Pure
  binding/rules/codes permanecen en dominio. Public config declarations separadas
  evitan alcanzar opciones privadas desde browser/proxy. RSC mantiene su option type
  export sin root/bootstrap; type Payload se permite solo desde OtpOptions/AdminOptions
  preexistentes, nunca desde concrete adapters/ledger/crypto. Email/proxy API conservada.
- Un solo authService posee HTTP, incluso sesión/logout; hooks/context fuera de
  application. Enforcement compartido lint/tests resuelve AST TypeScript transitivo,
  incluidos type imports/import types, barrels, aliases, dynamic import, require e
  import equals. Fixtures positivos/negativos, source real y lint de source unsaved;
  no dependencia de búsquedas por substring para validar fronteras.
- [Closure evidence](../../../docs/architecture/auth-clean-closure.md) cubre todas
  las entradas del inventario y SC-01–20 con owners/tests y límites. Docs de migración
  registran correlations Google antiguas sin binding: drenar o iniciar flujo nuevo,
  nunca rescatar principal/grants. Rollback compatible no baja generation ni revive
  permits/correlations/sessions. Backup pre-cutover exige writers detenidos y re-cutover
  fresco antes de tráfico. Schema inicializado fuera del commit puede quedar sin grants.
- Comparación explícita API con checker TS contra 05: mismos exports/types/properties/
  signatures/overloads en root/client/rsc/proxy; diff vacío tras normalizar solo IDs de
  Symbol.iterator y orden de unions literales. JSONs/log en `/tmp/auth-clean-06-api-*`.
  Manifest/lock/options/codecs/corpus/otpStore intactos; bootstrap solo imports; tablas,
  AAD/formats/namespaces/TTL, wire/status/cookies y ownership evidence conservados.
- Gates finales: `pnpm test:unit` **55 archivos / 373 tests**, 9.93 s, exit 0; log
  `/tmp/auth-clean-06-unit-final.log`. `pnpm typecheck` (incluidos scripts) exit 0;
  `pnpm lint` incluido grafo arquitectónico exit 0. Prettier del slice explícito
  (con `--ignore-path /dev/null`, incluyendo docs/ticket) y `git diff --cached --check` /
  `git diff --check` pasan. Warning consumer pnpm.overrides preexistente, sin error.
  Sin cambios manifest/lock; frozen-lockfile no aplica. Hooks de commit ejecutan
  Prettier y ESLint; su resultado y hash se verifican después del commit.
- Code Review contra base fija 05 sobre diff staged completo, incluidos nuevos archivos
  y retiros, antes del único commit: **Standards 0 hallazgos; Spec 0 hallazgos**.
  Ambos revisores aprobaron sin edits. No se sustituyeron los gates por la revisión.
- Solo 06 se marca completed tras satisfacer checks; no push/deploy/publicación,
  Chromium/Playwright/E2E ni migrations/backups/restores contra servicios reales.
  Untracked ajenos, incluidos planes auth-atomic-design/auth-hardening y documentos
  previos, conservados sin stage. La escritura del índice/commit Git requiere escalación
  de filesystem y fue autorizada por la tarea; no hubo rechazo de auto-review.

Límites: la suite actual conserva fixtures SQLite/HTTP reales en proceso y no se
presenta como tests aislados ni certificación DB multiproceso. Doubles no certifican
rollback físico/locks, cookies/provider runtime, shutdown de writers ni despliegue;
validación operacional separada pendiente, sin bloquear el cierre unit/static pedido.
Retención nativa sigue a cargo del host. Solo paths internos no publicados se retiraron;
consumidores que usaban deep imports fuera del exports map deben usar entrypoints.
Engram leído pero herramientas ausentes en ALL_TOOLS; no se modifica configuración
persistente del host. El contexto y las decisiones quedan en esta evidencia local.
