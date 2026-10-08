/** Compatibility entry point; remove in auth-clean 06 after caller audit. */
export {
  createAdminPolicy,
  setAuthenticationEvidence,
  getAuthenticationEvidence,
  clearAuthenticationEvidence,
} from '../infrastructure/payload/adminPolicy'
export type { AuthenticationEvidence, AdminOptions } from '../../adminOptions'
