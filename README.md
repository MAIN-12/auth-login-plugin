# @main12/auth-login

**Payload CMS authentication plugin** — login, signup, OTP, forgot password, branded emails, and "Powered by Main 12" footer. Install once, configure your project name and logo, done.

```ts
// payload.config.ts
import { authLoginPlugin } from '@main12/auth-login'

plugins: [
  authLoginPlugin({
    projectName: 'My SaaS',
    domain: 'https://myapp.com',
    style: 'hero-ui',        // 'tailwind' (default) | 'hero-ui'
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
- **Powered by Main 12** — bundled inline SVG, linked to main12.com by default
- **Zero runtime deps** (Tailwind mode) — Next.js + React are peer dependencies

---

## Installation

```bash
pnpm add @main12/auth-login
```

### Tailwind mode (default, zero UI deps)

No extra dependencies needed.

### HeroUI mode

```bash
pnpm add @heroui/react framer-motion @iconify/react
```

---

## Quick Start

### 1. Add the plugin to your Payload config

```ts
import { authLoginPlugin } from '@main12/auth-login'

export default buildConfig({
  plugins: [
    authLoginPlugin({
      projectName: 'My App',
      domain: 'https://myapp.com',
      contactEmail: 'support@myapp.com',
      style: 'tailwind',   // or 'hero-ui'
    }),
  ],
  // ... rest of your config
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

### 3. Wire up the login action

The plugin needs a `login` function. Pass yours from Payload's `useAuth()`:

```tsx
// login/page.tsx
'use client'
import { LoginPage } from '@main12/auth-login/client'
import { useAuth } from '@/providers/Auth'
import AppLogo from '@/components/Logo/AppLogo'

export default function Page() {
  const { login } = useAuth()
  return (
    <LoginPage
      logo={<AppLogo width={180} height={42} />}
      onPasswordLogin={login}
      redirectTo="/dashboard"
      poweredBy={{ enabled: true }}
    />
  )
}
```

---

## Configuration Options

```ts
authLoginPlugin({
  // === Branding ===
  projectName: 'My App',          // Used in email subjects and footers
  contactEmail: 'hi@myapp.com',   // Email footer contact
  domain: 'https://myapp.com',    // Links in emails

  // === Style ===
  style: 'tailwind',              // 'tailwind' | 'hero-ui'

  // === Enable/Disable ===
  enabled: true,                  // Set false to disable the plugin
})
```

Each page component also accepts these props:

```ts
<LoginPage
  logo={...}                    // React node — your brand logo
  onPasswordLogin={login}       // Required — Payload's login function
  redirectTo="/dashboard"       // Where to go after login
  showGoogleOAuth={true}        // Show "Continue with Google" button
  signupUrl="/signup"           // Link to signup page
  poweredBy={{                  // Powered by logo config
    enabled: true,
    logoUrl: '/custom-logo.png',  // Override the default Main12 logo
    linkUrl: 'https://your-site.com',
    width: 28,
    height: 28,
  }}
/>
```

---

## Using Hooks & Services Directly

Don't want the pre-built pages? Use the hooks and services to build your own:

```tsx
import { useLoginFlow, useVerifyOtpFlow, checkEmail, sendOtp } from '@main12/auth-login/client'

function MyCustomLogin() {
  const { email, handleEmailSubmit, ... } = useLoginFlow({
    redirectTo: '/dashboard',
    onPasswordLogin: login,
  })
  // Build your own UI with these values
}
```

### Exported Hooks

| Hook | Purpose |
|------|---------|
| `useLoginFlow` | Multi-step login state machine (email → password/OTP) |
| `useVerifyOtpFlow` | OTP input, verify, resend with cooldown |
| `useForgotPasswordFlow` | Email → check → send OTP |
| `useSetPasswordFlow` | Set password with strength indicator |

### Exported Services

| Function | Description |
|----------|-------------|
| `checkEmail(email)` | Check if user exists and has password |
| `sendOtp(email, purpose)` | Send OTP to email |
| `verifyOtp(email, otp)` | Verify OTP code |
| `setUserPassword(password, confirm)` | Set/update password |
| `signup(name, email)` | Create new user |
| `initiateGoogleLogin(redirect)` | Redirect to Google OAuth |

---

## API Endpoints

Registered automatically by the plugin:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/check-email` | Check if email is registered |
| POST | `/api/auth/otp/send` | Generate + send OTP |
| POST | `/api/auth/otp/verify` | Verify OTP + login |
| POST | `/api/auth/set-password` | Set/update password |
| POST | `/api/auth/signup` | Create account |

---

## Email Templates

Four HTML email templates in EN/ES, using the host project's Payload email adapter:

- **Welcome** — sent on signup
- **OTP** — 6-digit code for login or password reset
- **Password Reset** — OTP email for forgot password flow
- **Password Changed** — confirmation after password update

Override translations or template functions via the `emails` option (Phase 2).

---

## Dev Testing

This repo ships with a dev harness. To test locally:

```bash
cd auth-login-plugin
pnpm install
pnpm dev
```

Visits:
- `http://localhost:3000/login` — multi-step login
- `http://localhost:3000/signup` — create account
- `http://localhost:3000/forgot-password` — password reset
- `http://localhost:3000/admin` — Payload admin panel

The dev config uses SQLite (no external DB needed) with a Users collection pre-configured.

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
