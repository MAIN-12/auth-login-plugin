# 03 — Registro, recuperación y establecimiento de contraseña

**What to build:** El usuario completa registro, recuperación y establecimiento de contraseña con los flujos vigentes sobre Atomic Design. Las continuaciones de ownership, cambio voluntario y reautenticación se conservan, y login y registro reutilizan la acción Google sin ampliar los métodos permitidos.

**Blocked by:** 01 — Base compatible y login con contraseña; 02 — Acceso y verificación OTP.

**Status:** completed

- [x] SignupForm, ForgotPasswordForm y SetPasswordForm, con sus páginas y composiciones de tarjeta y layout, usan los módulos definitivos bajo Tailwind y HeroUI; no se mantienen páginas paralelas por estilo.
- [x] El registro conserva validaciones, prueba de propiedad, propósito OTP y continuación hacia establecimiento de contraseña conforme al flujo existente; reutiliza la verificación del ticket 02 sin duplicar su interacción.
- [x] La recuperación conserva solicitud de código, ownership, establecimiento de contraseña y retorno al login, sin añadir autenticación automática ni modificar endpoints o políticas.
- [x] Las continuaciones existentes de cambio voluntario de contraseña y reautenticación conservan su contexto, destinos y requisitos; las pruebas de continuación de contraseña existentes siguen acreditando esos comportamientos.
- [x] GoogleAuthButton combina Button y GoogleIcon y se reutiliza en login y signup; la visibilidad y la acción solo reflejan los métodos permitidos por la configuración actual.
- [x] Errores, ayuda, etiquetas, textos localizados, disabled/loading, callbacks y navegación conservan su comportamiento observable; las composiciones responsive no duplican formularios ni solicitudes.
- [x] Los organismos consumen los hooks de aplicación vigentes; páginas, templates y moléculas no incorporan políticas de servidor, acceso a almacenamiento ni permisos.
- [x] Las pruebas en el seam público de composición cubren registro, recuperación, establecimiento de contraseña y métodos habilitados/deshabilitados en ambos estilos, reutilizando dobles de transporte y navegación existentes.
- [x] Los checks aplicables de tipos, lint, build e imports permanecen verdes; se preservan API pública y defaults sin instalar nuevas librerías ni introducir nuevos seams.
- [x] Los puentes de compatibilidad que aún necesita la integración no migrada permanecen privados y sin lógica duplicada hasta el cierre del ticket 05.

## Evidencia de cierre

Implementado exclusivamente en `chore/audit`, sobre 01+02 completed.
Verificaciones, revisión independiente, compatibilidad y límites en
[auth-atomic-design-03.md](../../../docs/architecture/auth-atomic-design-03.md).
Suite final: 59 archivos / 412 tests. Typecheck, lint, build/consumo externo,
Prettier y diff estático de API pasan; Standards 0 / Spec 0 hallazgos.
Commit individual sin push; 04 queda pendiente y 05 sigue bloqueada por 04.
