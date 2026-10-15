# Aplicar @main12/auth-login 3.1.1 en Enntra PR #149

**No es una actualización de parche transparente:** además de validación, componentes HeroUI y correos, el cambio desde el artefacto publicado `3.1.0` incluye almacenamiento administrado por Payload y la retirada de APIs de migración. Actualiza primero la integración y ensaya la preservación de datos; no ejecutes el script de corte anterior sin adaptarlo.

Estado al 2026-10-14: el código `3.1.1` está integrado en [auth-login-plugin PR #2](https://github.com/MAIN-12/auth-login-plugin/pull/2), pero npm todavía publica `3.1.0` como latest. Esta guía no constituye publicación ni aprobación de despliegue.

## Camino rápido

1. Resuelve los bloqueos de esquema y corte de seguridad de la sección siguiente en una base aislada.
2. Cuando `3.1.1` esté publicado, fija esa versión en `package.json` de Enntra y regenera `pnpm-lock.yaml` con su pnpm 10. No uses un enlace local como prueba del paquete publicado.
3. Alinea Tailwind, comprueba los estilos HeroUI y adapta los tests OTP y los correos personalizados.
4. Regenera tipos/import map, revisa la migración Payload y ejecuta las comprobaciones antes de desplegar.

### Base concreta de la revisión

La guía inspeccionó [Enntra PR #149](https://github.com/MAIN-12/enntra-v3/pull/149), rama `feat/auth-login-migration`, commit [`a3a65796a58f357a082603c1652f3049692fe3b8`](https://github.com/MAIN-12/enntra-v3/tree/a3a65796a58f357a082603c1652f3049692fe3b8). Si el PR cambia, vuelve a comprobar estos puntos; no son afirmaciones sobre su futuro HEAD.

| Archivo del consumidor                                                                                        | Acción necesaria                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`, `pnpm-lock.yaml`                                                                              | Pasar de `@main12/auth-login: 3.1.0` a `3.1.1` publicado; Tailwind `4.1.18` no cumple el peer `^4.3.3` del plugin actual. Alinear también `@tailwindcss/postcss`. |
| `src/migrations/20261011_000000_auth_login.ts`, `src/migrations/index.ts`                                     | Añadir una nueva migración de preservación para las cinco colecciones internas; no editar historia ya aplicada.                                                   |
| `scripts/migrate-auth-login.mts`, sus tests y fixtures                                                        | Eliminar la dependencia del export retirado `migrateAuthLogin` e implementar el corte en el consumidor.                                                           |
| `src/app/(frontend)/globals.css`, `src/styles/heroui-theme.css`                                               | Conservar el import completo HeroUI y los tokens del tema; verificar CSS compilado, no añadir rojos fijos.                                                        |
| `e2e/auth-pages.spec.ts`                                                                                      | Sustituir seis inputs OTP editables por un input nativo y seis casillas visuales.                                                                                 |
| `src/collections/Users/infrastructure/auth/emails.ts`, `src/utilities/email/templates/{otp,passwordReset}.ts` | Propagar `expiresAt`, corregir vencimiento/preheader y decidir si se entrega texto plano personalizado.                                                           |
| `docs/planing/auth-login-plugin-migration.md`                                                                 | Sustituir las afirmaciones sobre SQL creado en runtime/API de corte por los contratos actuales.                                                                   |

## 1. Bloqueos de esquema y corte: no omitir

El PR inspeccionado importa `migrateAuthLogin` y escribe en `auth_login_google_identities`; su guía describe tablas SQL creadas de forma perezosa. **Esos supuestos ya no son válidos en 3.1.1.** El export no existe; las rutas nunca crean tablas. La migración additive existente no provisiona las cinco colecciones del plugin.

Mantén el plugin habilitado mientras generas una **nueva migración Payload del esquema completo**. Revisa la conversión de tablas manuales antes de aplicarla: las tablas nuevas necesitan IDs/esquema Payload y expiración numérica en milisegundos. Las colecciones son `auth-login-otp-security`, `auth-login-credential-locks`, `auth-login-password-permits`, `auth-login-identities` y `auth-login-cutovers`.

Preserva cuentas, IDs, hash/salt, evidencia de verificación, cuotas y registros de consumo vigentes. Las asociaciones Google pasan a `auth_login_identities` con `provider = 'google'` y las nuevas restricciones únicas; comprueba conteos y asociaciones originales. Nunca reconstruyas identidades por coincidencia de correo ni aceptes un drop/create que descarte datos de seguridad.

El script del consumidor debe revocar sesiones/pruebas antiguas y establecer una generación nueva, criptográficamente aleatoria, de **64 caracteres hexadecimales minúsculos** por colección afectada en `auth-login-cutovers`, con todos los escritores detenidos. El plugin valida esa generación en runtime, pero no ofrece un runner de corte. Adapta también los tests/fixtures que invoquen la API retirada o creen el antiguo esquema manualmente.

No copies SQL genérico ni ejecutes el comando de corte del PR inspeccionado en producción. Sigue [migraciones de esquema](schema-migrations.md), [corte y restauración](migration.md) y [contratos actuales](plugin-contracts.md); ensaya contra la base PostgreSQL real en una copia aislada. No marques usuarios verificados por tener contraseña o un login anterior.

## 2. HeroUI: estilos, tema y OTP

Enntra ya importa `@heroui/react/styles` completo y escanea `@main12/auth-login/dist/**/*.js`. **No necesita añadir automáticamente imports selectivos:** comprueba primero que el CSS final contiene `FieldError`, `InputOTP` e `InputGroup`. La ausencia de estilos puede dejar las casillas sin dimensiones y el error con color/tamaño de texto ordinario; `@source` no carga esos estilos.

Solo si el consumidor cambia a imports selectivos, añade junto a los componentes existentes:

```css
@import '@heroui/styles/components/field-error.css';
@import '@heroui/styles/components/input-otp.css';
@import '@heroui/styles/components/input-group.css';
```

Mantén el scope/layer HeroUI del host. Los errores usan `FieldError`/`isInvalid` y el token `--danger`, no `#f00` ni una paleta Tailwind. La tipografía nativa observada con HeroUI 3.2.2 es 12 px; si el tema del host la cambia, valida esa decisión explícitamente. `EnntraAuthPages` fuerza `theme="light"`: conserva esa elección si es intencional; usa `inherit` solo si deseas seguir el tema del host.

OTP ahora tiene **un input numérico con caret/selección y seis casillas visuales**; contraseña compone `InputGroup` y botón HeroUI. Las props públicas OTP no cambian. Cambia el bloque que espera seis inputs en `e2e/auth-pages.spec.ts` por esta interacción:

```ts
const input = page.locator('input[inputmode="numeric"]')
await expect(input).toHaveCount(1)
const slots = page.locator('[data-slot="input-otp-slot"]')
await expect(slots).toHaveCount(6)
const boxes = await slots.evaluateAll((elements) =>
  elements.map((element) => {
    const box = element.getBoundingClientRect()
    return { width: box.width, height: box.height }
  }),
)
expect(boxes.every(({ width, height }) => width > 0 && height > 0)).toBe(true)
const verify = page.waitForRequest('**/api/auth/otp/verify')
await input.fill('123456')
expect((await verify).postDataJSON()).toMatchObject({ otp: '123456' })
```

Conserva las aserciones existentes de `email`, `context`, `purpose`, destino y ausencia de descubrimiento de cuentas. Este cambio de selector no demuestra entrega de correo ni OAuth reales.

## 3. Correos personalizados: plazo real y contenido consistente

El plugin conserva el deadline original al reenviar; `expiresAt` es Unix en **milisegundos** y `expiresInSeconds` es tiempo restante, no un TTL nuevo. Los renderers Enntra inspeccionados solo reciben la duración, la redondean hacia arriba y ponen el código en el preheader. Los cambios del template integrado no corrigen automáticamente esos overrides.

- Incluye `expiresAt` en la desestructuración de `enntraAuthEmails.otp` y pásalo a ambos templates; extiende sus interfaces para aceptarlo.
- Muestra una fecha límite explícita UTC/localizada a partir de `expiresAt`. Como fallback, usa segundos restantes redondeados hacia abajo, sin `Math.ceil(... / 60)` ni un mínimo artificial de un minuto. No anuncies una nueva duración al reenviar tarde.
- Retira el OTP del preheader; conserva el código y el propósito en el cuerpo. Escapa contenido dinámico al componer HTML propio.
- Los built-ins devuelven `{ subject, html, text }`. Un override `{ subject, html }` sigue válido y **no recibe texto sintetizado**. Si añades `text`, debe ser no vacío y coincidir en código, propósito, deadline e instrucciones. Revisa el MIME realmente entregado por Brevo.

No cambies `purpose === 'password-reset'` del callback por `recovery`: `password-reset` es el propósito del **renderer de correo**; `recovery` es el propósito **HTTP/flujo**. Mantén las notificaciones welcome/password-changed explícitas del consumidor después del éxito, fuera de la transacción de credenciales.

## 4. Checklist antes de actualizar el PR

Ejecuta en Enntra, con las fixtures aisladas del proyecto y sin credenciales externas de producción:

```sh
pnpm install --frozen-lockfile
pnpm generate:types
pnpm generate:importmap
pnpm test:graphql
pnpm exec vitest run src/collections/Users/access.test.ts src/collections/Users/infrastructure/auth/authMigration.test.ts
pnpm exec playwright test e2e/auth-pages.spec.ts
pnpm build
```

- [ ] `3.1.1` resuelve desde npm y el lockfile incluye los peers alineados, no enlaces locales.
- [ ] Tests de migración/corte usan el nuevo esquema y comprueban preservación, revocación y restauración; ninguna tabla durable se pierde.
- [ ] Registro, login OTP y recuperación muestran seis casillas con dimensiones reales; pegado, borrado y reintento funcionan sin doble verificación.
- [ ] Email inválido muestra error temático y borde inválido; submit permanece deshabilitado hasta datos válidos. Establecer contraseña exige política válida y confirmación coincidente.
- [ ] Mostrar/ocultar contraseña y Google tienen presentación consistente en registro/login; comprueba móvil y los temas realmente soportados por Enntra.
- [ ] Reenvío tardío conserva el deadline; los correos personalizados no filtran el código en preheader y HTML/texto concuerdan cuando hay ambos.
- [ ] El PR documenta evidencia nueva; los pases de 3.1.0 no certifican esta actualización ni proveedor/accesibilidad manual.

## Rollback

No reviertas solo el número de versión: restaura una aplicación/esquema compatibles y de seguridad equivalente. Conserva asociaciones, cuotas y ledgers de consumo; un backup anterior exige repetir el corte con escritores detenidos y generación nueva antes de abrir tráfico. No vuelvas a handlers JWT/OTP antiguos ni reactives pruebas consumidas. Consulta [los límites de rollback](migration.md#rollback-rehearsal-and-deployment).
