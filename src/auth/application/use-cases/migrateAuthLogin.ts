import type { MaintenanceCommit, MaintenanceIntent } from '../ports/maintenance'

/** Offline operator admission, never a manufactured HTTP principal. */
export function createAuthLoginMigration(port: MaintenanceCommit) {
  return async (intent: MaintenanceIntent) => {
    if (intent.maintenance !== true || !intent.collection)
      throw new Error(
        'auth-login: cutover requires maintenance and a supported native session/verification collection',
      )
    const inventory = intent.legacyOtpCollection
    if (
      inventory &&
      (!inventory.slug || inventory.slug === intent.collection || inventory.validFilter !== true)
    )
      throw new Error('auth-login: invalid explicit legacy OTP inventory')
    const { success, collection, accounts, legacyCodesDeleted, generation } =
      await port.commit(intent)
    return { success, collection, accounts, legacyCodesDeleted, generation }
  }
}
