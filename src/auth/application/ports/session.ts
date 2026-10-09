import type { CredentialCapabilities } from '../../domain/credentials'

/** Bound to the authenticated principal by composition; callers cannot select an account. */
export interface OwnCapabilities {
  readOwn(): Promise<CredentialCapabilities>
}

/** Native refresh owns session mutation/revocation; the application sees only expiry. */
export interface NativeRefresh {
  refresh(): Promise<{ expiresAt: number }>
}
