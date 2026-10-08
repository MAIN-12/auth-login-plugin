# Separar la política de autenticación de Payload, HTTP y React

**Estado: adaptación aprobada para las tareas 01–03 en sus chats dedicados por instrucción explícita del usuario (2026-10-08); tareas 04–06 aún pendientes.** Esta especificación adapta
Clean Architecture al plugin `@main12/auth-login`, tomando como evidencia el código
`5bd52e1`. Define propietarios de política, contratos y una migración incremental;
no afirma que las capas propuestas ya existan ni autoriza una reescritura.

## 1. Decisión y ruta de lectura

El plugin conservará la autoridad nativa de Payload sobre credenciales y sesiones.
La aplicación decidirá qué operación está permitida y su orden; adapters concretos
realizarán consultas, commits, criptografía y transporte. HTTP y React no decidirán
reglas de negocio ni accederán directamente a almacenamiento.

1. Aprobar alcance y autoridad documental (§2).
2. Revisar grafo, árbol y contratos (§3–6).
3. Verificar invariantes y escenarios (§7–8).
4. Implementar slices con equivalencia observable y tests unitarios (§9–11).

**Resultado esperado:** un mismo caso de uso aplica la misma política invocado desde
HTTP o desde un caller interno autorizado, sin importar Payload/Next/React ni
exponer secretos. La refactorización conserva API pública, schema y seguridad.

## 2. Alcance, autoridad y límites

### 2.1 Adaptación deliberada

[Los contratos del plugin](../plugin-contracts.md) son la autoridad funcional actual.
[CLEAN-Payload-v2](payload-clean/CLEAN-Payload-v2.md) describe una aplicación AOP y
`src/collections/<Collection>`; sus paths y tipos generados compartidos no se
adoptan literalmente en este paquete. El plugin **configura una collection del
consumidor**, no posee su colección, perfiles, roles ni modelo generado.

[CONTEXT](../CONTEXT.md) y los índices copiados contienen referencias a otro árbol
(`docs/system/architecture/...`). Son contexto histórico que deberá reconciliarse
si se aprueba esta propuesta, no evidencia de una autoridad compartida vigente.
La aprobación explícita del usuario para la tarea 01 está registrada en la sección
de seams de `plugin-contracts.md`; CONTEXT e índice local fueron reconciliados.
Los contratos de seguridad existentes permanecen vigentes.

Los términos **DEBE**, **NO DEBE** y **DEBERÍA** son obligaciones propuestas:
DEBE/NO DEBE son criterios de aceptación; DEBERÍA admite excepción documentada
con razón, alcance, responsable y test. Son criterios aprobados para los slices 01–03 en sus chats dedicados; las operaciones
de 04–06 continúan pendientes de sus propios chats.

### 2.2 Incluido y excluido

| Incluido                                                                 | Excluido                                                   |
| ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Password login, OTP, ownership, password lifecycle, Google, capabilities | Nuevos métodos, vendors o features de autenticación        |
| Coordinación nativa de sesiones, políticas admin, provisioning y cutover | Inventar hashing/JWT/session engine sustituto de Payload   |
| Puertos angostos, mappers, adapters y composition root                   | Repository genérico CRUD, DI container o base classes      |
| Separación HTTP/client/hooks y protección del grafo                      | Reorganizar todo `components/` por estética                |
| Migración interna sin cambiar consumidores                               | Email-change UX, autolink Google por email, username-only  |
| Tests unitarios y doubles de contratos                                   | Chromium, Playwright, E2E o nuevas suites DB de aceptación |

No se eliminarán harnesses históricos únicamente para mover capas. No se ejecutarán
como gate de este trabajo: la decisión del usuario es **solo pruebas unitarias**.
Typecheck, lint y formato son validaciones estáticas, no pruebas de navegador.

### 2.3 Fuentes de verdad

- `CollectionConfig` del consumidor conserva fields, access, hooks y configuración.
- Los tipos Payload/runtime pertenecen a adapters y composición, no al dominio.
- Snapshots internos angostos son evidencia seleccionada para una intención, no
  clones de documentos ni esquemas alternativos.
- Dominio posee invariantes; aplicación posee workflows y autorización operacional.
- Los DTO HTTP públicos conservan su shape; no son automáticamente entidades.
- Los exports `.`/`client`/`rsc`/`proxy` conservan nombres y comportamiento.

## 3. Capas, responsabilidad y grafo

### 3.1 Propietarios

| Capa propuesta             | Decide o hace                                                                      | No hace                                                     |
| -------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `domain`                   | Reglas deterministas de password, propósito, redirect, capabilities y elegibilidad | I/O, workflows, status HTTP, reloj ambiental, SDK           |
| `application/use-cases`    | Intención, método habilitado, principal, orden, consumo y política de fallo        | SQL, fetch, cookies, React, objetos Payload                 |
| `application/ports`        | Capacidades que necesitan operaciones reales                                       | CRUD universal, configuración completa o `PayloadRequest`   |
| `infrastructure/payload`   | Native auth, queries seleccionadas, locks, hooks, commits y sesión                 | Autorizar una operación solo porque llegó por HTTP          |
| `infrastructure/security`  | Ledger durable y formatos criptográficos existentes                                | Conceder autoridad ante fallo o pérdida de estado           |
| `infrastructure/providers` | Google token exchange/verificación y entrega email                                 | Elegir autolink/provisioning o iniciar sesión por su cuenta |
| `interface/http`           | Input/bounds, origin/CORS, cookies, response y errores públicos                    | Reglas de signup/recovery/reauth o ensamblar stores         |
| `interface/client`         | Un único adapter HTTP y validación de respuestas                                   | Estado React, acceso server o autoridad de identidad        |
| `interface/react`          | Hooks/context de interacción, navegación y estado transitorio                      | Duplicar fetch o reglas server en forms                     |
| `composition`              | Snapshots config y construcción concreta por instancia/request                     | Singletons globales de config, reglas de negocio            |

### 3.2 Grafo obligatorio

```text
interface/http ──────> application/use-cases ──────> domain
                               │                    ▲
                               ▼                    │
                        application/ports <──────── infrastructure

interface/react ─────> interface/client ─────> contracts + domain browser-safe
components ──────────> interface/react + contracts + domain browser-safe
composition ─────────> application + infrastructure + interface/http
exports ─────────────> superficies explícitas de su runtime
```

`contracts` contiene wire models y public errors, sin runtime server. Application
puede importar tipos de resultado internos y vocabulario puro; no importa modelos
React/HTTP para ejecutar una operación. Los adapters implementan ports, no al revés.

**ARC-01:** domain/application NO DEBEN importar `payload`, `drizzle-orm`, React,
Next, endpoints, components, interface, infrastructure ni composition. El dominio
NO DEBE importar application. Imports `type` no exceptúan estas reglas.

**ARC-02:** app/domain NO DEBEN usar `Request`, `Response`, `Headers`, cookies,
`fetch`, `process.env`, `Buffer` criptográfico, `node:crypto`, `Date.now` o aleatoriedad
ambiental. El reloj y random existentes se inyectarán donde realmente se usan;
no se creará un puerto de reloj para cada operación sin necesidad.

**ARC-03:** cliente/RSC/proxy NO DEBEN alcanzar ledger, secret config, Payload
adapters o crypto server mediante imports transitivos. RSC email templates conservan
su superficie propia; el proxy sigue sin ser validador de sesión.

**ARC-04:** solo composition importa simultáneamente factories concretas de
infraestructura y casos de uso para ensamblarlos. HTTP recibe operaciones ya
construidas, y tipos de Payload solo para adaptar la entrada/request.

### 3.3 Árbol de destino propuesto

Nombres internos sugeridos; agrupación por operación, no un archivo por método.
Solo se crean directorios que contengan una responsabilidad real.

```text
src/
  index.ts                         # fachada pública del plugin
  config.ts / googleOptions.ts / adminOptions.ts
  exports/client.ts / exports/rsc.ts / proxy.ts
  auth/
    contracts/
      errors.ts                    # error response HTTP; reexport de code puro
      httpModels.ts                # DTO públicos existentes
    domain/
      credentials.ts / passwordRules.ts / redirect.ts / emailPresentation.ts
      errors.ts / ownershipPolicy.ts / googleAccountPolicy.ts / proofBinding.ts
      password-blocklist.json / password-blocklist.license.json
    application/
      models.ts                    # comandos, principal, evidencia/resultados internos
      ports/
        accountEvidence.ts / nativeAuth.ts / credentialCommit.ts
        securityState.ts / proofCodec.ts / googleProvider.ts / otpDelivery.ts
      use-cases/
        passwordLogin.ts / otp.ts / ownershipVerification.ts
        passwordLifecycle.ts / googleFlow.ts / credentialCapabilities.ts
        sessionLifecycle.ts / migrateAuthLogin.ts
    infrastructure/
      payload/
        accountEvidenceRepository.ts / nativeAuthAdapter.ts
        credentialCommitAdapter.ts / sessionPolicy.ts / adminPolicy.ts
        nativeTransaction.ts / nativeSessionCoordination.ts / migrationAdapter.ts
        accountEvidenceMapper.ts / credentialRequest.ts
      security/
        payloadSecurityStore.ts / methodPermitLedger.ts / cutoverGeneration.ts
        otpCrypto.ts / permitCodec.ts / googleCorrelationCrypto.ts
      providers/
        googleProvider.ts / otpDelivery.ts
    interface/
      http/
        authEndpoints.ts / passwordEndpoints.ts / googleEndpoints.ts
        authSchemas.ts / responses.ts
      client/
        authService.ts / passwordProof.ts / googleActions.ts
      react/
        AuthFlowContext.tsx
        hooks/useLoginFlow.ts / hooks/useVerifyOtpFlow.ts
        hooks/useForgotPasswordFlow.ts / hooks/useSetPasswordFlow.ts
    composition/
      createAuthApplication.ts / createRequestAuthScope.ts / installAuthPolicy.ts
  components/                     # forms y estilos conservados
```

No introducir un `Repository<T>` o un `BaseUseCase`. Un único `createAuthApplication`
puede retornar grupos de funciones. No hace falta crear una clase por intención.

## 4. Inventario completo de operaciones

`<auth>` significa el `authEndpointPrefix` configurado bajo el API prefix. La tabla
incluye rutas reales, aliases deshabilitados y operaciones sin endpoint. Los nombres
de caso de uso son **destino propuesto**, no exports nuevos al consumidor.

| Entrada actual                                        | Caso de uso/owner propuesto                  | Puerto o adapter principal                 | Condición a preservar                                    |
| ----------------------------------------------------- | -------------------------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| `POST <auth>/login` y login nativo coordinado         | `passwordLogin`                              | `NativePasswordAuth`                       | Método, verified, lockout/hooks, token/cookie nativos    |
| `POST <auth>/otp/send`, purpose login                 | `otp.send`                                   | Account evidence, security state, delivery | Generic accepted, budgets y contexto; no password write  |
| `POST <auth>/otp/verify`, purpose login               | `otp.verify`                                 | Security state + native proven session     | Proof consumido una vez; identidad exacta                |
| OTP send/verify purpose signup                        | `ownershipVerification`                      | Account evidence + permit codec            | Solo ausencia autorizada; no precrear cuenta             |
| OTP send/verify purpose recovery                      | `ownershipVerification`                      | Evidence + permit codec                    | Password existente; no primer password                   |
| OTP send/verify purpose reauth                        | `ownershipVerification`                      | Principal/evidence + permit codec          | Verified, cuenta/SID exactos, método habilitado          |
| OTP send/verify purpose verify-email                  | `ownershipVerification`                      | Credential commit                          | Solo `_verified`; sin sesión, token ni password          |
| `POST <auth>/signup`                                  | `passwordLifecycle.completeSignup`           | Credential commit                          | Owner-chosen password; sin auto-login                    |
| `POST <auth>/forgot-password`                         | `ownershipVerification.sendRecovery`         | Security state + delivery                  | Alias de operación, no llamada a otro handler HTTP       |
| `POST <auth>/reset-password`                          | `passwordLifecycle.completeRecovery`         | Credential commit                          | Revoca sesiones/permits, no auto-login                   |
| `POST <auth>/set-password`                            | `passwordLifecycle.completeReauthentication` | Credential commit                          | Principal/SID/evidencia actual; nueva autoridad nativa   |
| `POST <auth>/reauthenticate`                          | `passwordLifecycle.reauthenticate`           | Native password reauth + permit codec      | Grant limitado de cinco minutos, no login alternativo    |
| `GET <auth>/credentials`                              | `credentialCapabilities`                     | Account evidence                           | Solo principal autenticado de la collection              |
| `GET <auth>/oauth/google`                             | `googleFlow.startLogin`                      | Google provider + correlation store        | ReturnTo local, provider habilitado, binding browser     |
| `POST <auth>/oauth/google/link`                       | `googleFlow.startLink`                       | Permit ledger + native account binding     | Link explícito, proof reciente, no email autolink        |
| `GET <auth>/oauth/google/reauthenticate`              | `googleFlow.startReauthentication`           | Native principal + correlation store       | Exact principal; popup/binding existentes                |
| `GET <auth>/oauth/google/callback`                    | `googleFlow.callback`                        | Provider, account commit, native session   | Consume antes de exchange; sub estable y verified        |
| `POST /refresh-token` bajo collection                 | `sessionLifecycle.refresh`                   | Native refresh                             | No extender lifetime absoluto de sesión                  |
| Logout nativo y writes de sesión coordinados          | Adapter lifecycle + política sesión          | Native session coordination                | Revocación conservada; sin nuevo endpoint inventado      |
| Native REST/GraphQL/Local API credential/email writes | Adapter hooks + guard común                  | Trusted provisioning policy                | Local API + overrideAccess + context explícitos          |
| UI/resource admin access y evidence                   | Política pura + host adapter                 | Original admin eligibility + authorize     | No habilitar admin por email ownership                   |
| Root `migrateAuthLogin(payload, options)`             | `migrateAuthLogin`                           | Maintenance commit                         | Epoch colección, inventory explícito, preserva hashes    |
| `POST <auth>/check-email`                             | HTTP compatibility stub                      | Ninguno                                    | `METHOD_DISABLED`; no discovery                          |
| `POST <auth>/oauth/google` y `/callback`              | HTTP compatibility stubs                     | Ninguno                                    | Deshabilitados; no confundir con GET activo              |
| `authLoginPlugin` enabled/disabled factory            | Composition root                             | Config/install policies                    | Disabled inert; publicConfig segura por instancia        |
| `createAuthService`, hooks, pages, modal/card         | Client adapter + React interface             | HTTP owner único                           | Transiciones/exports/locale seguros preservados          |
| `/rsc` email exports y `/proxy` helpers               | Interface especializada                      | Templates/redirect utils                   | Sin grants, sin secrets ni detector ambiental automático |

La configuración de autenticación nativa instalada por `index.ts` también DEBE
proteger sus propias vías de entrada; extraer endpoints no puede abrir una vía
Payload paralela que omita la política. No mover todos los hooks a application:
la traducción y la coordinación del lifecycle del framework siguen siendo adapters.

## 5. Contratos internos: angostos y operacionales

### 5.1 Comandos, evidencia y errores

**APP-01:** cada operación DEBE tener comando tipado y validación de invariantes
reutilizable. Zod/bounds de body/query viven en HTTP; app no confía en que HTTP fue
el único caller. Campos desconocidos, propósito inválido y password incorrecto
NO DEBEN llegar a efectos de credencial. Evitar duplicar schemas con reglas distintas.

Propuesta de vocabulario mínimo:

```ts
type AccountID = string | number
interface Principal {
  accountID: AccountID
  collection: string
  sid?: string
}
interface AccountEvidence {
  accountID: AccountID
  email: string
  verification: 'verified' | 'unverified' | 'unknown'
  credentials: 'available' | 'unavailable' | 'unknown'
  deleted: boolean
  version: string
}
type FailureCode = AuthErrorCode // code semántico importado desde domain/errors
type Outcome<T> = { ok: true; value: T } | { ok: false; code: FailureCode }
```

`version` es binding opaco calculado por el adapter, no hash/salt transferidos al
caller. `Principal` lo construye un adapter desde autenticación nativa verificada;
no se acepta del body. Collection es contexto de instancia, nunca selector público.

`domain/errors.ts` propone el vocabulario canónico puro de códigos; `contracts/errors.ts`
reexporta ese código y deriva el response HTTP. Application importa dominio, no el
contrato HTTP. Esto conserva los exports públicos sin invertir las dependencias.

**APP-02:** fallos esperados DEBEN tener código sin `status`; HTTP conserva el mapping
actual de 400/401/403/503 y sus respuestas/correlation IDs. Un fallo inesperado
DEBE cerrarse como `AUTH_UNAVAILABLE` sin stack/texto de infraestructura. Se puede
usar excepción interna tipada en vez de `Outcome`, pero se elegirá un patrón único
por grupo y no se propagará `APIError` de Payload a app/domain.

El `AuthRequestError` público sigue teniendo status: pertenece al adapter cliente.
El legacy `AuthFailure` con status no se conservará como error de dominio; su
compatibilidad interna durante un slice se resuelve en el mapper HTTP.

### 5.2 Repositories versus adapters

| Puerto propuesto        | Operaciones semánticas mínimas                                  | Restricción                                                      |
| ----------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| `AccountEvidenceReader` | `findOwnershipByEmail(email)`, `readOwnCapabilities(principal)` | Sin documentos completos/hash/salt; reads privilegiados acotados |
| `NativePasswordAuth`    | `login(credentials)`, `reauthenticate(principal, password)`     | Preserva Payload verify/hash, hooks, lockout y evidencia         |
| `NativeSessions`        | `openFromProof(binding)`, `refresh(principal)`                  | Devuelve receipt privado; token no es DTO público automático     |
| `CredentialCommit`      | `completePassword(command)`, `verifyEmail(binding)`             | Commit atómico con relectura/consumo/revocación                  |
| `GoogleProvider`        | `authorize(correlation)`, `exchange(callback, correlation)`     | Identidad verificada; no decide cuentas                          |
| `GoogleAccountCommit`   | `finish(identity, correlation, policy)`                         | Mapeo sub/collection y uniqueness bajo lock                      |
| `SecurityState`         | `transaction(keys, work)` para estado privado                   | Serialización durable; no store de colección genérico            |
| `PermitCodec`           | `issue(binding, expiry)`, `read(encoded, purpose)`              | Formato/AAD/TTL actuales; no grants por parseo solamente         |
| `OtpCrypto`             | Generar/comparar/bindings criptográficos actuales               | No cambiar corpus, formatos o parámetros por mover capas         |
| `OtpDelivery`           | `deliver({ email, code, locale })`                              | Nunca retorna autoridad ni expone código al cliente              |
| `MaintenanceCommit`     | `cutover(options)`                                              | Attestation/inventory explícitos, sin reset budgets              |

Estos son contratos conceptuales a concretar con los DTO existentes seleccionados,
no una exigencia de doce interfaces separadas. Agrupar puertos usados juntos por un
slice es aceptable; un adapter concreto puede implementarlos sin duplicar queries.

Un **repository** nombra retrieval/persistence de evidencia identificable, no una
fachada de todo Payload. El ledger OTP es un **transactional storage adapter**;
Google es un **provider service adapter**; login/credential/session son **adapters
operacionales nativos**, no repositories de usuarios con `save(user)`.

### 5.3 Firmas de referencia propuestas

Estas firmas hacen verificables los límites; no son API pública nueva. `Receipt`
es un identificador privado ligado al scope, no una credencial que acepte el cliente.
La implementación puede agruparlas, pero NO DEBE ampliar input/results a documentos
Payload o introducir `{ req: unknown }` para sortear el grafo.

```ts
interface PasswordLoginCommand {
  email: string
  password: string
}
interface CompletionCommand {
  purpose: 'signup' | 'recovery' | 'reauth'
  encodedPermit: string
  password: string
}
interface ProofBinding {
  accountID: AccountID | null
  email: string
  version: string
  purpose: 'login' | 'signup' | 'recovery' | 'reauth' | 'verify-email'
  sid?: string
  nonce?: string
  expiresAt: number
}
interface NativeSessionReceipt {
  readonly reference: string
}
interface AccountEvidenceReader {
  findOwnershipByEmail(email: string): Promise<AccountEvidence | null>
  readOwnCapabilities(principal: Principal): Promise<CredentialCapabilities>
}
interface CredentialCommit {
  completePassword(input: {
    binding: ProofBinding
    password: string
    principal: Principal | null
  }): Promise<Outcome<{ session?: NativeSessionReceipt }>>
  verifyEmail(binding: ProofBinding): Promise<Outcome<{ verified: true }>>
}
interface AuthApplication {
  passwordLogin(command: PasswordLoginCommand): Promise<Outcome<NativeSessionReceipt>>
  sendOwnership(command: {
    email: string
    purpose: ProofBinding['purpose']
    context?: string
  }): Promise<Outcome<{ context: string; retryAfter: number }>>
  completePassword(command: CompletionCommand): Promise<
    Outcome<{
      session?: NativeSessionReceipt
    }>
  >
}
```

`ProofBinding` es evidence server interna, NO un input que el HTTP caller puede
fabricar: la operación decode/validate verifica permit y liga purpose explícito.
El scope proporciona principal y policy; el body no puede inyectar dependencias.
Las firmas OTP verify/Google/migration DEBEN seguir el inventario §4: comandos
angostos y resultados discriminados, con finalización nativa detrás del mismo commit.
No añadir props opcionales sin necesidad real ni convertir session receipt en token.

### 5.4 Request scope, native receipts y commit

**TX-01:** `createRequestAuthScope(req)` DEBE capturar el `PayloadRequest` real en
closures concretas. App recibe dependencias ligadas al scope, no `req`, transactionID,
Drizzle sessions, cookies ni un `unknown` que permita extraerlos. El scope NO DEBE
reutilizarse entre requests o instancias. El helper offline crea su propio scope
nativo a partir de Payload, sin fingir un principal HTTP.

Un `NativeSessionReceipt` interno puede referenciar resultado serializable de la
operación y un handle opaco ligado al adapter. HTTP materializa cookie/user/exp
mediante ese adapter. Tokens y documentos nativos NO DEBEN formar parte del modelo
de dominio. No usar casts para esconder un `PayloadRequest` dentro de un DTO.

**TX-02:** app ordena las fases y selecciona la intención; el adapter DEBE poseer el
commit indivisible. Una lectura de elegibilidad fuera del commit es orientativa:
antes de persistir, relectura bajo locks aplica la misma política pura sobre evidencia
actual y verifica accountID/email/version/SID/generation. App no abre SQL transaction.

**TX-03:** proof consume + cambio de credencial + revocación/native session update
DEBEN conservar los límites existentes. OTP/OAuth correlation se quema antes de
fase posterior y un fallo posterior no la resucita. No fusionar ni separar transacciones
para conseguir una abstracción uniforme. Documentar qué consumo es irreversible y
qué writes hacen rollback juntos para cada operación.

**TX-04:** todo Local API/DB call transaccional DEBE llevar el mismo `req` real con
transactionID del adapter. Hooks del host corren en esa unidad cuando corresponde;
cutover conserva bypass nativo deliberado para no rehash/provision. `finally` limpia
transactionID, sesiones registradas, weak-set markers y cambios temporales de user,
tanto en success como en throw síncrono/asíncrono.

**TX-05:** locks y SQL conservan bindings para valores y resolución/quoting de
identificadores desde metadata confiable. SQLite busy retry puede ocurrir antes de
iniciar trabajo; NO DEBE repetir efectos de auth/hooks después de empezar el callback.
Transacción previa incompatible continúa fallando cerrada, no commit implícito.

## 6. Interfaces y composition root

### 6.1 HTTP

**HTTP-01:** endpoints DEBEN limitarse a request decoding, schema/bounds, origin,
principal binding, invocación y response mapping. Checks `allowSignup`, `recovery`,
`passwordLogin`, `otpLogin`, Google y admisión reauth viven en casos de uso. El handler
puede rechazar origin temprano, pero no es propietario de elegibilidad de identidad.

**HTTP-02:** `forgot-password` llama una operación compartida, no otro handler. Los
aliases deshabilitados permanecen interfaces inert sin resolver cuentas ni enviar mail.
`verify-email` conserva success exactamente `{ success: true }` sin grant extra.

**HTTP-03:** origin/CORS, `no-store`, cookie flags, lifetime, returnTo, callback cleanup,
`removeTokenFromResponses` y status/error codes DEBEN permanecer equivalentes. Mapping
de tokens se realiza solo en interfaz/adapter nativo, nunca en React o domain.

### 6.2 Cliente y React

**CLI-01:** `createAuthService(publicConfig, locale?)` DEBE seguir siendo el único owner
de HTTP de workflows password/OTP/ownership/Google **y sesión/logout**. El fetch
directo de `AuthProvider` deberá pasar por métodos internos de la misma instancia
de authService, conservando rutas nativas de sesión y contratos públicos. Mover sus helpers Google juntos
si necesitan navegación/popup, sin duplicar requests en hooks o forms. Cada instancia
captura config pública explícita; sin fetch global configurable ni shared singleton.

**CLI-02:** hooks/context DEBEN vivir en `interface/react`; coordinan estado de formulario,
retry, in-flight y navegación. HTTP models/login steps/OTP purpose y response unions
salen de `domain/types.ts` a contratos o UI según su significado, manteniendo reexports
públicos. `passwordProof.ts` es estado/continuation cliente, no prueba server válida.

**CLI-03:** éxito/malformed/error/expired grant DEBEN conservar guards y recovery UI.
Ningún consumidor puede convertir un flag React en verified/session/admin authority.
Forms Tailwind/HeroUI y card/page/modal usan mismos workflows; un solo árbol responsive.

### 6.3 Instancia y ciclo de vida

**CMP-01:** `authLoginPlugin` conserva overloads y snapshot immutable de opciones privadas
incluidas anidadas. Composition valida configuración y construye application factories;
request scope liga concrete adapters al request correcto. No process-global bridge,
server secret en publicConfig, late reads del objeto mutable del consumidor ni DI container.

**CMP-02:** instalar políticas collection/hooks/access y native coordination es bootstrap,
no un caso de uso. Los policies del host originales se componen preservando su semántica
sin ejecutarlos dos veces para UI/resources. Disabled factory es completamente inert.

## 7. Invariantes de seguridad no negociables

| ID     | Obligación propuesta                                                     | Fallo que debe negar autoridad                                     |
| ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| SEC-01 | Usar credenciales/session nativas; ownership no reemplaza password       | Adapter o hooks rechazan; no token/cookie ni fallback              |
| SEC-02 | Unknown/unverified/deleted conserva denegación y no inventa evidencia    | Campos omitidos/malformed no significan available/verified         |
| SEC-03 | Send genérico sin lookup público, mail receipt ni account existence      | Missing account/mail failure mantiene contrato anti-enumeración    |
| SEC-04 | Purpose/collection/email/account/version/SID/origin/browser/epoch bound  | Reuso, sustitución o proof stale no concede ninguna operación      |
| SEC-05 | Consumo único durable y revocación vigente                               | Fallo storage no usa memoria/fallback; concurrencia no doble grant |
| SEC-06 | Quotas/cooldown/attempts no se reinician por resend/cutover/mail failure | Código viejo o exhausted attempts sigue cerrado                    |
| SEC-07 | Recovery solo reemplaza password existente y revoca sesiones             | Passwordless/unknown no obtiene primer password por recovery       |
| SEC-08 | Verify-email cambia solo verificación y preserva credenciales/sesiones   | Hook que muta credenciales hace rollback; OTP sigue consumido      |
| SEC-09 | Google login por sub estable; linking explícito                          | Email matching no autolink; duplicate sub/cuenta denegado          |
| SEC-10 | Trusted provisioning requiere las tres condiciones y origen Local API    | REST/GraphQL forwarded flags/cookie no crea privilegio             |
| SEC-11 | Admin conserva original eligibility y autorización explícita del host    | Email ownership solo no abre administración                        |
| SEC-12 | Secrets solo config privada/adapters; logs con code/correlation          | Logger throw no grant ni leak email/password/OTP/token/hash/body   |
| SEC-13 | Cutover scoped preserva cuenta/password/mapping y budgets                | Failure rollback; no resume ni restore old grants como rollback    |
| SEC-14 | New password sigue corpus versionado y mínimo Unicode existente          | Password legacy corto no se revalida como nuevo en login           |

No introducir `overrideAccess: true` genérico para que un repository pase un test.
Cada read/write privilegiado DEBE explicar alcance, owner y evidencia exigida.
Privilegio nativo interno no equivale a autorización del usuario.

## 8. Escenarios verificables por intención

Cada fila DEBE probar llamada directa al caso de uso y, donde corresponda, mapping
HTTP con doubles. En fallos verificar también **ausencia de efectos**, no solo código.

| Escenario                 | Given / When                                                | Then obligatorio                                                     |
| ------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| SC-01 Password happy      | Método activo y credencial admitida; login                  | Llama native auth una vez, receipt; no hashing propio                |
| SC-02 Método disabled     | Caller no HTTP llama signup/recovery/reauth/Google disabled | `METHOD_DISABLED` antes de lookup/commit/provider/delivery           |
| SC-03 Input inválido      | Extra field/purpose inválido/weak new password              | `INVALID_INPUT`; cero commit; legacy login no regla de new password  |
| SC-04 OTP happy           | Existing verified account, send y verify válido             | Budget/context respetado; única native session, cero password writes |
| SC-05 OTP adversarial     | Wrong/expired/exhausted/wrong binding/replacement account   | Deny; attempts/consumption actuales y sin nueva autoridad            |
| SC-06 Mail/store fault    | Delivery falla o transaction rechaza                        | Send genérico si aplica; store falla cerrado; sin reset budgets      |
| SC-07 Ownership signup    | Account absent y proof vigente, complete                    | Un create nativo; owner password; sin sesión automática              |
| SC-08 Recovery invalid    | Missing/deleted/passwordless/unknown evidence               | No permit válido ni credential establishment; send genérico          |
| SC-09 Reauth stale        | Principal/SID/version cambia antes de complete              | Commit recheck niega; no session/credential effects                  |
| SC-10 Verify-email        | Account legacy y hooks seguros; verify                      | Solo verified true; zero cookie/token/permit/password/session        |
| SC-11 Hook failure        | Hook throws o cambia credencial durante verify/complete     | Commit rollback; cleanup finally; no raw error; proof no revive      |
| SC-12 OAuth happy         | Correlation/browser vigente y verified stable sub           | Consume, exchange, account policy, native session en orden           |
| SC-13 OAuth hostile       | Otro browser, stale state, provider fails, email match      | Consume según fase; zero autolink, no session; cleanup cookie        |
| SC-14 Capabilities        | Exact principal con evidencia password/verification         | Own query; unavailable/unknown separados; ningún hash en result      |
| SC-15 Native lifecycle    | Refresh/logout/provisioning guard con doubles               | Deadline no extendido; revocation maintained; flags no bypass        |
| SC-16 Admin               | Original eligibility denies o authorize rejects/throws      | Deny UI/resources; sin duplicar original decisión                    |
| SC-17 Cutover             | Maintenance/inventory valid o commit falla                  | Generation scoped; preserve budgets; aggregate-only result/rollback  |
| SC-18 UI/client           | Malformed transport o expired/consumed/transient proof      | Safe error, in-flight único y continuación/retry conservados         |
| SC-19 Instance            | Dos configs y scopes request diferentes                     | No secret leak ni crosscollection/session/config bleed               |
| SC-20 Transaction adapter | Callback success o asynchronous rejection                   | Mismo req/bindings; cleanup markers/sessions/transactionID siempre   |

Concurrencia unitaria usa store serializado controlado y llamadas intercaladas:
prueba protocolo y orden, **no demuestra locks reales entre procesos**. DB/native
runtime y navegador no quedan certificados por aprobar esta tabla.

## 9. Mapeo de migración desde archivos reales

Cada movimiento DEBE incluir imports/reexports/tests del slice, sin dejar dos owners
activos. Shims internos solo temporales, identificados y con fecha/slice de eliminación.

| Fuente actual                                                              | Destino propuesto                                            | Separación necesaria                                          |
| -------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| `auth/domain/login.ts`                                                     | domain/credentials + domain/errors + use-cases/passwordLogin | Sacar factory/orquestación y status; preservar codes públicos |
| `auth/domain/otp.ts`                                                       | use-cases/otp + ports/securityState + security/otpCrypto     | Política/order separado de crypto/ledger; mismos formatos     |
| `auth/domain/passwordLifecycle.ts`                                         | use-cases/passwordLifecycle + security/permitCodec           | Reglas y grants separadas de AES/HMAC/clock ambiental         |
| `auth/domain/types.ts`                                                     | contracts/httpModels + React workflow types                  | No DTO HTTP/steps React en dominio por conveniencia           |
| `auth/domain/proofBinding.ts`                                              | domain/proofBinding + mapper/crypto según función            | Encoding puro separado de secretos/evidence nativa            |
| `auth/domain/credentials.ts`, rules, redirect, emailPresentation           | domain existente                                             | Mantener reglas puras/corpus y browser reachability           |
| `auth/application/ownershipVerification.ts`                                | use-cases/ownershipVerification + domain/ownershipPolicy     | Reemplazar hash/salt evidence por capability/version opaca    |
| `auth/application/googleAccountPolicy.ts`                                  | domain/googleAccountPolicy                                   | Política pura sin AuthFailure HTTP                            |
| `auth/application/googleFlow.ts`                                           | use-cases/googleFlow + security/googleCorrelationCrypto      | Sacar Node crypto; conservar burn-before-exchange             |
| `auth/application/services/authService.ts`, `passwordProof.ts`             | interface/client                                             | Un único HTTP owner; reexports compatibles                    |
| `auth/application/hooks/*`, `AuthFlowContext.tsx`                          | interface/react                                              | React/Next excluidos de application                           |
| `endpoints/*`                                                              | interface/http                                               | Sacar configuración concreta, policy y store wiring           |
| `auth/server/passwordAdapter.ts`                                           | payload/credentialCommitAdapter + nativeTransaction          | Mantener unidad nativa; extraer políticas sin dividir commit  |
| `auth/server/otpSession.ts`                                                | nativeAuthAdapter/sessionCoordination/nativeTransaction      | No sustituir native engine ni mover detalles DB a app         |
| `auth/server/credentialEvidence.ts`                                        | accountEvidenceRepository + mapper                           | Selección reducida, own-only, zero hash/salt fuera adapter    |
| `auth/server/credentialRequest.ts`                                         | payload/credentialRequest + mapper                           | WeakSets request-scoped y version calculation server          |
| `auth/server/googleAccount.ts`, `googleAuthentication.ts`                  | googleAccountCommit + application composition                | Account policy puro; auth native/locks/sub persistence server |
| `auth/server/googleProvider.ts`, `otpEmail.ts`                             | infrastructure/providers                                     | Provider/transport/templates no account policy                |
| `auth/server/otpStore.ts`, `methodPermitLedger.ts`, `cutoverGeneration.ts` | infrastructure/security                                      | Retener persistent tables/key namespaces/transaction behavior |
| `auth/server/sessionPolicy.ts`, `adminPolicy.ts`                           | infrastructure/payload + pure policy si útil                 | Guard/host lifecycle nativo; no requests en domain            |
| `auth/server/migration.ts`                                                 | use-cases/migrateAuthLogin + migrationAdapter                | Intención maintenance separada de native commit/DDL           |
| `index.ts`, config/options, `exports/*`                                    | Facades actuales + composition                               | API/signatures immutable; no export privado nuevo             |

El mapeo no exige copiar nombres de todos los archivos. Un módulo puede continuar
integrado temporalmente y declarar su acoplamiento durante un slice; no llamarlo
aplicación portable hasta retirar los imports prohibidos.

## 10. Slices independientes y prioridades

Cada slice DEBE compilar, conservar contratos, pasar gates unitarios y ser revertible
como código sin restaurar autoridad revocada. No empezar por mover carpetas en masa.

| Slice | Prioridad y entrega                                                    | Criterio específico de salida                                              |
| ----- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| S0    | P0: aprobación, inventario contrato/imports y tests de caracterización | Authority reconciliada; expectativas existentes congeladas                 |
| S1    | P0: password login + errors/contracts + request composition seam       | Direct-call método disabled; native auth intacta; HTTP equivalente         |
| S2    | P0: ownership/password lifecycle + commit/evidence ports               | Endpoints sin elegibilidad; no hash/salt en application; rechecks intactos |
| S3    | P0: OTP use-cases/store/crypto seams                                   | Purpose/quotas/consumption/storage-error regresiones cubiertas             |
| S4    | P1: Google provider/correlation/account separation                     | No email autolink; callback burn y explícito linking/reauth                |
| S5    | P1: client service/context/hooks y contract reexports                  | Un owner HTTP; tests DOM/hooks unitarios, exports estables                 |
| S6    | P1: capabilities/session/admin/native guards/cutover                   | Native boundaries documentadas; no request en app/domain                   |
| S7    | P1: enforce imports, borrar shims, actualizar docs de seams            | Zero excepción transicional sin justificar; checklist completa             |

S2 puede conservar OTP factory integrada hasta S3, declarándola adapter transicional.
S6 no cambia las tablas/generation ni el comportamiento de migración; no es un nuevo
cutover de producción. Si un slice exige schema/API change, detenerlo y especificar
ese cambio por separado: no ocultarlo como movimiento Clean.

## 11. Evidencia, enforcement y cierre

### 11.1 Gates ejecutables

- `pnpm test:unit`: regresiones existentes y nuevas unitarias, sin Chromium ni suites
  de aceptación externas. La suite actual también ejecuta fixtures SQLite/HTTP
  en proceso; no llamarlas pruebas aisladas de use-cases ni decir que están skipped.
  Los nuevos escenarios de esta refactorización usan doubles unitarios; retirar o
  reclasificar fixtures existentes sería una decisión separada, no parte del refactor.
- `pnpm typecheck`: superficies y contratos internos.
- `pnpm lint`: restricciones arquitectónicas, incluidos imports type/dynamic/barrels.
- `pnpm exec prettier --check <archivos-del-slice>`: formato, sin reformat global.
- `git diff --check`: whitespace; revisar API/schema diff explícitamente.

**TST-01:** ampliar `eslint.config.js` con
barriers de §3 y agregar `tests/architecture-boundaries.test.ts` propuesto para el
grafo local/transitivo. El gate DEBE rechazar `domain -> application`, `application ->
infrastructure/interface`, `client -> server` y sus evasiones por reexports/alias/
`import()`/`require`. Probar fixtures válidos e inválidos; no basta buscar substrings.

**TST-02:** unit tests DEBEN afirmar narrow mappings, zero secret export, disabled/no
side effects, stale evidence under commit, bindings, cleanup y output compatibility.
Mocks de native adapters no deben fabricar acceso permitido por default para esconder
la ausencia de políticas. Caracterizar guards/hooks con request doubles explícitos.

### 11.2 Trazabilidad a tests reales y nuevas obligaciones

Los nombres siguientes existen en el checkout base. Los HTTP/migration tests incluyen
fixtures SQLite/HTTP reales ejecutadas por la suite actual en proceso. Listarlos no
los convierte en evidencia aislada de use-cases ni en certificación de DB multiproceso. Tras el split, conservar su intención y añadir double-based
unit tests para las obligaciones pendientes.

| Requisitos/escenarios | Evidencia existente (archivo y nombre exacto representativo)                                                                                                   | Nueva prueba unitaria requerida                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| APP/HTTP, SC-01–03    | `auth-http.test.ts`: `does not enumerate accounts and denies disabled native and plugin routes`                                                                | Direct use-case disabled antes de cualquier adapter; stable mapper |
| TX-04/05, SC-20       | `credential-transaction.test.ts`: `binds credential lock values on the %s native transaction`                                                                  | req propagation/recheck y cleanup sin session registry leak        |
| SEC-03–06, SC-04–06   | `otp-flow.test.ts`: `storage failures deny access and failed delivery neither resets budgets nor claims receipt`                                               | Semántica same tras crypto/storage port extraction                 |
| SEC-04, SC-05         | `otp-flow.test.ts`: `an issued login proof cannot authorize a replacement account with the same email`                                                         | Cambio version/account entre read y commit                         |
| SEC-07, SC-08         | `ownership-application.test.ts`: `ownership recovery cannot grant a password to missing, deleted, passwordless or unknown native credential state`             | Evidence mapper reemplaza hash/salt sin perder unknown             |
| SEC-04, SC-09         | `ownership-application.test.ts`: `email reauthentication requires a verified exact principal and binds its existing SID, including explicit password addition` | Principal/SID stale en commit; caller interno no bypass            |
| SEC-08, SC-10–11      | `legacy-verification.test.ts`: `legacy email ownership binds existing credential evidence without granting password or session authority`                      | Native adapter double mutations/rollback y burned proof            |
| SEC-14, SC-03/07      | `password-lifecycle.test.ts`: `new passwords reject the versioned compromised corpus and count Unicode characters, not artificial composition`                 | Codec equivalencia TTL/AAD sin Node crypto en use-case             |
| SEC-09, SC-12–13      | `oauth-application.test.ts`: `a matching verified Google email never authorizes a local account without explicit linking`                                      | finish commit uniqueness/version y no session en failure           |
| SEC-04/05, SC-13      | `oauth-application.test.ts`: `expires correlation after ten minutes and burns provider failures without account effects`                                       | Orden consume/exchange/finish tras port extraction                 |
| SEC-10, SC-15         | `email-identity-http.test.ts`: `requires both explicit trusted Local API provisioning flags and rejects REST/GraphQL-origin forwarding`                        | Hooks adapter con doubles para tres condiciones/origen             |
| SEC-11, SC-16         | `admin-policy.test.ts`: `runs original eligibility exactly once for the shared UI/resource decision`                                                           | verify-email no eleva admin y authorize failure cerrado            |
| SEC-13, SC-17         | `migration-http.test.ts`: `cutover preserves account issuance budgets and each repeat chooses a fresh generation`                                              | Cutover orchestration/adapter doubles sin reset budgets            |
| CLI, SC-18            | `password-continuation.test.tsx`: `transient unavailable storage preserves the limited proof and editable password for retry`                                  | Solo authService hace HTTP, hooks sin fetch duplicado              |
| CMP, SC-19            | `plugin-config.test.ts`: `does not mutate collection settings or observe caller mutations after constructing a factory`                                        | Dos scopes instancias y surfaces sin transitive secret imports     |
| ARC/TST               | ESLint existente; `build-imports.test.ts`: `emits JSON import attributes for native Node rather than relying on Next bundling`                                 | Architecture graph con casos negativos y export surface parity     |

**Límite de evidencia:** no afirmar interoperabilidad runtime, locks multi-process,
semántica física de rollback SQLite/PostgreSQL, cookies reales ni accesibilidad humana
por estas pruebas. La refactorización puede certificar estructura y equivalencia
unitaria; no una nueva certificación de despliegue del consumidor. Si se modifica una
semántica nativa que doubles no pueden demostrar, el riesgo queda visible y exige una
decisión separada, no reactivar Chromium/integraciones contra la solicitud del usuario.

### 11.3 Compatibilidad y rollback

**COMP-01:** DEBEN permanecer names/signatures/entrypoints existentes, configuración
serializable, rutas/métodos/status/wire unions, cookie semantics, schema nativo/private
security tables, proof formats, namespaces, TTL, corpus y ownership evidence. No
`export *`; mantener exports explícitos y sus tests estáticos de superficie.

**COMP-02:** rollback de código revierte un slice completo compatible; nunca revive
permits/correlations/sessions ni baja generation. Un backup pre-cutover exige el
procedimiento existente de maintenance/re-cutover antes de retomar writers. Esta
refactorización no ejecuta cutover, producción, commit o push por sí misma.

### 11.4 Checklist de conformidad final

- [ ] Aprobación y autoridad documental plugin-specific registradas.
- [ ] Todas las entradas de §4 tienen owner y están caracterizadas.
- [ ] Ningún workflow o HTTP status vive en dominio.
- [ ] Application no conoce Payload/SQL/HTTP/React/Node crypto.
- [ ] Repositories devuelven evidencia seleccionada, no documentos/secretos.
- [ ] Ports operacionales conservan native auth y unidad de commit.
- [ ] Same req, locks, stale checks, consumption y finally conservados.
- [ ] Endpoints no poseen política ni ensamblan concrete stores.
- [ ] Cliente tiene un solo owner HTTP; hooks/context fuera de application.
- [ ] Composition aislada por plugin/request; disabled completamente inert.
- [ ] Native hooks/guards/admin y cutover no crean bypasses paralelos.
- [ ] API/wire/schema/proof/exports conservados; shims transicionales retirados.
- [ ] SC-01–20 cubiertos por unit tests/doubles con límites explícitos.
- [ ] Grafo enforced; gates unit/static verdes; sin Chromium ni E2E.
- [ ] Docs describen estado implementado real, no árbol objetivo por adelantado.

## Próxima decisión

Aprobar esta adaptación y empezar S0/S1; no adoptar la frontera de collection ni los
tipos AOP del consumidor. Separar política **sin dividir los commits nativos** es la
restricción central: los folders son una consecuencia, no la prueba de Clean.
