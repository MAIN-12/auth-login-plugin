// Only copied into the disposable acceptance app; never part of the published package.
import { getPayload } from 'payload'
import { config, capturedLogs, fixture, inbox } from '../auth-config'
export async function GET(request: Request) {
  if (process.env.AUTH_CONSUMER_OTP !== '1' && process.env.AUTH_CONSUMER_PASSWORD !== '1') return new Response(null, { status: 404 })
  const email = new URL(request.url).searchParams.get('email')
  if (email) {
    const payload = await getPayload({ config, key: 'browser-consumer' })
    const { docs } = await payload.find({ collection: 'customers', where: { email: { equals: email } }, overrideAccess: true })
    return Response.json({ users: docs.map(user => ({ id: user.id, email: user.email, role: user.role, verified: user._verified })) })
  }
  return Response.json({ inbox, logs: capturedLogs, now: fixture.now, loginBarrier: fixture.loginBarrier })
}
export async function POST(request: Request) {
  if (process.env.AUTH_CONSUMER_OTP !== '1' && process.env.AUTH_CONSUMER_PASSWORD !== '1') return new Response(null, { status: 404 })
  const body = await request.json()
  if (typeof body.armLogin === 'string' && process.env.AUTH_CONSUMER_PASSWORD === '1') {
    const payload = await getPayload({ config, key: 'browser-consumer' })
    const actualUpdate = payload.db.updateOne.bind(payload.db)
    fixture.loginBarrier = { email: body.armLogin, entered: false, released: false }
    // Instrument scheduling only, not authentication/storage results: forward exact args to the real adapter.
    payload.db.updateOne = async args => {
      const barrier = fixture.loginBarrier
      if (barrier && !barrier.entered && args.collection === 'customers' && args.data.email === barrier.email && Array.isArray(args.data.sessions) && args.req?.url?.includes('/access/login')) {
        barrier.entered = true
        const deadline = Date.now() + 30000
        while (!barrier.released && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20))
        if (!barrier.released) throw new Error('fixture login barrier timed out')
      }
      return actualUpdate(args)
    }
    return Response.json({ armed: true })
  }
  if (body.releaseLogin && fixture.loginBarrier) { fixture.loginBarrier.released = true; return Response.json({ released: true }) }
  if (typeof body.deleteEmail === 'string' && process.env.AUTH_CONSUMER_PASSWORD === '1') {
    const payload = await getPayload({ config, key: 'browser-consumer' })
    await payload.delete({ collection: 'customers', where: { email: { equals: body.deleteEmail } }, overrideAccess: true })
    return Response.json({ deleted: true })
  }
  if (body.replaceEmail === 'replacement@example.com') {
    const payload = await getPayload({ config, key: 'browser-consumer' })
    const { docs } = await payload.find({ collection: 'customers', where: { email: { equals: body.replaceEmail } }, overrideAccess: true })
    const original = docs[0]
    await payload.update({ collection: 'customers', id: original.id, data: { email: 'displaced-replacement@example.com' }, overrideAccess: true })
    const replacement = await payload.create({ collection: 'customers', data: { email: body.replaceEmail, password: 'actual-browser-test-password', _verified: true }, disableVerificationEmail: true, overrideAccess: true, context: { authLoginCredentialProvisioning: true } })
    return Response.json({ originalID: original.id, replacementID: replacement.id })
  }
  if (Number.isSafeInteger(body.now)) fixture.now = body.now
  if (typeof body.failCredentialWrite === 'boolean') fixture.failCredentialWrite = body.failCredentialWrite
  if (typeof body.failMail === 'boolean') fixture.failMail = body.failMail
  return Response.json({ now: fixture.now })
}
