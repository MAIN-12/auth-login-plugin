# OTP inicial para acceso Google con correo externo

**Estado:** Diferido por decisión del usuario · **Fecha:** 2026-10-09

Dejar este caso reportado para desarrollarlo posteriormente. No implementar ahora
el desafío OTP ni modificar la política de acceso existente por este aplazamiento.

## Caso pendiente

Una cuenta local creada o utilizada con contraseña u OTP intenta acceder por
primera vez con una cuenta Google registrada con un correo externo, por ejemplo
`persona@outlook.com`. Todavía no existe una asociación con su identificador Google
(`sub`).

Google advierte que, para correos externos a Gmail sin evidencia de Workspace
(`hd`), `email_verified` no garantiza la propiedad actual del buzón. Por ello,
coincidir por correo no basta para asociar automáticamente ambas cuentas.
[Referencia oficial](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Flujo propuesto para retomar

1. Google autentica al usuario y lo devuelve al callback de nuestra aplicación.
2. El backend valida la identidad y detecta que falta evidencia de propiedad actual
   del correo externo. No asocia la cuenta ni crea la sesión local todavía.
3. Nuestra aplicación envía un OTP al correo y muestra su pantalla de verificación.
4. Al confirmar el OTP, asocia Google con la misma cuenta local e inicia la sesión.
5. Los accesos posteriores utilizan la asociación por `sub`, sin configurar nada
   manualmente ni repetir este OTP inicial.

## Criterios para el desarrollo futuro

- Conservar la cuenta, credenciales y permisos existentes; no crear duplicados.
- Impedir asociación y sesión ante OTP inválido, expirado o reutilizado, o conflicto
  de identidad Google; conservar los controles nativos de autenticación.
- Validar el flujo en el callback HTTP y la sesión nativa, no confiar en el frontend.

Este seguimiento cubre únicamente la comprobación inicial de correos externos.
No aprueba implementar el flujo, habilitar autolink indiscriminado ni cambiar el
comportamiento actual de otros casos de login Google.
