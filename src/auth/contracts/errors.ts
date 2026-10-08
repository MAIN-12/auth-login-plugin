import type { AuthErrorCode } from '../domain/errors'
export type { AuthErrorCode } from '../domain/errors'
export interface AuthErrorResponse {
  success: false
  code: AuthErrorCode
}
/** Legacy transport failure retained for unmigrated flows through task 06. */
export class AuthFailure extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly status: number,
  ) {
    super(code)
  }
}
export const authStatus: Record<AuthErrorCode, number> = {
  INVALID_INPUT: 400,
  AUTH_FAILED: 401,
  METHOD_DISABLED: 403,
  UNAUTHENTICATED: 401,
  AUTH_UNAVAILABLE: 503,
  ORIGIN_DENIED: 403,
}
