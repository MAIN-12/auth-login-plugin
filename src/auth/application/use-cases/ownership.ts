import type {
  OwnershipSendCommand,
  OwnershipVerifyCommand,
  PasswordCompletionCommand,
  PasswordReauthenticationCommand,
} from '../models'
import { AuthOperationFailure } from '../../domain/errors'
import { isPasswordValid } from '../../domain/passwordRules'
import { parseOtpInput } from '../../domain/otpRules'
import type { OtpProtocol } from '../ports/otp'
import type {
  CredentialCommit,
  NativeReauthentication,
  OwnershipPrincipal,
  OwnershipProof,
  PasswordPermit,
  PasswordPermits,
  PermitGrant,
} from '../ports/ownership'

export interface OwnershipSettings {
  password: boolean
  signup: boolean
  recovery: boolean
  otpReauthentication: boolean
}
/** Shared admission and commands for HTTP and internal callers, before any native effects. */
export function createOwnershipPolicy(dependencies: {
  settings: OwnershipSettings
  principal: OwnershipPrincipal | null
  protocol: (
    purpose: OwnershipProof['purpose'],
  ) => Promise<OtpProtocol<PermitGrant | { success: true }>>
  permits: PasswordPermits
  commit: CredentialCommit
  nativeReauthenticate: NativeReauthentication
}) {
  const settings = Object.freeze({ ...dependencies.settings })
  const principal = dependencies.principal ? Object.freeze({ ...dependencies.principal }) : null
  function admitMethod(purpose: OwnershipProof['purpose'], otp: boolean) {
    if (purpose === 'verify-email') return
    if (purpose === 'reauth') {
      if (otp ? !settings.otpReauthentication : !settings.password)
        throw new AuthOperationFailure('METHOD_DISABLED')
      return
    }
    if (!settings.password || (purpose === 'signup' ? !settings.signup : !settings.recovery))
      throw new AuthOperationFailure('METHOD_DISABLED')
  }
  function admit(purpose: OwnershipProof['purpose'], otp: boolean) {
    admitMethod(purpose, otp)
    if (purpose === 'reauth' && !principal?.sid) throw new AuthOperationFailure('UNAUTHENTICATED')
  }
  function admitCompletion(purpose: PasswordPermit['purpose']) {
    admitMethod(purpose, false)
    if (purpose === 'reauth' && !principal) throw new AuthOperationFailure('METHOD_DISABLED')
  }
  function purposeOf(input: unknown): OwnershipProof['purpose'] {
    const purpose = (input as { purpose?: unknown } | null)?.purpose
    if (!['signup', 'recovery', 'reauth', 'verify-email'].includes(String(purpose)))
      throw new AuthOperationFailure('INVALID_INPUT')
    return purpose as OwnershipProof['purpose']
  }
  return {
    admitMethod,
    admitCompletion,
    async send(input: OwnershipSendCommand, origin: string | null) {
      const purpose = purposeOf(input)
      admit(purpose, true)
      parseOtpInput(input, false, purpose)
      return (await dependencies.protocol(purpose)).send(input, origin)
    },
    async verify(input: OwnershipVerifyCommand) {
      const purpose = purposeOf(input)
      admit(purpose, true)
      parseOtpInput(input, true, purpose)
      return (await dependencies.protocol(purpose)).verify(input)
    },
    async complete(purpose: PasswordPermit['purpose'], input: PasswordCompletionCommand) {
      admitCompletion(purpose)
      if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new AuthOperationFailure('INVALID_INPUT')
      const data = input
      if (
        Object.keys(data).some((key) => !['permit', 'password'].includes(key)) ||
        typeof data.permit !== 'string' ||
        data.permit.length > 2048 ||
        typeof data.password !== 'string' ||
        !isPasswordValid(data.password)
      )
        throw new AuthOperationFailure('INVALID_INPUT')
      return dependencies.commit(
        await dependencies.permits.read(purpose, data.permit),
        data.password,
      )
    },
    async reauthenticate(input: PasswordReauthenticationCommand) {
      admit('reauth', false)
      if (
        !input ||
        typeof input !== 'object' ||
        Array.isArray(input) ||
        Object.keys(input).some((key) => key !== 'password') ||
        typeof (input as { password?: unknown }).password !== 'string' ||
        !(input as { password: string }).password
      )
        throw new AuthOperationFailure('INVALID_INPUT')
      return dependencies.permits.grant(
        await dependencies.nativeReauthenticate((input as { password: string }).password),
      )
    },
  }
}
