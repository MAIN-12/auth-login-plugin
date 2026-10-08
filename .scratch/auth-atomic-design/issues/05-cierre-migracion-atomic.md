# 05 — Retirada de compatibilidad interna y cierre

**What to build:** El mantenedor encuentra toda la interfaz clasificada en cinco niveles, sin estructura legacy paralela, y el consumidor conserva su integración pública. El cierre entrega documentación y evidencia funcional, estructural y estática del alcance aprobado, no una certificación E2E.

**Blocked by:** 02 — Acceso y verificación OTP; 03 — Registro, recuperación y establecimiento de contraseña; 04 — Integración de modal, providers y wrappers RSC.

**Status:** completed

- [x] Todos los módulos visuales quedan clasificados en atoms, molecules, organisms, templates y pages según sus responsabilidades; los colaboradores privados permanecen con su propietario y los adapters visuales junto al nivel que implementan.
- [x] LoginPage, SignupPage, ForgotPasswordPage, VerifyOtpPage y SetPasswordPage tienen una única composición cada una; se eliminan los cinco pares Hero/Tailwind duplicados sin retirar los adapters con diferencias reales.
- [x] Antes de contraer, comprobar que ningún caller interno requiere forwards; retirar puentes y referencias obsoletas, actualizando imports y mocks sin dejar implementaciones legacy paralelas.
- [x] Las verificaciones estructurales acreditan dirección de dependencias, ausencia de ciclos indebidos y de políticas de autenticación en primitivas; no sustituyen las pruebas de comportamiento.
- [x] Dominio, aplicación, servidor, providers, configuración, locale, tema, inicializadores, wrappers y email mantienen sus responsabilidades; no se reclasifican artificialmente como UI ni se incorporan tareas de auth-clean.
- [x] La documentación describe clasificación, composición directa entre niveles, responsabilidades de adapters, soporte transversal y contratos que se preservan, sin publicar un design system ni nuevos deep imports soportados.
- [x] La matriz funcional de las cinco pantallas y la integración pública conserva ambos estilos, métodos configurados, errores, navegación, callbacks, branding, i18n, precedencias, instancia única, carga y comportamientos accesibles definidos.
- [x] Las suites Vitest y happy-dom pertinentes, incluidas OTP, presentación, provider, carga, movimiento reducido y continuación de contraseña, pasan con expectations observables y mocks adaptados al árbol final.
- [x] Typecheck, lint, build y checks existentes de imports/exports y consumo público pasan; exports, tipos, props, defaults, AUTH_FORMS y getFormBySlug mantienen compatibilidad.
- [x] El informe de cierre distingue evidencia unitaria y estática de ejecución real: happy-dom no certifica lector de pantalla ni navegación real, y build/dobles RSC no acreditan SSR o integración real de Next.
- [x] No se incorporan Chromium, Playwright, E2E, DB, nuevas dependencias, cambios de seguridad o API, publicación npm ni tareas de propuestas ajenas para dar por cumplida esta migración.


## Evidencia de cierre

Implementado únicamente en `chore/audit`, sobre 04
`13c86b209bf73a84d4a790dbd6a43e185dfd70ee`; dependencias 01–04 completed
verificadas como ancestros. Informe y clasificación final:
`docs/architecture/auth-atomic-design-05.md`.

Retirados forwards internos, legacy fields y diez páginas por estilo; registro
AUTH_FORMS/getFormBySlug íntegro en organisms/forms. Imports y tests adaptados,
API pública normalizada contra 04 sin diferencias. Red/green estructural y
5 checks finales, 8 suites afectadas / 78 tests; full **60 archivos / 427 tests**.
Typecheck (incluye scripts), lint, build dentro de test:consumer, consumo estático,
Prettier y diff check pasan. Code Review paralelo: Standards 0 / Spec 0.

Happy-dom no acredita navegación real, lector de pantalla ni accesibilidad manual;
build/dobles RSC no acreditan SSR o Next real. Ciclos comprobados solo en UI y
soporte presentación; ciclo preexistente de infraestructura no alterado. Los deep
imports internos retirados no son API soportada; no se auditaron consumidores
externos. Sin DB/E2E, nuevas dependencias, seguridad, auth-hardening, otros repos,
memorias globales, push, publicación ni despliegue. Untracked ajenos conservados.

Los cinco tickets quedan completed, cada uno con su commit individual secuencial.
El hash de 05 se entrega en el resultado del chat para evitar autorreferencia.
