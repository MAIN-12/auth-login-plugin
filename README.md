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

### 1. Add the plugin + Users collection to your Payload config

```ts
import { authLoginPlugin } from '@main12/auth-login'

export default buildConfig({
  collections: [
    {
      slug: 'users',
      auth: { tokenExpiration: 7200, verify: false, maxLoginAttempts: 5 },
      fields: [
        { name: 'name', type: 'text' },
        // OTP fields required by the plugin:
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
      logo: '/logo.png',          // shown automatically on all auth pages
      style: 'hero-ui',           // or 'tailwind'
    }),
  ],
})
```

### 2. Add auth pages to your app

Create one-line route files under `src/app/(frontend)/(auth)/`:

```tsx
// login/page.tsx
export { LoginPage as default } from '@main12/auth-login/client'

// signup/page.tsx
export { SignupPage as default } from '@main12/auth-login/client'

// forgot-password/page.tsx
export { ForgotPasswordPage as default } from '@main12/auth-login/client'

// verify-otp/page.tsx
export { VerifyOtpPage as default } from '@main12/auth-login/client'

// set-password/page.tsx
export { SetPasswordPage as default } from '@main12/auth-login/client'
```

The logo is already handled — no need to pass it. The plugin reads it from the global config.

### 3. Wire up the login action

```tsx
// login/page.tsx — override with your Payload login function:
'use client'
import { LoginPage } from '@main12/auth-login/client'
import { useAuth } from '@/providers/Auth'

export default function Page() {
  const { login } = useAuth()
  return <LoginPage onPasswordLogin={login} redirectTo="/dashboard" />
}
```

### 4. That's it — visit `/login`

---

## Configuration Options

```ts
authLoginPlugin({
  // === Branding ===
  projectName: 'My App',          // Used in email subjects and footers
  contactEmail: 'hi@myapp.com',   // Email footer contact
  domain: 'https://myapp.com',    // Links in emails
  logo: '/logo.png',              // Shown on all auth pages + email headers

  // === Style ===
  style: 'tailwind',              // 'tailwind' (default) | 'hero-ui'

  // === Enable/Disable ===
  enabled: true,                  // Set false to disable the plugin
})
```

### Per-page overrides

Each page component also accepts these props for project-specific customization:

```ts
<LoginPage
  logo={<AppLogo width={180} />}  // Override global logo (optional)
  onPasswordLogin={login}          // Required — Payload's login function
  redirectTo="/dashboard"          // Where to go after login
  showGoogleOAuth={true}           // Show "Continue with Google" button
  signupUrl="/signup"              // Link to signup page
  poweredBy={{                     // Powered by logo config
    enabled: true,
    logoUrl: '/custom.png',        // Override default Main12 logo
    linkUrl: 'https://your-site.com',
  }}
/>
```

---

## Building Custom Auth Pages

You can build your own UI while reusing the plugin's hooks, services, and endpoints.

### Custom login with your own components

```tsx
'use client'
import { useLoginFlow } from '@main12/auth-login/client'
import { Button, Input } from '@heroui/react' // or shadcn, or plain HTML
import { useAuth } from '@/providers/Auth'

export default function MyCustomLogin() {
  const { login } = useAuth()
  const {
    step, email, password, error, isLoading, showPassword,
    setEmail, setPassword, setShowPassword,
    handleEmailSubmit, handlePasswordSubmit, handleSendOtp, handleEditEmail,
  } = useLoginFlow({
    redirectTo: '/dashboard',
    onPasswordLogin: login,
  })

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit}>
            <Input type="email" label="Email" value={email} onValueChange={setEmail} />
            <Button type="submit" isLoading={isLoading}>Continue</Button>
          </form>
        )}
        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit}>
            <p>Signing in as {email} <button onClick={handleEditEmail}>Edit</button></p>
            <Input type="password" label="Password" value={password} onValueChange={setPassword} />
            <Button type="submit" isLoading={isLoading}>Sign In</Button>
          </form>
        )}
        {step === 'otp-prompt' && (
          <>
            <p>{email} <button onClick={handleEditEmail}>Edit</button></p>
            <Button onPress={handleSendOtp} isLoading={isLoading}>Send Code</Button>
          </>
        )}
      </div>
    </div>
  )
}
```

### Custom email templates

Override individual email translations or entire template functions:

```ts
import { getEmailTranslations } from '@main12/auth-login/rsc'

// Option 1: Deep-merge translations
const myTranslations = getEmailTranslations('en')
myTranslations.welcome.subject = 'Welcome to My SaaS! 🚀'
myTranslations.otp.purposeLogin = 'Use this code to access your dashboard:'

// Option 2: Import template generators and wrap them
import { generateWelcomeEmail, generateOtpEmail } from '@main12/auth-login/rsc'

function myWelcomeEmail(params) {
  const base = generateWelcomeEmail(params)
  return {
    ...base,
    html: base.html.replace('Get Started', 'Launch Dashboard'),
  }
}

// Use in your Payload hooks or custom endpoints
await payload.sendEmail({
  to: user.email,
  subject: myWelcomeEmail({ userName: user.name }).subject,
  html: myWelcomeEmail({ userName: user.name }).html,
})
```

---

## Exported Hooks & Services

| Hook / Service | Type | Purpose |
|---------------|------|---------|
| `useLoginFlow` | Hook | Multi-step login state machine (email → password/OTP) |
| `useVerifyOtpFlow` | Hook | OTP input, verify, resend with cooldown |
| `useForgotPasswordFlow` | Hook | Email → check → send OTP |
| `useSetPasswordFlow` | Hook | Set password with strength indicator |
| `checkEmail(email)` | Service | Check if user exists and has password |
| `sendOtp(email, purpose)` | Service | Send OTP to email |
| `verifyOtp(email, otp)` | Service | Verify OTP code |
| `setUserPassword(pw, confirm)` | Service | Set/update password |
| `signup(name, email)` | Service | Create new user |
| `initiateGoogleLogin(redirect)` | Service | Redirect to Google OAuth |

---

## API Endpoints

Registered automatically by the plugin:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/check-email` | Check if email is registered |
| POST | `/api/auth/otp/send` | Generate + send OTP via Payload email adapter |
| POST | `/api/auth/otp/verify` | Verify OTP + login (sets httpOnly cookie) |
| POST | `/api/auth/set-password` | Set/update password |
| POST | `/api/auth/signup` | Create account + send welcome email |

---

## ShadCN Compatibility

The `tailwind` style uses standard Tailwind utility classes — it works in ShadCN projects out of the box. If you want ShadCN components instead of plain HTML:

1. Follow the [Custom Auth Pages](#building-custom-auth-pages) guide above
2. Import `useLoginFlow`, `useVerifyOtpFlow`, etc. from the plugin
3. Use your ShadCN `<Button>`, `<Input>`, `<Card>` components with the same hook values

No need for a separate `style: 'shadcn'` — the Tailwind style already renders compatible markup, and custom pages give you full ShadCN component control.

---

## Dev Testing

This repo ships with a dev harness. To test locally:

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
