import { selectEmailLocale } from '../domain/emailPresentation'
import { otpEndpoints } from '../interface/http/otpLogin'
import { createOwnershipOtpEndpoint } from './ownership'
import { randomBytes } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import type { OtpOptions, PublicAuthConfig } from '../../config'
import { createOtpLogin } from '../application/use-cases/otpLogin'
import { createOtpProtocol } from '../application/use-cases/otpProtocol'
import { createOtpCodec } from '../infrastructure/crypto/otpCodec'
import { createNativeOtpLogin } from '../infrastructure/payload/otpLogin'
import { createOtpLedger } from '../infrastructure/payload/otpLedger'
import { createPayloadOtpStore } from '../server/otpStore'
import { readCutoverGeneration } from '../server/cutoverGeneration'
import { otpEmail } from '../server/otpEmail'
import { AuthOperationFailure } from '../domain/errors'

export function createOtpLoginScope(
  settings: Pick<PublicAuthConfig, 'collection' | 'otpLogin'>,
  req: PayloadRequest,
  options?: OtpOptions,
  assertOriginalAdminDenied?: (req: PayloadRequest) => Promise<void>,
) {
  settings = Object.freeze({ ...settings })
  options = captureOtpOptions(options)
  let started = false
  let adapter: ReturnType<typeof createNativeOtpLogin> | undefined
  const flow = createOtpLogin({
    enabled: settings.otpLogin && !!options,
    flow: async () => {
      if (started) throw new AuthOperationFailure('AUTH_UNAVAILABLE')
      started = true
      try {
        const generation = await readCutoverGeneration(req, settings.collection)
        adapter = createNativeOtpLogin(
          req,
          settings.collection,
          generation,
          assertOriginalAdminDenied,
        )
        return createOtpProtocol({
          ...options!,
          now: options!.now ?? Date.now,
          purpose: 'login',
          collection: settings.collection,
          challengeGeneration: generation,
          codec: createOtpCodec(options!.secret),
          ledger: createOtpLedger(createPayloadOtpStore(req)),
          findAccount: adapter.findAccount,
          quotaIdentity: adapter.quotaIdentity,
          session: adapter.session,
          deliver: async ({ email, code }) => {
            const locale = req.headers.get('accept-language')
            const mail = otpEmail(code, {
              ...options!.email!,
              locale: selectEmailLocale(locale, options!.email!.locale),
            })
            await req.payload.sendEmail({
              to: email,
              ...(options!.email ? { from: options!.email.from } : {}),
              ...mail,
            })
          },
          event: (event, correlation) =>
            req.payload.logger.info({ event: `auth.otp.${event}`, correlation }),
        })
      } catch (error) {
        try {
          req.payload.logger.info({
            event: 'auth.otp.unavailable',
            correlation: randomBytes(32).toString('hex'),
          })
        } catch {
          /* Logging cannot grant authority. */
        }
        throw error
      }
    },
  })
  return {
    ...flow,
    takeReceipt: () => {
      if (!adapter) throw new AuthOperationFailure('AUTH_UNAVAILABLE')
      return adapter.takeReceipt()
    },
    dispose: () => {
      started = true
      adapter?.dispose()
    },
  }
}

export function createOtpEndpoints(
  settings: PublicAuthConfig,
  options?: OtpOptions,
  assertOriginalAdminDenied?: (req: PayloadRequest) => Promise<void>,
) {
  const config = Object.freeze({ ...settings })
  const privateOptions = captureOtpOptions(options)
  return otpEndpoints(
    config,
    privateOptions,
    (req) => createOtpLoginScope(config, req, privateOptions, assertOriginalAdminDenied),
    (action, input, req) =>
      createOwnershipOtpEndpoint(
        config,
        privateOptions!,
        action,
        input,
        assertOriginalAdminDenied,
      ).handler(req),
  )
}

function captureOtpOptions(options?: OtpOptions) {
  return options
    ? Object.freeze({
        ...options,
        email: options.email
          ? Object.freeze({
              ...options.email,
              colors: options.email.colors ? Object.freeze({ ...options.email.colors }) : undefined,
            })
          : undefined,
      })
    : undefined
}
