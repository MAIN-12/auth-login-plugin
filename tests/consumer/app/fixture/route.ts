// Only copied into the disposable acceptance app; never part of the published package.
import { getPayload } from 'payload'
import { config, capturedLogs, fixture, inbox } from '../auth-config'
export async function GET() {
  if (process.env.AUTH_CONSUMER_OTP !== '1') return new Response(null, { status: 404 })
  return Response.json({ inbox, logs: capturedLogs, now: fixture.now })
}
export async function POST(request: Request) {
  if (process.env.AUTH_CONSUMER_OTP !== '1') return new Response(null, { status: 404 })
  const body = await request.json()
  if (body.replaceEmail === 'replacement@example.com') {
    const payload = await getPayload({ config, key: 'browser-consumer' })
    const { docs } = await payload.find({ collection: 'customers', where: { email: { equals: body.replaceEmail } }, overrideAccess: true })
    const original = docs[0]
    await payload.update({ collection: 'customers', id: original.id, data: { email: 'displaced-replacement@example.com' }, overrideAccess: true })
    const replacement = await payload.create({ collection: 'customers', data: { email: body.replaceEmail, password: 'actual-browser-test-password', _verified: true }, disableVerificationEmail: true, overrideAccess: true, context: { authLoginCredentialProvisioning: true } })
    return Response.json({ originalID: original.id, replacementID: replacement.id })
  }
  if (Number.isSafeInteger(body.now)) fixture.now = body.now
  if (typeof body.failMail === 'boolean') fixture.failMail = body.failMail
  return Response.json({ now: fixture.now })
}
