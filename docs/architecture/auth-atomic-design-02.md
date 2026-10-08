# Atomic Design 02 — acceso y verificación OTP

Base: `b1afe8858cefeb514d6b392e5beda54fe2e2080b`, rama `chore/audit`.
Autoridad: ticket `.scratch/auth-atomic-design/issues/02-acceso-verificacion-otp.md`
y spec local. Dependencia 01 completed; implementación exclusiva de 02.
No hay AGENTS.md aplicable en el repositorio ni sus ancestros; dev/AGENTS.md
no aplica a este slice. Se aplicaron Implement, TDD y Code Review de Matt Pocock.
Los seams de composición pública y pruebas OTP fueron aprobados en el spec.

## Cambios y compatibilidad

- OtpInput reside en molecules: una sola interacción posicional para los dos
  estilos, sin imports del adapter Tailwind. Conserva tokens visuales, mensajes
  accesibles, edición/borrado por posición, foco, flechas, pegado y autofill.
  No usa HeroUI ni necesita cargarlo para renderizar controles HTML nativos.
- VerifyOtpForm reside en organisms y consume Button, OtpInput y AuthErrorNotice
  directamente. VerifyOtpPage compone una sola pantalla sobre AuthLayout/AuthCard
  definitivos. Los dos antiguos paths de página son forwards privados.
- AUTH_FORMS apunta directamente al organismo; los paths antiguos de form y UI
  mantienen forwards para consumidores pendientes. No hay segunda implementación.
- Verificación automática/manual y reenvío conservan el guard de aplicación
  existente. Durante cualquier operación se deshabilitan controles incompatibles:
  reenvío durante verificación, entrada y verificación durante reenvío.
- Conserva recuperación localizada por contexto inválido, errores anunciables,
  métodos habilitados, rutas/destinos, textos y efectos. Login completa acceso;
  signup/recovery/reauth continúan a set-password; verify-email vuelve a login.
  No se modifica el hook, transporte, dominio, servidor ni sus políticas.
- API, dependencias, configuración, providers, RSC y auth-clean no cambian.
  El alcance no implementa 03/04/05 ni auth-hardening.

## Evidencia

- Red → green en AuthPages con controles Tailwind/HeroUI reales: el reenvío
  aparecía habilitado durante verificación; el test falló en ambos estilos y
  pasa con disabled coherente. `/tmp/auth-atomic-02-red.log` y
  `/tmp/auth-atomic-02-green.log`.
- 15 tests nuevos de composición pública protegen solicitud OTP con método
  habilitado, exclusión concurrente, error/reintento, edición posicional, borrar,
  backspace/flechas/foco, pegado/autofill, recuperación y las cinco continuaciones
  por propósito. Reutiliza las suites OTP, carga, tema y correcciones existentes.
- Pruebas enfocadas: 7 archivos / 45 tests, 1.34 s.
  `/tmp/auth-atomic-02-focused.log`.
- Suite final: **58 archivos / 396 tests**, 10.30 s.
  `/tmp/auth-atomic-02-unit-final.log`. Una primera ejecución detectó timeout de
  una espera HeroUI bajo carga; se ajustó a esperar el control visible hasta
  cinco segundos, sin sleeps ni modificar comportamiento de producción.
- `pnpm typecheck` (incluye scripts), `pnpm lint`, Prettier del slice y
  `git diff --cached --check` pasan.
  `/tmp/auth-atomic-02-{typecheck-final,lint-final,format}.log`.
- `pnpm test:consumer` pasa, incluyendo build limpio, tarball temporal,
  instalación externa sin scripts, resolución de root/client/rsc/proxy,
  ESM root/migration y declaraciones públicas. Node v22.23.2;
  SHA256 `d5feef7cbea171aa0169e121e91399dea80cf6ef4ac8cb9b719cee5cff205059`.
  `/tmp/auth-atomic-02-consumer.log`. El sandbox requirió acceso al socket local
  de tsx; una ejecución intermedia detectó una edición concurrente de fuente y
  se repitió con fuente estable. No publicación.
- Diff estático normalizado de exports, propiedades, tipos y call signatures
  vacío contra 01, usando TypeScript checker. Se preserva incluso el nombre
  `props` en la firma pública de VerifyOtpPage.
  `/tmp/auth-atomic-02-api-after.json`, diff de cero bytes en
  `/tmp/auth-atomic-02-api-diff.log`.
- Code Review independiente del candidato staged contra 01: **Standards 0 /
  Spec 0 hallazgos**. Spec local suministrado; docs/agents/issue-tracker.md
  ausente, sin necesidad de tracker remoto.
- Grafo existente de atoms/molecules y soporte: sin dependencia transitiva de
  workflow/transporte/owners superiores ni ciclos; incluido en focused y suite.

## Límites y secuencia

Vitest/happy-dom acredita atributos e interacción simulada; no certifica SSR
real, navegación de navegador ni lector de pantalla. No Chromium, Playwright,
E2E ni nuevas suites de DB. Se conservan fixtures históricos HTTP/SQLite de la
suite. No push, publicación ni despliegue.

03 queda desbloqueada por 01+02 y es siguiente en orden; 04 ya estaba
desbloqueada por 01. 05 sigue bloqueada por 03+04. El padre coordina los chats
separados; este chat no inicia ninguna siguiente implementación.
