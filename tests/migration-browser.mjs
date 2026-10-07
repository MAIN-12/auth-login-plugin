import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'

// Public packed exports/HTTP and Chromium; fixture endpoints only provision/control the disposable host.
export async function verifyMigrationAcceptance({
  browser,
  origin,
  origin2,
  database,
  maintenance,
  provider,
  onPage,
}) {
  const verified = []
  const mark = (label) => {
    verified.push(label)
    console.log(`Migration ${database}: ${label}`)
  }
  const bases = [origin, origin2]
  const post = (base, path, body, cookie) =>
    fetch(`${base}/backend/access/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base, ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    })
  const success = async (response) => {
    assert.equal(response.status, 200, await response.clone().text())
    return response.json()
  }
  const limited = (response) =>
    assert.equal(
      response.headers.get('set-cookie'),
      null,
      'ownership proof must not create an application session',
    )
  const rejected = async (response) => {
    assert.ok(response.status >= 400 && response.status < 500, await response.clone().text())
    limited(response)
  }
  const messages = async (email) =>
    (
      await Promise.all(
        bases.map(async (base) => (await (await fetch(`${base}/fixture`)).json()).inbox),
      )
    )
      .flat()
      .filter((message) => message.to === email)
  const code = (message) => String(message.html).match(/\b(\d{6})\b/)[1]
  const send = async (email, purpose) => {
    const response = await post(origin, 'otp/send', { email, purpose })
    limited(response)
    const body = await success(response)
    return { email, purpose, context: body.context, otp: code((await messages(email)).at(-1)) }
  }
  const login = async (email, password, base = origin) => {
    const response = await post(base, 'login', { email, password })
    await success(response)
    return response.headers.get('set-cookie').split(';')[0]
  }
  const me = async (base, cookie) =>
    (
      await (
        await fetch(`${base}/backend/customers/me`, { headers: { origin: base, cookie } })
      ).json()
    ).user
  const email = 'unverified-legacy@example.com'
  const password = 'legacy password remains unchanged'
  await rejected(await post(origin, 'login', { email, password }))
  const proof = await send(email, 'verify-email')
  await rejected(await post(origin2, 'otp/verify', { ...proof, purpose: 'recovery' }))
  const verifiedEmail = await post(origin2, 'otp/verify', proof)
  limited(verifiedEmail)
  assert.deepEqual(await success(verifiedEmail), { success: true })
  await rejected(await post(origin, 'otp/verify', proof))
  const preservedCookie = await login(email, password)
  assert.equal((await me(origin2, preservedCookie)).email, email)
  mark(
    'legacy unverified account proves email across processes without password change, permit or automatic login; replay and purpose substitution rejected',
  )

  // A second real legacy account exercises the packed verification UI, not a reconstructed form.
  const browserEmail = 'browser-legacy@example.com'
  assert.equal(
    (
      await fetch(`${origin}/fixture`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ migrationLegacyEmail: browserEmail }),
      })
    ).status,
    200,
  )
  const browserProof = await send(browserEmail, 'verify-email')
  const context = await browser.newContext()
  const page = await context.newPage()
  onPage?.(page)
  await page.goto(
    `${origin}/auth/verify-otp?${new URLSearchParams({ email: browserEmail, purpose: 'verify-email', context: browserProof.context })}`,
  )
  assert.equal(await page.locator('input[type="password"]').count(), 0)
  const digits = page.locator('input[autocomplete="one-time-code"]')
  await digits.first().waitFor()
  const completion = page.waitForResponse((response) =>
    response.url().endsWith('/access/otp/verify'),
  )
  for (let index = 0; index < 6; index++) await digits.nth(index).fill(browserProof.otp[index])
  assert.equal((await completion).status(), 200)
  assert.equal(
    (await context.cookies()).filter((cookie) => cookie.name === 'consumer-token').length,
    0,
  )
  await login(browserEmail, password)
  await context.close()
  mark(
    'Chromium packed verify-email form has no password input and creates no application cookie; original password remains usable',
  )

  if (process.env.AUTH_CONSUMER_ISSUE06_VERIFY_ONLY === '1')
    return {
      passed: true,
      subset: 'verify-email only; cutoff/rollback not exercised',
      database,
      instances: 2,
      browser: 'Chromium',
      verified,
      humanScreenReader: 'pending',
    }

  const beginGoogle = async () => {
    const response = await fetch(`${origin}/backend/access/oauth/google`, { redirect: 'manual' })
    assert.equal(response.status, 303, await response.clone().text())
    const authorization = await fetch(response.headers.get('location'), { redirect: 'manual' })
    assert.equal(authorization.status, 302)
    return {
      callback: authorization.headers.get('location'),
      cookie: response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; '),
    }
  }
  const finishGoogle = (flow, base = origin) =>
    new Promise((resolve, reject) => {
      const url = new URL(flow.callback)
      const request = httpRequest(
        `${base}${url.pathname}${url.search}`,
        { headers: { host: url.host, cookie: flow.cookie } },
        (incoming) => {
          const chunks = []
          incoming.on('data', (data) => chunks.push(data))
          incoming.on('end', () => {
            const headers = new Headers()
            for (let i = 0; i < incoming.rawHeaders.length; i += 2)
              headers.append(incoming.rawHeaders[i], incoming.rawHeaders[i + 1])
            resolve(new Response(Buffer.concat(chunks), { status: incoming.statusCode, headers }))
          })
        },
      )
      request.on('error', reject)
      request.setTimeout(120000, () =>
        request.destroy(new Error('Migration OAuth callback timed out')),
      )
      request.end()
    })
  const googleLogin = async () => {
    const response = await finishGoogle(await beginGoogle())
    assert.equal(response.status, 303, await response.clone().text())
    const cookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith('consumer-token='))
      .split(';')[0]
    return me(origin2, cookie)
  }
  const googleAccount = await googleLogin()
  assert.equal(googleAccount.email, 'google-public@example.com')
  const pendingGoogle = await beginGoogle()
  const assertGoogleRejected = async (flow) => {
    const exchanges = provider.exchanges.length
    for (const base of bases) {
      const response = await finishGoogle(flow, base)
      assert.ok([400, 401, 403].includes(response.status), await response.clone().text())
      assert.ok(
        !response.headers.getSetCookie().some((cookie) => cookie.startsWith('consumer-token=')),
        'rejected correlation cannot create an application cookie',
      )
    }
    assert.equal(
      provider.exchanges.length,
      exchanges,
      'invalidated correlation must fail before provider exchange',
    )
  }
  const unrelatedLogin = await fetch(`${origin}/backend/outsiders/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({
      email: 'unrelated@example.com',
      password: 'unrelated password remains unchanged',
    }),
  })
  await success(unrelatedLogin)
  const unrelatedCookie = unrelatedLogin.headers.get('set-cookie').split(';')[0]
  const unrelatedMe = async (base) =>
    (
      await (
        await fetch(`${base}/backend/outsiders/me`, {
          headers: { origin: base, cookie: unrelatedCookie },
        })
      ).json()
    ).user
  const oldCookie = await login('browser@example.com', 'actual-browser-test-password')
  const pendingCode = await send('race@example.com', 'login')
  const grantProof = await send('mail@example.com', 'recovery')
  const grantResponse = await post(origin2, 'otp/verify', grantProof)
  limited(grantResponse)
  const grant = (await success(grantResponse)).permit
  assert.ok(grant)
  const assertCutoff = async () => {
    for (const [scope, count] of [
      ['customers', 0],
      ['outsiders', 1],
    ])
      assert.equal(
        (await (await fetch(`${origin}/fixture?legacyOtpScope=${scope}`)).json()).count,
        count,
      )

    for (const base of bases) {
      assert.equal(
        (await unrelatedMe(base)).email,
        'unrelated@example.com',
        'scoped migration must preserve unrelated collection sessions and global host keys',
      )
      assert.equal(await me(base, oldCookie), null)
      await rejected(await post(base, 'otp/verify', pendingCode))
      await rejected(
        await post(base, 'reset-password', {
          permit: grant,
          password: 'attacker replacement password',
        }),
      )
      await login('browser@example.com', 'actual-browser-test-password', base)
      await login('mail@example.com', 'actual-browser-test-password', base)
      await login(email, password, base)
    }
  }
  const firstCutoff = await maintenance('cutoff')
  assert.equal(firstCutoff.success, true)
  assert.equal(firstCutoff.collection, 'customers')
  assert.equal(firstCutoff.legacyCodesDeleted, 1)
  await assertCutoff()
  await assertGoogleRejected(pendingGoogle)
  assert.equal(
    (await googleLogin()).id,
    googleAccount.id,
    'cutoff preserves stable private Google association',
  )
  mark(
    'maintenance cutoff rejects pre-cutoff sessions, OTP codes and ownership grants in both processes while preserving accounts/passwords',
  )
  const postCutoffGoogle = await beginGoogle()
  const postCutoffCookie = await login('browser@example.com', 'actual-browser-test-password')
  const postCutoffCode = await send('race@example.com', 'login')
  const postCutoffProof = await send('mail@example.com', 'recovery')
  const postCutoffGrant = (await success(await post(origin2, 'otp/verify', postCutoffProof))).permit
  const restoredCutoff = await maintenance('rollback')
  assert.equal(restoredCutoff.success, true)
  assert.equal(restoredCutoff.legacyCodesDeleted, 1)
  assert.notEqual(restoredCutoff.generation, firstCutoff.generation)
  await assertCutoff()
  await assertGoogleRejected(pendingGoogle)
  await assertGoogleRejected(postCutoffGoogle)
  assert.equal(
    (await googleLogin()).id,
    googleAccount.id,
    'backup restore/re-cutoff preserves Google identity association',
  )
  mark(
    'pre/post-cutoff OAuth correlations reject before provider exchange in both processes; stable Google association survives cutoff and restored backup',
  )
  for (const base of bases) {
    assert.equal(await me(base, postCutoffCookie), null)
    await rejected(await post(base, 'otp/verify', postCutoffCode))
    await rejected(
      await post(base, 'reset-password', {
        permit: postCutoffGrant,
        password: 'attacker replacement password',
      }),
    )
  }
  mark(
    'real database backup restore with re-applied cutoff and unchanged host keys fresh collection generation cannot resurrect pre/post-cutoff sessions/codes/grants',
  )
  return {
    passed: true,
    database,
    instances: 2,
    browser: 'Chromium',
    verified,
    humanScreenReader: 'pending',
  }
}
