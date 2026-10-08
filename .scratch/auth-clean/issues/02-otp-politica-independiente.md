# 02 — OTP con política independiente del transporte

**What to build:** El usuario solicita y verifica un OTP de login desde el formulario hasta una única sesión nativa. La política y el orden son idénticos por HTTP y por caller interno, y permanecen seguros ante resend, fallos de correo/storage y cambios de cuenta.

**Blocked by:** 01 — Login por contraseña y contratos base.

**Status:** completed

**Referencia:** «Separar la política de autenticación de Payload, HTTP y React», §§4–8, 10–11. Requisitos ARC-01–04, APP-01–02, TX-01–05, HTTP-01/03, CLI-01–03, CMP-01, SEC-01–06/12, TST-02, COMP-01/02. Escenarios SC-02–06, SC-18–20.

**Alcance:** Una unidad interna revisable; no exige un PR separado ni autoriza implementación. Migra OTP de login y expande seams reutilizables por ownership; no adelanta la autorización de signup/recovery/reauth del ticket 03.

- [x] Send y verify de login son operaciones con comandos angostos, validación reutilizable y política de método; un caller no HTTP no puede omitir límites o habilitación (SC-02/03).
- [x] Separar orquestación de evidencia de cuenta, ledger durable, criptografía y entrega; ports expresan capacidades reales, no CRUD genérico ni documentos Payload (ARC-01/02, APP-01).
- [x] Mantener formatos criptográficos, AAD, namespaces, binding, generación, TTL, cuotas, cooldown y attempts existentes; reloj/random se inyectan solo donde se usan, sin dependencias Node crypto en aplicación.
- [x] La evidencia seleccionada conserva estados unknown/unverified/deleted; omisiones o datos malformed nunca se convierten en identidad disponible o verificada (SEC-02).
- [x] Send conserva accepted genérico y contexto/budgets sin revelar existencia de cuenta, código ni receipt de correo; fallo de delivery no reinicia límites (SC-06, SEC-03/06).
- [x] Storage falla cerrado sin fallback de memoria ni autoridad alternativa; conservar serialización durable y consumption actual (SEC-05).
- [x] Verify válido consume una sola vez y abre una única sesión nativa con identidad exacta; nunca escribe password ni inventa sesión propia (SC-04, SEC-01).
- [x] Wrong/expired/exhausted proof, propósito/contexto inválido, resend y sustitución de cuenta con el mismo email respetan attempts/bindings y niegan nueva autoridad (SC-05, SEC-04).
- [x] El adapter relee evidencia vigente bajo el límite nativo de commit y valida accountID/email/version/generation; application ordena fases pero no abre SQL transaction (TX-02).
- [x] Mantener el burn previo a fases posteriores: un fallo de sesión/hooks no resucita OTP. Documentar consumo irreversible y writes que hacen rollback juntos sin fusionar/separar transacciones (TX-03).
- [x] Adapters propagan el mismo req real, preservan SQL con bindings/identificadores confiables y limpian transactionID/markers/sesiones/user temporal en finally, incluido rechazo asíncrono (TX-04/05, SC-20).
- [x] Retry SQLite solo puede preceder al callback; no repetir auth/hooks tras iniciarlo ni hacer commit implícito de transacción incompatible (TX-05).
- [x] HTTP solo decodifica y mapea; conserva origin/CORS, no-store, cookies, lifetime y respuestas. Composición liga stores/codecs/delivery al scope sin secretos en publicConfig (HTTP-01/03, CMP-01).
- [x] Send/verify del cliente pasan exclusivamente por el adapter HTTP compartido; hooks fuera de aplicación conservan in-flight, retry, contexto y guardas ante transporte malformed o expired proof (CLI-01–03, SC-18).
- [x] Añadir tests directos y HTTP/client con doubles para SC-02–06 y SC-18–20, incluidos orden burn/session, cambio de evidencia y llamadas intercaladas al store controlado; asserts de ausencia de efectos y de filtrado de secretos (TST-02, SEC-12).
- [x] Mantener callers de ownership funcionales con compatibilidad temporal identificada para 03; no declarar portable un módulo aún acoplado. Conservar API/schema/proof y rollback de código sin restaurar grants (COMP-01/02).
- [x] Pasan gates unitarios/estáticos/formato sin Chromium ni nuevas suites DB/E2E. Fixtures históricos se conservan; serialización en doubles demuestra protocolo, no locks multiproceso o rollback físico.

## Cierre y evidencia — 2026-10-08

Implementación autorizada para este chat y únicamente 02. Base verificada:
`chore/audit`, HEAD `8bf2a3a300422115fd7b9a1222e202150e6348a9`, dependencia 01
completed. Se siguieron `~/.agents/skills/implement/SKILL.md`, TDD y code-review.
No hay AGENTS.md aplicable, .agents/skills local ni docs/agents/issue-tracker.md;
el ticket local y docs/plugin-contracts.md son la autoridad de este slice.

- Comandos y política: application/use-cases/otpLogin.ts y otpProtocol.ts;
  reglas puras en domain/otpRules.ts, ports atómicos de challenge/budgets y codec
  en application/ports/otp.ts. No Node/Payload/HTTP/React/reloj ambiental en ellos.
- Composición privada e immutable por instancia/request: composition/otpLogin.ts.
  Selección estricta unknown/unverified/deleted/verified y receipt privado nativo
  en infrastructure/payload/otpLogin.ts. Ledger y codec mantienen namespaces,
  HMAC/AES-GCM/AAD, quotas, cooldown, generación, TTL y attempts.
- Send accepted conserva contexto y budgets sin assertion de delivery. Verify
  consume antes de sesión; storage cierra sin fallback. otpSession relee identidad,
  email, versión y generation bajo la transacción nativa y tras hooks asíncronos.
  El burn no revierte con la sesión; writes nativos/hooks transaccionales sí
  comparten rollback. Locks SQL usan valores ligados/identificadores confiables;
  se preserva retry SQLite solo antes del callback y denegación de tx incompatible.
  Markers/transactionID/sessions y user/evidence temporal se limpian/restauran.
- HTTP en interface/http/otpLogin.ts decodifica/mapea y materializa cookie/CORS,
  lifetime/removeTokenFromResponses y no-store. Cliente compartido rechaza context
  malformed y receipt expired; hook migrado a interface/react conserva in-flight,
  retry y contexto. Ownership mantiene bridge contracts/otpCompatibility para 03;
  paths legacy/hook se retiran en 06, sin declarar portable lo aún acoplado.
- TDD red/green registrado en ejecución: gate directo inexistente; consumed omitido;
  evidencia cambiada por hook asíncrono; context/receipt malformed o expired;
  lock sin bindings; IDs vacíos/no finitos y email malformed. Después pasan.
- Tests nuevos: 34 en cinco archivos tests/otp-login-*.test.{ts,tsx}. Doubles
  prueban orden burn/session, llamada intercalada controlada, fallos sin efectos,
  sustitución de cuenta, cleanup y dos factories reales con requests/colecciones/
  secretos/config distintos, mutación posterior y proof cruzado denegado.
- `pnpm test:unit`: **40 archivos / 273 tests pasan**, ejecución final 8.29 s.
  Conserva fixtures SQL/HTTP históricos; no nuevas suites DB/E2E ni Chromium.
- `pnpm typecheck` (incluye scripts), `pnpm lint`, Prettier del slice y
  `git diff --cached --check`: pasan. Advertencia preexistente de pnpm sobre
  overrides de tests/consumer sin efecto fuera de la raíz, sin errores.
- Revisión paralela Standards: 0 violaciones/0 observaciones pendientes; Spec:
  0 pendientes. Locale duplicado se centralizó; los dos P2 sobre selección
  malformed y evidencia SC-19 fueron corregidos y revisados de nuevo.
- Sin push, despliegue, cambio de rama ni implementación de 03–06. Archivos
  ajenos sin seguimiento preservados. Se crea un commit exclusivo de este slice.

Límite de evidencia: doubles demuestran protocolo/aislamiento/mapping/cleanup,
no locks multiproceso, rollback físico o cookies de navegador. Rollback de código
compatible nunca restaura grants consumidos/revocados. 03 queda desbloqueada por
02; 05 ya estaba desbloqueada por 01. El padre coordina el siguiente chat.
Engram fue leído, pero sus herramientas no están disponibles en este entorno;
no se modificó la configuración del host para instalarlo durante este slice.
