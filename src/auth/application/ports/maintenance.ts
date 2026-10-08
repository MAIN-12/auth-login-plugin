/** Operator intent; query syntax and native request remain private to the adapter. */
export interface MaintenanceIntent {
  collection: string
  maintenance: true
  legacyOtpCollection?: { slug: string; validFilter: boolean }
}
export interface MaintenanceReport {
  success: true
  collection: string
  accounts: number
  legacyCodesDeleted: number
  generation: string
}
export interface MaintenanceCommit {
  commit(intent: MaintenanceIntent): Promise<MaintenanceReport>
}
