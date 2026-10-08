# Atomic Design 04 — integración modal, providers y RSC

Base: `0fd64f2410729160bb1a52c3b61d8230fb5f7ee5`, rama `chore/audit`.
Autoridad: `.scratch/auth-atomic-design/issues/04-modal-providers-rsc.md`
y spec local. 01–03 son ancestros completados; 04 depende solo de 01.
Estado tracked inicial limpio; untracked ajenos preservados. No hay AGENTS.md
aplicable en repo, ancestros o directorios del slice; `dev/AGENTS.md` no aplica.
Se aplican Implement, TDD y Code Review de Matt Pocock. Los seams públicos
AuthProvider/AuthCard/AuthPages y los checks estructurales están aprobados en el
spec. No se modifican memorias globales.

## Implementación y compatibilidad

- AuthModal vive en organisms con adapters privados NativeAuthModal y
  AuthModalHero, y tipos compartidos privados. La selección HeroUI conserva lazy
  y Suspense; el adapter nativo no importa HeroUI. Se trasladan intactos cancel,
  foco, wrap de Tab/Shift+Tab, cierre, scroll y portal bajo el tema del consumidor.
- AuthPages vive en pages: una composición AuthLayout + AuthCard, con los cinco
  slugs y fallback a login conservados. No agrega políticas ni implementaciones
  por estilo. AuthCard ya definitivo mantiene slug y contenido personalizado.
- AuthProvider, AuthCardServer y AuthPagesServer consumen directamente los módulos
  definitivos. Los entrypoints client/RSC apuntan también a AuthCard, AuthPages,
  AuthLayout y PoweredBy definitivos, con los mismos símbolos y tipos públicos.
- Los tres paths anteriores de modal/dispatcher son forwards privados temporales;
  se dejan para el cierre 05. El registro AUTH_FORMS ya usa los organismos de
  01–03. Esta integración no exige nuevos bloqueos ni modifica aquellos flujos.
- Providers, configuración, inicializadores, presentación y wrappers RSC siguen
  fuera de la taxonomía visual. No cambia configuración, transporte, servidor,
  secretos, dominio, aplicación, métodos, sesión ni políticas auth-clean.
- Se preservan precedencia, null/false/undefined, mensajes parciales, locale
  explícito, branding/atribución, textura/movimiento reducido, estados de carga,
  disabled y alertas. No hay nuevas primitivas públicas ni deep imports soportados.

## Evidencia

- Caracterización anterior al traslado: **3 archivos / 44 tests**, provider,
  presentación y carga. `/tmp/auth-atomic-04-characterization.log`.
- Red → green estructural: el consumidor todavía dependía del path antiguo de
  AuthModal antes del cambio. `/tmp/auth-atomic-04-red.log`. Tras mover los
  propietarios y conectar integración: **4 archivos / 47 tests**.
  `/tmp/auth-atomic-04-green.log`. Este check acredita estructura, no comportamiento.
- Caracterización ampliada por entrypoint client: cancelación, Tab/Shift+Tab,
  restauración de foco/scroll, abrir repetidamente con destino nuevo y formulario
  limpio, navegación interna signup/recuperación y reinicio al cerrar. Se conserva
  el test de petición antigua que no cierra un modal nuevo. Provider: **20 tests**.
  `/tmp/auth-atomic-04-provider-final.log`.
- Presentación: cinco pantallas y slug desconocido bajo ambos estilos; una sola
  instancia viva de contenido personalizado en las tres variantes; logo null,
  herencia undefined, atribución false y diccionario parcial en modal; initializer
  whitelist y configuración congelada sin campos privados extra del caller.
  Tailwind abre formulario completo sin cargar el adapter HeroUI retenido; se
  conserva el test del único loader hasta la tarjeta HeroUI completa.
- Checks TypeScript del contrato exportado: publicConfig obligatorio en wrappers
  RSC y provider client; whitelist de campos escalares serializables. El initializer
  sigue siendo el provider explícito. Dobles server/client existentes acreditan
  herencia y precedencia, sin afirmar ejecución de SSR.
- `pnpm test:unit`: **60 archivos / 425 tests**, 10.49 s, primera ejecución full
  verde. `/tmp/auth-atomic-04-unit-final.log`.
- `pnpm typecheck` (incluye scripts) y `pnpm lint`: pasan.
  `/tmp/auth-atomic-04-typecheck-final.log`, `/tmp/auth-atomic-04-lint-final.log`.
- Prettier del candidato staged y `git diff --cached --check`: pasan.
  `/tmp/auth-atomic-04-prettier-final.log`.
- `pnpm test:consumer`: pasa, build limpio, instalación temporal externa sin
  scripts, resolución root/client/rsc/proxy, ESM nativo y declaraciones públicas.
  Node v22.23.2; SHA256 del tarball
  `14148c93a793399a6aec619c0f1785c05995f60b4a3e8893be5237c640b057e7`.
  `/tmp/auth-atomic-04-consumer.log`. El sandbox requirió acceso al socket IPC local
  de tsx y al índice Git; las escalaciones fueron autorizadas.
- API normalizada por TypeScript checker contra 03: sin diferencias en exports,
  propiedades, tipos ni call signatures; diff de cero bytes.
  `/tmp/auth-atomic-04-api-{before,after}.json`, `/tmp/auth-atomic-04-api-diff.log`.
- Code Review: dos subagentes independientes, candidato staged contra 03:
  **Standards 0 / Spec 0**. Revisaron también archivos nuevos y tests; sin cambios
  posteriores en código. El ticket/spec local suministrado es la autoridad;
  `docs/agents/issue-tracker.md` no existe y no se requiere tracker remoto.

## Límites y secuencia

Vitest/happy-dom verifica interacción simulada, foco y atributos observables;
no certifica lector de pantalla, accesibilidad manual ni navegación real. Los
checks TypeScript, dobles RSC y build no acreditan SSR real o integración Next.
Sin Chromium, Playwright, E2E, nuevas suites de DB, dependencias, push, publicación,
despliegue ni auth-hardening. No se tocan otros repos ni archivos de enntra-v3.

04 completed tras comprobar todos los criterios y gates, con commit individual
en `chore/audit`. 05 conserva su ticket y código intactos: sus dependencias
02+03+04 quedan satisfechas. La retirada de forwards y el cierre corresponden al
padre en el siguiente chat.
