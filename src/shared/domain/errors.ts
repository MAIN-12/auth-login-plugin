/** Safe public diagnostics: never derive reasons from raw exception messages. */
export const authErrorReasons = [
  'OAUTH_CALLBACK_INVALID',
  'OAUTH_STATE_INVALID',
  'GOOGLE_IDENTITY_REJECTED',
  'GOOGLE_EMAIL_UNVERIFIED',
  'GOOGLE_LINK_REQUIRED',
  'SIGNUP_DISABLED',
  'ACCOUNT_NOT_VERIFIED',
  'ACCOUNT_UNAVAILABLE',
  'ACCOUNT_LOGIN_DENIED',
  'ACCOUNT_STATE_CHANGED',
  'ACCOUNT_NOT_FOUND',
  'ACCOUNT_EMAIL_CHANGED',
  'ACCOUNT_CREDENTIALS_CHANGED',
  'GOOGLE_ASSOCIATION_NOT_PERSISTED',
  'GOOGLE_ASSOCIATION_CONFLICT',
  'AUTH_CONFIGURATION_CHANGED',
  'PUBLIC_ACCOUNT_PRIVILEGE_DENIED',
  'PUBLIC_ACCOUNT_STATE_INVALID',
  'SESSION_LOGIN_DENIED',
  'AUTHENTICATION_REJECTED',
  'AUTHENTICATION_UNAVAILABLE',
] as const
export type AuthErrorReason = (typeof authErrorReasons)[number]
export function safeAuthErrorReason(value: unknown): AuthErrorReason | undefined {
  return typeof value === 'string' && (authErrorReasons as readonly string[]).includes(value)
    ? (value as AuthErrorReason)
    : undefined
}

export type AuthErrorCode =
  | 'INVALID_INPUT'
  | 'AUTH_FAILED'
  | 'METHOD_DISABLED'
  | 'UNAUTHENTICATED'
  | 'AUTH_UNAVAILABLE'
  | 'ORIGIN_DENIED'

/** Semantic failure; transport status belongs to the interface. */
export class AuthOperationFailure extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly reason?: AuthErrorReason,
  ) {
    super(code)
  }
}
