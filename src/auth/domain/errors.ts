export type AuthErrorCode =
  | 'INVALID_INPUT'
  | 'AUTH_FAILED'
  | 'METHOD_DISABLED'
  | 'UNAUTHENTICATED'
  | 'AUTH_UNAVAILABLE'
  | 'ORIGIN_DENIED'

/** Semantic failure; transport status belongs to the interface. */
export class AuthOperationFailure extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(code)
  }
}
