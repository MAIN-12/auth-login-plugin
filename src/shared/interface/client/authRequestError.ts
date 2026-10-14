import type { AuthErrorCode, AuthErrorReason } from '../../domain/errors'
export class AuthRequestError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly status: number,
    public readonly reason?: AuthErrorReason,
    public readonly requestId?: string,
  ) {
    super(code)
  }
}
