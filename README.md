# @main12/auth-login

**Payload CMS authentication plugin** — login, signup, OTP, forgot password, branded emails, and "Powered by Main 12" footer. Install once, done.

```ts
// payload.config.ts
import { authLoginPlugin } from '@main12/auth-login'

plugins: [
  authLoginPlugin({
    projectName: 'My SaaS',
    domain: 'https://myapp.com',
    logo: 'https://myapp.com/logo.png',
    style: 'tailwind',
    routeRedirects: true,
  }),
]
```

---

## Features

- **5 auth pages** — login (multi-step), signup, forgot password, verify OTP, set password
- **Single catch-all route** — one file handles all auth pages (`AuthPages` component)
- **Route redirects** — automatic `/login` → `/auth/login`, `/admin/login` → `/auth/login` via Next.js 16 proxy
- **Multi-style** — `tailwind` (zero UI deps) or `hero-ui` (HeroUI + framer-motion). Set once in config
- **Google OAuth** — optional, enable via `providers` config (hidden by default)
- **5 API endpoints** — `check-email`, `otp/send`, `otp/verify`, `set-password`, `signup`
- **OTP engine** — SHA-256 hashing + `timingSafeEqual` comparison, 10-min expiry, 3 attempts
- **Email templates** — welcome, OTP login, password reset, password changed (EN/ES)
- **Powered by Main 12** — bundled inline SVG, linked to main12.com by default (URL overridable)
- **Global logo** — pass once in plugin config, automatically shown on all pages and email headers
- **Configurable login methods** — `passwordLogin` and `otpLogin` options for flexible auth flows
- **Auto-verify OTP** — automatically verifies when all 6 digits are entered
- **Smart redirects** — logged-in users are redirected away from auth pages
- **Google account picker** — always shows account selection by default (`prompt: 'select_account'`)
- **Zero runtime deps** (Tailwind mode) — Next.js + React are peer dependencies

---

## Installation

```bash
pnpm add @main12/auth-login
```

### Tailwind mode (default, zero UI deps — also ShadCN compatible)

No extra dependencies needed. The Tailwind style uses standard utility classes that work in any Tailwind project, including ShadCN-based ones.

If you are using Tailwind CSS in your host app, add the plugin to your Tailwind source scanning so custom utility classes compile properly:

- **Tailwind v4** (in your `globals.css`):
  ```css
  @source './node_modules/@main12/auth-login/**/*.{js,ts,jsx,tsx}';
  ```
- **Tailwind v3** (in your `tailwind.config.js`):
  ```js
  content: [
    './node_modules/@main12/auth-login/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ]
  ```

### HeroUI mode

```bash
pnpm add @heroui/react framer-motion @iconify/react
```

---

## Quick Start (Simplified Setup)

The fastest way to get all auth pages running with just **2 files**.

### 1. Add the plugin + Users collection

```ts
// payload.config.ts
import { authLoginPlugin } from '@main12/auth-login'

export default buildConfig({
  collections: [
    {
      slug: 'users',
      auth: { tokenExpiration: 7200, verify: false, maxLoginAttempts: 5 },
      fields: [
        { name: 'name', type: 'text' },
      ],
    },
  ],
  plugins: [
    authLoginPlugin({
      projectName: 'My App',
      domain: 'https://myapp.com',
      logo: '/logo.png',
      style: 'tailwind',
      routeRedirects: true,   // enables /login → /auth/login redirects
    }),
  ],
})
```

> **Note:** OTP data is stored in a hidden `auth-otps` collection that the plugin registers automatically. No OTP fields needed on your `users` collection.

### 2. Create the catch-all auth route (1 file)

```tsx
// src/app/(frontend)/(auth)/auth/[...slug]/page.tsx
'use client'

import { use } from 'react'
import { AuthPages } from '@main12/auth-login/client'

export default function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = use(params)
  return <AuthPages slug={slug} />
}
```

This single file handles all routes:
- `/auth/login`
- `/auth/signup`
- `/auth/forgot-password`
- `/auth/verify-otp`
- `/auth/set-password`

### 3. Add the proxy for route redirects (1 file)

```ts
// src/proxy.ts (Next.js 16+)
export { proxy, config } from '@main12/auth-login/proxy'
```

This redirects:
- `/login` → `/auth/login`
- `/signup` → `/auth/signup`
- `/forgot-password` → `/auth/forgot-password`
- `/verify-otp` → `/auth/verify-otp`
- `/set-password` → `/auth/set-password`
- `/admin/login` → `/auth/login` (**always**, regardless of `routeRedirects` setting)

### 4. Visit `/login` — done.

---

## Configuration

```ts
authLoginPlugin({
  // Core
  projectName: 'My App',          // Email subjects + footers
  contactEmail: 'hi@myapp.com',   // Email footer contact
  domain: 'https://myapp.com',    // Links in emails
  logo: '/logo.png',              // All auth pages + email headers
  style: 'tailwind',              // 'tailwind' | 'hero-ui'
  enabled: true,

  // Login methods
  passwordLogin: true,            // Allow password-based login (default: true)
  otpLogin: true,                 // Allow OTP-based login (default: true)

  // Route redirects
  routeRedirects: true,           // Enable /login → /auth/login redirects
  // or with custom base path:
  // routeRedirects: { basePath: '/auth' },

  // OAuth providers (optional — hidden by default)
  providers: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      prompt: 'select_account',   // Always show account picker (default)
    },
  },
})
```

### Route Redirects

| Value | Behavior |
|-------|----------|
| `false` (default) | No redirects. You manage your own routes. |
| `true` | Redirects `/login`, `/signup`, etc. → `/auth/login`, `/auth/signup`, etc. |
| `{ basePath: '/myauth' }` | Same, but redirects to `/myauth/login`, etc. |

> **Note:** `/admin/login` is **always** redirected to the plugin login page when the proxy is active, regardless of the `routeRedirects` setting.

### Google OAuth (Providers)

Google OAuth is **hidden by default**. To enable it, just add `providers.google` — the plugin handles everything (UI buttons + server-side OAuth flow via `payload-oauth2` under the hood):

```ts
authLoginPlugin({
  providers: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      successRedirect: '/dashboard',    // optional, defaults to '/admin'
      failureRedirect: '/login?error=failed', // optional
    },
  },
})
```

That's it. No extra packages to install, no extra plugins to configure.

| Config | Behavior |
|--------|----------|
| Omitted / not set | Google OAuth hidden |
| `google: true` | Auto-detect `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` from env |
| `google: { clientId, clientSecret }` | Enable with explicit credentials |
| `google: false` | Force disable |

#### Google Account Picker

By default, Google always shows the account selection screen (`prompt: 'select_account'`). This prevents confusion when users have multiple Google accounts.

| `prompt` value | Behavior |
|----------------|----------|
| `'select_account'` (default) | Always show account picker |
| `'consent'` | Prompt for consent every time |
| `'none'` | Skip picker, use existing session |

### Login Methods

Control which login methods are available:

```ts
authLoginPlugin({
  passwordLogin: false,  // Disable password login
  otpLogin: true,        // Enable OTP login
})
```

| `passwordLogin` | `otpLogin` | User has password | Behavior |
|---|---|---|---|
| ✅ | ✅ | Yes | Password step |
| ✅ | ✅ | No | OTP → straight to app |
| ❌ | ✅ | Any | OTP → straight to app |
| ✅ | ❌ | No | OTP → set password prompt |
| ✅ | ❌ | Yes | Password step |

When `otpLogin` is enabled, users are never prompted to set a password after OTP verification — they go straight to the app. The set-password prompt only appears when `passwordLogin` is enabled and `otpLogin` is disabled.

---

## AuthPages Props

The `AuthPages` component accepts these props for customization:

```tsx
<AuthPages
  slug={slug}                    // Required — from catch-all route params
  redirectTo="/dashboard"        // Where to go after login/set-password (default: '/admin')
  logo={<MyLogo />}             // Custom logo component
  basePath="/auth"               // Base path for sibling links (default: '/auth')
  showGoogleOAuth={true}         // Override Google OAuth visibility
  onPasswordLogin={customLogin}  // Custom login handler
  onSignup={customSignup}        // Custom signup handler
/>
```

---

## Individual Page Setup (Advanced)

If you need full control over each page, create separate route files instead of using `AuthPages`:

```tsx
// login/page.tsx
'use client'
import { LoginPage } from '@main12/auth-login/client'

export default function Page() {
  return (
    <LoginPage
      onPasswordLogin={async ({ email, password }) => {
        const res = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        if (!res.ok) throw new Error('Login failed')
      }}
      redirectTo="/dashboard"
      signupUrl="/signup"
    />
  )
}
```

### Per-page overrides

```tsx
<LoginPage
  logo={<AppLogo width={180} />}
  onPasswordLogin={login}
  redirectTo="/dashboard"
  showGoogleOAuth={true}
  signupUrl="/signup"
/>

<SignupPage onSignup={signup} loginUrl="/login" />
<ForgotPasswordPage loginUrl="/login" />
<VerifyOtpPage loginUrl="/login" />
<SetPasswordPage redirectTo="/dashboard" />
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

## Exports

| Import path | Contents |
|-------------|----------|
| `@main12/auth-login` | Plugin factory, types, server config |
| `@main12/auth-login/client` | Page components, `AuthPages`, hooks, services, UI utilities |
| `@main12/auth-login/rsc` | Email template generators, translations |
| `@main12/auth-login/proxy` | Next.js 16 proxy for route redirects |

---

## ShadCN Compatibility

The `tailwind` style works in ShadCN projects out of the box. For ShadCN components, build a [custom page](#building-custom-pages) — import the plugin's hooks and use your `@/components/ui/button`, `@/components/ui/input`, etc.

---

## Setup Comparison

| Approach | Files needed | Best for |
|----------|-------------|----------|
| **Catch-all + proxy** (recommended) | 2 files | Most projects — fastest setup |
| **Individual pages** | 5 files | Full control over each page |
| **Custom pages with hooks** | Your own files | Completely custom UI |
| **Backend only** (`routeRedirects: false`, no `AuthPages`) | 0 frontend files | Custom frontend using only the API endpoints + hooks |

---

## 🤖 AI Agent Prompts

Copy these prompts into Claude, Cursor, Copilot, or any AI agent.

### Prompt: Set up the auth plugin (simplified catch-all)

```
Add @main12/auth-login to this Payload project:

1. Install: pnpm add @main12/auth-login
2. In payload.config.ts, add:
   - Users collection with auth enabled + otpHash, otpAttempts, otpExpiresAt fields
   - Plugin: authLoginPlugin({ projectName: "<PROJECT>", domain: "<URL>", logo: "/logo.png", style: "tailwind", routeRedirects: true })
3. Create catch-all route: src/app/(frontend)/(auth)/auth/[...slug]/page.tsx
   - 'use client', import { use } from 'react', import { AuthPages } from '@main12/auth-login/client'
   - export default function Page({ params }) { const { slug } = use(params); return <AuthPages slug={slug} /> }
4. Create proxy: src/proxy.ts
   - export { proxy, config } from '@main12/auth-login/proxy'
5. Verify: visit /login → should redirect to /auth/login
```

### Prompt: Set up with Google OAuth

```
Add @main12/auth-login with Google OAuth to this Payload project:

1. Install: pnpm add @main12/auth-login
2. In payload.config.ts, add:
   - Users collection with auth enabled + otpHash, otpAttempts, otpExpiresAt fields
   - Plugin: authLoginPlugin({
       projectName: "<PROJECT>",
       domain: "<URL>",
       style: "tailwind",
       routeRedirects: true,
       providers: {
         google: {
           clientId: process.env.GOOGLE_CLIENT_ID,
           clientSecret: process.env.GOOGLE_CLIENT_SECRET,
         }
       }
     })
3. Create catch-all route + proxy (same as simplified setup)
4. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env
5. Verify: visit /login → should show Google OAuth button
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

## Usage with @main12/brevo-adapter

```ts
import { authLoginPlugin } from '@main12/auth-login'
import { brevoAdapter } from '@main12/brevo-adapter'

export default buildConfig({
  email: brevoAdapter(),
  plugins: [authLoginPlugin({ projectName: 'My App' })],
})
```

The auth-login plugin uses `payload.sendEmail()` internally — which routes through Brevo automatically.

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
