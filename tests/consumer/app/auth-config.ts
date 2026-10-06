import { authLoginPlugin } from '@main12/auth-login'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { postgresAdapter } from '@payloadcms/db-postgres'
import type { SendEmailOptions } from 'payload'

// Next entry chunks can evaluate this module separately; the disposable process owns one fixture.
const fixtureGlobal = globalThis as typeof globalThis & { __otpAcceptance?: { now: number; failMail: boolean; inbox: SendEmailOptions[]; logs: string[] } }
export const fixture = fixtureGlobal.__otpAcceptance ??= { now: Date.now(), failMail: false, inbox: [], logs: [] }
export const inbox = fixture.inbox
export const capturedLogs = fixture.logs
const otpEnabled = process.env.AUTH_CONSUMER_OTP === '1'

const port = Number(process.env.AUTH_CONSUMER_PORT)
export const plugin = authLoginPlugin({
  collection: 'customers', apiPrefix: '/backend', authEndpointPrefix: '/access',
  passwordLogin: true, otpLogin: otpEnabled,
  ...(otpEnabled ? { otp: {
    secret: 'consumer-only-otp-secret-not-production',
    origin: () => 'trusted-loopback-fixture', now: () => fixture.now,
    cooldownSeconds: 1, accountLimit: 5, originLimit: 50,
    email: { from: 'auth@example.test', locale: 'en' as const },
  } } : {}),
  providers: { google: false }, allowSignup: false, recovery: false,
  modalLogin: true, logo: '/brand.svg', session: { maxAge: otpEnabled ? 600 : 60 },
})
export const config = buildConfig({
  secret: 'consumer-only-private-secret-not-production', cookiePrefix: 'consumer',
  serverURL: `http://127.0.0.1:${port}`, routes: { api: '/backend' },
  csrf: [`http://127.0.0.1:${port}`], cors: [`http://127.0.0.1:${port}`],
  ...(otpEnabled ? { logger: { options: { level: 'info' }, destination: { write: (chunk: string) => { capturedLogs.push(chunk) } } } } : {}),
  telemetry: false, db: process.env.AUTH_CONSUMER_DATABASE_URL ? postgresAdapter({ pool: { connectionString: process.env.AUTH_CONSUMER_DATABASE_URL }, push: process.env.AUTH_CONSUMER_SECONDARY !== '1' }) : sqliteAdapter({ client: { url: `file:${process.cwd()}/consumer.db` }, push: true }),
  email: () => ({ name: 'server-only-test-inbox', defaultFromAddress: 'auth@example.test', defaultFromName: 'Acceptance', sendEmail: async message => { if (fixture.failMail) throw new Error('fixture mail failure'); inbox.push({ ...message, date: new Date(fixture.now) }) } }),
  collections: [{ slug: 'customers', auth: { verify: true, useSessions: true, tokenExpiration: 7200, removeTokenFromResponses: true, cookies: { sameSite: 'Lax' } }, access: { admin: () => false, read: ({ req }) => Boolean(req.user), create: () => false }, fields: [] }],
  plugins: [plugin],
  onInit: async payload => {
    if (process.env.AUTH_CONSUMER_SECONDARY === '1') return
    for (const email of otpEnabled ? ['browser@example.com', 'race@example.com', 'attempts@example.com', 'ttl@example.com', 'mail@example.com', 'limit@example.com', 'password-race@example.com', 'logout-race@example.com', 'refresh-race@example.com', 'replacement@example.com'] : ['browser@example.com']) {
      const users = await payload.find({ collection: 'customers', where: { email: { equals: email } }, overrideAccess: true })
      if (!users.docs.length) await payload.create({ collection: 'customers', data: { email, password: 'actual-browser-test-password', _verified: true }, disableVerificationEmail: true, overrideAccess: true, context: { authLoginCredentialProvisioning: true } })
    }
  },
})
