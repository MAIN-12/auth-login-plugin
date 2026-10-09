import type { PasswordLoginCommand, Principal } from '../models'
export interface NativePasswordAuth {
  authenticate: (credentials: PasswordLoginCommand) => Promise<Principal>
}
