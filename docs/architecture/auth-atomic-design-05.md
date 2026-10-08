# Atomic Design 05 — retirada interna y cierre

Base: `13c86b209bf73a84d4a790dbd6a43e185dfd70ee`, rama `chore/audit`.
Autoridad: `.scratch/auth-atomic-design/issues/05-cierre-migracion-atomic.md`
y spec local. 01–04 completed y ancestros verificados. Estado tracked inicial
limpio; los untracked ajenos se conservan. Sin AGENTS.md aplicable al slice
(`dev/AGENTS.md` solo aplica a dev). Se aplican Implement, TDD y Code Review de
Matt Pocock sobre los seams aprobados. Sin memorias globales.

## Árbol final y reglas

| Nivel | Responsabilidad y módulos |
| --- | --- |
| atoms | Control Input sin etiqueta/error, Button, Spinner, Divider, GoogleIcon, Card y partes; AuthPageTexture y AuthLoadingIndicator puramente visuales. |
| molecules | FormField (etiqueta, control, ayuda/error), PasswordField, OtpInput posicional compartido, GoogleAuthButton, AuthErrorNotice, PoweredBy; fieldProps es soporte privado. |
| organisms | Cinco formularios, AuthCard, AuthModal; forms conserva AUTH_FORMS/getFormBySlug y sus tipos. |
| templates | AuthLayout distribuye fondo, textura y contenido; no ejecuta autenticación. |
| pages | Una composición por LoginPage, SignupPage, ForgotPasswordPage, VerifyOtpPage y SetPasswordPage; AuthPages despacha slugs. |

Cada nivel puede componer inferiores directamente; no necesita atravesarlos todos.
Atoms/molecules no alcanzan hooks de workflow, transporte ni propietarios visuales
superiores. Organisms no importan templates/pages; templates no importan pages.
AuthCard conserva privados shell, renderer, configs y coordinación loading/reveal.
AuthModal conserva privados tipos y adapters NativeAuthModal/AuthModalHero.
Los adapters Tailwind/Hero junto a atoms/molecules conservan diferencias reales;
HeroUI sigue opcional y lazy. El indicador visual no posee Suspense/workflow.

`auth-presentation` y `ui/{locale,theme,translations}` son soporte transversal,
fuera de la taxonomía. Providers, inicializadores, wrappers RSC, configuración,
dominio, aplicación, servidor y email conservan sus responsabilidades auth-clean.
No se cambia transporte, seguridad, sesiones ni política; no se añaden deps.

## Contracción y compatibilidad

Se inspeccionaron los imports/reexports antes de eliminar puentes: los callers de
producción pendientes eran el registro forms y sus tipos; los tests aún usaban
forwards visuales y adapters ui. Se movió el registro íntegro a organisms/forms,
se conectaron callers/exports y se adaptaron tests antes del gate final.
Se retiran los siete forwards visuales raíz, auth-card, forms, ui/index/hero/tailwind,
los diez forwards de páginas por estilo y los dos LegacyField sin callers finales.
Las cinco composiciones únicas ya migradas no se reescriben. Se conserva ui de
soporte y los adapters con implementación real; no quedan dos fuentes visuales.

Los entrypoints root/client/rsc/proxy conservan exports, props y tipos; no se
publican primitivas ni un design system. El registro, los slugs, fallback de
getFormBySlug, defaults y callbacks son los mismos. Se preservan ambos estilos,
configuración pública explícita/serializable, branding, atribución, i18n parcial,
precedencias (undefined hereda, null/false explícitos), formulario único,
loading, textura/movimiento reducido y manejo de foco/modal.

**Riesgo de imports:** consumidores que usaban paths internos retirados deben
migrar a los entrypoints públicos. Esos deep imports no son API soportada; no
se auditó código de consumidores externos. La comparación estática del checker
acredita API exportada, no identidad de paths internos ni ejecución RSC real.

## Evidencia y límites

- Red estructural: la expectativa del árbol final falla con los forwards presentes.
  `/tmp/auth-atomic-05-red.log`. El check de ciclos ampliado también reveló el ciclo
  preexistente AuthConfigContext → AuthServiceContext → AuthConfigContext. No se
  modifica infraestructura auth-clean: el check visual se delimita explícitamente
  a los cinco niveles y soporte auth-presentation/ui, incluyendo dependencias tipo.
  No se afirma ausencia de ciclos en todo el repositorio.
- Green tras retirada y adaptación: 8 archivos / 78 tests afectados (presentación,
  carga, textura, tema, correcciones, OTP/integración, continuación password y
  estructura). `/tmp/auth-atomic-05-green.log`. No cambian sus expectativas de
  comportamiento; campos del adapter Hero reciben IDs explícitos en los tests.
- Estructura final: 5 checks de primitivas sin política/transporte/superiores,
  ciclos visuales/soporte, integración directa, inventario sin legacy y dirección
  de composición. `/tmp/auth-atomic-05-structure.log`. Son checks estructurales,
  no evidencia funcional. Lint conserva además las fronteras auth-clean existentes.
- API normalizada por TypeScript checker vs 04: diff de cero bytes.
  `/tmp/auth-atomic-05-api-after.json`, `/tmp/auth-atomic-05-api-diff.log`.

La matriz funcional se verifica en las suites existentes: atomic-login-ui,
atomic-otp-ui y atomic-password-ui cubren las cinco pantallas/ambos estilos,
métodos, errores, navegación, callbacks y controles; auth-presentation cubre
precedencias/branding/i18n/instancia única; auth-provider cubre integración modal;
auth-card-loading y auth-texture cubren lazy/reveal/movimiento reducido;
password-continuation e integration-ui conservan lifecycle y OTP posicional.

Happy-dom acredita interacción simulada, atributos y foco observables. No acredita
navegación real, lector de pantalla ni accesibilidad manual. Typecheck, dobles RSC,
build y consumidor estático no acreditan SSR real ni integración Next ejecutada.
Sin Chromium, Playwright, E2E, DB, publicación, push, despliegue, auth-hardening
ni cambios en enntra-v3. Esas validaciones reales siguen fuera de este alcance.

## Gates de cierre

- `pnpm test:unit`: **60 archivos / 427 tests**, 10.37 s, primera ejecución
  completa verde. `/tmp/auth-atomic-05-unit.log`.
- `pnpm typecheck` (incluye `typecheck:scripts`) y `pnpm lint`: pasan.
  `/tmp/auth-atomic-05-typecheck.log`, `/tmp/auth-atomic-05-lint.log`.
- `pnpm test:consumer`: pasa y ejecuta `pnpm build` limpio como parte del gate;
  SWC compila 153 archivos. Instalación temporal externa sin scripts, resolución
  root/client/rsc/proxy, ESM nativo y declaraciones públicas.
  Node v22.23.2; SHA256 tarball
  `fd899ea287ad6cf74e8ff8111de829d391aecbb0eda767564f91ccef6a0c42c3`.
  `/tmp/auth-atomic-05-consumer.log`. Primer intento bloqueado por el socket IPC
  local de tsx; reejecución con escalación autorizada pasa. Git requiere también
  escalación autorizada para escribir índice/commit.
- `pnpm exec prettier --check` sobre los archivos nuevos/modificados del candidato
  y `git diff --cached --check`: pasan. `/tmp/auth-atomic-05-prettier.log`.
- Advertencia existente: `pnpm.overrides` en tests/consumer/package.json no tiene
  efecto fuera de la raíz; no se cambia configuración de dependencias.

Los logs `/tmp` son evidencia de esta ejecución, no artefactos versionados;
este informe conserva comandos, resultados y límites de manera persistente.

## Revisión y estado final

Code Review paralelo del candidato staged contra 04: **Standards 0 / Spec 0**,
dos revisores independientes, solo lectura; no ejecutaron gates por su cuenta.
No cambios posteriores en código. La ausencia de docs/agents/issue-tracker.md
no bloquea: el usuario entregó ticket y spec locales como autoridad explícita.

01–05 completed, secuenciales y un commit por tarea en chore/audit:
01 `b1afe8858cefeb514d6b392e5beda54fe2e2080b`,
02 `a3b406a30f6c507054f73f5be8294a785f637339`,
03 `0fd64f2410729160bb1a52c3b61d8230fb5f7ee5`,
04 `13c86b209bf73a84d4a790dbd6a43e185dfd70ee`.
El hash individual de 05 y resultado de hooks/Git se entregan en el chat;
no se incluye un hash autorreferencial en este commit. Migración Atomic Design
cerrada en el alcance aprobado, conservando los límites de validación anteriores.
