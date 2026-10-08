import { AuthFailure, authStatus } from './errors'
import { AuthOperationFailure } from '../domain/errors'
import {
  parsePasswordCredentials as parseCredentials,
  type PasswordCredentials,
} from '../domain/passwordLoginRules'
import { passwordLoginOperation } from '../application/use-cases/passwordLogin'
export function parsePasswordCredentials(input: unknown): PasswordCredentials {
  try {
    return parseCredentials(input)
  } catch (error) {
    if (error instanceof AuthOperationFailure)
      throw new AuthFailure(error.code, authStatus[error.code])
    throw error
  }
}
/** Legacy generic signature; delegates all entry policy to the single owner. Retire in 06. */
export function createPasswordLogin<T>(dependencies: {
  enabled: boolean
  authenticate: (credentials: PasswordCredentials) => Promise<T>
}) {
  const login = passwordLoginOperation(dependencies)
  return async (input: unknown): Promise<T> => {
    const result = await login(input as PasswordCredentials)
    if (!result.ok) throw new AuthFailure(result.code, authStatus[result.code])
    return result.value
  }
}
