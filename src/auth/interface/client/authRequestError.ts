import type { AuthErrorCode } from '../../domain/errors'
export class AuthRequestError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly status: number,
  ) {
    super(code)
  }
}
