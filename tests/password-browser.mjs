import assert from 'node:assert/strict'

// Packed consumer, two independent Payload processes, native HTTP and Chromium. No auth/storage mocks.
export async function verifyPasswordAcceptance({ browser, origin, origin2, database, onPage }) {
  const bases = [origin, origin2]
  const verified = []
  const mark = (label) => {
    verified.push(label)
    console.log(`Password acceptance ${database}: ${label}`)
  }
  const originalPassword = 'actual-browser-test-password'
  const ownerPassword = 'owner chooses a lengthy phrase'
  const nextPassword = 'replacement phrase chosen by owner'
  const post = (base, path, body, cookie) =>
    fetch(`${base}/backend${path}`, {
      method: 'POST',
      signal: AbortSignal.timeout(60000),
      headers: { 'content-type': 'application/json', origin: base, ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    })
  const control = async (body) => {
    for (const base of bases)
      assert.equal(
        (
          await fetch(`${base}/fixture`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
        ).status,
        200,
      )
  }
  const snapshot = async () =>
    (
      await Promise.all(
        bases.map(async (base) => (await (await fetch(`${base}/fixture`)).json()).inbox),
      )
    )
      .flat()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  const messages = async (email) => (await snapshot()).filter((message) => message.to === email)
  const code = (message) => String(message.html).match(/\b(\d{6})\b/)[1]
  const users = async (email) =>
    (await (await fetch(`${origin}/fixture?email=${encodeURIComponent(email)}`)).json()).users
  let now = (await (await fetch(`${origin}/fixture`)).json()).now
  const tick = async (ms) => {
    now += ms
    await control({ now })
  }
  const success = async (response) => {
    assert.equal(response.status, 200, await response.clone().text())
    return response.json()
  }
  const noSession = (response) =>
    assert.equal(
      response.headers.get('set-cookie'),
      null,
      'limited proof must never issue an application cookie',
    )
  const rejected = async (response) => {
    assert.ok(
      response.status >= 400 && response.status < 500,
      `${response.status}: ${await response.clone().text()}`,
    )
    noSession(response)
  }
  const me = async (cookie) =>
    (
      await (
        await fetch(`${origin2}/backend/customers/me`, { headers: { origin: origin2, cookie } })
      ).json()
    ).user
  const login = async (email, password, base = origin) => {
    const response = await post(base, '/access/login', { email, password })
    await success(response)
    return response.headers.get('set-cookie').split(';')[0]
  }
  const request = async (email, purpose, context, base = origin) => {
    const response = await post(base, '/access/otp/send', {
      email,
      purpose,
      ...(context ? { context } : {}),
    })
    noSession(response)
    const body = await success(response)
    assert.equal(body.code, 'OTP_REQUEST_ACCEPTED')
    return body.context
  }
  const permit = async (email, purpose, base = origin) => {
    await tick(1001)
    const context = await request(email, purpose, undefined, base)
    const response = await post(base === origin ? origin2 : origin, '/access/otp/verify', {
      email,
      purpose,
      context,
      otp: code((await messages(email)).at(-1)),
    })
    noSession(response)
    const body = await success(response)
    assert.equal('token' in body, false)
    assert.equal('user' in body, false)
    assert.match(body.permit, /^[A-Za-z0-9_-]{64,2048}$/)
    return body.permit
  }

  // A pre-registration attack cannot choose credentials or reserve the victim's address.
  const email = 'owner@example.com'
  await rejected(
    await post(origin, '/access/signup', {
      email,
      password: 'attacker chooses this password',
      role: 'admin',
    }),
  )
  const preContext = await request(email, 'signup')
  assert.equal((await users(email)).length, 0)
  await rejected(
    await post(origin, '/access/login', { email, password: 'attacker chooses this password' }),
  )
  await tick(300001)
  const signupPermit = await permit(email, 'signup')
  await rejected(await post(origin2, '/access/signup', { permit: signupPermit, password: 'short' }))
  await rejected(
    await post(origin2, '/access/signup', { permit: signupPermit, password: 'Mailcreated5240' }),
  )
  await rejected(
    await post(origin2, '/access/reset-password', {
      permit: signupPermit,
      password: ownerPassword,
    }),
  )
  await rejected(
    await post(origin2, '/access/signup', {
      permit: signupPermit,
      password: ownerPassword,
      role: 'admin',
      email: 'attacker@example.com',
    }),
  )
  const signup = await post(origin2, '/access/signup', {
    permit: signupPermit,
    password: ownerPassword,
  })
  noSession(signup)
  await success(signup)
  assert.equal((await users(email)).length, 1)
  assert.equal((await users(email))[0].role, 'customer')
  assert.equal((await users(email))[0].verified, true)
  await rejected(
    await post(origin, '/access/signup', { permit: signupPermit, password: nextPassword }),
  )
  await rejected(
    await post(origin, '/access/login', { email, password: 'attacker chooses this password' }),
  )
  const firstCookie = await login(email, ownerPassword)
  const secondCookie = await login(email, ownerPassword, origin2)
  await rejected(await post(origin, '/customers/forgot-password', { email }))
  await rejected(
    await post(origin, '/customers/reset-password', {
      token: signupPermit,
      password: nextPassword,
    }),
  )
  const nativeWrite = await fetch(`${origin}/backend/customers/${(await users(email))[0].id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', origin, cookie: firstCookie },
    body: JSON.stringify({ password: nextPassword }),
  })
  await rejected(nativeWrite)
  await login(email, ownerPassword)
  await rejected(
    await post(origin2, '/access/otp/verify', {
      email,
      purpose: 'signup',
      context: preContext,
      otp: code((await messages(email))[0]),
    }),
  )
  const oneUseEmail = 'single-use-signup@example.com'
  const oneUsePermit = await permit(oneUseEmail, 'signup')
  await success(
    await post(origin, '/access/signup', { permit: oneUsePermit, password: ownerPassword }),
  )
  assert.equal(
    (
      await fetch(`${origin}/fixture`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deleteEmail: oneUseEmail }),
      })
    ).status,
    200,
  )
  await rejected(
    await post(origin2, '/access/signup', { permit: oneUsePermit, password: nextPassword }),
  )
  assert.equal((await users(oneUseEmail)).length, 0)
  mark(
    'pre-registration stores no account/password; owner-only completion, role stripping, policy HTTP bypass/replay',
  )

  // Recovery grants confer no app identity and keep sessions/password intact until commit.
  const recoveryPermit = await permit(email, 'recovery')
  assert.equal((await me(firstCookie)).email, email)
  assert.equal((await me(secondCookie)).email, email)
  assert.equal(await me(`consumer-token=${recoveryPermit}`), null)
  await rejected(
    await post(origin, '/access/signup', { permit: recoveryPermit, password: nextPassword }),
  )
  await rejected(
    await post(origin, '/access/reset-password', { permit: recoveryPermit, password: 'short' }),
  )
  assert.equal((await me(firstCookie)).email, email)
  await login(email, ownerPassword)
  await tick(300001)
  const pendingPermit = await permit(email, 'recovery')
  const reset = await post(origin2, '/access/reset-password', {
    permit: recoveryPermit,
    password: nextPassword,
  })
  noSession(reset)
  await success(reset)
  for (const cookie of [firstCookie, secondCookie]) assert.equal(await me(cookie), null)
  await rejected(
    await post(origin, '/access/reset-password', {
      permit: recoveryPermit,
      password: ownerPassword,
    }),
  )
  await rejected(
    await post(origin, '/access/reset-password', {
      permit: pendingPermit,
      password: ownerPassword,
    }),
  )
  await rejected(await post(origin, '/access/login', { email, password: ownerPassword }))
  await login(email, nextPassword)
  mark(
    'limited recovery proof; request/verify preserve sessions; confirmed reset revokes all and pending grants; replay denied',
  )

  // Real transaction rollback: downstream Payload hook failure cannot spend permit or change credential.
  const failingEmail = 'mail@example.com'
  const failureCookie = await login(failingEmail, originalPassword)
  const failurePermit = await permit(failingEmail, 'recovery')
  await control({ failCredentialWrite: true })
  const failedReset = await post(origin2, '/access/reset-password', {
    permit: failurePermit,
    password: nextPassword,
  })
  assert.ok([401, 503].includes(failedReset.status), await failedReset.clone().text())
  noSession(failedReset)
  await control({ failCredentialWrite: false })
  assert.equal((await me(failureCookie)).email, failingEmail)
  await login(failingEmail, originalPassword)
  const retry = await post(origin, '/access/reset-password', {
    permit: failurePermit,
    password: nextPassword,
  })
  noSession(retry)
  await success(retry)
  assert.equal(await me(failureCookie), null)
  await login(failingEmail, nextPassword)
  mark(
    'real Payload credential-hook failure rolls back password, sessions and permit; same permit succeeds on retry',
  )

  // Independent servers compete to consume one authorization; native session additions must not resurrect access.
  const raceEmail = 'race@example.com'
  const raceCookie = await login(raceEmail, originalPassword)
  const racePermit = await permit(raceEmail, 'recovery')
  const outcomes = await Promise.all(
    bases.map((base) =>
      post(base, '/access/reset-password', { permit: racePermit, password: nextPassword }),
    ),
  )
  assert.deepEqual(outcomes.map((response) => response.status).sort(), [200, 401])
  outcomes.forEach(noSession)
  assert.equal(await me(raceCookie), null)
  const revokeEmail = 'password-race@example.com'
  const revokeCookie = await login(revokeEmail, originalPassword)
  const revokePermit = await permit(revokeEmail, 'recovery')
  const [native, confirmed] = await Promise.all([
    post(origin, '/customers/refresh-token', {}, revokeCookie),
    post(origin2, '/access/reset-password', { permit: revokePermit, password: nextPassword }),
  ])
  await success(confirmed)
  assert.equal(await me(revokeCookie), null)
  if (native.status === 200)
    assert.equal(await me(native.headers.get('set-cookie').split(';')[0]), null)
  else assert.equal(native.status, 401)
  await login(revokeEmail, nextPassword)
  const pendingEmail = 'pending-password@example.com'
  let pendingOtp
  if (process.env.AUTH_CONSUMER_OTP === '1') {
    const context = await request(pendingEmail, 'login')
    pendingOtp = { context, otp: code((await messages(pendingEmail)).at(-1)) }
  }
  const pendingReset = await permit(pendingEmail, 'recovery')
  await fetch(`${origin}/fixture`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ armLogin: pendingEmail }),
  })
  const delayedLogin = post(origin, '/access/login', {
    email: pendingEmail,
    password: originalPassword,
  })
  let entered = false
  for (let attempt = 0; attempt < 200; attempt++) {
    const state = await (await fetch(`${origin}/fixture`)).json()
    if (state.loginBarrier?.entered) {
      entered = true
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  assert.ok(
    entered,
    'real native login must reach pre-session-write barrier after password verification',
  )
  try {
    await success(
      await post(origin2, '/access/reset-password', {
        permit: pendingReset,
        password: nextPassword,
      }),
    )
  } finally {
    await fetch(`${origin}/fixture`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ releaseLogin: true }),
    })
  }
  const obsoleteLogin = await delayedLogin
  await rejected(obsoleteLogin)
  if (pendingOtp)
    await rejected(
      await post(origin2, '/access/otp/verify', {
        email: pendingEmail,
        purpose: 'login',
        ...pendingOtp,
      }),
    )
  await login(pendingEmail, nextPassword)
  mark(
    'cross-process exactly-one reset consumption; concurrent refresh and password-verified/pre-write native login cannot resurrect access; old OTP proof revoked when enabled',
  )

  // Expiry is independent of OTP's TTL and no-password accounts cannot gain a credential via recovery.
  const ttlEmail = 'ttl@example.com'
  const expired = await permit(ttlEmail, 'recovery')
  await tick(600001)
  await rejected(
    await post(origin2, '/access/reset-password', { permit: expired, password: nextPassword }),
  )
  await login(ttlEmail, originalPassword)
  const absentContext = await request('absent@example.com', 'recovery')
  const passwordlessContext = await request('passwordless@example.com', 'recovery')
  assert.equal((await messages('absent@example.com')).length, 0)
  assert.equal((await messages('passwordless@example.com')).length, 0)
  for (const [account, context] of [
    ['absent@example.com', absentContext],
    ['passwordless@example.com', passwordlessContext],
  ])
    await rejected(
      await post(origin2, '/access/otp/verify', {
        email: account,
        purpose: 'recovery',
        context,
        otp: '000000',
      }),
    )
  await login('legacy@example.com', 'short')
  const replacementPermit = await permit('replacement@example.com', 'recovery')
  const replacement = await fetch(`${origin}/fixture`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ replaceEmail: 'replacement@example.com' }),
  })
  assert.equal(replacement.status, 200)
  await rejected(
    await post(origin2, '/access/reset-password', {
      permit: replacementPermit,
      password: nextPassword,
    }),
  )
  await login('replacement@example.com', originalPassword)
  mark(
    'ten-minute permit expiry; recovery does not add password; generic unknown/passwordless requests; legacy short login',
  )

  // Voluntary change needs a recent proof tied to current session and renews only within original cap.
  const changeEmail = 'browser@example.com'
  const current = await login(changeEmail, originalPassword)
  const other = await login(changeEmail, originalPassword, origin2)
  await rejected(await post(origin, '/access/set-password', { password: nextPassword }, current))
  const stale = await success(
    await post(origin, '/access/reauthenticate', { password: originalPassword }, current),
  )
  await tick(300001)
  await rejected(
    await post(
      origin2,
      '/access/set-password',
      { permit: stale.permit, password: nextPassword },
      current,
    ),
  )
  const recent = await success(
    await post(origin, '/access/reauthenticate', { password: originalPassword }, current),
  )
  await rejected(
    await post(
      origin2,
      '/access/set-password',
      { permit: recent.permit, password: nextPassword },
      other,
    ),
  )
  const changed = await post(
    origin2,
    '/access/set-password',
    { permit: recent.permit, password: nextPassword },
    current,
  )
  await success(changed)
  const rotated = changed.headers.get('set-cookie').split(';')[0]
  const claims = (value) => JSON.parse(Buffer.from(value.split('=')[1].split('.')[1], 'base64url'))
  assert.notEqual(claims(current).sid, claims(rotated).sid)
  assert.ok(claims(rotated).exp <= claims(current).exp)
  assert.equal((await me(rotated)).email, changeEmail)
  assert.equal(await me(current), null)
  assert.equal(await me(other), null)
  await rejected(
    await post(
      origin,
      '/access/set-password',
      { permit: recent.permit, password: ownerPassword },
      rotated,
    ),
  )
  mark(
    'reauthentication five-minute expiry/session binding; change rotates SID within original cap and revokes other sessions',
  )

  // Public browser lifecycle is completed without pre-verification password or premature application session.
  const context = await browser.newContext()
  const page = await context.newPage()
  onPage?.(page)
  await page.goto(origin)
  await page.getByRole('button', { name: 'Open login' }).click()
  await page.getByRole('link', { name: /Sign up/i }).click()
  const nameInput = page.getByLabel(/Full name/i)
  if (await nameInput.count()) await nameInput.fill('Legitimate owner')
  await page.getByLabel(/^Email/).fill('ui-owner@example.com')
  await page.getByRole('button', { name: /Create account/i }).click()
  const inputs = page.locator('input[autocomplete="one-time-code"]')
  await inputs.first().waitFor()
  assert.equal(await page.locator('input[type="password"]').count(), 0)
  const browserCode = code((await messages('ui-owner@example.com')).at(-1))
  for (let i = 0; i < 6; i++) await inputs.nth(i).fill(browserCode[i])
  const passwordInput = page.locator('input[type="password"]').first()
  await passwordInput.waitFor()
  assert.equal(
    (await context.cookies()).filter((cookie) => cookie.name === 'consumer-token').length,
    0,
  )
  await passwordInput.fill(ownerPassword)
  const confirm = page.locator('input[type="password"]').nth(1)
  if (await confirm.count()) await confirm.fill(ownerPassword)
  const completed = page.waitForResponse((response) => response.url().endsWith('/access/signup'))
  await page.getByRole('button', { name: /Set password|Create account|Sign up/i }).click()
  assert.equal((await completed).status(), 200)
  assert.equal(
    (await context.cookies()).filter((cookie) => cookie.name === 'consumer-token').length,
    0,
  )
  const uiCookie = await login('ui-owner@example.com', ownerPassword)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Open login' }).click()
  await page.getByLabel(/^Email/).fill('ui-owner@example.com')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('link', { name: /Forgot password/i }).click()
  await page.getByLabel(/^Email/).fill('ui-owner@example.com')
  const recoverySent = page.waitForResponse(
    (response) =>
      response.url().endsWith('/access/forgot-password') ||
      response.url().endsWith('/access/otp/send'),
  )
  await page.getByRole('button', { name: 'Send Reset Code', exact: true }).click()
  assert.equal((await recoverySent).status(), 200)
  await inputs.first().waitFor()
  const recoveryCode = code((await messages('ui-owner@example.com')).at(-1))
  for (let i = 0; i < 6; i++) await inputs.nth(i).fill(recoveryCode[i])
  await passwordInput.waitFor()
  assert.equal((await me(uiCookie)).email, 'ui-owner@example.com')
  await passwordInput.fill(nextPassword)
  if (await confirm.count()) await confirm.fill(nextPassword)
  const recovered = page.waitForResponse((response) =>
    response.url().endsWith('/access/reset-password'),
  )
  await page.getByRole('button', { name: 'Set Password', exact: true }).click()
  assert.equal((await recovered).status(), 200)
  assert.equal(await me(uiCookie), null)
  assert.equal(
    (await context.cookies()).filter((cookie) => cookie.name === 'consumer-token').length,
    0,
  )
  const uiCurrent = await login('ui-owner@example.com', nextPassword)
  const uiOther = await login('ui-owner@example.com', nextPassword, origin2)
  await context.addCookies([
    {
      name: 'consumer-token',
      value: uiCurrent.split('=')[1],
      url: origin,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.goto(`${origin}/change`)
  await page.getByLabel('Current password', { exact: true }).fill(nextPassword)
  const reauthenticated = page.waitForResponse((response) =>
    response.url().endsWith('/access/reauthenticate'),
  )
  await page.getByRole('button', { name: 'Reauthenticate', exact: true }).click()
  assert.equal((await reauthenticated).status(), 200)
  await page.getByLabel(/^New password/i).fill(ownerPassword)
  await page.getByLabel(/^Confirm password/i).fill(ownerPassword)
  const voluntarilyChanged = page.waitForResponse((response) =>
    response.url().endsWith('/access/set-password'),
  )
  await page.getByRole('button', { name: 'Set Password', exact: true }).click()
  assert.equal((await voluntarilyChanged).status(), 200)
  await page.waitForURL(`${origin}/`)
  assert.equal(await me(uiCurrent), null)
  assert.equal(await me(uiOther), null)
  const uiRotated = (await context.cookies()).find((cookie) => cookie.name === 'consumer-token')
  assert.ok(uiRotated?.httpOnly)
  assert.equal((await me(`consumer-token=${uiRotated.value}`)).email, 'ui-owner@example.com')
  if (process.env.AUTH_CONSUMER_OTP === '1') {
    await tick(1001)
    const passwordless = 'passwordless@example.com'
    const loginContext = await request(passwordless, 'login')
    const otpLogin = await post(origin, '/access/otp/verify', {
      email: passwordless,
      purpose: 'login',
      context: loginContext,
      otp: code((await messages(passwordless)).at(-1)),
    })
    await success(otpLogin)
    const otpCookie = otpLogin.headers.get('set-cookie').split(';')[0]
    await context.addCookies([
      {
        name: 'consumer-token',
        value: otpCookie.split('=')[1],
        url: origin,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])
    await page.goto(`${origin}/change`)
    await tick(1001)
    await page.getByRole('button', { name: 'Verify by email', exact: true }).click()
    await inputs.first().waitFor()
    const addingCode = code((await messages(passwordless)).at(-1))
    for (let i = 0; i < 6; i++) await inputs.nth(i).fill(addingCode[i])
    await passwordInput.waitFor()
    await passwordInput.fill(ownerPassword)
    await confirm.fill(ownerPassword)
    const added = page.waitForResponse((response) =>
      response.url().endsWith('/access/set-password'),
    )
    await page.getByRole('button', { name: 'Set Password', exact: true }).click()
    assert.equal((await added).status(), 200)
    await page.waitForURL(`${origin}/`)
    assert.equal(await me(otpCookie), null)
    await login(passwordless, ownerPassword)
    mark(
      'Chromium explicit password addition to OTP-only account requires permitted OTP reauthentication',
    )
  }
  await context.close()
  for (const purpose of ['signup', 'recovery']) {
    const expiredEmail =
      purpose === 'signup' ? 'ui-expired-signup@example.com' : 'ui-owner@example.com'
    const preservedCookie = purpose === 'recovery' ? await login(expiredEmail, ownerPassword) : null
    const expiryContext = await browser.newContext()
    const expiryPage = await expiryContext.newPage()
    onPage?.(expiryPage)
    await expiryPage.clock.install({ time: new Date(now) })
    await expiryPage.goto(origin)
    await expiryPage.getByRole('button', { name: 'Open login' }).click()
    if (purpose === 'signup') await expiryPage.getByRole('link', { name: /Sign up/i }).click()
    else {
      await expiryPage.getByLabel(/^Email/).fill(expiredEmail)
      await expiryPage.getByRole('button', { name: 'Continue', exact: true }).click()
      await expiryPage.getByRole('link', { name: /Forgot password/i }).click()
    }
    const requestAndVerify = async () => {
      await expiryPage.getByLabel(/^Email/).fill(expiredEmail)
      await expiryPage
        .getByRole('button', {
          name: purpose === 'signup' ? 'Create Account' : 'Send Reset Code',
          exact: true,
        })
        .click()
      const digits = expiryPage.locator('input[autocomplete="one-time-code"]')
      await digits.first().waitFor()
      const latestCode = code((await messages(expiredEmail)).at(-1))
      for (let i = 0; i < 6; i++) await digits.nth(i).fill(latestCode[i])
      await expiryPage.locator('input[autocomplete="new-password"]').first().waitFor()
    }
    await requestAndVerify()
    await tick(600001)
    await expiryPage.clock.fastForward(600001)
    await expiryPage
      .getByRole('button', {
        name: purpose === 'signup' ? 'Create Account' : 'Send Reset Code',
        exact: true,
      })
      .waitFor()
    if (purpose === 'signup') assert.equal((await users(expiredEmail)).length, 0)
    else assert.equal((await me(preservedCookie)).email, expiredEmail)
    await requestAndVerify()
    await expiryPage.getByLabel(/^New password/i).fill(nextPassword)
    await expiryPage.getByLabel(/^Confirm password/i).fill(nextPassword)
    const restarted = expiryPage.waitForResponse((response) =>
      response.url().endsWith(purpose === 'signup' ? '/access/signup' : '/access/reset-password'),
    )
    await expiryPage.getByRole('button', { name: 'Set Password', exact: true }).click()
    assert.equal((await restarted).status(), 200)
    assert.equal(
      (await expiryContext.cookies()).filter((cookie) => cookie.name === 'consumer-token').length,
      0,
    )
    await login(expiredEmail, nextPassword)
    if (preservedCookie) assert.equal(await me(preservedCookie), null)
    await expiryContext.close()
  }
  mark(
    'Chromium mounted signup/recovery grant expiry returns to same-purpose fresh proof and completes without early mutation',
  )
  mark(
    'Chromium packed registration: email proof before password, owner-selected credentials; recovery confirmation/revocation without automatic login; voluntary reauth/change/session rotation',
  )
  console.log(
    JSON.stringify(
      { passed: true, database, instances: 2, browser: 'Chromium', verified },
      null,
      2,
    ),
  )
  return { passed: true, database, browser: 'Chromium', instances: 2, verified }
}
