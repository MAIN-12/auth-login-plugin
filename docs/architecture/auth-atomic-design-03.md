# Atomic Design 03 — registro y lifecycle de contraseña

Base: `a3b406a30f6c507054f73f5be8294a785f637339`, rama `chore/audit`.
Autoridad: `.scratch/auth-atomic-design/issues/03-registro-recuperacion-password.md`
y spec local. 01 (`b1afe8858cefeb514d6b392e5beda54fe2e2080b`) y 02 son ancestros
y sus tickets están completed. Estado tracked inicial limpio; untracked ajenos preservados.
No hay AGENTS.md aplicable en repo/ancestros ni en los directorios del slice;
`dev/AGENTS.md` no aplica. Se aplicaron Implement, TDD y Code Review de Matt Pocock.
Los seams públicos AuthCard/AuthPages y los límites de pruebas ya están aprobados
en el spec. No se modificaron memorias globales del usuario.

## Implementación y contratos

- SignupForm, ForgotPasswordForm y SetPasswordForm viven en organisms. Consumen
  Button, FormField/PasswordField y AuthErrorNotice definitivos. AUTH_FORMS apunta
  directamente a ellos; los paths anteriores son forwards privados.
- SignupPage, ForgotPasswordPage y SetPasswordPage tienen una sola composición
  con AuthLayout y AuthCard definitivos. Los seis paths Hero/Tailwind son forwards,
  sin formularios duplicados ni implementaciones alternativas.
- GoogleAuthButton compone Button/GoogleIcon y se reutiliza en login y signup.
  El caller conserva método habilitado, override de visibilidad, variante y acción.
  El icono es decorativo (`aria-hidden`); el texto localizado identifica la acción.
- Signup conserva su coordinación React en useSignupFlow, extraída sin alterar
  solicitud ownership, propósito, contexto, retryAfter, errores ni destino.
  Los callbacks de compatibilidad onSignup/verifyOtpUrl conservan su comportamiento
  vigente (no sustituyen ownership). No se añaden endpoints o políticas.
- Recuperación y signup reutilizan VerifyOtpForm de 02. OTP concede la continuación
  limitada; completar contraseña vuelve al login con el destino, sin auto-login.
- SetPassword conserva useSetPasswordFlow y su prueba limitada, validación, strength,
  ayuda, reautenticación por contraseña/OTP y destino de cambio voluntario.
  PasswordField comparte la composición de visibilidad controlada que ya existía;
  login sigue enmascarado y sin acción de visibilidad adicional.
- Dominio, aplicación, transporte, servidor, configuración, sesiones y permisos
  mantienen sus propietarios auth-clean. HeroUI sigue lazy/opcional. No cambia
  API pública, dependencia, default, registro de slugs ni getFormBySlug.

## Verificación

- TDD red → green de Google en signup Tailwind/HeroUI: el SVG carecía del atributo
  decorativo; fallaron ambos casos antes de la composición compartida.
  `/tmp/auth-atomic-03-red.log` y `/tmp/auth-atomic-03-google-green.log`.
- Caracterización previa al traslado: 2 archivos / 19 tests en signup, recuperación,
  continuación y errores. `/tmp/auth-atomic-03-characterization.log`.
- 16 tests nuevos en `tests/atomic-password-ui.test.tsx`, seam público y controles
  reales Tailwind/HeroUI, con dobles de transporte/navegación existentes:
  flujos completos ownership → OTP → password → login; errores y etiquetas;
  validación y visibilidad; cambio voluntario; reauth contraseña/OTP; métodos
  habilitados/deshabilitados; una sola instancia y submit disabled/loading.
- `pnpm exec vitest run tests/atomic-password-ui.test.tsx tests/password-continuation.test.tsx tests/atomic-login-ui.test.tsx tests/atomic-otp-ui.test.tsx tests/atomic-design-structure.test.ts tests/auth-presentation.test.tsx tests/auth-card-loading.test.tsx`:
  **7 archivos / 73 tests**, 1.95 s. `/tmp/auth-atomic-03-focused.log`.
- `pnpm test:unit`: **59 archivos / 412 tests**, 8.54 s.
  `/tmp/auth-atomic-03-unit-final.log`. Primera full: 411 pass / 1 timeout en mount
  HeroUI de atomic-login; espera por formulario ampliada de 1000 a 5000 ms, igual
  que OTP, sin sleeps ni cambios de assertions. Enfocado 6/6 antes de repetir full.
  `/tmp/auth-atomic-03-unit-first.log`, `/tmp/auth-atomic-03-login-retry.log`.
- `pnpm typecheck` (incluye scripts) y `pnpm lint` pasan;
  `pnpm exec eslint tests/atomic-login-ui.test.tsx` pasa tras ajustar la espera.
  `/tmp/auth-atomic-03-{typecheck-final,lint-final}.log`.
- Prettier del candidato staged y `git diff --cached --check` pasan.
  `/tmp/auth-atomic-03-prettier-final.log`.
- `pnpm test:consumer` pasa: build limpio (181 archivos SWC), tarball temporal,
  instalación externa sin scripts, resolución root/client/rsc/proxy, ESM nativo
  root/migration y declaraciones. Node v22.23.2, SHA256
  `e34cdcccd91b32f76da297a173da365279613cfaa3f60ba16e876e446f6061e2`.
  `/tmp/auth-atomic-03-consumer.log`. El sandbox requirió acceso al socket local
  de tsx y permiso para preparar el commit; las escalaciones fueron autorizadas.
- Comparación estática normalizada por TypeScript checker contra la captura de 02:
  exports, propiedades, tipos y call signatures iguales; diff de cero bytes.
  `/tmp/auth-atomic-03-api-after.json`, `/tmp/auth-atomic-03-api-diff.log`.
- Code Review: dos subagentes independientes, candidato staged contra 02 antes
  de commit: **Standards 0 / Spec 0**. Revisión del ajuste posterior de timeout:
  **Standards 0 / Spec 0**. Tracker remoto no necesario: spec/ticket local suministrado;
  `docs/agents/issue-tracker.md` ausente.
- Checks estructurales existentes (focused y full): sin ciclos indebidos ni
  dependencia transitiva de atoms/molecules hacia workflow, transporte u owners
  superiores, incluyendo las moléculas nuevas.

## Límites y secuencia

Vitest/happy-dom acredita interacción simulada y atributos accesibles; no certifica
SSR real, navegador, lector de pantalla ni UX manual. No Chromium, Playwright, E2E
ni nuevas suites de DB. Se conservan fixtures históricos SQLite/HTTP de la suite.
No push, publicación, despliegue ni auth-hardening; 04/05 no implementados.

03 completed tras verificar criterios y gates, con commit individual en chore/audit.
04 (`04-modal-providers-rsc.md`) está desbloqueada por 01. 05
(`05-cierre-migracion-atomic.md`) cumple 02+03 y sigue bloqueada por 04.
El padre coordina el siguiente chat; este trabajo termina en 03.
