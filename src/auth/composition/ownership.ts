import type { Endpoint, PayloadRequest } from 'payload'
import type { OtpOptions, PublicAuthConfig } from '../../config'
import { createOwnershipPolicy } from '../application/use-cases/ownership'
import { createOwnershipVerification } from '../application/use-cases/ownershipVerification'
import { createOtpCodec } from '../infrastructure/crypto/otpCodec'
import { createPasswordPermitCodec } from '../infrastructure/crypto/passwordPermitCodec'
import { createOtpLedger } from '../infrastructure/payload/otpLedger'
import { createPayloadOtpStore } from '../server/otpStore'
import { permitSecretForGeneration, readCutoverGeneration } from '../server/cutoverGeneration'
import { findOwnershipAccount } from '../server/ownershipAccount'
import {
  commitPassword,
  passwordReauthentication,
  commitEmailVerification,
  grantOwnershipPermit,
} from '../server/passwordAdapter'
import { otpEmail } from '../server/otpEmail'
import { selectEmailLocale } from '../domain/emailPresentation'
import { AuthOperationFailure } from '../domain/errors'
import { ownershipOtpEndpoint, passwordEndpoints } from '../interface/http/ownership'

/** One command per request scope; native receipts never enter application outcomes. */
export function createOwnershipScope(
  settings: PublicAuthConfig,
  req: PayloadRequest,
  options?: OtpOptions,
  assertPublicAccount?: (req: PayloadRequest) => Promise<void>,
) {
  settings = Object.freeze({ ...settings })
  options = captureOptions(options)
  let active = true
  let used = false
  let receipt: Awaited<ReturnType<typeof commitPassword>> | undefined
  const principal =
    req.user?.collection === settings.collection
      ? { id: req.user.id, sid: req.user._sid ? String(req.user._sid) : undefined }
      : null
  let permitGeneration: string | undefined
  const codec = async () => {
    permitGeneration = await readCutoverGeneration(req, settings.collection)
    return createPasswordPermitCodec({
      collection: settings.collection,
      secret: permitSecretForGeneration(req.payload.secret, settings.collection, permitGeneration),
      now: options?.now,
    })
  }
  const assertCurrent = async (generation: string) => {
    if ((await readCutoverGeneration(req, settings.collection)) !== generation)
      throw new AuthOperationFailure('AUTH_FAILED')
  }
  const assertPrincipal = () => {
    if (
      !principal ||
      req.user?.collection !== settings.collection ||
      req.user.id !== principal.id ||
      req.user._sid !== principal.sid
    )
      throw new AuthOperationFailure('AUTH_FAILED')
  }
  const policy = createOwnershipPolicy({
    settings: {
      password: settings.passwordLogin,
      signup: settings.allowSignup,
      recovery: settings.recovery,
      otpReauthentication: settings.otpLogin && !!options,
    },
    principal,
    permits: {
      grant: (permit) =>
        grantOwnershipPermit(
          req,
          settings.collection,
          permit,
          async () => (await codec()).grant(permit),
          async () => {
            if (permit.purpose === 'reauth') assertPrincipal()
          },
        ),
      read: async (purpose, encoded) => (await codec()).read(purpose, encoded),
    },
    commit: async (permit, password) => {
      if (permitGeneration === undefined) throw new AuthOperationFailure('AUTH_FAILED')
      const generation = permitGeneration
      receipt = await commitPassword(
        req,
        settings.collection,
        permit,
        password,
        options?.now,
        assertPublicAccount,
        async () => {
          await assertCurrent(generation)
          if (permit.purpose === 'reauth') assertPrincipal()
        },
      )
      return { success: true }
    },
    nativeReauthenticate: (password) =>
      passwordReauthentication(req, settings.collection, password),
    protocol: async (purpose) => {
      if (!options) throw new AuthOperationFailure('METHOD_DISABLED')
      const generation = await readCutoverGeneration(req, settings.collection)
      return createOwnershipVerification({
        ...options,
        now: options.now ?? Date.now,
        collection: settings.collection,
        purpose,
        principal,
        challengeGeneration: generation,
        codec: createOtpCodec(options.secret),
        ledger: createOtpLedger(createPayloadOtpStore(req)),
        findOwnershipAccount: (email) => findOwnershipAccount(req, settings.collection, email),
        grant: async (proof) => {
          if ((await readCutoverGeneration(req, settings.collection)) !== generation)
            throw new AuthOperationFailure('AUTH_FAILED')
          return proof.purpose === 'verify-email'
            ? commitEmailVerification(req, settings.collection, proof, assertPublicAccount, () =>
                assertCurrent(generation),
              )
            : grantOwnershipPermit(
                req,
                settings.collection,
                { ...proof, purpose: proof.purpose },
                async () =>
                  (await codec()).grant({
                    ...proof,
                    purpose: proof.purpose as 'signup' | 'recovery' | 'reauth',
                  }),
                async () => {
                  await assertCurrent(generation)
                  if (proof.purpose === 'reauth') assertPrincipal()
                },
              )
        },
        deliver: async ({ email, code }) => {
          const mail = otpEmail(code, {
            ...options!.email!,
            locale: selectEmailLocale(req.headers.get('accept-language'), options!.email!.locale),
          })
          await req.payload.sendEmail({ to: email, from: options!.email!.from, ...mail })
        },
        event: (event, correlation) =>
          req.payload.logger.info({ event: `auth.${purpose}.${event}`, correlation }),
      })
    },
  })
  async function run<T>(work: () => Promise<T>) {
    if (!active || used) throw new AuthOperationFailure('AUTH_UNAVAILABLE')
    used = true
    return work()
  }
  return {
    admitMethod: policy.admitMethod,
    admitCompletion: policy.admitCompletion,
    send: (input: Parameters<typeof policy.send>[0], origin: string | null) =>
      run(() => policy.send(input, origin)),
    verify: (input: Parameters<typeof policy.verify>[0]) => run(() => policy.verify(input)),
    complete: (...args: Parameters<typeof policy.complete>) => run(() => policy.complete(...args)),
    reauthenticate: (input: Parameters<typeof policy.reauthenticate>[0]) =>
      run(() => policy.reauthenticate(input)),
    takeReceipt: () => {
      if (!active || !receipt) throw new AuthOperationFailure('AUTH_UNAVAILABLE')
      const value = receipt
      receipt = undefined
      return value
    },
    dispose: () => {
      active = false
      receipt = undefined
    },
  }
}
export function createOwnershipOtpEndpoint(
  settings: PublicAuthConfig,
  options: OtpOptions | undefined,
  action: string,
  parsed?: unknown,
  assertPublicAccount?: (req: PayloadRequest) => Promise<void>,
): Endpoint {
  const config = Object.freeze({ ...settings })
  const captured = captureOptions(options)
  return ownershipOtpEndpoint(
    config,
    captured,
    action,
    (req) => createOwnershipScope(config, req, captured, assertPublicAccount),
    parsed,
  )
}
export function createPasswordEndpoints(
  settings: PublicAuthConfig,
  options?: OtpOptions,
  assertPublicAccount?: (req: PayloadRequest) => Promise<void>,
): Endpoint[] {
  const config = Object.freeze({ ...settings })
  const captured = captureOptions(options)
  return passwordEndpoints(config, captured, (req) =>
    createOwnershipScope(config, req, captured, assertPublicAccount),
  )
}
function captureOptions(options?: OtpOptions) {
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
