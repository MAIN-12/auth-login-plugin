## Guías de arquitectura

La autoridad local del plugin es [plugin-contracts.md](plugin-contracts.md). La adaptación auth-clean está aprobada únicamente para la tarea 01; [auth-clean-spec.md](architecture/auth-clean-spec.md) define su destino incremental. Las guías en `architecture/payload-clean/` son referencias históricas AOP, no contratos normativos de este paquete. No adoptar sus collections, aliases ni tipos generados literalmente.

## Vocabulario de arquitectura Payload

- **Collection owner**: la collection que posee una operación, documento o capacidad por lenguaje, invariantes y política operacional; no se decide por una relación Payload.
- **Application owner**: el caso de uso o application service que coordina orden, autorización de recurso, atomicidad, idempotencia y política de fallo de una intención.
- **Superficie pública de collection**: exports explícitos de `src/collections/<Collection>/index.ts`, consumidos desde `@/<Collection>` por otras collections. `@/<Collection>/<layer>` es interno.
- **Servicio integrado/transicional Payload-bound**: código que declara explícitamente su acoplamiento a Payload o tipos generados; no equivale a dominio puro ni a aplicación portable.
- **Adapter de entrada**: hook, endpoint, job, cron o handler que valida entrada, invoca un caso de uso/query y traduce salida/errores; no posee workflow de negocio.
- **Servicio de cliente**: wrapper frontend/HTTP de una collection consumido por React hooks; no es un lifecycle hook de Payload ni vive en `interface/hooks/`.
