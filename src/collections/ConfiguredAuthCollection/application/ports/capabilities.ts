import type { CredentialCapabilities } from '../../domain'
/** A bound principal scope; callers cannot select an account. */
export interface OwnCapabilities {
  readOwn(): Promise<CredentialCapabilities>
}
