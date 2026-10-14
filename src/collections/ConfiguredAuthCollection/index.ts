/** Server seam for the externally supplied configured auth collection.
 * This owner registers no collection/table; the consumer supplies its CollectionConfig. */
export {
  setAuthenticationEvidence,
  authenticationEvidenceCleanup,
  clearAuthenticationEvidence,
  getAuthenticationEvidence,
  createAdminPolicy,
} from './infrastructure/payload/adminPolicy'
export { createOwnCapabilitiesRepository } from './infrastructure/payload/credentialEvidence'
export {
  beginCredentialIntent,
  clearCredentialIntent,
  guardCredentialIntent,
  assertCredentialIntent,
} from './infrastructure/payload/credentialIntent'
export {
  reauthenticationRequests,
  credentialRequests,
  credentialVersion,
} from './infrastructure/payload/credentialRequest'
export { credentialTransaction } from './infrastructure/payload/credentialTransaction'
export { createNativePasswordAuth } from './infrastructure/payload/nativePasswordAuth'
export {
  isOtpSessionRequest,
  createOtpSession,
  installNativeSessionCoordination,
} from './infrastructure/payload/otpSession'
export { findOwnershipAccount } from './infrastructure/payload/ownershipAccount'
export {
  beginReauthenticationEvidence,
  clearReauthenticationEvidence,
  sealReauthenticationEvidence,
  readReauthenticationProof,
  settleReauthenticationTransaction,
} from './infrastructure/payload/reauthenticationEvidence'
export {
  clearSessionPolicyRequest,
  createSessionPolicy,
} from './infrastructure/payload/sessionPolicy'
export {
  findNativeAccountById,
  findNativeAccountByEmail,
} from './infrastructure/queries/nativeAccounts'
export {
  createVerifiedPasswordAccount,
  updateAccountPassword,
  verifyAccountEmail,
  persistNativeSessions,
  clearProviderAccountPassword,
} from './infrastructure/repositories/accountCredentials'
export { lockUserRow } from './infrastructure/repositories/userRowLock'
export type { AuthenticationEvidence, AdminOptions } from './infrastructure/payload/adminPolicy'
