/** Focused real-Chromium native-input seam, isolated from database/Next setup. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { chromium, expect } from '@playwright/test'

const require = createRequire(import.meta.url)
// Use the already-installed Vitest/Vite build dependency; no package installation.
const viteRequire = createRequire(
  createRequire(require.resolve('vitest/package.json')).resolve('vite/package.json'),
)
const { build } = viteRequire('esbuild')
const postcssRequire = createRequire(require.resolve('@tailwindcss/postcss'))
const postcss = postcssRequire('postcss')
const tailwind = require('@tailwindcss/postcss')
const cwd = process.cwd()
const consumerRoot = process.env.AUTH_NATIVE_CONSUMER_STYLE_ROOT
const css = (
  await postcss([tailwind({ base: consumerRoot || cwd })]).process(
    consumerRoot
      ? '@import "./auth.css"; @import "./theme.css";'
      : readFileSync(path.join(cwd, 'tests/fixtures/hero-auth-scoped.css'), 'utf8'),
    {
      from: consumerRoot
        ? path.join(consumerRoot, 'src/styles/native-input-browser.css')
        : path.join(cwd, 'tests/fixtures/hero-auth-scoped.css'),
    },
  )
).css
const app = await build({
  stdin: {
    resolveDir: cwd,
    loader: 'tsx',
    contents: `
      import React from 'react'
      import { createRoot } from 'react-dom/client'
      import { OtpInput } from './src/components/molecules/OtpInput'
      import { FormField } from './src/components/molecules/FormField'
      import { PasswordField } from './src/components/molecules/PasswordField'
      import { VerifyOtpForm } from './src/components/organisms/VerifyOtpForm'
      import { AuthPresentationContext } from './src/contexts/AuthAppearanceContext'
      import { AuthConfigProvider } from './src/authentication/interface/react/providers/AuthConfigProvider'
      import { AuthFlowContext } from './src/authentication/interface/react/AuthFlowContext'
      import { publicConfig } from './tests/auth-test-config'
      function App() {
        const [otp, setOtp] = React.useState('')
        const [disabled, setDisabled] = React.useState(false)
        const [visible, setVisible] = React.useState(false)
        const [completed, setCompleted] = React.useState(false)
        return <AuthPresentationContext.Provider value={{ style: 'hero-ui', poweredBy: { enabled: false } }}>
          <span id="danger-probe" style={{ color: "var(--danger)" }} />
          <section id="email"><FormField label="Email" type="email" value="bad" error="Invalid email" /></section>
          <section id="entry"><OtpInput value={otp} onValueChange={setOtp} isDisabled={disabled} autoFocus error="Invalid code" /></section>
          <button id="disable" onClick={() => setDisabled(!disabled)}>Disable entry</button>
          <section id="password"><PasswordField label="Password" value="existing" isDisabled={disabled} visible={visible}
            onToggleVisibility={() => setVisible(!visible)} visibilityLabel={visible ? 'Hide password' : 'Show password'} error="Invalid password" /></section>
          <AuthConfigProvider publicConfig={{ ...publicConfig, otpLogin: true }}>
            <AuthFlowContext.Provider value={{ push: () => {}, complete: async () => setCompleted(true), searchParams: new URLSearchParams('email=member%40example.test&context=${'a'.repeat(64)}') }}>
              <section id="verification"><VerifyOtpForm /></section>
            </AuthFlowContext.Provider>
          </AuthConfigProvider>
          <output id="completed">{String(completed)}</output>
        </AuthPresentationContext.Provider>
      }
      createRoot(document.getElementById('root')).render(<App />)
    `,
  },
  bundle: true,
  platform: 'browser',
  format: 'iife',
  write: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      name: 'isolated-navigation',
      setup(builder) {
        builder.onResolve({ filter: /^next\/navigation$/ }, () => ({
          path: 'navigation',
          namespace: 'harness',
        }))
        builder.onLoad({ filter: /.*/, namespace: 'harness' }, () => ({
          contents:
            'export const useRouter = () => ({ push() {} }); export const useSearchParams = () => new URLSearchParams();',
          loader: 'js',
        }))
      },
    },
  ],
})
let requests = 0
const bodies = []
const server = createServer(async (request, response) => {
  if (request.url === '/app.js') return response.end(app.outputFiles[0].contents)
  if (request.url === '/app.css') {
    response.setHeader('content-type', 'text/css')
    return response.end(css)
  }
  if (request.method === 'POST') {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    bodies.push(JSON.parse(Buffer.concat(chunks).toString()))
    requests++
    await new Promise((resolve) => setTimeout(resolve, 150))
    response.setHeader('content-type', 'application/json')
    response.statusCode = requests === 1 ? 401 : 200
    return response.end(
      JSON.stringify(
        requests === 1
          ? { success: false, code: 'AUTH_FAILED' }
          : { success: true, user: { id: 'A' }, exp: Math.floor(Date.now() / 1000) + 900 },
      ),
    )
  }
  response.setHeader('content-type', 'text/html')
  const theme = process.env.AUTH_NATIVE_THEME === 'dark' ? 'dark' : 'light'
  const customDanger =
    process.env.AUTH_NATIVE_CUSTOM_DANGER === '1' ? 'style="--danger:rgb(160,80,200)"' : ''
  response.end(
    `<!doctype html><html data-theme-preference="${theme}"><head><link rel="stylesheet" href="/app.css"></head><body data-theme="${theme}" ${customDanger}><div id="root" class="identity-login"></div><script src="/app.js"></script></body></html>`,
  )
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  const origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(origin)
  const otp = page.locator('#entry input')
  await expect(otp).toHaveCount(1)
  await expect(page.locator('#entry [data-slot="input-otp-slot"]')).toHaveCount(6)
  const slotBoxes = await page.locator('#entry [data-slot="input-otp-slot"]').evaluateAll((slots) =>
    slots.map((slot) => ({
      width: slot.getBoundingClientRect().width,
      height: slot.getBoundingClientRect().height,
    })),
  )
  const errorStyle = await page.locator('#entry [data-slot="field-error"]').evaluate((error) => ({
    color: getComputedStyle(error).color,
    fontSize: getComputedStyle(error).fontSize,
  }))
  const dangerColor = await page
    .locator('#danger-probe')
    .evaluate((probe) => getComputedStyle(probe).color)
  if (consumerRoot) console.log(JSON.stringify({ slotBoxes, errorStyle, dangerColor }))
  assert.ok(
    slotBoxes.every((box) => box.width >= 30 && box.height >= 30),
    `OTP slots must be visibly sized: ${JSON.stringify(slotBoxes)}`,
  )
  assert.equal(
    errorStyle.color,
    dangerColor,
    'FieldError must use semantic danger, not inherited text color',
  )
  assert.equal(errorStyle.fontSize, '12px', 'FieldError must use native small typography')
  await expect(page.locator('#email [data-slot="field-error"]')).toHaveCSS('color', dangerColor)
  await expect(page.locator('#email [data-slot="field-error"]')).toHaveCSS('font-size', '12px')

  await otp.fill('12345')
  await expect(otp).toHaveValue('12345')
  // Native caret selection and deletion compact later digits, unlike Tailwind positions.
  await otp.evaluate((input) => input.setSelectionRange(2, 3))
  await otp.press('Backspace')
  await expect(otp).toHaveValue('1245')
  await otp.press('ArrowLeft')
  assert.ok((await otp.evaluate((input) => input.selectionStart)) < 4)
  await otp.press('ArrowRight')
  await otp.fill('')
  await otp.focus()
  await page.evaluate(() => navigator.clipboard.writeText('654-321'))
  await otp.press('ControlOrMeta+V')
  await expect(otp).toHaveValue('654321')
  await expect(otp).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#entry [data-slot="field-error"]')).toHaveCSS('color', dangerColor)
  const password = page.locator('#password input')
  const toggle = page.getByRole('button', { name: 'Show password' })
  await toggle.click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(password).toHaveValue('existing')
  await page.locator('#disable').click()
  await expect(otp).toBeDisabled()
  await expect(password).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Hide password' })).toBeDisabled()
  // Exercise the real public verification flow against this local HTTP seam.
  const verification = page.locator('#verification input')
  await verification.fill('123456')
  await expect(verification).toBeDisabled()
  await expect(page.locator('#verification [role="alert"]')).toBeVisible()
  await expect(verification).toHaveValue('')
  await expect(verification).toBeFocused()
  assert.equal(requests, 1, 'completion must emit a single request')
  await verification.fill('654321')
  await expect(page.locator('#completed')).toHaveText('true')
  assert.equal(requests, 2, 'retry must emit exactly one additional request')
  assert.deepEqual(
    bodies.map((body) => body.otp),
    ['123456', '654321'],
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS: native slots, numeric autofill, real paste, caret/delete/arrows, host danger token, password visibility/disabled state, single verification and refocused retry',
  )
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
