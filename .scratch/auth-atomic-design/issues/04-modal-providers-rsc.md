# 04 — Integración de modal, providers y wrappers RSC

**What to build:** El consumidor integra la composición nueva mediante AuthProvider, su modal, AuthPages y los wrappers client/RSC sin cambiar configuración ni exponer secretos. Puede completarse mientras otros flujos siguen usando forwards temporales y conserva personalización y accesibilidad observables.

**Blocked by:** 01 — Base compatible y login con contraseña.

**Status:** completed

- [x] AuthProvider y AuthModal consumen la base Atomic Design manteniendo apertura, finalización, cierre, foco y navegación por teclado; el adapter nativo y AuthModalHero permanecen implementaciones privadas del mismo organismo.
- [x] AuthPages conserva las cinco pantallas y sus slugs; AuthCard mantiene tanto composición mediante slug como contenido personalizado, con una sola instancia viva del formulario.
- [x] La integración puede aterrizar sin esperar los tickets 02 y 03: usa los forwards privados del ticket 01 para los flujos pendientes, sin agregar bloqueos ni duplicar implementaciones.
- [x] Branding, logo, PoweredBy y atribución conservan comportamiento; los overrides explícitos prevalecen sobre contexto/provider y defaults, undefined hereda y null o false conservan su significado.
- [x] Las traducciones y diccionarios parciales mantienen fallback por locale, sección y clave; no se activa detección ambiental de locale automáticamente.
- [x] HeroUI continúa siendo opcional y lazy; Tailwind no exige instalar o cargar HeroUI, y el fallback no espera la librería que sustituye. La tarjeta aparece completa tras una única coordinación de carga.
- [x] Movimiento reducido y textura mantienen la experiencia actual; estado de carga, controles disabled y alertas conservan atributos y efectos accesibles observables.
- [x] Los wrappers client/RSC e inicializadores conservan la configuración pública explícita y la serialización permitida, aislando secretos; providers y soporte transversal permanecen fuera de los niveles visuales.
- [x] Los entrypoints, tipos, reexports, props, callbacks y defaults públicos conservan compatibilidad; no se añaden deep imports soportados ni exports de primitivas.
- [x] Reutilizar suites de presentación, provider, carga y composición para acreditar precedencias, branding, i18n, modal, instancia única y carga diferida; los checks estáticos verifican los contratos RSC sin afirmar ejecución real de SSR.
- [x] Los checks aplicables se mantienen verdes sin nuevos runners, dependencias, navegador real ni DB; la evidencia happy-dom de foco y atributos no se presenta como certificación de lector de pantalla o accesibilidad manual.

## Evidencia de cierre

Implementación y validación: `docs/architecture/auth-atomic-design-04.md`.
Base `0fd64f2410729160bb1a52c3b61d8230fb5f7ee5`, rama `chore/audit`.
60 archivos / 425 tests; typecheck, lint, build/test:consumer, Prettier y hooks
verdes; API estática sin diferencias; revisión Standards 0 / Spec 0.
Modal/adapters y dispatcher definitivos, providers y wrappers fuera de niveles
visuales, forwards privados preservados hasta 05. Los contratos RSC se acreditan
estáticamente y con dobles: no SSR real ni certificación de accesibilidad manual.
Sin navegador real, DB nueva, dependencias, publicación o tareas ajenas.

02+03+04 completed desbloquean `05-cierre-migracion-atomic.md`; el padre coordina
su siguiente chat. 05 no implementado ni modificado en esta tarea.
