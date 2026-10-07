import { authLoginPlugin } from '@main12/auth-login'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { postgresAdapter } from '@payloadcms/db-postgres'
import type { SendEmailOptions } from 'payload'

// Next entry chunks can evaluate this module separately; the disposable process owns one fixture.
const fixtureGlobal = globalThis as typeof globalThis & { __otpAcceptance?: { now: number; failMail: boolean; failCredentialWrite: boolean; loginBarrier?: { email: string; entered: boolean; released: boolean }; inbox: SendEmailOptions[]; logs: string[]; allowSignup?: boolean; denyOriginalAdmin?: boolean; failOriginalAdmin?: boolean; adminUnavailable?: boolean; adminEligible?: boolean; hooks?: string[]; denyAccountRead?: boolean; denyRoleRead?: boolean; maskPublicAdminRole?: boolean; denyProtectedRead?: boolean; injectPublicAdmin?: boolean } }
export const fixture = fixtureGlobal.__otpAcceptance ??= { now: Date.now(), failMail: false, failCredentialWrite: false, inbox: [], logs: [] }
export const inbox = fixture.inbox
export const capturedLogs = fixture.logs
const integration = process.env.AUTH_CONSUMER_ISSUE05 === '1'
const oauthEnabled = process.env.AUTH_CONSUMER_OAUTH === '1' || integration
const lifecycle = process.env.AUTH_CONSUMER_PASSWORD === '1' || integration
const otpEnabled = process.env.AUTH_CONSUMER_OTP === '1' || lifecycle || oauthEnabled

const port = Number(process.env.AUTH_CONSUMER_PORT)
const callbackPort = Number(process.env.AUTH_CONSUMER_PRIMARY_PORT ?? port)
export const plugin = authLoginPlugin({
  collection: 'customers', apiPrefix: '/backend', authEndpointPrefix: '/access',
  passwordLogin: true, otpLogin: process.env.AUTH_CONSUMER_OTP === '1' || integration, ...(integration ? { basePath: '/members', locale: 'en' as const } : {}),
  ...(otpEnabled ? { otp: {
    secret: 'consumer-only-otp-secret-not-production',
    origin: () => 'trusted-loopback-fixture', now: () => fixture.now,
    cooldownSeconds: 1, accountLimit: 5, originLimit: 50,
    email: { from: 'auth@example.test', locale: 'en' as const, ...(integration ? { projectName: 'Consumer <Brand>', domain: 'https://consumer.example.test', contactEmail: 'help@consumer.example.test', contactUrl: 'https://consumer.example.test/contact' } : {}) },
  } } : {}),
  providers: { google: oauthEnabled ? { enabled: true, clientId: 'consumer-google-client', clientSecret: 'consumer-google-secret-private', redirectURI: `http://127.0.0.1:${callbackPort}/backend/access/oauth/google/callback`, customFetch: (input, init) => { const requested = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url); return fetch(`${process.env.AUTH_CONSUMER_OIDC_ISSUER}${requested.pathname}${requested.search}`, init) } } : false }, allowSignup: oauthEnabled ? process.env.AUTH_CONSUMER_SECONDARY !== '1' : lifecycle, recovery: lifecycle,
  ...(oauthEnabled ? { admin: { authorize: ({ req, evidence }) => { if (fixture.adminUnavailable) throw new Error('fixture unavailable policy'); return Boolean(fixture.adminEligible && req.user?.role === 'admin' && evidence.method !== 'otp') }, collections: [{ slug: 'administrative-records', operations: ['read', 'create', 'update', 'delete'] }] } } : {}),
  modalLogin: true, logo: '/brand.svg', session: { maxAge: otpEnabled ? 600 : 60 },
})
export const config = buildConfig({
  secret: 'consumer-only-private-secret-not-production', cookiePrefix: 'consumer',
  admin: { user: 'customers' }, serverURL: `http://127.0.0.1:${port}`, routes: { api: '/backend' },
  csrf: [`http://127.0.0.1:${port}`], cors: [`http://127.0.0.1:${port}`],
  ...(otpEnabled ? { logger: { options: { level: 'info' }, destination: { write: (chunk: string) => { capturedLogs.push(chunk) } } } } : {}),
  telemetry: false, db: process.env.AUTH_CONSUMER_DATABASE_URL ? postgresAdapter({ pool: { connectionString: process.env.AUTH_CONSUMER_DATABASE_URL }, push: process.env.AUTH_CONSUMER_SECONDARY !== '1' }) : sqliteAdapter({ client: { url: `file:${process.cwd()}/consumer.db` }, push: process.env.AUTH_CONSUMER_SECONDARY !== '1' }),
  email: () => ({ name: 'server-only-test-inbox', defaultFromAddress: 'auth@example.test', defaultFromName: 'Acceptance', sendEmail: async message => { if (fixture.failMail) throw new Error('fixture mail failure'); inbox.push({ ...message, date: new Date(fixture.now) }) } }),
  collections: [{ slug: 'customers', auth: { verify: true, useSessions: true, tokenExpiration: 7200, removeTokenFromResponses: true, cookies: { sameSite: 'Lax' } }, access: { admin: ({ req }) => { if (fixture.failOriginalAdmin) throw new Error('fixture original Admin unavailable'); return oauthEnabled && !fixture.denyOriginalAdmin && req.user?.role === 'admin' }, read: ({ req }) => Boolean(req.user) && !fixture.denyAccountRead, create: () => false }, fields: [{ name: 'role', type: 'text', defaultValue: 'customer', ...(oauthEnabled ? { access: { update: () => false, read: () => !fixture.denyRoleRead } } : {}) }], hooks: { afterLogin: [({ user }) => { if (oauthEnabled) (fixture.hooks ??= []).push(`afterLogin:${user.authLoginMethod ?? 'native'}`); return user }], afterRead: [({ doc }) => { if (oauthEnabled) (fixture.hooks ??= []).push('afterRead'); if (oauthEnabled && fixture.maskPublicAdminRole && doc.role === 'admin') return { ...doc, role: 'customer' }; return doc }], beforeChange: [({ data, operation }) => { if (oauthEnabled && fixture.injectPublicAdmin && operation === 'create') data.role = 'admin'; if (fixture.failCredentialWrite && data.password) throw new Error('fixture credential write failure'); return data }] } }, ...(oauthEnabled ? [{ slug: 'administrative-records', access: { read: () => !fixture.denyProtectedRead, create: () => true, update: () => true, delete: () => true }, fields: [{ name: 'name', type: 'text' as const }] }] : [])],
  plugins: [plugin],
  onInit: async payload => {
    if (process.env.AUTH_CONSUMER_SECONDARY === '1') return
    for (const email of otpEnabled ? ['browser@example.com', 'race@example.com', 'attempts@example.com', 'ttl@example.com', 'mail@example.com', 'limit@example.com', 'password-race@example.com', 'logout-race@example.com', 'refresh-race@example.com', 'replacement@example.com', 'pending-password@example.com'] : ['browser@example.com']) {
      const users = await payload.find({ collection: 'customers', where: { email: { equals: email } }, overrideAccess: true })
      if (!users.docs.length) await payload.create({ collection: 'customers', data: { email, password: 'actual-browser-test-password', _verified: true }, disableVerificationEmail: true, overrideAccess: true, context: { authLoginCredentialProvisioning: true } })
    }
    if (oauthEnabled) {
      const existing = await payload.find({ collection: 'administrative-records', overrideAccess: true })
      if (!existing.docs.length) await payload.create({ collection: 'administrative-records', data: { name: 'protected' }, overrideAccess: true })
      await payload.update({ collection: 'customers', where: { email: { equals: 'browser@example.com' } }, data: { role: 'admin' }, overrideAccess: true })
    }
    if (lifecycle) {
      for (const [email, password] of [['legacy@example.com', 'short'], ['passwordless@example.com', undefined]] as const) {
        const users = await payload.find({ collection: 'customers', where: { email: { equals: email } }, overrideAccess: true })
        if (!users.docs.length) {
          const user = await payload.create({ collection: 'customers', data: { email, password: password ?? 'discarded provisioning credential', _verified: true }, disableVerificationEmail: true, overrideAccess: true, context: { authLoginCredentialProvisioning: true } })
          if (!password) await payload.db.updateOne({ collection: 'customers', id: user.id, data: { ...user, hash: null, salt: null }, returning: false })
        }
      }
    }
  },
})
