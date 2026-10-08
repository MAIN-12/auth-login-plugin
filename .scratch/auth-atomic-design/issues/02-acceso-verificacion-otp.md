# 02 — Acceso y verificación OTP

**What to build:** El usuario puede solicitar un código de acceso y verificarlo con la misma experiencia actual, usando las composiciones Atomic Design compartidas por Tailwind y HeroUI. Los fallos y contextos inválidos tienen recuperación localizada y no producen peticiones concurrentes.

**Blocked by:** 01 — Base compatible y login con contraseña.

**Status:** completed

- [x] El recorrido de solicitud y verificación OTP para login atraviesa los módulos nuevos desde AuthPages y AuthCard hasta el formulario y sus controles, conservando métodos habilitados, rutas, callbacks, textos y efectos existentes.
- [x] OtpInput es una molécula posicional neutral respecto al estilo; Tailwind y HeroUI comparten una sola lógica de interacción y no dependen de un adapter Tailwind para reutilizarla.
- [x] Editar o borrar un dígito conserva las posiciones restantes; backspace, foco y navegación de teclado mantienen la semántica vigente sin desplazar el código accidentalmente.
- [x] Pegado y autofill de un código completo mantienen el comportamiento vigente, incluyendo la verificación automática cuando corresponda.
- [x] La verificación manual y automática comparten el guard de envío y no generan solicitudes simultáneas; loading, disabled y recuperación de errores mantienen el estado visible coherente.
- [x] Un contexto OTP ausente o inválido muestra la recuperación localizada existente en vez de dejar una pantalla vacía; los errores de envío y verificación siguen siendo anunciables.
- [x] La composición conserva la distinción de propósito entre acceso y prueba de propiedad; no mezcla continuaciones ni altera las políticas OTP del dominio o del servidor.
- [x] VerifyOtpForm y VerifyOtpPage usan una composición por pantalla para ambos estilos, manteniendo una única instancia del formulario y la carga coordinada de la tarjeta.
- [x] Reutilizar las suites de composición y las pruebas OTP enfocadas para verificar edición posicional, borrado, pegado/autofill, contexto inválido, distinción de propósito y exclusión de envíos; conservar los checks aplicables verdes.
- [x] Los forwards temporales necesarios para registro y recuperación continúan apuntando a los módulos definitivos; no se introducen nuevos seams de autenticación, contratos públicos ni dependencias.


## Evidencia de cierre

Completada el 2026-10-08 en `chore/audit`, base
`b1afe8858cefeb514d6b392e5beda54fe2e2080b`, exclusivamente ticket 02.
Decisiones, evidencia y límites en
[auth-atomic-design-02.md](../../../docs/architecture/auth-atomic-design-02.md).

- TDD red→green en AuthPages de disabled de reenvío durante verificación;
  15 tests públicos nuevos con controles reales de ambos estilos.
- Focused: 7 archivos / 45 tests; suite final: 58 archivos / 396 tests.
- Typecheck/scripts, lint, Prettier del slice y whitespace pasan.
- Build y consumo externo pasan; diff estático de API contra 01 vacío.
- Code Review independiente: Standards 0 / Spec 0 hallazgos.
- No nuevos seams, API, dependencias, política de autenticación ni servidor.
  No browser/E2E/SSR real, nuevas suites DB, push, publicación ni despliegue.
- 03 desbloqueada por 01+02; 04 ya desbloqueada por 01; 05 espera 03+04.
  03/04/05 no se implementaron; el padre coordina el siguiente chat.

El hash del commit individual se entrega en el resultado del chat, sin referencia
circular dentro de este mismo commit.
