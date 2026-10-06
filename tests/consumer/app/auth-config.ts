import { authLoginPlugin } from '@main12/auth-login'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'

const port = Number(process.env.AUTH_CONSUMER_PORT)
export const plugin = authLoginPlugin({ collection: 'customers', apiPrefix: '/backend', authEndpointPrefix: '/access', passwordLogin: true, otpLogin: false, providers: { google: false }, allowSignup: false, recovery: false, modalLogin: true, logo: '/brand.svg', session: { maxAge: 60 } })
export const config = buildConfig({
  secret: 'consumer-only-private-secret-not-production', cookiePrefix: 'consumer',
  serverURL: `http://127.0.0.1:${port}`, routes: { api: '/backend' },
  csrf: [`http://127.0.0.1:${port}`], cors: [`http://127.0.0.1:${port}`],
  telemetry: false, db: sqliteAdapter({ client: { url: `file:${process.cwd()}/consumer.db` }, push: true }),
  collections: [{ slug: 'customers', auth: { verify: true, useSessions: true, tokenExpiration: 7200, removeTokenFromResponses: true, cookies: { sameSite: 'Lax' } }, access: { read: ({ req }) => Boolean(req.user), create: () => false }, fields: [] }],
  plugins: [plugin],
  onInit: async payload => {
    const users = await payload.find({ collection: 'customers', where: { email: { equals: 'browser@example.com' } }, overrideAccess: true })
    if (!users.docs.length) await payload.create({ collection: 'customers', data: { email: 'browser@example.com', password: 'actual-browser-test-password', _verified: true }, disableVerificationEmail: true, overrideAccess: true, context: { authLoginCredentialProvisioning: true } })
  },
})
