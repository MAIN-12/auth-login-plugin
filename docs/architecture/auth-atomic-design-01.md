# Atomic Design 01 — base compatible y login

## Inventario previo y contratos

Base: `379fc9520a9a2eebad3b27b5e0cdf0b557bc8000`, rama `chore/audit`.
Autoridad: `.scratch/auth-atomic-design/spec.md` y ticket 01. Este documento
se inició antes de mover código. No amplía auth-clean ni auth-hardening.

Los entrypoints root/client/rsc/proxy mantienen exports explícitos. Client conserva
las cinco páginas y sus props, AuthPages, AuthCard con slug o children, AuthLayout,
PoweredBy, cinco formularios, AUTH_FORMS/getFormBySlug, AuthProvider/useAuth, hooks,
servicios y tipos. RSC conserva wrappers con publicConfig explícita, formularios,
registry, layout y email. Root y proxy no cambian. No se publican primitivas ni
se prometen deep imports. Defaults, callbacks, slugs, traducciones y precedencia
explícito/provider/defaults se conservan; undefined hereda y null/false desactivan.

| Nivel final | Responsabilidad y lote |
| --- | --- |
| atoms | Button, control Input sin label/error/help, Spinner, Divider, GoogleIcon, Card/partes, AuthPageTexture: 01. Adapters Tailwind/Hero privados junto al nivel. |
| molecules | FormField (ID, label, help, error), PasswordField, AuthErrorNotice, PoweredBy: 01. OtpInput: 02. GoogleAuthButton compartido: 03. |
| organisms | LoginForm, AuthCard y colaboradores privados de carga/reveal/shell/renderer/configs: 01. VerifyOtpForm: 02. Signup/ForgotPassword/SetPasswordForm: 03. AuthModal/adapters: 04. |
| templates | AuthLayout con fondo, textura y slot de contenido: 01, sin autenticación. |
| pages | LoginPage composición única: 01. VerifyOtpPage: 02. Signup/ForgotPassword/SetPasswordPage: 03. AuthPages dispatcher/integración: 04. |
| soporte transversal | auth-presentation, ui/theme/locale/translations, providers/config/signup/flow, inicializadores y wrappers client/server. Email permanece separado. |

Antes de 01, ui/index selecciona adapters lazy y depende de auth-card loading;
ui/tailwind y ui/hero reúnen control y campo. OtpInput posicional reside en Tailwind
y Hero lo reutiliza. LoginPageHero y LoginPageTailwind son idénticos. Los otros
cuatro pares y sus formularios permanecen para sus tickets.

## Reglas de dependencia y expansión

Los niveles superiores pueden componer inferiores directamente. Átomos no importan
moléculas, organismos, páginas, hooks de flujo, HTTP ni políticas de métodos;
moléculas no deciden permisos, métodos ni destinos. Organismos consumen los hooks
existentes. El contexto visual compartido de carga permite a controles diferir
al Suspense único de la tarjeta sin importar su organismo. La coordinación,
reveal y configuración de formularios siguen siendo privados de AuthCard; el
indicador fallback es visual y no depende de HeroUI. Soporte de presentación
no importa organismos ni aplicación.

Los paths anteriores migrados quedan como forwards privados a una implementación.
El Input anterior delega a FormField: conserva props sin llamar átomo al campo
compuesto. OTP permanece en su ubicación hasta 02; no se implementan sus requisitos
en este lote. No se mueve policy, transporte, DB ni wrappers/modal de 04.

## Seams y límites

Seam aprobado: AuthCard y AuthPages públicos; LoginPage se observa como composición
pública equivalente. Tests de texto, controles, asociaciones accesibles, navegación,
callbacks y transporte con Vitest/happy-dom; estructura/imports se verifican aparte.
No Chromium, Playwright, E2E ni nuevos harnesses DB. La suite heredada incluye fixtures
HTTP/SQLite en proceso. Build/consumo estático no certifican SSR real, ni happy-dom
certifica lector de pantalla, navegación real o accesibilidad manual.

## Evidencia

- Caracterización previa en el seam público: 4 tests nuevos sobre AuthPages/AuthCard
  con controles reales en Tailwind y HeroUI, callback/destino, rutas base,
  asociación label/control, error/reintento y exclusión de submits concurrentes.
  `/tmp/auth-atomic-01-characterization.log`.
- Red → green de FormField con ayuda/error asociados, dentro de la composición
  pública custom AuthCard: falta del módulo en red, 6 tests UI en green.
  `/tmp/auth-atomic-01-red.log` y `/tmp/auth-atomic-01-focused.log`.
- Red → green estructural: detectó transporte y ciclo transitivos vía el antiguo
  módulo AuthConfigContext. AuthConfigValue separa el valor data-only del provider,
  sin cambiar su instancia/contrato. Dos checks de grafo pasan: átomos/moléculas
  no alcanzan workflows/transporte/owners superiores y presentación no tiene
  ciclos. `/tmp/auth-atomic-01-structure-{red,green}.log`.
- Se conserva OTP en ui/tailwind hasta 02. Los paths antiguos de componentes,
  ui y auth-card son forwards a sus owners nuevos; los pequeños adapters legacy
  de campo solo asignan ID y delegan. Las otras cuatro páginas/formularios,
  AuthPages, wrappers y modal/provider mantienen su implementación para 02–04.
- El mock de carga ahora intercepta el adapter real de átomos y espera también
  el campo Hero lazy. Una prueba de modal con 100 ms fijos falló en la primera
  suite completa; ahora espera el input visible con vi.waitFor, preservando
  todas sus assertions. `/tmp/auth-atomic-01-provider-final.log`.
- Suite final: **57 archivos / 381 tests**, 8.92 s, incluyendo fixtures históricos
  HTTP/SQLite en proceso. `/tmp/auth-atomic-01-unit-final.log`.
- `pnpm typecheck` (incluye scripts), `pnpm lint`, Prettier del slice y whitespace
  checks pasan. `/tmp/auth-atomic-01-{typecheck-final,lint-final,format}.log`.
- `pnpm test:consumer` pasa: ejecuta build limpio, empaquetado temporal,
  instalación externa sin scripts, resolución de root/client/rsc/proxy,
  root/migration ESM nativo y declaraciones públicas. Node v22.23.2,
  SHA256 tarball `0bbabcb6f08f647b33e18d236e9d66768bf02a758d1cdb4f91cb66089b4b6133`.
  `/tmp/auth-atomic-01-consumer.log`. No publica el paquete.
- Comparación estática con TypeScript checker de exports, propiedades, tipos y
  call signatures contra la base: diff vacío. Se normalizan IDs internos de
  símbolos y orden de unions literales; no es ejecución de SSR.
  `/tmp/auth-atomic-01-api-{before,after}.json`, diff de 0 bytes en
  `/tmp/auth-atomic-01-api-diff.log`.
- Revisión independiente del candidato por Code Review de Matt Pocock:
  **Standards 0 / Spec 0 hallazgos**. No cambia API, policy ni defaults y no
  incorpora requisitos 02–05. Fuente de spec/ticket local proporcionada;
  falta docs/agents/issue-tracker.md, sin necesidad de consultar tracker remoto.

Ticket 01 completed con esta evidencia, en su commit individual. No se ejecutaron
Chromium/Playwright/E2E, SSR real, lector de pantalla ni harnesses DB nuevos;
no push, despliegue ni publicación. Los fixtures heredados de la suite no se
presentan como nueva aceptación operacional.

Siguiente por orden: 02, desbloqueada por 01. 04 también queda desbloqueada por 01,
pero el siguiente chat debe elegir 02. 03 espera 01+02; 05 espera 02+03+04.
Los tickets restantes permanecen ready-for-agent y no se implementaron aquí.
