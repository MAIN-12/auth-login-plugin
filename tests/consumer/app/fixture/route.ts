// Only copied into the disposable acceptance app; never part of the published package.
import { createPayloadRequest, getPayload } from 'payload'
import { config, capturedLogs, fixture, inbox } from '../auth-config'
export async function GET(request: Request) {
  if (
    process.env.AUTH_CONSUMER_OTP !== '1' &&
    process.env.AUTH_CONSUMER_PASSWORD !== '1' &&
    process.env.AUTH_CONSUMER_OAUTH !== '1' &&
    process.env.AUTH_CONSUMER_ISSUE05 !== '1' &&
    process.env.AUTH_CONSUMER_ISSUE06 !== '1'
  )
    return new Response(null, { status: 404 })
  if (new URL(request.url).searchParams.get('storage') === '1') {
    const payload = await getPayload({ config })
    const db = payload.db as unknown as {
      name: string
      drizzle: unknown
      execute: (args: { db: unknown; raw: string }) => Promise<{ rows: Record<string, unknown>[] }>
    }
    if (db.name !== 'sqlite') return Response.json({ adapter: db.name })
    const journal = await db.execute({ db: db.drizzle, raw: 'PRAGMA journal_mode' })
    const timeout = await db.execute({ db: db.drizzle, raw: 'PRAGMA busy_timeout' })
    return Response.json({
      adapter: db.name,
      journalMode: journal.rows[0].journal_mode,
      busyTimeout: timeout.rows[0].timeout,
    })
  }
  const legacyScope = new URL(request.url).searchParams.get('legacyOtpScope')
  if (legacyScope && process.env.AUTH_CONSUMER_ISSUE06 === '1') {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'auth-otps',
      where: { collection: { equals: legacyScope } },
      overrideAccess: true,
    })
    return Response.json({ count: result.totalDocs })
  }
  const email = new URL(request.url).searchParams.get('email')
  if (email) {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'customers',
      where: { email: { equals: email } },
      overrideAccess: true,
      showHiddenFields: process.env.AUTH_CONSUMER_OAUTH === '1',
    })
    return Response.json({
      users: docs.map((user) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        verified: user._verified,
        ...(process.env.AUTH_CONSUMER_OAUTH === '1' ? { sessions: user.sessions } : {}),
      })),
    })
  }
  return Response.json({
    requestOrigin: new URL(request.url).origin,
    requestHost: request.headers.get('host'),
    inbox,
    logs: capturedLogs,
    now: fixture.now,
    loginBarrier: fixture.loginBarrier,
    hooks: fixture.hooks,
  })
}
export async function POST(request: Request) {
  if (
    process.env.AUTH_CONSUMER_OTP !== '1' &&
    process.env.AUTH_CONSUMER_PASSWORD !== '1' &&
    process.env.AUTH_CONSUMER_OAUTH !== '1' &&
    process.env.AUTH_CONSUMER_ISSUE05 !== '1' &&
    process.env.AUTH_CONSUMER_ISSUE06 !== '1'
  )
    return new Response(null, { status: 404 })
  const body = await request.json()
  if (
    body.migrationLegacyEmail === 'browser-legacy@example.com' &&
    process.env.AUTH_CONSUMER_ISSUE06 === '1'
  ) {
    const payload = await getPayload({ config })
    await payload.create({
      collection: 'customers',
      data: {
        email: body.migrationLegacyEmail,
        password: 'legacy password remains unchanged',
        _verified: false,
      },
      disableVerificationEmail: true,
      overrideAccess: true,
      context: { authLoginCredentialProvisioning: true },
    })
    return Response.json({ created: true })
  }
  if (typeof body.armLogin === 'string' && process.env.AUTH_CONSUMER_PASSWORD === '1') {
    const payload = await getPayload({ config })
    const actualUpdate = payload.db.updateOne.bind(payload.db)
    fixture.loginBarrier = { email: body.armLogin, entered: false, released: false }
    // Instrument scheduling only, not authentication/storage results: forward exact args to the real adapter.
    payload.db.updateOne = async (args) => {
      const barrier = fixture.loginBarrier
      if (
        barrier &&
        !barrier.entered &&
        args.collection === 'customers' &&
        args.data.email === barrier.email &&
        Array.isArray(args.data.sessions) &&
        args.req?.url?.includes('/access/login')
      ) {
        barrier.entered = true
        const deadline = Date.now() + 30000
        while (!barrier.released && Date.now() < deadline)
          await new Promise((resolve) => setTimeout(resolve, 20))
        if (!barrier.released) throw new Error('fixture login barrier timed out')
      }
      return actualUpdate(args)
    }
    return Response.json({ armed: true })
  }
  if (body.releaseLogin && fixture.loginBarrier) {
    fixture.loginBarrier.released = true
    return Response.json({ released: true })
  }
  if (typeof body.deleteEmail === 'string' && process.env.AUTH_CONSUMER_PASSWORD === '1') {
    const payload = await getPayload({ config })
    await payload.delete({
      collection: 'customers',
      where: { email: { equals: body.deleteEmail } },
      overrideAccess: true,
    })
    return Response.json({ deleted: true })
  }
  if (body.replaceEmail === 'replacement@example.com') {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'customers',
      where: { email: { equals: body.replaceEmail } },
      overrideAccess: true,
    })
    const original = docs[0]
    await payload.update({
      collection: 'customers',
      id: original.id,
      data: { email: 'displaced-replacement@example.com', _verified: false },
      overrideAccess: true,
      context: { authLoginCredentialProvisioning: true },
    })
    const replacement = await payload.create({
      collection: 'customers',
      data: { email: body.replaceEmail, password: 'actual-browser-test-password', _verified: true },
      disableVerificationEmail: true,
      overrideAccess: true,
      context: { authLoginCredentialProvisioning: true },
    })
    return Response.json({ originalID: original.id, replacementID: replacement.id })
  }
  for (const key of [
    'denyOriginalAdmin',
    'failOriginalAdmin',
    'denyAccountRead',
    'denyRoleRead',
    'denyProtectedRead',
    'injectPublicAdmin',
    'maskPublicAdminRole',
  ] as const)
    if (typeof body[key] === 'boolean') fixture[key] = body[key]
  if (typeof body.adminUnavailable === 'boolean') fixture.adminUnavailable = body.adminUnavailable
  if (typeof body.adminEligible === 'boolean') fixture.adminEligible = body.adminEligible
  if (
    body.sessionLifetime &&
    process.env.AUTH_CONSUMER_OAUTH === '1' &&
    [1, 600].includes(body.sessionLifetime)
  ) {
    const payload = await getPayload({ config })
    payload.collections.customers.config.auth.tokenExpiration = body.sessionLifetime
  }
  if (body.localAccess && process.env.AUTH_CONSUMER_OAUTH === '1') {
    const payload = await getPayload({ config })
    const req = await createPayloadRequest({ config, request })
    if (body.localAccess === 'copied-principal' && req.user)
      req.user = { ...req.user, role: 'admin' }
    try {
      const result = await payload.find({
        collection: 'administrative-records',
        ...(body.localAccess === 'user-only' ? { user: req.user } : { req }),
        overrideAccess: body.localAccess === 'trusted',
      })
      return Response.json({ count: result.docs.length })
    } catch {
      return new Response(null, { status: 403 })
    }
  }
  if (Number.isSafeInteger(body.now)) fixture.now = body.now
  if (typeof body.failCredentialWrite === 'boolean')
    fixture.failCredentialWrite = body.failCredentialWrite
  if (typeof body.failMail === 'boolean') fixture.failMail = body.failMail
  return Response.json({ now: fixture.now })
}
