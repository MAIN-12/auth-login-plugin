/** Compatibility path for unmigrated callers; retired in auth-clean 06. */
export { createOwnershipVerification } from '../contracts/ownershipCompatibility'
export type {
  OwnershipAccount,
  OwnershipPrincipal,
  OwnershipProof,
} from '../contracts/ownershipCompatibility'
