# Migrar de @main12/auth-login v2 a v3

La versión 3 cambia la configuración, los contratos de autenticación y el almacenamiento de seguridad. **No basta con actualizar el paquete:** adapta la aplicación, genera su migración de esquema con Payload y realiza el corte de autenticación con todos los escritores detenidos. Esta guía compara la versión `v2.2.1` con el candidato `3.0.0` del repositorio; no certifica su publicación ni los controles de aceptación pendientes.

Este archivo es una guía, no una migración ejecutable ni SQL universal. La migración concreta depende del adaptador, la colección autenticada y el esquema de cada aplicación.

## Camino recomendado

1. Ensaya la actualización y la restauración en una copia aislada de la base de datos.
2. Adapta dependencias, configuración del servidor, componentes y proxy.
3. Conserva temporalmente la colección OTP anterior y genera una migración Payload que preserve cuentas y credenciales.
4. En producción, activa mantenimiento, detén todos los escritores y toma un respaldo nativo.
5. Aplica el esquema revisado y el corte de seguridad implementado por la aplicación para cada colección inventariada y verifica el resultado antes de reanudar tráfico.

Consulta [el contrato de integración](plugin-contracts.md), [las migraciones de esquema](schema-migrations.md) y [el corte operativo y rollback](migration.md) para los detalles de cada etapa.

## 1. Actualizar dependencias y configuración

El `package.json` actual requiere Node `^22.0.0 || ^24.0.0` y fija Payload `3.90.2`, Next `16.3.6`, React `19.2.6` y Framer Motion `12.43.0`; HeroUI `3.2.2` es opcional. Revisa esas versiones en la aplicación y actualiza su lockfile. No asumas que la compatibilidad de v2 o el antiguo mínimo de Node siguen vigentes. Instala el artefacto v3 aprobado para tu despliegue: el número de versión no constituye aprobación del candidato.

| En v2                                                         | En v3                                                                                                             |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Configuración mínima con valores implícitos                   | `passwordLogin`, `otpLogin`, `providers.google`, `allowSignup` y `recovery` deben ser explícitos.                 |
| Estado global `pluginConfig` y puente de variables de entorno | Una fábrica por aplicación; comparte únicamente `authPlugin.publicConfig` con la UI.                              |
| `auth.verify: false` en el ejemplo de instalación             | `auth.useSessions: true`, `auth.verify: true` y estrategia local por email son obligatorios.                      |
| `domain` y `contactEmail` en opciones generales               | La configuración de correo se declara en `otp.email`.                                                             |
| `logo` como componente React en el plugin                     | El plugin acepta una URL serializable; los componentes React se pasan a las propiedades de presentación de la UI. |
| `providers.google: true` o credenciales inferidas             | `false` o un objeto explícito; habilitado requiere `clientId`, `clientSecret` y `redirectURI`.                    |
| Reexportar `proxy` y `config`                                 | Crear el proxy con `createAuthProxy` y configuración explícita. El proxy predeterminado es inerte.                |

Ejemplo inicial de contraseña, sin habilitar registro, recuperación, OTP ni Google accidentalmente:

```ts
// auth-plugin.ts: módulo exclusivo del servidor
import { authLoginPlugin } from '@main12/auth-login'

export const authPlugin = authLoginPlugin({
  collection: 'users', // conserva el slug de tu aplicación
  apiPrefix: '/api',
  authEndpointPrefix: '/auth',
  basePath: '/auth',
  passwordLogin: true,
  otpLogin: false,
  providers: { google: false },
  allowSignup: false,
  recovery: false,
  session: { maxAge: 7200 }, // segundos, límite absoluto
  routeRedirects: true,
  style: 'tailwind',
  locale: 'es',
  projectName: 'Mi aplicación',
  logo: '/logo.png',
})
```

Añade `authPlugin` a `buildConfig({ plugins: [authPlugin], ... })`. La ruta `routes.api` de Payload debe coincidir con `apiPrefix`. En la colección existente conserva sus campos, IDs, hooks y políticas; cambia la configuración de autenticación sin reemplazar la colección:

```ts
auth: {
  useSessions: true,
  verify: true,
  tokenExpiration: 7200,
  removeTokenFromResponses: true,
},
```

La colección objetivo no puede usar API keys, estrategias alternativas, login por username ni deshabilitar la estrategia local. La elegibilidad administrativa sigue siendo una política del host. Para una colección exclusivamente frontend, declara `access.admin: () => false`; no apliques esa política indiscriminadamente a usuarios administradores existentes.

### Activar métodos adicionales deliberadamente

OTP, registro mediante contraseña y recuperación requieren `otp.origin` confiable, un adaptador de correo Payload operativo y `otp.email` con remitente y locale explícitos. No confíes directamente en `x-forwarded-for`; el host debe resolver el peer o validar sus proxies. La clave OTP puede derivarse del secreto Payload de alta entropía; un override existente no debe cambiarse incidentalmente durante la migración.

Google se configura exclusivamente en el servidor:

```ts
providers: {
  google: {
    enabled: true,
    clientId: googleClientId,
    clientSecret: googleClientSecret,
    redirectURI: 'https://app.example.com/api/auth/oauth/google/callback',
  },
},
```

Registra exactamente el callback compuesto por `apiPrefix + authEndpointPrefix + '/oauth/google/callback'`. Las opciones v2 `prompt`, `successRedirect` y `failureRedirect` no pertenecen al contrato actual. Conserva asociaciones históricas comprobables; v3 usa el mapeo privado de sujeto a cuenta y **no** vincula automáticamente por coincidencia de email. El plugin no convierte los datos históricos de `payload-oauth2` a ese mapeo: inventaría su formato y prepara una migración de preservación autorizada en la aplicación antes de habilitar Google.

## 2. Adaptar componentes, servicios y proxy

Nunca importes la fábrica del servidor dentro de un componente cliente. Pasa solo `publicConfig` desde el servidor:

```tsx
// Layout del servidor
import { AuthProvider } from '@main12/auth-login/rsc'
import { authPlugin } from './auth-plugin'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider publicConfig={authPlugin.publicConfig} locale="es-CO">
      {children}
    </AuthProvider>
  )
}
```

Para el catch-all, usa el export RSC con configuración explícita y ajusta el import local a tu estructura:

```tsx
import { AuthPages } from '@main12/auth-login/rsc'
import { authPlugin } from '@/auth-plugin'

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  return <AuthPages slug={slug} publicConfig={authPlugin.publicConfig} />
}
```

En composiciones cliente, `AuthConfigProvider` recibe `publicConfig`. `AuthClientInit` es un alias de ese proveedor de árbol, no un inicializador global. Pasa el locale de la aplicación explícitamente; el locale del plugin es un fallback inmutable.

```ts
// proxy.ts: no importa configuración privada del servidor
import { createAuthProxy } from '@main12/auth-login/proxy'

export const proxy = createAuthProxy({ basePath: '/auth' })
export const config = {
  matcher: [
    '/admin/login',
    '/login',
    '/signup',
    '/forgot-password',
    '/verify-otp',
    '/set-password',
  ],
}
```

Si utilizas login modal, configura `modalLogin: true` también en este runtime. El proxy solo canonicaliza rutas: una cookie no prueba autenticación y no sustituye los guards del servidor.

Para formularios personalizados, usa `createAuthService(publicConfig, locale)` del export `/client`. Los antiguos `checkEmail`, `sendOtp`, `verifyOtp`, `signup` y `setUserPassword` globales siguen exportados como stubs deshabilitados; no conservan el comportamiento de v2. Elimina la dependencia de descubrimiento público de cuentas y de tokens devueltos a la UI. Maneja `AuthRequestError`, conserva el `context` de emisión OTP y utiliza permisos limitados para completar registro/recuperación/cambio de contraseña. El propósito antiguo `password-reset` no sustituye el propósito actual `recovery`. Consulta los contratos HTTP antes de migrar llamadas directas.

## 3. Preservar cuentas y generar el esquema

**No marques todas las cuentas como verificadas.** Conserva IDs, `hash`, `salt`, evidencia fiable de `_verified` y asociaciones de proveedor. La existencia de email, contraseña o login anterior no es evidencia suficiente de verificación. Las contraseñas cortas anteriores siguen válidas para login; el mínimo de 15 caracteres y la blocklist se aplican a contraseñas nuevas.

Una cuenta sin evidencia fiable queda bloqueada hasta probar propiedad. El flujo `verify-email` puede establecer verificación sin sustituir la contraseña y no emite sesión ni permiso de contraseña. No puede desbloquear cuentas administradoras; esas requieren aprovisionamiento de un operador autorizado. Una contraseña destruida por la implementación OTP anterior no se puede reconstruir. Sigue [la guía de cuentas existentes](migration.md).

### Mantener temporalmente `auth-otps`

v2.2.1 registraba `auth-otps` automáticamente; v3 ya no lo hace. La aplicación consumidora decide cómo inventariar e invalidar sus códigos históricos. Si su migración usa la API de colecciones de Payload, **mantén temporalmente su definición real en `collections`**; el plugin no registra ni elimina datos de esa colección. En v2.2.1 estándar, los campos eran:

```ts
// Definición transitoria: adapta cualquier personalización real del host.
{
  slug: 'auth-otps',
  admin: { hidden: true },
  access: {
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'email', type: 'email', required: true, index: true },
    { name: 'hash', type: 'text', required: true },
    { name: 'purpose', type: 'text' },
    { name: 'attempts', type: 'number', defaultValue: 0 },
    { name: 'expiresAt', type: 'text' },
  ],
},
```

Ese esquema **no tenía `scope` ni `collection`**. No copies filtros sobre esos campos sin comprobar que tu host realmente los añadió. Un filtro vacío solo es seguro si el inventario demuestra que todos los códigos pertenecen exclusivamente a la colección objetivo. Si varios tenants o colecciones compartían códigos sin distinguir propietario, resuelve primero ese inventario; no inventes un filtro ni asumas que omitirlo revoca todos los grants históricos.

### Generar y revisar en la aplicación consumidora

Mantén habilitado el plugin al generar el esquema. Con el runner Payload y la configuración de la aplicación:

```bash
payload migrate:create auth_login_v2_to_v3
```

Revisa y versiona el TypeScript y snapshot JSON generados. La migración debe añadir las sesiones/verificación nativas que falten y las cinco colecciones internas: `auth-login-otp-security`, `auth-login-credential-locks`, `auth-login-password-permits`, `auth-login-identities` y `auth-login-cutovers`. Evita eliminaciones o recreaciones destructivas de cuentas, credenciales y `auth-otps` antes del corte.

Las tablas manuales `auth_login_*` de versiones intermedias no se adoptan automáticamente: su esquema puede diferir en IDs y expiración. Si existen, prepara una migración explícita de preservación; no borres protección antirreplay ni mapeos de sujetos. No reescribas migraciones ya aplicadas. No hay exports actuales `/schema` ni `/migrations`: sigue [el flujo consumer-owned](schema-migrations.md).

## 4. Ejecutar el corte con mantenimiento real

Anuncia la interrupción, bloquea el tráfico público y detén **todas** las instancias web, workers, tareas programadas y demás escritores. Toma un respaldo nativo y verifica previamente que sabes restaurarlo.

Con los escritores detenidos, aplica el esquema revisado:

```bash
payload migrate
```

Después aplica el corte de seguridad que la aplicación haya implementado, revisado y ensayado. **El consumidor es responsable de migrar los datos**: el plugin no ofrece un helper ejecutable, conversión automática ni limpieza de códigos legacy.

Conserva cuentas, hash/salt, evidencia fiable de verificación y asociaciones de proveedor. Invalida sesiones nativas, tokens de reset/verificación, códigos anteriores y grants del host según su inventario real. No reinicies cuotas compartidas ni elimines los registros antirreplay.

El runtime conserva `auth-login-cutovers`: lee una generación por colección, con formato de 64 caracteres hexadecimales minúsculos; un registro ausente representa la autoridad inicial. El corte implementado por el consumidor debe establecer una generación criptográficamente aleatoria nueva junto con sus revocaciones, con todos los escritores detenidos. OTP, OAuth y permisos se vinculan a esa generación; el plugin solo la valida y lee, no la escribe ni coordina la migración. Consulta [el contrato de estado](migration.md#consumer-owned-security-state).

Tras validar el corte, elimina la definición transitoria de `auth-otps` mediante **otra migración Payload revisada**, únicamente cuando su inventario completo permita retirar la colección y no queden consumidores. No mezcles una eliminación anticipada con la migración que necesita leerla.

Para SQLite concurrente, todas las instancias deben usar `wal: true` y `busyTimeout: 1000` en `sqliteAdapter`, en un filesystem con locking/shared-memory adecuados. No presupongas soporte de SQLite multi-host sobre filesystem de red.

## 5. Verificar y preparar rollback

- [ ] El número e identidad de las cuentas se conservan; hashes/salts y evidencia de verificación no se alteran incidentalmente.
- [ ] Cuentas verificadas pueden usar solo los métodos habilitados; desconocidas/no verificadas siguen la política de propiedad.
- [ ] Sesiones, códigos, correlaciones y permisos anteriores al corte son rechazados.
- [ ] Google conserva asociaciones comprobadas sin email-autolink; cuentas y datos de otras colecciones siguen intactos.
- [ ] La UI recibe solo `publicConfig`; proxy, locale, correo y flujos propios funcionan con los contratos v3.
- [ ] El respaldo se restauró en un entorno aislado y se repitió el corte antes de cualquier tráfico.
- [ ] Se completaron los gates de release y verificaciones humanas aplicables; el ensayo no es aprobación de producción.

**Rollback no significa restaurar autoridad antigua.** Mantén escritores detenidos y tráfico en mantenimiento, restaura el respaldo y repite el corte de seguridad implementado por el consumidor con un build equivalente y el mismo inventario, antes de atender solicitudes. La aplicación debe establecer una generación nueva en cada corte. No vuelvas a un plugin v2 inseguro ni restaures códigos/sesiones consumidos para rescatar un flujo. Si restauras un esquema anterior, vuelve a aplicar primero las migraciones de preservación necesarias para el build seguro.

La siguiente acción es ensayar este procedimiento con la configuración y el adaptador reales de tu aplicación. Ningún comando de base de datos se ejecuta por leer o crear esta guía.
