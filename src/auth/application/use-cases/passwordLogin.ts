import { AuthOperationFailure } from '../../domain/errors'
import { parsePasswordCredentials } from '../../domain/passwordLoginRules'
import type { Outcome, PasswordLoginCommand, PasswordLoginResult } from '../models'
import type { NativePasswordAuth } from '../ports/nativePasswordAuth'

export function passwordLoginOperation<T>(dependencies: {
  enabled: boolean
  authenticate: (credentials: PasswordLoginCommand) => Promise<T>
}) {
  const { enabled, authenticate } = dependencies
  return async (input: PasswordLoginCommand): Promise<Outcome<T>> => {
    if (!enabled) return { ok: false, code: 'METHOD_DISABLED' }
    try {
      const credentials = parsePasswordCredentials(input)
      return { ok: true, value: await authenticate(credentials) }
    } catch (error) {
      return {
        ok: false,
        code: error instanceof AuthOperationFailure ? error.code : 'AUTH_UNAVAILABLE',
      }
    }
  }
}

export function createPasswordLogin(dependencies: NativePasswordAuth & { enabled: boolean }) {
  const operation = passwordLoginOperation(dependencies)
  return async (input: PasswordLoginCommand): Promise<Outcome<PasswordLoginResult>> => {
    const result = await operation(input)
    return result.ok ? { ok: true, value: { principal: result.value } } : result
  }
}
