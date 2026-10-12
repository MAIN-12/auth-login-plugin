export type { OwnCapabilities } from '../../../collections/ConfiguredAuthCollection/application'

/** Native refresh owns session mutation/revocation; the application sees only expiry. */
export interface NativeRefresh {
  refresh(): Promise<{ expiresAt: number }>
}
