import { execFileSync, spawn } from 'node:child_process'
import { cp, mkdtemp, readFile, readdir, rm, writeFile, mkdir, access } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const root = resolve(import.meta.dirname, '..')
const temp = await mkdtemp(join(tmpdir(), 'auth-ticket01-consumer-'))
const packageDir = join(temp, 'package')
const app = join(temp, 'app')
let server
let browser
let logs = ''
try {
  await mkdir(join(root, 'dist'), { recursive: true })
  await writeFile(join(root, 'dist', '__stale-consumer-test.js'), 'obsolete')
  execFileSync('pnpm', ['build'], { cwd: root, stdio: 'inherit' })
  await assert.rejects(access(join(root, 'dist', '__stale-consumer-test.js')))
  execFileSync('pnpm', ['pack', '--pack-destination', packageDir], { cwd: root, stdio: 'inherit' })
  const tarball = join(packageDir, (await readdir(packageDir)).find(file => file.endsWith('.tgz')))
  await cp(join(root, 'tests/consumer'), app, { recursive: true })
  const manifest = JSON.parse(await readFile(join(app, 'package.json'), 'utf8'))
  manifest.dependencies['@main12/auth-login'] = `file:${tarball}`
  await writeFile(join(app, 'package.json'), JSON.stringify(manifest, null, 2))
  execFileSync('pnpm', ['install', '--ignore-scripts'], { cwd: app, stdio: 'inherit' })
  const probe = createServer()
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  const origin = `http://127.0.0.1:${port}`
  server = spawn('pnpm', ['exec', 'next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: app, env: { ...process.env, AUTH_CONSUMER_PORT: String(port), NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  server.stdout.on('data', data => { logs += String(data) })
  server.stderr.on('data', data => { logs += String(data) })
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch(origin)).ok) break } catch {}
    if (server.exitCode !== null || attempt === 119) throw new Error(`Consumer failed to start:\n${logs}`)
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
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
  const result = await response.json()
  assert.equal(result.user.email, 'browser@example.com')
  assert.equal('token' in result, false)
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
} catch (error) {
  console.error(logs)
  throw error
} finally {
  await browser?.close()
  if (server?.pid) { try { process.kill(-server.pid, 'SIGTERM') } catch {} }
  await rm(temp, { recursive: true, force: true })
}
