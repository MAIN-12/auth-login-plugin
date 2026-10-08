import { createPasswordPermitCodec } from '../infrastructure/crypto/passwordPermitCodec'
import { AuthFailure } from './errors'
import { isPasswordValid } from '../domain/passwordRules'

import type { PasswordPermit } from '../application/ports/ownership'
export type { PasswordPermit } from '../application/ports/ownership'
/** Application policy; the native adapter owns the single commit boundary and stale-proof check. */
export function createPasswordLifecycle<T>(dependencies: {
  secret: string
  collection: string
  signup: boolean
  recovery: boolean
  password: boolean
  now?: () => number
  reauthentication?: boolean
  commit: (permit: PasswordPermit, password: string) => Promise<T>
}) {
  const codec = createPasswordPermitCodec(dependencies)
  const enabled = (purpose: PasswordPermit['purpose']) =>
    dependencies.password &&
    (purpose === 'signup'
      ? dependencies.signup
      : purpose === 'recovery'
        ? dependencies.recovery
        : true)
  const grant = (permit: PasswordPermit) => {
    if (
      permit.purpose === 'reauth'
        ? !(dependencies.reauthentication ?? dependencies.password)
        : !enabled(permit.purpose)
    )
      throw new AuthFailure('METHOD_DISABLED', 403)
    return codec.grant(permit)
  }
  async function complete(purpose: PasswordPermit['purpose'], input: unknown): Promise<T> {
    if (!enabled(purpose)) throw new AuthFailure('METHOD_DISABLED', 403)
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new AuthFailure('INVALID_INPUT', 400)
    const data = input as Record<string, unknown>
    if (
      Object.keys(data).some((key) => !['permit', 'password'].includes(key)) ||
      typeof data.permit !== 'string' ||
      data.permit.length > 2048 ||
      typeof data.password !== 'string' ||
      !isPasswordValid(data.password)
    )
      throw new AuthFailure('INVALID_INPUT', 400)
    return dependencies.commit(readPermit(purpose, data.permit), data.password)
  }
  const readPermit = codec.read
  return { grant, complete, readPermit }
}
