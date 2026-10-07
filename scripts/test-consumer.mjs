import { createHash } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { cp, mkdtemp, readFile, readdir, rm, writeFile, mkdir, access } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { temporaryPostgres, freePort } from './otp-postgres.mjs'
import { verifyPasswordAcceptance } from '../tests/password-browser.mjs'
import { verifyOtpAcceptance } from '../tests/otp-browser.mjs'
import { verifyOauthAcceptance } from '../tests/oauth-browser.mjs'
import { controlledOidcProvider } from './oauth-provider.mjs'
const password = process.env.AUTH_CONSUMER_PASSWORD === '1'
const otp = process.env.AUTH_CONSUMER_OTP === '1'
const oauth = process.env.AUTH_CONSUMER_OAUTH === '1'
const shared = otp || password || oauth
let provider
let postgres
let secondary
let diagnosticPage
const browserEvidence = []
const bundlerArgs = process.env.AUTH_CONSUMER_BUNDLER === 'webpack' ? ['--webpack'] : []

const root = resolve(import.meta.dirname, '..')
const temp = await mkdtemp(join(tmpdir(), 'auth-ticket01-consumer-'))
const packageDir = join(temp, 'package')
const app = join(temp, 'app')
let server
let browser
let logs = ''
async function digestDirectory(directory) {
  const hash = createHash('sha256')
  async function visit(path, relative = '') {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = `${relative}/${entry.name}`
      if (entry.isDirectory()) await visit(join(path, entry.name), name)
      else if (entry.isFile()) hash.update(name).update(await readFile(join(path, entry.name)))
    }
  }
  await visit(directory)
  return hash.digest('hex')
}
try {
  if (oauth) provider = await controlledOidcProvider()
  if (shared && process.env.AUTH_CONSUMER_DB !== 'sqlite') postgres = await temporaryPostgres()
  await mkdir(join(root, 'dist'), { recursive: true })
  await writeFile(join(root, 'dist', '__stale-consumer-test.js'), 'obsolete')
  const sourceHash = password || oauth ? await digestDirectory(join(root, 'src')) : null
  execFileSync('pnpm', ['build'], { cwd: root, stdio: 'inherit' })
  await assert.rejects(access(join(root, 'dist', '__stale-consumer-test.js')))
  execFileSync('pnpm', ['pack', '--pack-destination', packageDir], { cwd: root, stdio: 'inherit' })
  const tarball = join(packageDir, (await readdir(packageDir)).find(file => file.endsWith('.tgz')))
  if (password || oauth) assert.equal(await digestDirectory(join(root, 'src')), sourceHash, 'production source changed during build/pack; rerun at a frozen checkpoint')
  const fixtureHash = password || oauth ? await digestDirectory(join(root, 'tests/consumer')) : null
  await cp(join(root, 'tests/consumer'), app, { recursive: true })
  if (password || oauth) {
    assert.equal(await digestDirectory(app), fixtureHash, 'fixture source changed while copying')
    console.log(JSON.stringify({ sourceHash, fixtureHash, packedSha256: createHash('sha256').update(await readFile(tarball)).digest('hex'), node: process.version, payload: '3.90.2', next: '16.3.6', react: '19.2.6' }))
  }
  const manifest = JSON.parse(await readFile(join(app, 'package.json'), 'utf8'))
  manifest.dependencies['@main12/auth-login'] = `file:${tarball}`
  await writeFile(join(app, 'package.json'), JSON.stringify(manifest, null, 2))
  execFileSync('pnpm', ['install', '--ignore-scripts'], { cwd: app, stdio: 'inherit' })
  const probe = createServer()
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  const origin = `http://127.0.0.1:${port}`
  server = spawn('pnpm', ['exec', 'next', 'dev', ...bundlerArgs, '--hostname', '127.0.0.1', '--port', String(port)], { cwd: app, env: { ...process.env, AUTH_CONSUMER_PORT: String(port), ...(provider ? { AUTH_CONSUMER_OIDC_ISSUER: provider.issuer } : {}), ...(postgres ? { AUTH_CONSUMER_DATABASE_URL: postgres.url } : {}), NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  server.stdout.on('data', data => { logs += String(data) })
  server.stderr.on('data', data => { logs += String(data) })
  for (let attempt = 0; attempt < 120; attempt++) {
    try { const ready = await fetch(origin, { signal: AbortSignal.timeout(30000) }); if (ready.ok) break; if (ready.status === 500) throw new Error(`Consumer startup returned 500: ${await ready.text()}`) } catch (error) { if (String(error).includes('startup returned')) throw error }
    if (server.exitCode !== null || attempt === 119) throw new Error(`Consumer failed to start:\n${logs}`)
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  if (shared) {
    const port2 = await freePort()
    secondary = spawn('pnpm', ['exec', 'next', 'dev', ...bundlerArgs, '--hostname', '127.0.0.1', '--port', String(port2)], { cwd: app, env: { ...process.env, AUTH_CONSUMER_OTP: process.env.AUTH_CONSUMER_OTP ?? '0', AUTH_CONSUMER_SECONDARY: '1', ...(postgres ? { AUTH_CONSUMER_DATABASE_URL: postgres.url } : {}), AUTH_CONSUMER_PORT: String(port2), ...(provider ? { AUTH_CONSUMER_OIDC_ISSUER: provider.issuer, AUTH_CONSUMER_PRIMARY_PORT: String(port) } : {}), NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
    secondary.stdout.on('data', data => { logs += String(data) })
    secondary.stderr.on('data', data => { logs += String(data) })
    const origin2 = `http://127.0.0.1:${port2}`
    for (let attempt = 0; attempt < 120; attempt++) {
      try { const ready = await fetch(origin2, { signal: AbortSignal.timeout(30000) }); if (ready.ok) break; if (ready.status === 500) throw new Error(`Secondary startup returned 500: ${await ready.text()}`) } catch (error) { if (String(error).includes('startup returned')) throw error }
      if (secondary.exitCode !== null || attempt === 119) throw new Error(`Secondary failed to start:\n${logs}`)
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    browser = await chromium.launch({ headless: true })
    if (oauth) await verifyOauthAcceptance({ browser, origin, origin2, provider, database: postgres?.version ?? 'SQLite real', onPage: page => { diagnosticPage = page } })
    else if (password) await verifyPasswordAcceptance({ browser, origin, origin2, database: postgres?.version ?? 'SQLite real', onPage: page => { diagnosticPage = page; page.on('response', response => browserEvidence.push({ url: response.url(), status: response.status() })); page.on('pageerror', error => browserEvidence.push({ pageerror: error.message })) } })
    else await verifyOtpAcceptance({ browser, origin, origin2, postgresVersion: postgres.version, outage: postgres.outage })
    execFileSync('pnpm', ['exec', 'tsc', '--noEmit'], { cwd: app, stdio: 'inherit' })
    console.log(`${oauth ? 'OAuth' : password ? 'Password' : 'OTP'} consumer declarations GREEN`)
    process.exitCode = 0
  } else {
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  diagnosticPage = page
  page.on('response', response => browserEvidence.push({ url: response.url(), status: response.status() }))
  page.on('console', message => browserEvidence.push({ console: message.type(), text: message.text() }))
  page.on('pageerror', error => browserEvidence.push({ pageerror: error.message }))
  const requests = []
  page.on('request', request => requests.push(request.url()))
  await page.goto(origin)
  await page.getByRole('button', { name: 'Open login' }).click()
  await page.getByLabel(/^Email/).fill('browser@example.com')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByLabel(/^Password/).fill('actual-browser-test-password')
  const loginResponse = page.waitForResponse(response => response.url().endsWith('/backend/access/login'))
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  const response = await loginResponse
  assert.equal(response.status(), 200)
  // Preserve the original Turbopack browser contract. Webpack diagnosis must reach UI evidence
  // even when its unexpected document navigation discards Chromium's network response body.
  if (!bundlerArgs.length) {
    const result = await response.json()
    assert.equal(result.user.email, 'browser@example.com')
    assert.equal('token' in result, false)
  }
  await page.getByTestId('email').filter({ hasText: 'browser@example.com' }).waitFor()
  assert.equal(await page.locator('dialog').count(), 0)
  const cookie = (await context.cookies()).find(cookie => cookie.name === 'consumer-token')
  assert.ok(cookie?.httpOnly)
  assert.equal(cookie.sameSite, 'Lax')
  assert.ok(!requests.some(url => url.includes('check-email') || url.includes('otp/')))
  const oldCookie = cookie.value
  const jwtExp = JSON.parse(Buffer.from(oldCookie.split('.')[1], 'base64url')).exp
  assert.ok(cookie.expires <= jwtExp + 1)
  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await page.getByTestId('email').filter({ hasText: 'anonymous' }).waitFor()
  const replay = await fetch(`${origin}/backend/customers/me`, { headers: { cookie: `consumer-token=${oldCookie}`, origin } })
  assert.equal((await replay.json()).user, null)
  const refresh = await fetch(`${origin}/backend/customers/refresh-token`, { method: 'POST', headers: { cookie: `consumer-token=${oldCookie}`, origin } })
  assert.equal(refresh.status, 401)
  for (const source of await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.src))) {
    const javascript = await (await fetch(source)).text()
    assert.ok(!javascript.includes('consumer-only-private-secret-not-production'))
  }
  const html = await page.content()
  assert.ok(!html.includes('consumer-only-private-secret-not-production'))
  execFileSync('pnpm', ['exec', 'tsc', '--noEmit'], { cwd: app, stdio: 'inherit' })
  console.log(JSON.stringify({ passed: true, package: manifest.dependencies['@main12/auth-login'].split('/').pop(), node: process.version, payload: manifest.dependencies.payload, next: manifest.dependencies.next, react: manifest.dependencies.react, database: 'SQLite real', browser: 'Chromium', verified: ['packaged plugin/client/RSC/proxy imports', 'real password login', 'effective cookie prefix/HttpOnly/SameSite/expiry', 'no public account lookup', 'removeTokenFromResponses', 'server logout and replay rejection', 'consumer declarations', 'no private secret in client script chunks', 'stale dist excluded by clean build'] }, null, 2))
  }
} catch (error) {
  if (diagnosticPage && !diagnosticPage.isClosed()) {
    await diagnosticPage.screenshot({ path: `/tmp/auth-password-${bundlerArgs.length ? 'webpack' : 'turbopack'}-red.png` }).catch(() => {})
    await writeFile(`/tmp/auth-password-${bundlerArgs.length ? 'webpack' : 'turbopack'}-red.html`, await diagnosticPage.content().catch(() => 'unavailable'))
    await writeFile(`/tmp/auth-password-${bundlerArgs.length ? 'webpack' : 'turbopack'}-network.json`, JSON.stringify(browserEvidence, null, 2))
  }
  console.error(logs)
  throw error
} finally {
  await browser?.close()
  for (const child of [server, secondary]) {
    if (!child?.pid) continue
    try { process.kill(-child.pid, 'SIGTERM') } catch {}
    for (let attempt = 0; attempt < 30; attempt++) {
      try { process.kill(-child.pid, 0) } catch { break }
      await new Promise(resolve => setTimeout(resolve, 100))
      if (attempt === 29) { try { process.kill(-child.pid, 'SIGKILL') } catch {} }
    }
  }
  await postgres?.close()
  await provider?.close()
  await rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
}
