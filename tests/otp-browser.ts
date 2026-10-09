import assert from 'node:assert/strict'
import {
  requiredHeader,
  messageCode,
  type BrowserAcceptanceOptions,
  type FixtureMessage,
  type FixtureSnapshot,
} from './browser-support.ts'

// Approved public HTTP / packed-browser seams, real Payload + shared PostgreSQL.
export async function verifyOtpAcceptance({
  browser,
  origin,
  origin2,
  postgresVersion,
  outage,
  database = postgresVersion,
}: Omit<BrowserAcceptanceOptions, 'database'> & {
  database?: string
  postgresVersion?: string
  outage: <T>(work: () => Promise<T>) => Promise<T>
}) {
  const origins = [origin, origin2]
  const verified: string[] = []
  const post = (base: string, path: string, body: unknown, cookie?: string, headers = {}) =>
    fetch(`${base}/backend${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: base,
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: JSON.stringify(body),
    })
  const inbox = async (): Promise<FixtureMessage[]> =>
    (
      await Promise.all(
        origins.map(
          async (base: string) =>
            ((await (await fetch(`${base}/fixture`)).json()) as FixtureSnapshot).inbox,
        ),
      )
    )
      .flat()
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
  const codeFrom = messageCode
  const forAccount = async (email: string) =>
    (await inbox()).filter((message: FixtureMessage) => message.to === email)
  let now = (await (await fetch(`${origin}/fixture`)).json()).now
  const tick = async (milliseconds: number) => {
    now += milliseconds
    await Promise.all(
      origins.map((base) =>
        fetch(`${base}/fixture`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ now }),
        }),
      ),
    )
  }
  const send = async (
    email: string,
    context?: string,
    base = origin,
    headers: Record<string, string> = {},
  ) => {
    const response = await post(
      base,
      '/access/otp/send',
      { email, purpose: 'login', ...(context ? { context } : {}) },
      undefined,
      headers,
    )
    assert.equal(response.status, 200, await response.clone().text())
    const body = await response.json()
    assert.equal(body.code, 'OTP_REQUEST_ACCEPTED')
    assert.match(body.context, /^[a-f0-9]{64}$/)
    return body
  }
  const verify = (email: string, context: string, otp: string, base = origin) =>
    post(base, '/access/otp/verify', { email, purpose: 'login', context, otp })
  const assertRejected = async (response: Response) => {
    assert.equal(response.status, 401, await response.clone().text())
    assert.equal(requiredHeader(response, 'set-cookie'), null)
    assert.deepEqual(await response.json(), { success: false, code: 'AUTH_FAILED' })
  }
  const email = 'browser@example.com'
  const password = 'actual-browser-test-password'
  const oldLogin = await post(origin, '/access/login', { email, password })
  assert.equal(oldLogin.status, 200)
  const oldCookie = requiredHeader(oldLogin, 'set-cookie').split(';')[0]
  await tick(0)
  const challenge = await send(email)
  const message = (await forAccount(email))[0]
  const code = codeFrom(message)
  assert.ok(!String(message.subject).includes(code))
  const login = await verify(email, challenge.context, code, origin2)
  assert.equal(login.status, 200, await login.clone().text())
  const identity = await login.json()
  assert.equal(identity.user.email, email)
  assert.equal('token' in identity, false)
  assert.match(
    requiredHeader(login, 'set-cookie'),
    /^consumer-token=.+;.*HttpOnly(=true)?; SameSite=Lax/,
  )
  const oldIdentity = await fetch(`${origin2}/backend/customers/me`, {
    headers: { cookie: oldCookie, origin: origin2 },
  })
  assert.equal((await oldIdentity.json()).user.email, email)
  assert.equal((await post(origin2, '/access/login', { email, password })).status, 200)
  await assertRejected(await verify(email, challenge.context, code))
  verified.push(
    'cross-process OTP login, password/other session preserved, hidden token/native cookie, replay denied',
  )

  // Shared issuance reservation, then exactly one authorization among competing verifications.
  const raceEmail = 'race@example.com'
  await Promise.all(origins.map((base) => send(raceEmail, undefined, base)))
  const raceMessages = await forAccount(raceEmail)
  assert.equal(raceMessages.length, 1, 'concurrent issuance must send one challenge')
  // Exercise consumption with a fresh challenge after the concurrent issuance TTL.
  await tick(300001)
  const raceChallenge = await send(raceEmail)
  assert.equal(
    (await forAccount(raceEmail)).length,
    2,
    'fixture clock must expire prior issuance before new challenge',
  )
  const raceCode = codeFrom((await forAccount(raceEmail)).at(-1))
  const outcomes = await Promise.all(
    origins.map((base) => verify(raceEmail, raceChallenge.context, raceCode, base)),
  )
  assert.deepEqual(outcomes.map((response) => response.status).sort(), [200, 401])
  for (const response of outcomes.filter((response) => response.status !== 200))
    assert.equal(requiredHeader(response, 'set-cookie'), null)
  verified.push('shared-DB concurrent issuance and single-use consume')

  // Three incorrect attempts across independent servers exhaust the original challenge.
  const attemptsEmail = 'attempts@example.com'
  const attemptChallenge = await send(attemptsEmail)
  const attemptCode = codeFrom((await forAccount(attemptsEmail)).at(-1))
  const wrongCode = attemptCode === '000000' ? '999999' : '000000'
  await Promise.all(
    [origin, origin2, origin].map(async (base: string) =>
      assertRejected(await verify(attemptsEmail, attemptChallenge.context, wrongCode, base)),
    ),
  )
  await tick(1001)
  await send(attemptsEmail, attemptChallenge.context, origin2)
  assert.equal(codeFrom((await forAccount(attemptsEmail)).at(-1)), attemptCode)
  await assertRejected(await verify(attemptsEmail, attemptChallenge.context, attemptCode, origin2))
  verified.push('atomic three-attempt exhaustion and same-code resend without reset')

  const ttlEmail = 'ttl@example.com'
  const ttlChallenge = await send(ttlEmail)
  const ttlCode = codeFrom((await forAccount(ttlEmail)).at(-1))
  await assertRejected(await verify(ttlEmail, 'f'.repeat(64), ttlCode, origin2))
  const wrongPurpose = await post(origin, '/access/otp/verify', {
    email: ttlEmail,
    purpose: 'password-reset',
    context: ttlChallenge.context,
    otp: ttlCode,
  })
  assert.equal(wrongPurpose.status, 400)
  assert.equal(requiredHeader(wrongPurpose, 'set-cookie'), null)
  await tick(299000)
  await send(ttlEmail, ttlChallenge.context, origin2)
  assert.equal(codeFrom((await forAccount(ttlEmail)).at(-1)), ttlCode)
  await tick(1001)
  await assertRejected(await verify(ttlEmail, ttlChallenge.context, ttlCode))
  await assertRejected(await verify(email, ttlChallenge.context, ttlCode))
  verified.push('resend retains initial five-minute TTL; account/purpose/context binding')

  const limitEmail = 'limit@example.com'
  const limitChallenge = await send(limitEmail)
  const initialCount = (await forAccount(limitEmail)).length
  await send(limitEmail, limitChallenge.context, origin2)
  assert.equal(
    (await forAccount(limitEmail)).length,
    initialCount,
    'shared cooldown prevents new mail',
  )
  for (let i = 0; i < 4; i++) {
    await tick(1001)
    await send(limitEmail, limitChallenge.context, origins[i % 2])
  }
  assert.equal((await forAccount(limitEmail)).length, 5)
  await tick(1001)
  await send(limitEmail, limitChallenge.context, origin2)
  assert.equal((await forAccount(limitEmail)).length, 5)
  verified.push('shared one-second fixture cooldown and five/hour account cap')

  // Provider failure spends quota but never changes credentials or existing sessions.
  const mailEmail = 'mail@example.com'
  await fetch(`${origin}/fixture`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ failMail: true }),
  })
  const mailChallenge = await send(mailEmail)
  assert.equal((await forAccount(mailEmail)).length, 0)
  await fetch(`${origin}/fixture`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ failMail: false }),
  })
  await tick(1001)
  await send(mailEmail, mailChallenge.context, origin2)
  assert.equal((await forAccount(mailEmail)).length, 1)
  assert.equal((await post(origin, '/access/login', { email: mailEmail, password })).status, 200)
  verified.push('real email-adapter failure, bounded retry and credentials preserved')

  // Native password login/logout/refresh must reconcile session deltas with overlapping OTP.
  for (const nativeAction of ['password', 'logout', 'refresh']) {
    const raceAccount = `${nativeAction}-race@example.com`
    const initial = await post(origin, '/access/login', { email: raceAccount, password })
    assert.equal(initial.status, 200)
    const existingCookie = requiredHeader(initial, 'set-cookie').split(';')[0]
    const issued = await send(raceAccount)
    const issuedCode = codeFrom((await forAccount(raceAccount)).at(-1))
    const nativeRequest =
      nativeAction === 'password'
        ? post(origin, '/access/login', { email: raceAccount, password })
        : post(
            origin,
            nativeAction === 'logout' ? '/customers/logout' : '/customers/refresh-token',
            {},
            existingCookie,
          )
    const [native, otpLogin] = await Promise.all([
      nativeRequest,
      verify(raceAccount, issued.context, issuedCode, origin2),
    ])
    assert.deepEqual(
      [native.status, otpLogin.status],
      [200, 200],
      `overlap ${nativeAction}: ${await native.clone().text()} / ${await otpLogin.clone().text()}`,
    )
    const otpCookie = requiredHeader(otpLogin, 'set-cookie').split(';')[0]
    const me = async (cookie: string) =>
      (
        await (
          await fetch(`${origin2}/backend/customers/me`, { headers: { origin: origin2, cookie } })
        ).json()
      ).user
    assert.equal((await me(otpCookie)).email, raceAccount)
    if (nativeAction === 'logout') assert.equal(await me(existingCookie), null)
    else {
      assert.equal((await me(existingCookie)).email, raceAccount)
      assert.equal(
        (await me(requiredHeader(native, 'set-cookie').split(';')[0])).email,
        raceAccount,
      )
    }
  }
  verified.push(
    'native password/OTP, logout/OTP and refresh/OTP session races preserve additions/revocations',
  )

  // Provisioning reassigns the same address to a distinct real account: old proof cannot follow email.
  const replacementEmail = 'replacement@example.com'
  const replacementChallenge = await send(replacementEmail)
  const replacementCode = codeFrom((await forAccount(replacementEmail)).at(-1))
  const changedAccount = await fetch(`${origin}/fixture`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ replaceEmail: replacementEmail }),
  })
  assert.equal(changedAccount.status, 200)
  const replacementIdentity = await changedAccount.json()
  assert.notEqual(replacementIdentity.originalID, replacementIdentity.replacementID)
  await assertRejected(
    await verify(replacementEmail, replacementChallenge.context, replacementCode, origin2),
  )
  verified.push(
    'real account-email reassignment cannot transfer the original OTP proof to a replacement ID',
  )

  // Every origin request counts, including unknown identities; spoofed headers cannot change resolver.
  await tick(3600001)
  for (let i = 0; i < 50; i++)
    await send(`absent-${i}@example.com`, undefined, origins[i % 2], {
      'x-forwarded-for': `198.51.100.${i}`,
    })
  const beforeOrigin = (await forAccount(email)).length
  await send(email, undefined, origin2, { 'x-forwarded-for': '203.0.113.99' })
  assert.equal((await forAccount(email)).length, beforeOrigin)
  // Already capped: no actual delivery even with another spoofed source.
  await send(email, undefined, origin, { 'x-real-ip': '203.0.113.100' })
  assert.equal((await forAccount(email)).length, beforeOrigin)
  assert.equal((await post(origin2, '/access/login', { email, password })).status, 200)
  verified.push(
    '50/hour trusted-origin quota shared across processes; spoofing denied; password unaffected',
  )

  // New window, genuine packed React modal: request, failed verification, resend, successful login.
  await tick(3600001)
  const context = await browser.newContext()
  const page = await context.newPage()
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.goto(origin)
  await page.getByRole('button', { name: 'Open login' }).click()
  await page.getByLabel(/^Email/).fill(email)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  const sent = page.waitForResponse((response) => response.url().endsWith('/access/otp/send'))
  await page.getByRole('button', { name: 'Send Code', exact: true }).click()
  assert.equal((await sent).status(), 200)
  const browserCode = codeFrom((await forAccount(email)).at(-1))
  const inputs = page.locator('input[autocomplete="one-time-code"]')
  await inputs.first().waitFor()
  assert.equal(await inputs.count(), 6)
  const failed = page.waitForResponse((response) => response.url().endsWith('/access/otp/verify'))
  const incorrect = browserCode === '000000' ? '999999' : '000000'
  for (let i = 0; i < 6; i++) await inputs.nth(i).fill(incorrect[i])
  const failedResponse = await failed
  assert.equal(failedResponse.status(), 401)
  assert.equal(
    (await context.cookies()).filter((cookie) => cookie.name === 'consumer-token').length,
    0,
  )
  await tick(1001)
  const resend = page.waitForResponse((response) => response.url().endsWith('/access/otp/send'))
  await page.getByRole('button', { name: 'Resend Code', exact: true }).click()
  assert.equal((await resend).status(), 200)
  assert.equal(codeFrom((await forAccount(email)).at(-1)), browserCode)
  const verifyStartedAt = Date.now()
  const browserVerify = page
    .waitForResponse((response) => response.url().endsWith('/access/otp/verify'))
    .then((response) => ({ response, receivedAt: Date.now() }))
  for (let i = 0; i < 6; i++) await inputs.nth(i).fill(browserCode[i])
  const { response: browserResult, receivedAt: verifyReceivedAt } = await browserVerify
  assert.equal(browserResult.status(), 200, await browserResult.text())
  assert.equal('token' in (await browserResult.json()), false)
  await page.getByTestId('email').filter({ hasText: email }).waitFor()
  assert.equal(await page.locator('dialog').count(), 0)
  const cookie = (await context.cookies()).find((cookie) => cookie.name === 'consumer-token')
  assert.ok(cookie?.httpOnly)
  assert.equal(cookie.sameSite, 'Lax')
  const jwtExp = JSON.parse(
    Buffer.from(cookie.value.split('.')[1], 'base64url').toString('utf8'),
  ).exp
  const responseHeaders = await browserResult.allHeaders()
  const responseCookie = responseHeaders['set-cookie'] ?? ''
  const responseToken = responseCookie.match(/(?:^|\n)consumer-token=([^;]+)/)?.[1]
  assert.ok(responseToken, 'successful OTP response must set the native session cookie')
  assert.ok(cookie.value === responseToken, 'stored cookie must match this verification response')
  const responseExp = JSON.parse(
    Buffer.from(responseToken.split('.')[1], 'base64url').toString('utf8'),
  ).exp
  assert.equal(jwtExp, responseExp, 'stored cookie must belong to this verification response')
  const wireExpires = Date.parse(responseCookie.match(/Expires=([^;]+)/i)?.[1] ?? '') / 1000
  const responseDate = Date.parse(responseHeaders.date ?? '') / 1000
  assert.ok(Number.isFinite(wireExpires) && Number.isFinite(responseDate))
  assert.ok(wireExpires <= responseExp, 'server cookie must not outlive its signed JWT')
  // Chromium adjusts Expires by client receipt time minus the whole-second HTTP Date:
  // https://chromium.googlesource.com/chromium/src/+/2b7a08671c5e3ce4cf50b42e8a33cd5abda96c89/net/cookies/canonical_cookie.cc
  // Bound that adjustment by the observed receive window, allowing only 2ms timestamp quantization.
  const adjustedStart = wireExpires + verifyStartedAt / 1000 - responseDate
  const adjustedEnd = wireExpires + verifyReceivedAt / 1000 - responseDate
  assert.ok(cookie.expires >= adjustedStart - 0.002 && cookie.expires <= adjustedEnd + 0.002)
  assert.ok(!requests.some((url) => url.includes('check-email')))
  for (const source of await page
    .locator('script[src]')
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).src))) {
    const javascript = await (await fetch(source)).text()
    for (const secret of [
      'consumer-only-private-secret-not-production',
      'consumer-only-otp-secret-not-production',
    ])
      assert.ok(!javascript.includes(secret))
  }
  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await page.getByTestId('email').filter({ hasText: 'anonymous' }).waitFor()
  const replay = await fetch(`${origin2}/backend/customers/me`, {
    headers: { cookie: `consumer-token=${cookie.value}`, origin: origin2 },
  })
  assert.equal((await replay.json()).user, null)
  await context.close()
  verified.push(
    'Chromium packed modal request/failed verify/resend/login/logout; no client secrets',
  )
  await outage(async () => {
    const unavailable = await verify(email, challenge.context, code, origin2)
    assert.equal(unavailable.status, 503, await unavailable.clone().text())
    assert.equal(requiredHeader(unavailable, 'set-cookie'), null)
    assert.deepEqual(await unavailable.json(), { success: false, code: 'AUTH_UNAVAILABLE' })
  })
  verified.push(`${database} security-storage outage fails closed without cookie`)
  const logs = (
    await Promise.all(
      origins.map(
        async (base: string) =>
          ((await (await fetch(`${base}/fixture`)).json()) as FixtureSnapshot).logs,
      ),
    )
  ).flat()
  const serializedLogs = logs.join('')
  for (const sensitive of [cookie.value, password])
    assert.ok(!serializedLogs.includes(sensitive), 'logger must not contain authentication secrets')
  for (const sensitive of (await inbox()).map(codeFrom))
    assert.ok(
      !new RegExp(`\\b${sensitive}\\b`).test(serializedLogs),
      'logger must not contain OTP codes',
    )
  assert.ok(
    !/Failed query|params:|SELECT .*hash|\"hash\":|\"salt\":/i.test(serializedLogs),
    'logger must not expose security SQL/credentials',
  )
  const events = logs
    .flatMap((chunk) => chunk.split('\n').filter(Boolean))
    .map((line) => JSON.parse(line))
    .filter((line) => String(line.event).startsWith('auth.otp.'))
  assert.ok(events.some((event) => event.event === 'auth.otp.mail_failed'))
  assert.ok(events.some((event) => event.event === 'auth.otp.unavailable'))
  for (const event of events) assert.match(event.correlation, /^[a-f0-9]{64}$/)
  verified.push(
    'captured native logger and OTP events contain correlation only, no credentials/codes/token/SQL',
  )
  console.log(
    JSON.stringify(
      { passed: true, database, browser: 'Chromium', instances: 2, verified },
      null,
      2,
    ),
  )
  return { passed: true, database, browser: 'Chromium', instances: 2, verified }
}
