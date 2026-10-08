# 01 — Login por contraseña y contratos base

**What to build:** El usuario puede iniciar sesión por contraseña con el mismo resultado y la misma autoridad nativa de Payload; un caller interno autorizado ejecuta exactamente la misma política que HTTP. Se expande primero el seam de contratos y composición necesario para migrar este flujo sin romper los restantes.

**Blocked by:** None — can start immediately.

**Status:** completed

**Referencia:** «Separar la política de autenticación de Payload, HTTP y React», §§2–6, 8–11. Requisitos ARC-01–04, APP-01–02, TX-01, HTTP-01/03, CLI-01–03, CMP-01, SEC-01/02/12/14, TST-02, COMP-01/02. Escenarios SC-01–03, SC-18–20 en el alcance de login.

**Alcance:** Una unidad interna revisable; no exige un PR separado. La aprobación publica tickets, no autoriza implementación. No reorganizar otros flujos ni crear un repository CRUD, contenedor DI o engine de sesiones alternativo.

- [x] Registrar antes de implementar la aprobación de la adaptación específica del plugin y reconciliar su autoridad documental con los contratos vigentes; no adoptar colecciones o tipos del monorepo AOP literalmente.
- [x] Caracterizar nombres, firmas, overloads, rutas, respuestas, cookies y errores actuales de login y dejar inventario de los contratos a preservar y de los shims temporales con ticket de retiro.
- [x] Expandir contratos angostos de comando, principal, resultado y receipt privado junto a las formas existentes; otros callers continúan funcionando hasta migrarlos, sin dos propietarios activos de la política del login.
- [x] La operación directa valida invariantes y deniega un método deshabilitado antes de auth, lookup o cualquier efecto; HTTP solo añade decoding, bounds, origin y mapping.
- [x] Login invoca autenticación nativa una sola vez y conserva hooks, lockout, verificación y autoridad sobre credenciales/sesiones; no introduce hashing, JWT o fallback propio (SC-01).
- [x] Campos inválidos producen el error compatible sin efectos; la regla de nueva contraseña no se aplica a un password legacy corto durante login (SC-03, SEC-14).
- [x] Dominio contiene reglas/códigos puros sin workflow ni status HTTP; aplicación conoce comandos y ports, no Payload, SQL, React, Next, cookies, fetch, crypto o reloj ambiental (ARC-01/02).
- [x] Fallos esperados usan códigos semánticos; el mapper conserva status, body y correlation ID. Fallos inesperados se cierran como AUTH_UNAVAILABLE sin propagar APIError, stack ni secretos (APP-02, SEC-12).
- [x] Composición construye el flujo con configuración privada capturada e immutable; HTTP recibe la operación construida y no ensambla adapters concretos (ARC-04, CMP-01).
- [x] El scope liga adapters al request real mediante closures; no pasa req, transactionID ni un unknown encubierto a aplicación. Dos requests/instancias no comparten principal, secretos o configuración (TX-01, SC-19).
- [x] El receipt de sesión queda privado al adapter: HTTP materializa cookie/user/exp y aplica removeTokenFromResponses sin introducir token o documento nativo en dominio.
- [x] El formulario usa el mismo adapter HTTP configurado por instancia; hooks/context del camino de login coordinan interacción fuera de aplicación y conservan locale, guardas, in-flight único y un solo árbol responsive (CLI-01–03, SC-18).
- [x] Tests directos y mapping HTTP con doubles prueban happy path, disabled sin efectos, input inválido, native failure, error saneado, malformed response y aislamiento; caracterizan cleanup del scope cuando corresponde (SC-01–03, SC-18–20, TST-02).
- [x] Preservar API pública, schema, proof formats/TTL y exports explícitos. Los paths internos antiguos necesarios para otros tickets siguen utilizables mediante shims identificados, no duplicación de políticas (COMP-01).
- [x] Pasan test:unit, typecheck, lint, formato del slice y whitespace check. No Chromium, E2E ni nuevas suites de aceptación; fixtures SQLite/HTTP históricos de la suite actual se conservan sin llamarlos evidencia aislada de use-cases.
- [x] El slice es revertible como código compatible sin resucitar sesiones/proofs revocados; documentar límites de doubles, que no certifican locks reales, cookies de navegador ni rollback físico (COMP-02).

## Cierre y evidencia — 2026-10-08

Implementación autorizada explícitamente por el usuario para este chat y únicamente
este ticket. La aprobación/adaptación está registrada en `docs/plugin-contracts.md`;
CONTEXT e índice de arquitectura ahora referencian la autoridad local del plugin.
No existe AGENTS.md raíz ni .agents/skills en este checkout; dev/AGENTS.md no aplica
porque no se modificó dev. Se siguieron Implement, TDD y code-review de ~/.agents/skills.

- Caso de uso/puerto: `src/auth/application/use-cases/passwordLogin.ts`,
  `ports/nativePasswordAuth.ts`, `models.ts`; reglas/códigos puros en domain.
- Composición/scope y receipt privado: `src/auth/composition/passwordLogin.ts`,
  `src/auth/infrastructure/payload/nativePasswordAuth.ts`. El adapter llama una vez
  a loginOperation con req real, mapea fallos nativos y consume/limpia su receipt.
  No añade transacción o marker propio; la coordinación nativa existente mantiene
  sus responsabilidades de limpieza. No se pasa req/transactionID a application.
- HTTP/cliente/React: `src/auth/interface/http/passwordLogin.ts`, `authTransport.ts`,
  `interface/client/authService.ts`, `interface/react/AuthFlowContext.tsx` y
  `interface/react/hooks/useLoginFlow.ts`. Mismo contrato público, locale configurado,
  guard compartido de una operación en vuelo y reintento tras fallo.
- Shims y ticket de retiro 06: inventario en `docs/plugin-contracts.md`. No hay dos
  propietarios de política: el wrapper genérico antiguo delega al caso de uso.
- TDD: primer seam aplicación y primer scope fallaron antes de implementar;
  la prueba OTP durante password pendiente falló con un fetch y pasó tras el guard.
- `pnpm test:unit`: 35 archivos / 239 tests pasan tras el último cambio. Incluye
  28 tests nuevos en cinco archivos `tests/password-login-*.test.{ts,tsx}` con
  doubles de ports/SDK/HTTP; las fixtures SQLite/HTTP históricas permanecen.
- `pnpm typecheck`, `pnpm lint`, Prettier del slice y `git diff --cached --check`:
  pasan. Revisión separada Standards y Spec (incluido delta final): sin hallazgos.
- No Chromium, E2E, nuevas suites DB de aceptación, push, despliegue ni cambio de rama.

Límite de evidencia: doubles verifican protocolo, mapping, aislamiento y cleanup,
no locks reales, cookies de navegador o rollback físico. Revertir código compatible
no resucita sesiones/proofs revocados. Tareas 02–06 conservan sus archivos y estados;
02 y 05 quedan desbloqueadas por 01, pero no fueron implementadas aquí.
