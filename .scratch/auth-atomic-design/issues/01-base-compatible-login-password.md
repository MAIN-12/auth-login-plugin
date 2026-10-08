# 01 — Base compatible y login con contraseña

**What to build:** El usuario puede iniciar sesión con contraseña desde la composición pública de la página y la tarjeta, utilizando los cinco niveles de Atomic Design sin cambiar su integración. La expansión inicial deja puentes privados temporales hacia los módulos definitivos para que los flujos aún no migrados sigan funcionando.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] Inventariar los contratos públicos y documentar la clasificación semántica y las reglas de dependencias antes de migrar; la base contiene atoms, molecules, organisms, templates y pages con responsabilidades reales.
- [x] LoginPage, AuthLayout, AuthCard y LoginForm componen el recorrido de login con contraseña sobre la nueva base en Tailwind y HeroUI, conservando textos, validación, navegación, callbacks, rutas base y destino seguro existentes.
- [x] El control básico Input es un átomo separado de FormField; las etiquetas, ayuda y errores conservan sus asociaciones accesibles, IDs y descripciones. PasswordField conserva la interacción de contraseña existente.
- [x] Button, Spinner, Divider, GoogleIcon, Card y sus partes y AuthPageTexture se clasifican como átomos cuando corresponda; AuthErrorNotice y PoweredBy son moléculas reutilizables sin decisiones de autenticación.
- [x] La coordinación de carga y reveal, AuthCardShell, FormRenderer y configuraciones de formulario siguen siendo colaboradores privados de AuthCard; el soporte de presentación no introduce un ciclo con la coordinación de la tarjeta.
- [x] Los puentes temporales son forwards privados a una única implementación, no una segunda fuente de verdad; los flujos todavía no migrados y sus callers siguen resolviendo mientras avanza la migración.
- [x] Los átomos no conocen hooks de flujo, transporte ni políticas de autenticación; las moléculas no deciden métodos permitidos, destinos o permisos. No se añade un formulario genérico dirigido por múltiples flags.
- [x] El login mantiene disabled/loading, mensajes anunciables y una sola instancia viva del formulario en composiciones responsive; HeroUI continúa opcional y lazy, sin loaders independientes dentro de la tarjeta.
- [x] Las pruebas existentes en el seam público AuthCard y AuthPages acreditan el comportamiento de login en ambos estilos y la compatibilidad temporal de flujos no migrados; los checks estructurales se mantienen separados de las assertions funcionales.
- [x] Los checks aplicables de tipos, lint, build e imports públicos permanecen verdes sin cambiar exports, props, defaults, AUTH_FORMS, slugs ni getFormBySlug; no se crean nuevas exports de primitivas ni dependencias.

## Evidencia de cierre

Completada el 2026-10-08 en `chore/audit`, base
`379fc9520a9a2eebad3b27b5e0cdf0b557bc8000`, únicamente ticket 01.
Inventario previo, decisiones y límites en
[auth-atomic-design-01.md](../../../docs/architecture/auth-atomic-design-01.md).

- TDD/caracterización pública AuthCard/AuthPages, FormField help/error y red→green
  del grafo de presentación, con controles Tailwind y HeroUI reales.
- Suite final: 57 archivos / 381 tests; typecheck/scripts, lint, Prettier del slice
  y whitespace checks pasan.
- Build y test:consumer pasan (instalación temporal, subpaths, ESM root y tipos).
  Diff estático normalizado de API pública vacío contra base.
- Code Review: Standards 0 hallazgos; Spec 0 hallazgos.
- Sin navegador real/E2E/SSR, nueva aceptación DB, push, publicación ni despliegue.
  La suite conserva fixtures HTTP/SQLite históricos en proceso.
- OTP, registro/lifecycle, modal/providers/RSC y cierre quedan para 02–05.
  02 y 04 desbloqueadas; siguiente en orden 02.

El hash del commit individual se entrega en el resultado del chat; no se inserta
un hash autorreferencial en el archivo incluido en ese mismo commit.
