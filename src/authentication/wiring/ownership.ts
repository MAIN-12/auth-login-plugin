import { permitSecretForGeneration } from '../infrastructure/crypto/methodPermitSecret'
import type { Endpoint, PayloadRequest } from 'payload'
import type { OtpOptions, PublicAuthConfig } from '../../configuration/plugin/config'
import { createOwnershipPolicy } from '../application/use-cases/ownership'
import { createOwnershipVerification } from '../application/use-cases/ownershipVerification'
import { createOtpCodec, resolveOtpSecret } from '../../collections/AuthLoginOtpSecurity/index'
import { createPasswordPermitCodec } from '../../collections/AuthLoginPasswordPermits/index'
import { createOtpLedger } from '../../collections/AuthLoginOtpSecurity/index'
import { createPayloadOtpStore } from '../../collections/AuthLoginOtpSecurity/index'
import { readCutoverGeneration } from '../../collections/AuthLoginCutovers/index'
import { findOwnershipAccount } from '../../collections/ConfiguredAuthCollection/index'
import {
  commitPassword,
  passwordReauthentication,
  commitEmailVerification,
  grantOwnershipPermit,
  type PasswordCommitStage,
} from '../infrastructure/payload/passwordAdapter'
import { renderOtpEmail } from '../infrastructure/payload/otpEmail'
import { selectEmailLocale } from '../../shared/domain/emailPresentation'
import { AuthOperationFailure } from '../../shared/domain/errors'
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
  let completionStage:
    | PasswordCommitStage
    | 'completion-policy'
    | 'permit-generation-read'
    | 'permit-read'
    | 'generation-check'
    | 'principal-check'
    | undefined
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
      read: async (purpose, encoded) => {
        if (completionStage) completionStage = 'permit-generation-read'
        const permits = await codec()
        if (completionStage) completionStage = 'permit-read'
        return permits.read(purpose, encoded)
      },
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
          const previousStage = completionStage
          if (completionStage) completionStage = 'generation-check'
          await assertCurrent(generation)
          if (permit.purpose === 'reauth') {
            if (completionStage) completionStage = 'principal-check'
            assertPrincipal()
          }
          completionStage = previousStage
        },
        completionStage
          ? (stage) => {
              completionStage = stage
            }
          : undefined,
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
        codec: createOtpCodec(resolveOtpSecret(options.secret, req.payload.secret)),
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
        deliver: async ({ email, code, expiresAt }) => {
          const mail = await renderOtpEmail(
            code,
            {
              ...options!.email!,
              locale: selectEmailLocale(req.headers.get('accept-language'), options!.email!.locale),
            },
            options!.emails,
            purpose === 'recovery' ? 'password-reset' : purpose,
            Math.max(0, Math.floor((expiresAt - (options!.now ?? Date.now)()) / 1000)),
            expiresAt,
          )
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
    complete: (...args: Parameters<typeof policy.complete>) => {
      if (args[0] !== 'signup') completionStage = 'completion-policy'
      return run(() => policy.complete(...args))
    },
    diagnosticStage: () => completionStage,
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
        emails: options.emails ? Object.freeze({ ...options.emails }) : undefined,
        email: options.email
          ? Object.freeze({
              ...options.email,
              colors: options.email.colors ? Object.freeze({ ...options.email.colors }) : undefined,
            })
          : undefined,
      })
    : undefined
}
