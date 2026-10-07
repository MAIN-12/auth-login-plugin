import assert from 'node:assert/strict'
import AxeBuilder from '@axe-core/playwright'

// Playwright's visible check includes opacity:0 SSR controls. Observe the actual
// public card transition before interacting; do not sleep or alter auth outcomes.
export async function waitForPublicPresentation(page, name) {
  // Explicit fixture hydration observation; not a promise that arbitrary lazy
  // descendant controls are ready, nor evidence of no-JavaScript support.
  if (await page.locator('[data-consumer-hydrated]').count()) {
    await page.locator('[data-consumer-hydrated="true"]').waitFor({ timeout: 2000 })
    console.log(`Issue05 consumer hydrated ${name}: ${JSON.stringify(await page.evaluate(() => ({ timestamp: performance.now(), ready: document.querySelector('[data-consumer-hydrated]')?.getAttribute('data-consumer-hydrated') })))}`)
  }
  if (!await page.locator('[data-auth-card-ready]').count()) return
  await page.waitForFunction(() => [...document.querySelectorAll('[data-auth-card-ready]')].filter(element => element.getClientRects().length).every(element => getComputedStyle(element).opacity === '1'), undefined, { timeout: 2000 })
  console.log(`Issue05 presentation ready ${name}: ${JSON.stringify(await page.evaluate(() => ({ timestamp: performance.now(), opacity: [...document.querySelectorAll('[data-auth-card-ready]')].map(element => getComputedStyle(element).opacity) })))}`)
}

// Authentication and storage outcomes come from the packed plugin and real Payload adapter.
// Browser scheduling below delays a real request, never substitutes its result.
export async function verifyIntegrationAcceptance({ browser, origin, provider, database, onPage, diagnostic = false }) {
  const matrix = []
  const checks = []
  const a11y = []
  const originalPassword = 'actual-browser-test-password'
  const newPassword = 'consumer owns a distinctive long phrase'
  const post = (path, body) => fetch(`${origin}/backend/access${path}`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const snapshot = async () => (await (await fetch(`${origin}/fixture`)).json())
  const control = async body => assert.equal((await fetch(`${origin}/fixture`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).status, 200)
  // Initialize the real adapter before UI interaction: Next dev must not hot-reload
  // a browser form when schema creation writes the disposable SQLite database.
  assert.equal((await fetch(`${origin}/fixture?email=browser%40example.com`)).status, 200)
  let now = (await snapshot()).now
  const tick = async () => { now += 3600001; await control({ now }) }
  const mail = async email => (await snapshot()).inbox.filter(message => message.to === email).at(-1)
  const code = message => String(message.html).match(/\b(\d{6})\b/)[1]
  const translations = locale => locale === 'es' ? { email: /^Correo/, continue: 'Continuar', signup: /Regístrate/, create: 'Crear Cuenta', send: 'Enviar Código', reset: 'Enviar Código', forgot: /Olvidaste|Olvidó|Olvidaste tu contraseña/i, set: 'Establecer Contraseña', invalid: 'Correo o contraseña inválidos.', google: 'Continuar con Google' } : { email: /^Email/, continue: 'Continue', signup: /Sign up/i, create: 'Create Account', send: 'Send Code', reset: 'Send Reset Code', forgot: /Forgot password/i, set: 'Set Password', invalid: 'Invalid email or password.', google: 'Continue with Google' }
  const scan = async (page, name) => {
    await page.waitForTimeout(400) // measure the settled presentation, not transient reveal opacity
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
    a11y.push({ name, violations: result.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })) })
    assert.deepEqual(a11y.at(-1).violations, [], `axe ${name}`)
  }
  const open = async (surface, style, locale, viewport, form = 'login', redirect = '/landing?source=consumer#complete') => {
    const context = await browser.newContext({ viewport, locale: locale === 'es' ? 'es-CO' : 'en-US', ...(viewport.width < 500 ? { isMobile: true, hasTouch: true } : {}) })
    const page = await context.newPage()
    onPage?.(page)
    page.setDefaultTimeout(20000)
    page.on('pageerror', error => console.log(`Issue05 browser pageerror: ${error.message}`))
    const requests = []
    const payloads = []
    // Buffer an unchanged real HTTP response before a full-document navigation can
    // evict Chromium's response body. Forward request once; preserve all response
    // bytes/headers/status (including real Set-Cookie), never fabricate outcomes.
    await page.route(/\/backend\/access\/(?:login|otp\/verify)$/, async route => {
      const response = await route.fetch()
      payloads.push({ url: route.request().url(), status: response.status(), body: await response.json() })
      await route.fulfill({ response })
    })
    page.on('request', request => requests.push(request.url()))
    const base = `/members/${surface}/${style}/${locale}`
    await page.goto(`${origin}${base}/${form}?redirect=${encodeURIComponent(redirect)}`)
    await waitForPublicPresentation(page, `${surface}/${style}/${locale}/${form}`)
    if (surface === 'modal') await page.getByRole('button', { name: 'Open login' }).click()
    await page.getByLabel(translations(locale).email).filter({ visible: true }).waitFor()
    return { context, page, requests, payloads, base, t: translations(locale) }
  }
  const assertCookie = async context => {
    const cookie = (await context.cookies()).find(item => item.name === 'consumer-token')
    assert.ok(cookie?.httpOnly)
    assert.equal(cookie.sameSite, 'Lax')
    return cookie
  }
  const assertPublic = async page => {
    const secrets = ['consumer-only-private-secret-not-production', 'consumer-only-otp-secret-not-production', 'consumer-google-secret-private']
    for (const text of [await page.content(), ...await Promise.all((await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.src))).map(async url => (await (await fetch(url)).text())))]) for (const secret of secrets) assert.ok(!text.includes(secret), `public leak ${secret}`)
  }
  const enterCode = async (page, digits) => {
    const inputs = page.locator('input[autocomplete="one-time-code"]')
    await inputs.first().waitFor()
    assert.equal(await inputs.count(), 6, 'both adapters expose six positional inputs')
    await inputs.first().evaluate((element, value) => { const event = new Event('paste', { bubbles: true, cancelable: true }); Object.defineProperty(event, 'clipboardData', { value: { getData: () => value } }); element.dispatchEvent(event) }, digits)
  }

  // Every variant is exercised on a real desktop and a touch/mobile Chromium context.
  if (!diagnostic) for (const surface of ['card', 'page', 'modal']) for (const style of ['tailwind', 'hero-ui']) for (const locale of ['en', 'es']) for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const cell = `${surface}/${style}/${locale}/${viewport.width}`
    const { context, page, requests, payloads, t } = await open(surface, style, locale, viewport)
    if (surface === 'modal') {
      const dialog = page.getByRole('dialog')
      await dialog.waitFor()
      await page.waitForFunction(() => {
        const dialog = document.querySelector('[role="dialog"], dialog')
        return Boolean(dialog?.contains(document.activeElement))
      }, undefined, { timeout: 2000 })
      const initialFocus = await dialog.evaluate(element => ({ tag: document.activeElement?.tagName, id: document.activeElement?.id, dialogItself: document.activeElement === element, contained: element.contains(document.activeElement), documentFocus: document.hasFocus(), timestamp: performance.now() }))
      console.log(`Issue05 modal initial focus ${cell}: ${JSON.stringify(initialFocus)}`)
      assert.ok(initialFocus.contained, `${cell} initial focus in modal`)
      for (let step = 0; step < 10; step++) { await page.keyboard.press('Tab'); assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)), `${cell} Tab trapped`) }
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'hidden' })
      await page.waitForFunction(() => {
        const trigger = [...document.querySelectorAll('button')].find(element => element.textContent === 'Open login')
        return document.activeElement === trigger
      }, undefined, { timeout: 2000 })
      const restoredFocus = await page.getByRole('button', { name: 'Open login' }).evaluate(element => ({ exactTrigger: document.activeElement === element, tag: document.activeElement?.tagName, text: document.activeElement?.textContent, documentFocus: document.hasFocus(), timestamp: performance.now() }))
      console.log(`Issue05 modal restored focus ${cell}: ${JSON.stringify(restoredFocus)}`)
      assert.ok(restoredFocus.exactTrigger, `${cell} restores trigger focus`)
      await page.keyboard.press('Enter')
      await dialog.waitFor()
    }
    await scan(page, `${cell}/email`)
    await page.getByLabel(t.email).filter({ visible: true }).fill('browser@example.com')
    await page.getByRole('button', { name: t.continue, exact: true }).click()
    await page.locator('input[type="password"]').fill('incorrect-owner-password')
    let response = page.waitForResponse(response => response.url().endsWith('/backend/access/login'))
    await page.locator('input[type="password"]').press('Enter')
    assert.equal((await response).status(), 401)
    await page.getByRole('alert').filter({ hasText: t.invalid }).waitFor()
    assert.ok(await page.locator('input[aria-invalid="true"][aria-describedby]').count(), `${cell} associated validation`)
    await scan(page, `${cell}/failed-password`)
    await page.locator('input[type="password"]').fill(originalPassword)
    response = page.waitForResponse(response => response.url().endsWith('/backend/access/login'))
    await page.locator('input[type="password"]').press('Enter')
    const success = await response
    assert.equal(success.status(), 200)
    assert.equal('token' in payloads.at(-1).body, false)
    await page.waitForURL(`${origin}/landing?source=consumer#complete`)
    await page.getByTestId('email').filter({ hasText: 'browser@example.com' }).waitFor()
    await assertCookie(context)
    assert.ok(!requests.some(url => /\/api\/users|\/auth\/|check-email/.test(url)), `${cell} no default routes/account lookup`)
    await assertPublic(page)
    matrix.push({ surface, style, locale, viewport: viewport.width, passwordLogin: 'passed', keyboard: 'passed', a11y: 'passed', queryHash: 'preserved' })
    console.log(`Issue05 matrix GREEN ${cell}`)
    await context.close()
  }

  // Six independent surface/style lifecycles alternate ES/EN and mobile/desktop.
  for (const [index, cell] of ['card/tailwind', 'card/hero-ui', 'page/tailwind', 'page/hero-ui', 'modal/tailwind', 'modal/hero-ui'].entries()) {
    await tick()
    const [surface, style] = cell.split('/')
    const locale = index % 2 ? 'es' : 'en'
    const email = `integration-owner-${index}@example.com`
    const { context, page, base, t } = await open(surface, style, locale, { width: index % 2 ? 390 : 1280, height: 900 })
    await page.getByRole('link', { name: t.signup }).click()
    if (surface !== 'modal') await page.waitForURL(`${origin}${base}/signup?redirect=*`)
    await page.getByRole('button', { name: t.create, exact: true }).waitFor()
    await waitForPublicPresentation(page, `${cell}/signup`)
    await page.getByLabel(t.email).filter({ visible: true }).fill(email)
    let sent = page.waitForResponse(response => response.url().endsWith('/access/otp/send'))
    await page.getByRole('button', { name: t.create, exact: true }).click()
    assert.equal((await sent).status(), 200)
    const inputs = page.locator('input[autocomplete="one-time-code"]')
    await inputs.first().waitFor()
    assert.equal(await page.locator('input[type="password"]').count(), 0)
    assert.equal((await context.cookies()).some(item => item.name === 'consumer-token'), false)
    await scan(page, `${cell}/${locale}/otp`)
    // Write/delete out of order. Editing position five must not shift positions one or six.
    await inputs.nth(4).fill('5')
    assert.equal(await inputs.nth(0).inputValue(), '')
    assert.equal(await inputs.nth(4).inputValue(), '5')
    await inputs.nth(1).fill('2')
    await inputs.nth(4).fill('')
    assert.equal(await inputs.nth(1).inputValue(), '2')
    assert.equal(await inputs.nth(4).inputValue(), '')
    const message = await mail(email)
    const digits = code(message)
    assert.ok(String(message.html).includes('Consumer &lt;Brand&gt;'))
    assert.ok(!String(message.html).includes('undefined'))
    assert.ok(!String(message.subject).includes(digits))
    // Configured HTTPS contact takes precedence over the fallback email address.
    assert.ok(String(message.html).includes(`href="https://consumer.example.test/contact">${locale === 'es' ? 'Si tienes algún problema, contáctanos a' : 'If you have any issues, contact us at'}</a>`))
    assert.ok(String(message.html).includes(locale === 'es' ? 'Hola' : 'Hi'))
    const preheader = String(message.html).match(/<div[^>]*display:\s*none[^>]*>([\s\S]*?)<\/div>/i)?.[1]
    if (preheader) assert.ok(!preheader.includes(digits), 'OTP not in preheader')
    // Hold the real verify request to overlap automatic completion with a manual keyboard submit.
    let verificationCount = 0
    let release
    const gate = new Promise(resolve => { release = resolve })
    await page.route('**/backend/access/otp/verify', async route => { verificationCount++; await gate; await route.continue() })
    await enterCode(page, digits)
    await page.waitForTimeout(100)
    await page.keyboard.press('Enter')
    assert.equal(verificationCount, 1, `${cell} automatic/manual single flight`)
    release()
    await page.locator('input[type="password"]').first().waitFor()
    assert.equal(verificationCount, 1)
    await page.unroute('**/backend/access/otp/verify')
    assert.equal((await context.cookies()).some(item => item.name === 'consumer-token'), false)
    await scan(page, `${cell}/${locale}/set-password`)
    await page.locator('input[type="password"]').nth(0).fill(newPassword)
    await page.locator('input[type="password"]').nth(1).fill(newPassword)
    const created = page.waitForResponse(response => response.url().endsWith('/access/signup'))
    await page.getByRole('button', { name: t.set, exact: true }).click()
    assert.equal((await created).status(), 200)
    assert.equal((await context.cookies()).some(item => item.name === 'consumer-token'), false)
    const login = await post('/login', { email, password: newPassword })
    assert.equal(login.status, 200)
    const previousCookie = login.headers.get('set-cookie').split(';')[0]
    // Restart recovery at the custom route; no account status lookup or previous cookie required.
    await page.goto(`${origin}${base}/${surface === 'modal' ? 'login' : 'forgot-password'}?redirect=${encodeURIComponent('/landing?source=recovery#complete')}`)
    await waitForPublicPresentation(page, `${cell}/recovery-entry`)
    if (surface === 'modal') {
      await page.getByRole('button', { name: 'Open login' }).click()
      await page.getByLabel(t.email).filter({ visible: true }).fill(email)
      await page.getByRole('button', { name: t.continue, exact: true }).click()
      await page.getByRole('link', { name: t.forgot }).click()
    }
    await page.getByRole('button', { name: t.reset, exact: true }).waitFor()
    await waitForPublicPresentation(page, `${cell}/recovery`)
    await page.getByLabel(t.email).filter({ visible: true }).fill(email)
    sent = page.waitForResponse(response => response.url().endsWith('/access/forgot-password') || response.url().endsWith('/access/otp/send'))
    await page.getByRole('button', { name: t.reset, exact: true }).click()
    assert.equal((await sent).status(), 200)
    await enterCode(page, code(await mail(email)))
    await page.locator('input[type="password"]').first().waitFor()
    const recoveredPassword = `${newPassword} recovered ${index}`
    await page.locator('input[type="password"]').nth(0).fill(recoveredPassword)
    await page.locator('input[type="password"]').nth(1).fill(recoveredPassword)
    const reset = page.waitForResponse(response => response.url().endsWith('/access/reset-password'))
    await page.getByRole('button', { name: t.set, exact: true }).click()
    assert.equal((await reset).status(), 200)
    assert.equal((await (await fetch(`${origin}/backend/customers/me`, { headers: { origin, cookie: previousCookie } })).json()).user, null)
    assert.equal((await post('/login', { email, password: recoveredPassword })).status, 200)
    checks.push(`${cell}/${locale}: signup, positional OTP paste/singleflight, ownership completion, recovery, real session revocation`)
    await context.close()
  }

  // Login OTP and generic failed credentials retain the same configured contracts.
  for (const [index, cell] of ['card/tailwind', 'card/hero-ui', 'page/tailwind', 'page/hero-ui', 'modal/tailwind', 'modal/hero-ui'].entries()) {
    await tick()
    const [surface, style] = cell.split('/')
    const locale = index % 2 ? 'es' : 'en'
    const { context, page, payloads, t } = await open(surface, style, locale, { width: index % 2 ? 390 : 1280, height: 900 })
    await page.getByLabel(t.email).filter({ visible: true }).fill('mail@example.com')
    await page.getByRole('button', { name: t.continue, exact: true }).click()
    const sent = page.waitForResponse(response => response.url().endsWith('/access/otp/send'))
    await page.getByRole('button', { name: t.send, exact: true }).click()
    assert.equal((await sent).status(), 200)
    const digits = code(await mail('mail@example.com'))
    const failed = page.waitForResponse(response => response.url().endsWith('/access/otp/verify'))
    await enterCode(page, digits === '000000' ? '999999' : '000000')
    assert.equal((await failed).status(), 401)
    const authScope = await page.getByRole('dialog').count() ? page.getByRole('dialog') : page.locator('main[data-consumer-hydrated]')
    const errorAlert = authScope.getByRole('alert')
    await errorAlert.waitFor()
    assert.equal(await errorAlert.textContent(), locale === 'es' ? 'Algo salió mal. Por favor intenta de nuevo.' : 'Something went wrong. Please try again.')
    assert.equal((await context.cookies()).some(item => item.name === 'consumer-token'), false)
    await scan(page, `${cell}/${locale}/failed-otp`)
    const accepted = page.waitForResponse(response => response.url().endsWith('/access/otp/verify'))
    await enterCode(page, digits)
    const response = await accepted
    assert.equal(response.status(), 200)
    assert.equal('token' in payloads.at(-1).body, false)
    await page.waitForURL(`${origin}/landing?source=consumer#complete`)
    await assertCookie(context)
    await context.close()
    checks.push(`${cell}/${locale}: real failed/successful OTP login, localized announced failure, preserved query/hash`)
  }

  // The shared OAuth fixture deliberately makes browser@example.com an Admin.
  // Issue04 forbids email OTP for original-Admin-eligible accounts; do not relax it.
  await tick()
  const adminChallenge = await (await post('/otp/send', { email: 'browser@example.com', purpose: 'login' })).json()
  const adminOtp = await post('/otp/verify', { email: 'browser@example.com', purpose: 'login', context: adminChallenge.context, otp: code(await mail('browser@example.com')) })
  assert.equal(adminOtp.status, 401)
  assert.equal(adminOtp.headers.get('set-cookie'), null)
  assert.deepEqual(await adminOtp.json(), { success: false, code: 'AUTH_FAILED' })
  checks.push('real correct-code OTP denied for original Admin-eligible fixture account; ordinary verified account OTP succeeds')

  // Existing and unknown accounts fail with identical public shape; the UI never enumerates.
  const proxyResponse = await fetch(`${origin}/login?redirect=${encodeURIComponent('/landing?proxy=1#complete')}`, { redirect: 'manual' })
  assert.equal(proxyResponse.status, 307)
  assert.equal(new URL(proxyResponse.headers.get('location'), origin).pathname, '/members/login')
  assert.equal(new URL(proxyResponse.headers.get('location'), origin).searchParams.get('redirect'), '/landing?proxy=1#complete')
  const existingFailure = await post('/login', { email: 'browser@example.com', password: 'incorrect-owner-password' })
  const unknownFailure = await post('/login', { email: 'never-registered@example.com', password: 'incorrect-owner-password' })
  assert.equal(existingFailure.status, unknownFailure.status)
  assert.match(existingFailure.headers.get('X-Auth-Request-ID'), /^[a-f0-9-]{36}$/)
  assert.deepEqual(await existingFailure.json(), await unknownFailure.json())
  for (const unsafe of ['//attacker.invalid', '/%2f%2fattacker.invalid', '/\\attacker.invalid', 'https://attacker.invalid']) {
    const context = await browser.newContext()
    const page = await context.newPage(); onPage?.(page)
    await page.goto(`${origin}/members/card/tailwind/en/login?redirect=${encodeURIComponent(unsafe)}`)
    await page.getByLabel(/^Email/).filter({ visible: true }).waitFor()
    await waitForPublicPresentation(page, 'unsafe-return/login')
    await page.getByLabel(/^Email/).filter({ visible: true }).fill('browser@example.com')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.locator('input[type="password"]').fill(originalPassword)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.waitForURL(`${origin}/`)
    await context.close()
  }
  checks.push('public failed credentials indistinguishable for unknown/existing; browser rejects external/encoded/backslash return destinations')

  // Missing link state is recoverable, including invalid context rather than only missing email.
  for (const style of ['tailwind', 'hero-ui']) for (const locale of ['en', 'es']) for (const query of ['', '?email=browser%40example.com&context=invalid']) {
    const context = await browser.newContext()
    const page = await context.newPage(); onPage?.(page)
    await page.goto(`${origin}/members/card/${style}/${locale}/verify-otp${query}`)
    const incompleteAlert = page.locator('main[data-consumer-hydrated]').getByRole('alert')
    await incompleteAlert.waitFor()
    assert.ok((await incompleteAlert.textContent()).includes(locale === 'es' ? 'Este enlace de verificación está incompleto.' : 'This verification link is incomplete.'))
    const next = page.getByRole('link', { name: /login|sesión/i })
    assert.ok(await next.count())
    assert.match(await next.first().getAttribute('href'), /^\/members\/card\//)
    await scan(page, `${style}/${locale}/incomplete-otp`)
    await context.close()
  }
  checks.push('incomplete OTP links have localized explicit recovery, non-default custom destination')

  // Controlled real OIDC authorization and signed callback through each configured UI adapter.
  for (const style of ['tailwind', 'hero-ui']) for (const locale of ['en', 'es']) {
    const { context, page, t } = await open('card', style, locale, { width: 1280, height: 900 })
    provider.configure({ sub: `integration-google-${style}-${locale}`, email: `google-${style}-${locale}@example.com` })
    await page.getByRole('button', { name: t.google, exact: true }).click()
    await page.waitForURL(`${origin}/landing?source=consumer#complete`)
    await assertCookie(context)
    await context.close()
  }
  checks.push('configured Google path and signed OIDC callback preserve query/hash in both locales/styles (not live Google)')
  // Public individual page export must inherit enabled signup and custom mount defaults.
  for (const style of ['tailwind', 'hero-ui']) {
    const context = await browser.newContext()
    const page = await context.newPage(); onPage?.(page)
    await page.goto(`${origin}/individual?style=${style}`)
    await page.getByRole('link', { name: /Sign up/i }).waitFor()
    await waitForPublicPresentation(page, `${style}/individual/login`)
    const signup = page.getByRole('link', { name: /Sign up/i })
    await signup.waitFor()
    const target = new URL(await signup.getAttribute('href'), origin)
    assert.equal(target.pathname, '/members/signup')
    assert.equal(target.searchParams.get('redirect'), '/landing?source=individual#complete')
    await signup.click()
    await page.getByRole('button', { name: 'Create Account', exact: true }).waitFor()
    await waitForPublicPresentation(page, `${style}/individual/signup`)
    await context.close()
  }
  checks.push('independent LoginPage export in both adapters inherits configured signup/custom mount with destination')

  // Standalone email reauthentication keeps the caller destination through actual proof/session rotation.
  await tick()
  const reauthContext = await browser.newContext()
  const reauthPage = await reauthContext.newPage(); onPage?.(reauthPage)
  const previous = await post('/login', { email: 'browser@example.com', password: originalPassword })
  assert.equal(previous.status, 200)
  const previousCookie = previous.headers.get('set-cookie').split(';')[0]
  await reauthContext.addCookies([{ name: 'consumer-token', value: previousCookie.split('=')[1], url: origin, httpOnly: true, sameSite: 'Lax' }])
  await reauthPage.goto(`${origin}/change?redirect=${encodeURIComponent('/landing?source=reauth#complete')}`)
  await reauthPage.getByRole('button', { name: 'Verify by email', exact: true }).waitFor()
  await waitForPublicPresentation(reauthPage, 'standalone/reauth/change')
  await reauthPage.getByRole('button', { name: 'Verify by email', exact: true }).click()
  await reauthPage.locator('input[autocomplete="one-time-code"]').first().waitFor()
  await waitForPublicPresentation(reauthPage, 'standalone/reauth/otp')
  const continuation = new URL(reauthPage.url())
  assert.equal(continuation.pathname, '/members/verify-otp')
  assert.equal(continuation.searchParams.get('purpose'), 'reauth')
  assert.equal(continuation.searchParams.get('redirect'), '/landing?source=reauth#complete')
  await enterCode(reauthPage, code(await mail('browser@example.com')))
  await reauthPage.locator('input[autocomplete="new-password"]').first().waitFor()
  const changedPassword = 'standalone reauthentication owns this long phrase'
  await reauthPage.locator('input[type="password"]').nth(0).fill(changedPassword)
  await reauthPage.locator('input[type="password"]').nth(1).fill(changedPassword)
  const changed = reauthPage.waitForResponse(response => response.url().endsWith('/access/set-password'))
  await reauthPage.getByRole('button', { name: 'Set Password', exact: true }).click()
  assert.equal((await changed).status(), 200)
  await reauthPage.waitForURL(`${origin}/landing?source=reauth#complete`)
  const rotated = await assertCookie(reauthContext)
  assert.notEqual(rotated.value, previousCookie.split('=')[1])
  assert.equal((await (await fetch(`${origin}/backend/customers/me`, { headers: { origin, cookie: previousCookie } })).json()).user, null)
  await reauthContext.close()
  checks.push('standalone email reauth preserves query/hash through OTP/proof/completion and rotates real native session')
  const logs = (await snapshot()).logs.join('')
  for (const secret of [originalPassword, newPassword, changedPassword]) assert.ok(!logs.includes(secret), 'logger excludes password')
  for (const digits of (await snapshot()).inbox.map(code)) assert.ok(!new RegExp(`\\b${digits}\\b`).test(logs), 'logger excludes standalone OTP')
  assert.ok(logs.includes(existingFailure.headers.get('X-Auth-Request-ID')), 'failure header links captured sanitized logger correlation')
  assert.ok(!/"token"\s*:|"hash"\s*:|"salt"\s*:/.test(logs), 'logger excludes credentials/token bodies')
  checks.push('captured consumer logger excludes passwords, OTP and token bodies')
  const evidence = { issue: '05', passed: !diagnostic, diagnosticSubset: diagnostic, database, browser: 'Chromium', matrix, a11y, checks, manualOutstanding: ['real screen-reader announcement/reading-order validation', 'human visual contrast/zoom/target-size inspection', 'real mobile device and live Google acceptance'], claim: diagnostic ? 'DIAGNOSTIC subset only; full matrix skipped, not final acceptance.' : 'Automated checks are evidence, not WCAG certification of consumer applications.' }
  console.log(JSON.stringify(evidence, null, 2))
  return evidence
}
