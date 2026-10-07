import { createHash } from 'node:crypto'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { cp, mkdtemp, readFile, rm, writeFile, symlink } from 'node:fs/promises'
import { createServer, type AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { chromium, type Browser, type Page } from '@playwright/test'
import { temporaryPostgres, freePort } from './otp-postgres.ts'
import { verifyPasswordAcceptance } from '../tests/password-browser.ts'
import { verifyOtpAcceptance } from '../tests/otp-browser.ts'
import { verifyIntegrationAcceptance } from '../tests/integration-browser.ts'
import { verifyOauthAcceptance } from '../tests/oauth-browser.ts'
import { createClient } from '@libsql/client'
import { verifyMigrationAcceptance } from '../tests/migration-browser.ts'
import { controlledOidcProvider } from './oauth-provider.ts'
import {
  buildConsumerPackage,
  digestDirectory,
  installConsumerPackage,
  verifyNativePackage,
} from './consumer-package.ts'
const migration = process.env.AUTH_CONSUMER_ISSUE06 === '1'
const integration = process.env.AUTH_CONSUMER_ISSUE05 === '1'
const password = process.env.AUTH_CONSUMER_PASSWORD === '1'
const otp = process.env.AUTH_CONSUMER_OTP === '1'
const oauth = process.env.AUTH_CONSUMER_OAUTH === '1'
const shared = otp || password || oauth || integration || migration
let provider: Awaited<ReturnType<typeof controlledOidcProvider>> | undefined
let postgres: Awaited<ReturnType<typeof temporaryPostgres>> | undefined
let secondary: ChildProcess | undefined
let diagnosticPage: Page | undefined
const browserEvidence: Record<string, string | number>[] = []
const bundlerArgs = process.env.AUTH_CONSUMER_BUNDLER === 'webpack' ? ['--webpack'] : []

const root = resolve(import.meta.dirname, '..')
const temp = await mkdtemp(join(tmpdir(), 'auth-ticket01-consumer-'))
const packageDir = join(temp, 'package')
const app = join(temp, 'app')
const secondaryApp = join(temp, 'app-secondary')
const sqliteURL = `file:${join(app, 'consumer.db')}`
let server: ChildProcess | undefined
let browser: Browser | undefined
let logs = ''
let acceptanceResult: Record<string, unknown> | undefined
let sqliteConfiguration: unknown
async function digestHarness() {
  const hash = createHash('sha256')
  for (const file of [
    'package.json',
    'pnpm-lock.yaml',
    'scripts/test-consumer.ts',
    'scripts/consumer-package.ts',
    'tests/browser-support.ts',
    'scripts/otp-postgres.ts',
    'scripts/oauth-provider.ts',
    'tests/migration-browser.ts',
    'tests/integration-browser.ts',
    'tests/otp-browser.ts',
    'tests/password-browser.ts',
    'tests/oauth-browser.ts',
  ])
    hash.update(file).update(await readFile(join(root, file)))
  return hash.digest('hex')
}

try {
  if (oauth || integration || migration) provider = await controlledOidcProvider()
  if (shared && process.env.AUTH_CONSUMER_DB !== 'sqlite') postgres = await temporaryPostgres()
  const harnessHash = await digestHarness()
  const { tarball, sourceHash, packedSha256 } = await buildConsumerPackage(root, packageDir)
  const fixtureHash = await digestDirectory(join(root, 'tests/consumer'))
  await cp(join(root, 'tests/consumer'), app, { recursive: true })
  {
    assert.equal(
      await digestDirectory(join(root, 'tests/consumer')),
      fixtureHash,
      'fixture source changed while copying',
    )
    console.log(
      JSON.stringify({
        sourceHash,
        fixtureHash,
        harnessHash,
        packedSha256,
        node: process.version,
        payload: '3.90.2',
        next: '16.3.6',
        react: '19.2.6',
      }),
    )
  }
  const manifest = await installConsumerPackage(app, tarball)
  verifyNativePackage(app)
  // Dist directories alone do not isolate Next's generated next-env.d.ts/tsconfig writes.
  // Each real process owns its app root; only immutable installed dependencies and storage are shared.
  if (shared && !integration) {
    await cp(app, secondaryApp, {
      recursive: true,
      filter: (path) => path !== join(app, 'node_modules'),
    })
    await symlink(join(app, 'node_modules'), join(secondaryApp, 'node_modules'), 'dir')
  }
  const probe = createServer()
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
  const port = (probe.address() as AddressInfo).port
  await new Promise<void>((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  )
  const origin = `http://127.0.0.1:${port}`
  server = spawn(
    'pnpm',
    ['exec', 'next', 'dev', ...bundlerArgs, '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: app,
      env: {
        ...process.env,
        AUTH_CONSUMER_SQLITE_URL: sqliteURL,
        AUTH_CONSUMER_PORT: String(port),
        ...(provider ? { AUTH_CONSUMER_OIDC_ISSUER: provider.issuer } : {}),
        ...(postgres ? { AUTH_CONSUMER_DATABASE_URL: postgres.url } : {}),
        NEXT_TELEMETRY_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    },
  )
  server.stdout!.on('data', (data) => {
    logs += String(data)
  })
  server.stderr!.on('data', (data) => {
    logs += String(data)
  })
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const ready = await fetch(origin, { signal: AbortSignal.timeout(30000) })
      if (ready.ok) break
      if (ready.status === 500)
        throw new Error(`Consumer startup returned 500: ${await ready.text()}`)
    } catch (error) {
      if (String(error).includes('startup returned')) throw error
    }
    if (server.exitCode !== null || attempt === 119)
      throw new Error(`Consumer failed to start:\n${logs}`)
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  if (shared && !postgres) {
    sqliteConfiguration = await (await fetch(`${origin}/fixture?storage=1`)).json()
    assert.deepEqual(
      sqliteConfiguration,
      { adapter: 'sqlite', journalMode: 'wal', busyTimeout: 1000 },
      'concurrent SQLite acceptance requires the declared WAL/busy-timeout host setup',
    )
  }
  if (shared && !integration) {
    const port2 = await freePort()
    secondary = spawn(
      'pnpm',
      ['exec', 'next', 'dev', ...bundlerArgs, '--hostname', '127.0.0.1', '--port', String(port2)],
      {
        cwd: secondaryApp,
        env: {
          ...process.env,
          AUTH_CONSUMER_SQLITE_URL: sqliteURL,
          AUTH_CONSUMER_OTP: process.env.AUTH_CONSUMER_OTP ?? '0',
          AUTH_CONSUMER_SECONDARY: '1',
          ...(postgres ? { AUTH_CONSUMER_DATABASE_URL: postgres.url } : {}),
          AUTH_CONSUMER_PORT: String(port2),
          ...(provider
            ? {
                AUTH_CONSUMER_OIDC_ISSUER: provider.issuer,
                AUTH_CONSUMER_PRIMARY_PORT: String(port),
              }
            : {}),
          NEXT_TELEMETRY_DISABLED: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      },
    )
    secondary.stdout!.on('data', (data) => {
      logs += String(data)
    })
    secondary.stderr!.on('data', (data) => {
      logs += String(data)
    })
    const origin2 = `http://127.0.0.1:${port2}`
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        const ready = await fetch(origin2, { signal: AbortSignal.timeout(30000) })
        if (ready.ok) break
        if (ready.status === 500)
          throw new Error(`Secondary startup returned 500: ${await ready.text()}`)
      } catch (error) {
        if (String(error).includes('startup returned')) throw error
      }
      if (secondary.exitCode !== null || attempt === 119)
        throw new Error(`Secondary failed to start:\n${logs}`)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    if (sqliteConfiguration)
      assert.deepEqual(
        await (await fetch(`${origin2}/fixture?storage=1`)).json(),
        sqliteConfiguration,
        'both SQLite instances must use the declared storage setup',
      )
    browser = await chromium.launch({ headless: true })
    if (migration) {
      const stop = async (child: ChildProcess | undefined) => {
        if (!child?.pid) return
        try {
          process.kill(-child.pid, 'SIGTERM')
        } catch {}
        for (let count = 0; count < 100; count++) {
          try {
            process.kill(-child.pid, 0)
          } catch {
            return
          }
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        throw new Error('Maintenance requires stopped writers; consumer did not terminate')
      }
      const databaseFile = join(app, 'consumer.db')
      const backup = join(temp, postgres ? 'backup.sql' : 'backup.db')
      const pgBin = process.env.AUTH_TEST_POSTGRES_BIN ?? '/opt/homebrew/opt/postgresql@17/bin'
      const start = async (base: string, second: boolean) => {
        const child = spawn(
          'pnpm',
          [
            'exec',
            'next',
            'dev',
            ...bundlerArgs,
            '--hostname',
            '127.0.0.1',
            '--port',
            new URL(base).port,
          ],
          {
            cwd: second ? secondaryApp : app,
            env: {
              ...process.env,
              AUTH_CONSUMER_SQLITE_URL: sqliteURL,
              AUTH_CONSUMER_SECONDARY: '1',
              AUTH_CONSUMER_DIST: second ? '.next-secondary' : '.next',
              ...(provider
                ? {
                    AUTH_CONSUMER_OIDC_ISSUER: provider.issuer,
                    AUTH_CONSUMER_PRIMARY_PORT: String(port),
                  }
                : {}),
              AUTH_CONSUMER_PORT: new URL(base).port,
              ...(postgres ? { AUTH_CONSUMER_DATABASE_URL: postgres.url } : {}),
              NEXT_TELEMETRY_DISABLED: '1',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: true,
          },
        )
        child.stdout.on('data', (data) => {
          logs += String(data)
        })
        child.stderr.on('data', (data) => {
          logs += String(data)
        })
        for (let attempt = 0; attempt < 120; attempt++) {
          try {
            const response = await fetch(base, { signal: AbortSignal.timeout(30000) })
            if (response.ok) return child
          } catch {}
          if (child.exitCode !== null) throw new Error(`Restart failed: ${logs}`)
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
        throw new Error(`Restart timed out: ${logs}`)
      }
      const maintenance = async (phase: 'cutoff' | 'rollback') => {
        await stop(server)
        await stop(secondary)
        if (phase === 'cutoff') {
          if (postgres)
            execFileSync(join(pgBin, 'pg_dump'), ['--file', backup, postgres.url], {
              stdio: 'inherit',
            })
          else {
            const checkpoint = createClient({ url: `file:${databaseFile}` })
            try {
              await checkpoint.execute('PRAGMA wal_checkpoint(TRUNCATE)')
            } finally {
              checkpoint.close()
            }
            await cp(databaseFile, backup)
          }
        } else {
          if (postgres)
            execFileSync(
              join(pgBin, 'psql'),
              [
                postgres.url,
                '-v',
                'ON_ERROR_STOP=1',
                '-c',
                'DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
              ],
              { stdio: 'inherit' },
            )
          if (postgres)
            execFileSync(
              join(pgBin, 'psql'),
              [postgres.url, '-v', 'ON_ERROR_STOP=1', '-f', backup],
              { stdio: 'inherit' },
            )
          else {
            await rm(databaseFile, { force: true })
            await rm(`${databaseFile}-wal`, { force: true })
            await rm(`${databaseFile}-shm`, { force: true })
            await cp(backup, databaseFile)
          }
        }
        execFileSync('pnpm', ['exec', 'payload', 'run', './migration.ts'], {
          cwd: app,
          env: {
            ...process.env,
            AUTH_CONSUMER_SQLITE_URL: sqliteURL,
            AUTH_CONSUMER_SECONDARY: '1',
            AUTH_CONSUMER_PORT: String(port),
            ...(postgres ? { AUTH_CONSUMER_DATABASE_URL: postgres.url } : {}),
          },
          stdio: 'inherit',
        })
        const result = JSON.parse(await readFile(join(app, 'migration-result.json'), 'utf8'))
        server = await start(origin, false)
        secondary = await start(origin2, true)
        return result
      }
      acceptanceResult = await verifyMigrationAcceptance({
        browser,
        origin,
        origin2,
        maintenance,
        provider: provider!,
        database: postgres?.version ?? 'SQLite real',
        onPage: (page: Page) => {
          diagnosticPage = page
        },
      })
      assert.equal(
        await digestDirectory(join(root, 'src')),
        sourceHash,
        'source changed during acceptance; rerun frozen',
      )
      assert.equal(
        await digestDirectory(join(root, 'tests/consumer')),
        fixtureHash,
        'fixture changed during acceptance; rerun frozen',
      )
      assert.equal(
        await digestHarness(),
        harnessHash,
        'harness changed during acceptance; rerun frozen',
      )
    } else if (oauth)
      acceptanceResult = await verifyOauthAcceptance({
        browser,
        origin,
        origin2,
        provider: provider!,
        database: postgres?.version ?? 'SQLite real',
        onPage: (page: Page) => {
          diagnosticPage = page
        },
      })
    else if (password)
      acceptanceResult = await verifyPasswordAcceptance({
        browser,
        origin,
        origin2,
        database: postgres?.version ?? 'SQLite real',
        onPage: (page: Page) => {
          diagnosticPage = page
          page.on('response', (response) =>
            browserEvidence.push({ url: response.url(), status: response.status() }),
          )
          page.on('pageerror', (error) => browserEvidence.push({ pageerror: error.message }))
        },
      })
    else
      acceptanceResult = await verifyOtpAcceptance({
        postgresVersion: postgres?.version,
        browser,
        origin,
        origin2,
        database: postgres?.version ?? 'SQLite real',
        outage:
          postgres?.outage ??
          (async <T>(work: () => Promise<T>): Promise<T> => {
            const client = createClient({ url: `file:${join(app, 'consumer.db')}` })
            const transaction = await client.transaction('write')
            try {
              return await work()
            } finally {
              await transaction.rollback()
              transaction.close()
              client.close()
            }
          }),
      })
    execFileSync('pnpm', ['exec', 'tsc', '--noEmit'], { cwd: app, stdio: 'inherit' })
    execFileSync('pnpm', ['exec', 'tsc', '--noEmit'], { cwd: secondaryApp, stdio: 'inherit' })
    console.log(
      `${migration ? 'Migration' : oauth ? 'OAuth' : password ? 'Password' : 'OTP'} consumer declarations GREEN`,
    )
    process.exitCode = 0
  } else if (integration) {
    const diagnostic = process.env.AUTH_CONSUMER_ISSUE05_DIAGNOSTIC === '1'
    browser = await chromium.launch({ headless: true })
    const acceptance = await verifyIntegrationAcceptance({
      browser,
      origin,
      provider: provider!,
      diagnostic,
      database: postgres?.version ?? 'SQLite real',
      onPage: (page: Page) => {
        diagnosticPage = page
      },
    })
    execFileSync('pnpm', ['exec', 'tsc', '--noEmit'], { cwd: app, stdio: 'inherit' })
    assert.equal(
      await digestDirectory(join(root, 'src')),
      sourceHash,
      'source changed during acceptance; rerun frozen',
    )
    assert.equal(
      await digestDirectory(join(root, 'tests/consumer')),
      fixtureHash,
      'fixture changed during acceptance; rerun frozen',
    )
    assert.equal(
      await digestHarness(),
      harnessHash,
      'acceptance harness changed during run; rerun frozen',
    )
    if (!diagnostic && process.env.AUTH_CONSUMER_EVIDENCE_PATH)
      await writeFile(
        resolve(process.env.AUTH_CONSUMER_EVIDENCE_PATH),
        JSON.stringify(
          {
            ...acceptance,
            ...(sqliteConfiguration ? { sqliteConfiguration } : {}),
            sourceHash,
            fixtureHash,
            harnessHash,
            packedSha256,
            node: process.version,
            declarations: 'passed',
            snapshot: 'unchanged',
          },
          null,
          2,
        ) + '\n',
      )
    console.log(
      diagnostic
        ? 'Issue05 DIAGNOSTIC subset only: declarations/snapshot checked; no final acceptance evidence'
        : 'Issue05 packed consumer declarations and snapshot GREEN',
    )
    if (process.env.AUTH_CONSUMER_KEEP === '1') {
      console.log(
        JSON.stringify({
          keep: true,
          origin,
          app,
          pid: process.pid,
          inspection: `${origin}/members/modal/tailwind/es/login`,
        }),
      )
      await new Promise((resolve) => {
        process.once('SIGTERM', resolve)
        process.once('SIGINT', resolve)
      })
    }
  } else {
    // Initialize Payload/schema before opening a form. In Next's Webpack dev server,
    // lazy SQLite initialization during the first login can trigger a full reload
    // and discard the in-flight UI state; this is fixture setup, not an auth retry.
    const initialSession = await fetch(`${origin}/backend/customers/me`)
    assert.equal(initialSession.status, 200)
    assert.equal((await initialSession.json()).user, null)
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()
    diagnosticPage = page
    page.on('response', (response) =>
      browserEvidence.push({ url: response.url(), status: response.status() }),
    )
    page.on('console', (message) =>
      browserEvidence.push({ console: message.type(), text: message.text() }),
    )
    page.on('pageerror', (error) => browserEvidence.push({ pageerror: error.message }))
    const requests: string[] = []
    page.on('request', (request) => requests.push(request.url()))
    await page.goto(origin)
    await page.getByRole('button', { name: 'Open login' }).click()
    await page.getByLabel(/^Email/).fill('browser@example.com')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByLabel(/^Password/).fill('actual-browser-test-password')
    const loginStartedAt = Date.now()
    const loginResponse = page
      .waitForResponse((response) => response.url().endsWith('/backend/access/login'))
      .then((response) => ({ response, receivedAt: Date.now() }))
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    const { response, receivedAt: loginReceivedAt } = await loginResponse
    assert.equal(response.status(), 200)
    const result = await response.json()
    assert.equal(result.user.email, 'browser@example.com')
    assert.equal('token' in result, false)
    await page.getByTestId('email').filter({ hasText: 'browser@example.com' }).waitFor()
    assert.equal(await page.locator('dialog').count(), 0)
    const cookie = (await context.cookies()).find((cookie) => cookie.name === 'consumer-token')
    assert.ok(cookie?.httpOnly)
    assert.equal(cookie.sameSite, 'Lax')
    assert.ok(!requests.some((url) => url.includes('check-email') || url.includes('otp/')))
    const oldCookie = cookie.value
    const jwtExp = JSON.parse(
      Buffer.from(oldCookie.split('.')[1], 'base64url').toString('utf8'),
    ).exp
    const responseHeaders = await response.allHeaders()
    const responseCookie = responseHeaders['set-cookie'] ?? ''
    const responseToken = responseCookie.match(/(?:^|\n)consumer-token=([^;]+)/)?.[1]
    assert.ok(responseToken, 'successful password response must set the native session cookie')
    assert.ok(cookie.value === responseToken, 'stored cookie must match login response')
    const responseExp = JSON.parse(
      Buffer.from(responseToken.split('.')[1], 'base64url').toString('utf8'),
    ).exp
    assert.equal(jwtExp, responseExp)
    const wireExpires = Date.parse(responseCookie.match(/Expires=([^;]+)/i)?.[1] ?? '') / 1000
    const responseDate = Date.parse(responseHeaders.date ?? '') / 1000
    assert.ok(Number.isFinite(wireExpires) && Number.isFinite(responseDate))
    assert.ok(wireExpires <= responseExp, 'server cookie must not outlive its signed JWT')
    // Chromium adjusts Expires by client receipt time minus the whole-second HTTP Date.
    // Bound that adjustment by the observed receive window with 2ms timestamp quantization.
    const adjustedStart = wireExpires + loginStartedAt / 1000 - responseDate
    const adjustedEnd = wireExpires + loginReceivedAt / 1000 - responseDate
    assert.ok(cookie.expires >= adjustedStart - 0.002 && cookie.expires <= adjustedEnd + 0.002)
    await page.getByRole('button', { name: 'Logout', exact: true }).click()
    await page.getByTestId('email').filter({ hasText: 'anonymous' }).waitFor()
    const replay = await fetch(`${origin}/backend/customers/me`, {
      headers: { cookie: `consumer-token=${oldCookie}`, origin },
    })
    assert.equal((await replay.json()).user, null)
    const refresh = await fetch(`${origin}/backend/customers/refresh-token`, {
      method: 'POST',
      headers: { cookie: `consumer-token=${oldCookie}`, origin },
    })
    assert.equal(refresh.status, 401)
    for (const source of await page
      .locator('script[src]')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).src))) {
      const javascript = await (await fetch(source)).text()
      assert.ok(!javascript.includes('consumer-only-private-secret-not-production'))
    }
    const html = await page.content()
    assert.ok(!html.includes('consumer-only-private-secret-not-production'))
    execFileSync('pnpm', ['exec', 'tsc', '--noEmit'], { cwd: app, stdio: 'inherit' })
    acceptanceResult = {
      passed: true,
      package: manifest.dependencies['@main12/auth-login'].split('/').pop(),
      node: process.version,
      payload: manifest.dependencies.payload,
      next: manifest.dependencies.next,
      react: manifest.dependencies.react,
      database: 'SQLite real',
      browser: 'Chromium',
      verified: [
        'packaged plugin/client/RSC/proxy imports',
        'real password login',
        'effective cookie prefix/HttpOnly/SameSite/expiry',
        'no public account lookup',
        'removeTokenFromResponses',
        'server logout and replay rejection',
        'consumer declarations',
        'no private secret in client script chunks',
        'stale dist excluded by clean build',
      ],
    }
    console.log(JSON.stringify(acceptanceResult, null, 2))
  }
  assert.equal(
    await digestDirectory(join(root, 'src')),
    sourceHash,
    'source changed during acceptance; rerun frozen',
  )
  assert.equal(
    await digestDirectory(join(root, 'tests/consumer')),
    fixtureHash,
    'fixture changed during acceptance; rerun frozen',
  )
  assert.equal(
    await digestHarness(),
    harnessHash,
    'harness/manifest/lock changed during acceptance; rerun frozen',
  )
  if (acceptanceResult && sqliteConfiguration)
    acceptanceResult.sqliteConfiguration = sqliteConfiguration
  if (acceptanceResult && process.env.AUTH_CONSUMER_EVIDENCE_PATH)
    await writeFile(
      resolve(process.env.AUTH_CONSUMER_EVIDENCE_PATH),
      JSON.stringify(
        {
          ...acceptanceResult,
          sourceHash,
          fixtureHash,
          harnessHash,
          packedSha256: createHash('sha256')
            .update(await readFile(tarball))
            .digest('hex'),
          node: process.version,
          declarations: 'passed',
          snapshot: 'unchanged',
        },
        null,
        2,
      ) + '\n',
    )
} catch (error) {
  if (diagnosticPage && !diagnosticPage.isClosed()) {
    await diagnosticPage
      .screenshot({
        path: `/tmp/auth-password-${bundlerArgs.length ? 'webpack' : 'turbopack'}-red.png`,
      })
      .catch(() => {})
    await writeFile(
      `/tmp/auth-password-${bundlerArgs.length ? 'webpack' : 'turbopack'}-red.html`,
      await diagnosticPage.content().catch(() => 'unavailable'),
    )
    await writeFile(
      `/tmp/auth-password-${bundlerArgs.length ? 'webpack' : 'turbopack'}-network.json`,
      JSON.stringify(browserEvidence, null, 2),
    )
  }
  console.error(logs)
  throw error
} finally {
  await browser?.close()
  for (const child of [server, secondary]) {
    if (!child?.pid) continue
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {}
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        process.kill(-child.pid, 0)
      } catch {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
      if (attempt === 29) {
        try {
          process.kill(-child.pid, 'SIGKILL')
        } catch {}
      }
    }
  }
  await postgres?.close()
  await provider?.close()
  await rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
}
