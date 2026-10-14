import type { PasswordCredentials, Principal } from '../../domain'
export interface NativePasswordAuth {
  authenticate: (credentials: PasswordCredentials) => Promise<Principal>
}
