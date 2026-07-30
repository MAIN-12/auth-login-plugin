# @main12/auth-login

**Payload CMS authentication plugin** — login, signup, OTP, forgot password, branded emails, and "Powered by Main 12" footer. Install once, done.

```ts
// payload.config.ts
import { authLoginPlugin } from '@main12/auth-login'

plugins: [
  authLoginPlugin({
    projectName: 'My SaaS',
    domain: 'https://myapp.com',
    logo: 'https://myapp.com/logo.png',  // shown in all auth pages + emails
    style: 'hero-ui',                     // 'tailwind' (default) | 'hero-ui'
  }),
]
```

---

## Features

- **5 auth pages** — login (multi-step), signup, forgot password, verify OTP, set password
- **Multi-style** — `tailwind` (zero UI deps) or `hero-ui` (HeroUI + framer-motion). Set once in config
- **5 API endpoints** — `check-email`, `otp/send`, `otp/verify`, `set-password`, `signup`
- **OTP engine** — SHA-256 hashing + `timingSafeEqual` comparison, 10-min expiry, 3 attempts
- **Email templates** — welcome, OTP login, password reset, password changed (EN/ES)
- **Powered by Main 12** — bundled inline SVG, linked to main12.com by default (URL overridable)
- **Global logo** — pass once in plugin config, automatically shown on all pages and email headers
- **Zero runtime deps** (Tailwind mode) — Next.js + React are peer dependencies

---

## Installation

```bash
pnpm add @main12/auth-login
```

### Tailwind mode (default, zero UI deps — also ShadCN compatible)

No extra dependencies needed. The Tailwind style uses standard utility classes that work in any Tailwind project, including ShadCN-based ones.

### HeroUI mode

```bash
pnpm add @heroui/react framer-motion @iconify/react
```

---

## Quick Start

### 1. Add the plugin + Users collection

```ts
import { authLoginPlugin } from '@main12/auth-login'

export default buildConfig({
  collections: [
    {
      slug: 'users',
      auth: { tokenExpiration: 7200, verify: false, maxLoginAttempts: 5 },
      fields: [
        { name: 'name', type: 'text' },
        { name: 'otpHash', type: 'text', admin: { hidden: true } },
        { name: 'otpAttempts', type: 'number', admin: { hidden: true } },
        { name: 'otpExpiresAt', type: 'text', admin: { hidden: true } },
      ],
    },
  ],
  plugins: [
    authLoginPlugin({
      projectName: 'My App',
      domain: 'https://myapp.com',
      logo: '/logo.png',
      style: 'hero-ui',
    }),
  ],
})
```

### 2. Create one-line route files

```tsx
// src/app/(frontend)/(auth)/login/page.tsx
export { LoginPage as default } from '@main12/auth-login/client'

// src/app/(frontend)/(auth)/signup/page.tsx
export { SignupPage as default } from '@main12/auth-login/client'

// src/app/(frontend)/(auth)/forgot-password/page.tsx
export { ForgotPasswordPage as default } from '@main12/auth-login/client'

// src/app/(frontend)/(auth)/verify-otp/page.tsx
export { VerifyOtpPage as default } from '@main12/auth-login/client'

// src/app/(frontend)/(auth)/set-password/page.tsx
export { SetPasswordPage as default } from '@main12/auth-login/client'
```

### 3. Wire up the login action

```tsx
// login/page.tsx
'use client'
import { LoginPage } from '@main12/auth-login/client'
import { useAuth } from '@/providers/Auth'

export default function Page() {
  const { login } = useAuth()
  return <LoginPage onPasswordLogin={login} redirectTo="/dashboard" />
}
```

### 4. Visit `/login` — done.

---

## Configuration

```ts
authLoginPlugin({
  projectName: 'My App',          // Email subjects + footers
  contactEmail: 'hi@myapp.com',   // Email footer contact
  domain: 'https://myapp.com',    // Links in emails
  logo: '/logo.png',              // All auth pages + email headers
  style: 'tailwind',              // 'tailwind' | 'hero-ui'
  enabled: true,
})
```

### Per-page overrides

```tsx
<LoginPage
  logo={<AppLogo width={180} />}  // Override global logo (optional)
  onPasswordLogin={login}          // Required
  redirectTo="/dashboard"
  showGoogleOAuth={true}
  signupUrl="/signup"
  poweredBy={{ enabled: true, logoUrl: '/custom.png', linkUrl: 'https://...' }}
/>
```

---

## Building Custom Pages

Use the plugin's hooks to build your own UI with any component library (HeroUI, shadcn, plain Tailwind).

### Hook Quick-Reference

| Hook | Returns | Key inputs |
|------|---------|------------|
| `useLoginFlow({ redirectTo, onPasswordLogin })` | `step, email, password, error, isLoading, handleEmailSubmit, handlePasswordSubmit, handleSendOtp, handleEditEmail` | `redirectTo: string`, `onPasswordLogin: (creds) => Promise<void>` |
| `useForgotPasswordFlow()` | `email, error, isLoading, setEmail, handleSubmit` | none |
| `useVerifyOtpFlow({ email, purpose, redirectTo })` | `otp, error, isLoading, isResending, resendCooldown, setOtp, handleSubmit, handleResendCode` | `email: string`, `purpose: 'login'\|'signup'\|'password-reset'` |
| `useSetPasswordFlow({ redirectTo })` | `password, confirmPassword, error, isLoading, strength, setPassword, setConfirmPassword, handleSubmit` | `redirectTo: string` |

> **Signup note:** No hook needed — call `signup(name, email)` from `@main12/auth-login/client`, then redirect to `/verify-otp?email=...&purpose=signup`.

### Full Example: Custom Login Page

```tsx
'use client'
import { useLoginFlow } from '@main12/auth-login/client'
import { useAuth } from '@/providers/Auth'

export default function CustomLogin() {
  const { login } = useAuth()
  const {
    step, email, password, error, isLoading, showPassword,
    setEmail, setPassword, setShowPassword,
    handleEmailSubmit, handlePasswordSubmit, handleSendOtp, handleEditEmail,
  } = useLoginFlow({ redirectTo: '/dashboard', onPasswordLogin: login })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
        <img src="/logo.png" className="mx-auto mb-6" width={180} alt="" />

        {/* Step 1: Email */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <h1 className="text-xl font-semibold text-center">Welcome Back</h1>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email" required className="w-full h-12 px-4 border rounded-xl" />
            <button type="submit" disabled={isLoading}
              className="w-full h-12 bg-[#D5E855] rounded-full font-semibold">
              {isLoading ? 'Loading...' : 'Continue'}
            </button>
          </form>
        )}

        {/* Step 2a: Password */}
        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="flex justify-between border rounded-xl px-4 py-3">
              <span>{email}</span>
              <button type="button" onClick={handleEditEmail} className="text-sm">Edit</button>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <input type={showPassword ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Password" required
              className="w-full h-12 px-4 border rounded-xl" autoFocus />
            <button type="submit" disabled={isLoading}
              className="w-full h-12 bg-[#D5E855] rounded-full font-semibold">
              {isLoading ? 'Loading...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* Step 2b: OTP Prompt (migrated users without password) */}
        {step === 'otp-prompt' && (
          <div className="space-y-4">
            <div className="flex justify-between border rounded-xl px-4 py-3">
              <span>{email}</span>
              <button type="button" onClick={handleEditEmail}>Edit</button>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
              We'll send a verification code to this email.
            </div>
            <button onClick={handleSendOtp} disabled={isLoading}
              className="w-full h-12 bg-[#D5E855] rounded-full font-semibold">
              {isLoading ? 'Sending...' : 'Send Code'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

### Custom Signup

Same pattern — call `onSignup(name, email)` from your form, redirect to `/verify-otp?email=...&purpose=signup` on success.

### Custom Verify OTP

Use `useVerifyOtpFlow({ email, purpose, redirectTo })`. It manages the 6-digit input, verification, resend cooldown (60s), and auto-redirect. All you need is an `<input>` or `<InputOtp>` for the code and a verify button.

### Custom Forgot Password

Use `useForgotPasswordFlow()`. Collect email, call `handleSubmit(e)`. It checks user exists, sends OTP, and redirects to `/verify-otp?email=...&purpose=password-reset`.

### Custom Set Password

Use `useSetPasswordFlow({ redirectTo })`. Two password fields (new + confirm). The hook validates strength (≥8 chars, 3/4 criteria) and matches. Returns `strength.score` (0-5) for a visual indicator.

---

## Custom Email Templates

```ts
import { generateWelcomeEmail, getEmailTranslations } from '@main12/auth-login/rsc'

// Override translations
const t = getEmailTranslations('en')
t.welcome.subject = 'Welcome to My SaaS! 🚀'

// Or wrap template generators
function myWelcome(params) {
  const base = generateWelcomeEmail(params)
  return { ...base, html: base.html.replace('Get Started', 'Launch Now') }
}

// Use in hooks/endpoints
await payload.sendEmail({
  to: user.email,
  ...myWelcome({ userName: user.name, userEmail: user.email }),
})
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/check-email` | Check if email is registered |
| POST | `/api/auth/otp/send` | Generate + send OTP via Payload email adapter |
| POST | `/api/auth/otp/verify` | Verify OTP + login (sets httpOnly cookie) |
| POST | `/api/auth/set-password` | Set/update password |
| POST | `/api/auth/signup` | Create account + send welcome email |

---

## ShadCN Compatibility

The `tailwind` style works in ShadCN projects out of the box. For ShadCN components, build a [custom page](#building-custom-pages) — import the plugin's hooks and use your `@/components/ui/button`, `@/components/ui/input`, etc.

---

## 🤖 AI Agent Prompts

Copy these prompts into Claude, Cursor, Copilot, or any AI agent.

### Prompt: Set up the auth plugin in a new Payload project

```
Add @main12/auth-login to this Payload project:

1. Install: pnpm add @main12/auth-login
2. In payload.config.ts, add:
   - Users collection with auth enabled + otpHash, otpAttempts, otpExpiresAt fields
   - Plugin: authLoginPlugin({ projectName: "<PROJECT>", domain: "<URL>", logo: "/logo.png", style: "hero-ui" })
3. Create route files under src/app/(frontend)/(auth)/:
   - login/page.tsx      → export { LoginPage as default } from '@main12/auth-login/client'
   - signup/page.tsx     → export { SignupPage as default } from '@main12/auth-login/client'
   - forgot-password/page.tsx  → export { ForgotPasswordPage as default } from '@main12/auth-login/client'
   - verify-otp/page.tsx → export { VerifyOtpPage as default } from '@main12/auth-login/client'
   - set-password/page.tsx → export { SetPasswordPage as default } from '@main12/auth-login/client'
4. In login/page.tsx, wrap LoginPage with useAuth() to pass onPasswordLogin={login}.
5. Verify: visit /login
```

### Prompt: Build a custom login page with HeroUI components

```
Build a custom login page using @main12/auth-login hooks and @heroui/react:

- Import useLoginFlow from '@main12/auth-login/client'
- Use useAuth() from Payload's Auth provider for the login function
- Render 3 steps: email input → password input / OTP prompt
- Use HeroUI <Button>, <Input> with variant="bordered", rounded-full
- Add "Continue with Google" button using initiateGoogleLogin from the plugin
- Add "Powered by Main12" footer from the plugin's PoweredBy component
```

### Prompt: Customize email templates for my project

```
Customize the email templates from @main12/auth-login for my project "<PROJECT_NAME>":

- Import generateWelcomeEmail, generateOtpEmail, generatePasswordResetEmail, generatePasswordChangedEmail from '@main12/auth-login/rsc'
- Override each to use my brand colors (primary: <COLOR>, accent: <COLOR>)
- Change the welcome email CTA text to "<CUSTOM_TEXT>"
- Change the OTP email purpose text to "<CUSTOM_TEXT>"
- Add my project's social media links to the footer
```

---

## Dev Testing

```bash
git clone https://github.com/MAIN-12/auth-login-plugin.git
cd auth-login-plugin
pnpm install
pnpm dev
```

Visit `http://localhost:3000/login` — all 5 auth pages wired with SQLite.

---

## Requirements

| Dependency | Version | Required |
|------------|---------|----------|
| Payload CMS | `^3.82.0` | ✅ |
| Next.js | `^16.0.0` | ✅ |
| React | `^19.0.0` | ✅ |
| HeroUI | `^2.x` | Only for `style: 'hero-ui'` |
| Framer Motion | `^12.x` | Only for `style: 'hero-ui'` |

---

## License

MIT © Main 12
