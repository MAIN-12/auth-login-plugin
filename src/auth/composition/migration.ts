import type { Payload, Where } from 'payload'
import { createAuthLoginMigration } from '../application/use-cases/migrateAuthLogin'
import { createMaintenanceCommit } from '../infrastructure/payload/maintenance'
export interface AuthLoginMigrationOptions {
  collection: string
  /** Operator attestation only: stop ALL instances/workers/writers before calling. */
  maintenance: true
  /** Explicit host inventory. An empty filter is safe only for a dedicated legacy collection. */
  legacyOtpCollection?: { slug: string; where: Where }
}
/** Public offline API, same signature/report and native cutoff boundary. */
export async function migrateAuthLogin(payload: Payload, options: AuthLoginMigrationOptions) {
  const inventory = options.legacyOtpCollection
  const validFilter =
    !!inventory?.where && typeof inventory.where === 'object' && !Array.isArray(inventory.where)
  const where = validFilter ? structuredClone(inventory!.where) : undefined
  const migrate = createAuthLoginMigration(createMaintenanceCommit(payload, where))
  return migrate({
    collection: options.collection,
    maintenance: options.maintenance,
    ...(inventory ? { legacyOtpCollection: { slug: inventory.slug, validFilter } } : {}),
  })
}
