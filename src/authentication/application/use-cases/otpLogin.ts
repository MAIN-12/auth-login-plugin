import { AuthOperationFailure } from '../../../shared/domain/errors'
import { parseOtpInput } from '../../../collections/AuthLoginOtpSecurity/domain'
import type { OtpSendCommand, OtpVerifyCommand, Outcome, Principal } from '../models'
import type { OtpProtocol } from '../../../collections/AuthLoginOtpSecurity/application'

export function createOtpLogin(dependencies: {
  enabled: boolean
  flow: () => Promise<OtpProtocol<Principal>>
}) {
  const { enabled, flow } = dependencies
  async function run<T>(
    input: unknown,
    verify: boolean,
    work: (protocol: OtpProtocol<Principal>) => Promise<T>,
  ): Promise<Outcome<T>> {
    if (!enabled) return { ok: false, code: 'METHOD_DISABLED' }
    try {
      parseOtpInput(input, verify, 'login')
      return { ok: true, value: await work(await flow()) }
    } catch (error) {
      return {
        ok: false,
        code: error instanceof AuthOperationFailure ? error.code : 'AUTH_UNAVAILABLE',
      }
    }
  }
  return {
    send: (input: OtpSendCommand, origin: string | null) =>
      run(input, false, (protocol) => protocol.send(input, origin)),
    verify: (input: OtpVerifyCommand) => run(input, true, (protocol) => protocol.verify(input)),
  }
}
