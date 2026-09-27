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
- **No UI library required** (Tailwind mode) — only Next.js/React/Payload peers; `style: 'hero-ui'` additionally requires HeroUI + Framer Motion
- **Multi-language** — built-in English/Spanish, auto-detected per-request, fully overridable via `messages` prop, works with or without next-intl/next-i18next

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

## Testing All Pages

Once the catch-all route is set up, every auth page is reachable directly by URL. Some pages require query params to have meaningful content (they're normally reached by clicking through the flow, e.g. signup → verify-otp), so use the URLs below to test each one in isolation:

| Page | URL to test | Notes |
|------|-------------|-------|
| **Login** | `/auth/login` | 3 sub-states, driven by user interaction: email step (default) → password step or OTP-prompt step, depending on whether the account has a password and `passwordLogin`/`otpLogin` config |
| **Signup** | `/auth/signup` | Hidden entirely if `allowSignup: false` — falls back to rendering Login instead |
| **Forgot Password** | `/auth/forgot-password` | No query params required |
| **Verify OTP** | `/auth/verify-otp?email=test@example.com&purpose=signup` | ⚠️ **Renders a blank page if `email` is missing** — always include `?email=...`. `purpose` can be `login`, `signup`, or `password-reset` (changes the title/subtitle) |
| **Set Password** | `/auth/set-password` | No query params required |

> **Why does `/auth/verify-otp` show a blank page?** The page intentionally renders `null` when there's no `email` in the URL, since in real usage it's always reached via a redirect from signup/login/forgot-password that appends `?email=...&purpose=...`. This is expected — not a bug. Always test it with the full query string above.

### Testing the Login page's 3 sub-states

The Login page's step is internal UI state, not driven by the URL — to see each one:
1. **Email step** (default) — just load `/auth/login`.
2. **Password step** — enter an email that belongs to a user *with* a password set, then submit. Requires `passwordLogin: true` (default).
3. **OTP-prompt step** — enter an email that belongs to a user *without* a password set (e.g. a Google OAuth-only user), with `otpLogin: true` and `passwordLogin: true`.

### Testing Google OAuth

Google OAuth buttons only render when `providers.google` is configured with valid credentials (see [Google OAuth](#google-oauth-providers) below). With no credentials, the button is hidden — this is expected in a fresh setup.

### Testing different locales

Every page also respects the `locale` prop / auto-detection (see [Multi-Language Support](#multi-language-support)). To manually verify a specific language without changing your browser or OS settings, append the plugin's `locale` prop explicitly in your route file, or set the `NEXT_LOCALE` cookie / send an `Accept-Language` header:

```bash
curl -H "Accept-Language: es-MX,es;q=0.9" http://localhost:3000/auth/login
```

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

  // Signup
  allowSignup: true,               // Allow new users to sign up (default: true)

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
  passwordLogin={true}           // Override plugin's passwordLogin setting for this render
  otpLogin={true}                // Override plugin's otpLogin setting for this render
  onPasswordLogin={customLogin}  // Custom login handler
  onSignup={customSignup}        // Custom signup handler
  locale="es"                    // Override auto-detected locale (see Multi-Language Support)
  messages={{ es: { login: { title: 'Bienvenido' } } }} // Partial translation overrides

  // Card chrome — same options accepted by <AuthCard> (see Components Reference)
  poweredBy={{ enabled: true }}  // Configure/hide the "Powered by Main 12" badge
  cardClassName=""               // Extra classes on the card wrapper
  removeBorder={false}           // Remove the card border (useful for split/custom layouts)
  removeShadow={false}           // Remove the card shadow
  mobileVariant="plain"          // 'plain' | 'card' — how the card renders on mobile widths
/>
```

---

## Multi-Language Support

Built-in support for **English (`en`)** and **Spanish (`es`)** — works out of the box, no configuration required. The plugin never depends on next-intl, next-i18next, or any i18n library; it reads the same conventional signals those libraries already write, so it plugs into whatever your app already does automatically.

### Automatic locale detection

If you don't pass a `locale` prop, it's resolved per-request in this order:

1. `NEXT_LOCALE` cookie (written by next-intl, next-i18next, and most i18n routing middlewares by convention)
2. `Accept-Language` request header
3. `<html lang="...">` attribute (client-side fallback)
4. `'en'` (default)

This means if your app already uses next-intl or next-i18next, the auth pages automatically match your site's current language — **zero extra code needed**.

### Explicit locale override

Pass `locale` directly on `<AuthPages />` (or any individual page component) to force a specific language for that render, regardless of auto-detection — useful if you resolve the locale yourself server-side:

```tsx
// app/(auth)/auth/[...slug]/page.tsx
import { AuthPages } from '@main12/auth-login/rsc'
import { getLocale } from 'next-intl/server' // or however your app resolves it

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const locale = await getLocale()
  return <AuthPages slug={slug} locale={locale} />
}
```

### Overriding copy / adding new languages

Pass a `messages` object — a partial override, keyed by locale. Any key you don't specify falls back to the built-in English/Spanish copy automatically. You can also introduce entirely new locales this way (e.g. French, Portuguese):

```tsx
<AuthPages
  slug={slug}
  messages={{
    en: {
      login: { title: 'Welcome Back!' }, // override just this one key
    },
    es: {
      login: { title: '¡Bienvenido de nuevo!' },
    },
    fr: { // brand new locale, not built-in — falls back to English for any key not provided
      login: { title: 'Content de vous revoir', subtitle: 'Connectez-vous pour continuer.' },
      signup: { title: 'Créer un compte' },
    },
  }}
/>
```

Resolution order per key: `messages[locale]` → `messages.en` → built-in `[locale]` dictionary → built-in `en` dictionary.

### Available translation keys

Each page has its own section — see `UiTranslations` (exported from `@main12/auth-login/client`) for the full shape:

| Section | Covers |
|---------|--------|
| `login` | Title/subtitle for all 3 sub-states (email, password, OTP-prompt), Google button, form labels, links |
| `signup` | Title/subtitle, form labels, Google button, terms/privacy links, login link |
| `forgotPassword` | Title/subtitle, form labels, back-to-login link |
| `verifyOtp` | Title/subtitle for both variants (code verification vs password-reset), resend button (supports `{seconds}` interpolation) |
| `setPassword` | Title/subtitle, form labels, password requirements text |

### Using translations in custom pages

If you're building fully custom pages with the hooks (see [Building Custom Pages](#building-custom-pages)), import `getUiTranslations` directly:

```tsx
import { getUiTranslations } from '@main12/auth-login/client'

const t = getUiTranslations(locale, messages).login
// t.title, t.continueWithGoogle, t.emailLabel, etc.
```

---

## Migrating to 2.0

- Configure `allowSignup` only in `authLoginPlugin(...)`; remove it from `AuthCard`, `AuthPages`, and provider `authCardProps`. Disabled signup renders Login at the signup URL and hides the signup prompt, without a signup-specific redirect.
- Move `locale` and `messages` from `AuthLayout` to `AuthProvider` for shared page/modal defaults, or to an individual `AuthCard`. `AuthLayout` now handles only the page wrapper.
- Mount the server `AuthProvider` as shown below to share plugin settings with client auth components. `modalLogin: true` takes precedence over the plugin's proxy redirects.
- `AuthCard` forms now honor `style: 'hero-ui'` for cards, buttons, inputs, and OTP controls. Both page and modal flows use these shared forms. The older standalone page exports remain available.

## Modal login and shared session state

Enable modal login in the plugin:

```ts
// payload.config.ts
plugins: [authLoginPlugin({ modalLogin: true, style: 'hero-ui' })]
```

Mount the server provider once in your frontend layout. Await your Payload configuration first so its plugin settings are initialized. The server wrapper passes UI settings and locale to the client provider; it does not send secrets to the browser.

```tsx
// app/(frontend)/layout.tsx
import config from '@payload-config'
import { AuthProvider } from '@main12/auth-login/rsc'

export default async function Layout({ children }: { children: React.ReactNode }) {
  await config
  return <AuthProvider>{children}</AuthProvider>
}
```

For a client-only integration, import `AuthProvider` from `@main12/auth-login/client` and pass `modalLogin`, `style`, and `authCardProps` explicitly. Client modules cannot automatically read the Payload server configuration.

```tsx
'use client'
import { useAuth } from '@main12/auth-login/client'

export function AccountActions() {
  const { user, status, openLogin, isLoggedIn, logout } = useAuth()

  async function protectedAction() {
    try {
      if (!(await isLoggedIn())) return
      // The server confirmed the session. Continue your action here.
    } catch {
      // Session verification failed (for example, offline). Show a retry message.
    }
  }

  return <>
    <button onClick={() => openLogin()}>Sign in</button>
    <button onClick={protectedAction}>Continue</button>
  </>
}
```

| Provider API | Behavior |
| --- | --- |
| `user` / `status` / `error` | Current user; status is `loading`, `authenticated`, `unauthenticated`, or `error` |
| `openLogin({ redirectTo? })` | Opens login; navigates to the login page when modal mode is disabled |
| `closeLogin()` / `isLoginOpen` | Dismisses or observes the modal |
| `isLoggedIn({ redirectTo? })` | Fetches `/api/users/me` with cookies and no cache; returns true for a valid session, otherwise prompts for login and returns false |
| `isLogedin()` | Alias for `isLoggedIn()` |
| `refreshSession()` | Refreshes the user without prompting for login |
| `logout()` | Ends the server session, clears the user, and refreshes the current route |

The session check validates the server session instead of inspecting cookie presence. It rejects on network/server failures and preserves the last known user. Call it from an event handler or effect, not during rendering. An action that returns false is not automatically replayed after login. Continue enforcing authorization in your server endpoints and protected pages.

Login, signup, password recovery, OTP, and setting a password all reuse `AuthCard` within the modal. By default, successful login closes it and refreshes server-rendered data while retaining the current URL and page state. Pass `openLogin({ redirectTo: '/checkout' })` to navigate after success. Destinations must be local paths. Google OAuth still visits Google, then returns to the original page in modal mode unless an explicit Google `successRedirect` is configured. Standalone auth pages remain available for direct links and OAuth error fallback.

With `style: 'hero-ui'`, the provider loads the [HeroUI v3 Modal](https://heroui.com/en/docs/react/components/modal). Import `@heroui/styles` in your app CSS. Clicking the backdrop or empty area around the dialog dismisses login; clicking inside the form does not. Escape and the close button also dismiss it. Cancelling does not authenticate the user or continue a protected action. Tailwind mode uses the native modal dialog with Escape dismissal, focus restoration, and background scroll locking. Optional `modalLabel` and `closeLabel` customize accessible labels. Set shared branding and language directly on the provider; `authCardProps` supplies modal-only overrides and login-method settings. `initialUser` can provide a known user or null; otherwise the provider fetches the session on mount. No polling, inactivity timeout, or session watchdog is included.

### Shared language and branding

Configure shared presentation on the provider; both modal and page components inherit it:

```tsx
<AuthProvider
  locale="es"
  messages={{ es: { login: { title: 'Bienvenido' } } }}
  logo={<Logo />}
  poweredBy={{ enabled: false }}
>
  {children}
</AuthProvider>
```

`AuthCard` still renders the logo and controls its placement. A card can override `logo`, `locale`, `messages`, `style`, or `poweredBy` for its subtree:

```tsx
<AuthLayout backgroundClass="bg-white">
  <AuthCard slug="login" /> {/* Inherits the provider's branding and language */}
  <AuthCard slug="signup" locale="en" logo={<PartnerLogo />} />
</AuthLayout>
```

Precedence is **explicit component props → nearest provider → plugin/request/browser defaults**. Partial message dictionaries merge by translation key, and partial `poweredBy` settings merge by field. Undefined values inherit; `logo={null}` deliberately hides the logo. Custom children/forms inside a card inherit that card's language. Components also work without a provider.

`AuthLayout` only accepts page wrapper options (`backgroundClass`, `verticalAlign`, and `children`). Move any former layout `locale`/`messages` props to `AuthProvider`, `AuthCard`, or the page component. The layout never applied those settings to children; page components continue accepting their existing localization props.

For custom auth UI, `useAuthPresentation()` reads resolved presentation settings and `useAuthTranslations()` reads the shared dictionary. Both work independently of the session context. `getUiTranslations()` remains a pure function and only uses its explicit arguments.

Server exports keep detected settings as fallback context, so an RSC `AuthCard` or `AuthPages` inside a provider cannot accidentally override the provider's language or logo. Session checks and authorization remain independent of presentation settings.

### Proxy precedence

`modalLogin: true` disables this plugin's auth redirects, including `/admin/login` and redirects away from auth pages when a cookie is present. It also takes precedence over an explicit proxy `basePath`. Application access checks and unrelated proxy logic remain your application's responsibility.

Proxy runtimes may run separately from Payload. In the dev app, the proxy imports the plugin index to initialize the same settings; there is no second UI options file or repeated `modalLogin` setting:

```ts
// dev/proxy.ts
import './plugins'
export { proxy } from '@main12/auth-login/proxy'
export const config = {
  matcher: ['/admin/login', '/login', '/signup', '/forgot-password', '/verify-otp', '/set-password', '/auth/:path*'],
}
```

`allowSignup` is not a proxy option. Set it only in `authLoginPlugin(...)`. The server provider/cards carry it internally to the UI: when false, `AuthCard` renders Login for the `signup` slug and omits the entire signup prompt. It does not redirect to another URL. Do not pass `allowSignup` to `AuthCard`, `AuthPages`, or `authCardProps`.

If the application only uses modal login, the plugin proxy can be omitted altogether. Typing `/login` into the address bar does not open a modal over a previous page; use `openLogin()` or `isLoggedIn()` from the current page.

The development frontend layout mounts the shared provider. Try it at `/modal-demo`; change `style` or `modalLogin` directly in `dev/plugins/index.ts` to switch the UI or test page login. The dev proxy consumes the same plugin configuration. Run the provider and proxy regression suite with `pnpm test --run`.

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

## Custom Layouts (Split-Screen, etc.)

For layouts `AuthPages` can't express (e.g. a split-screen with an image pane), compose `AuthLayout` + `AuthCard` directly — the same primitives every built-in page is built from. Pass `slug` to auto-render the matching form (with full translation/config support), and use `removeBorder`/`removeShadow`/`cardClassName` to fit the card into your own layout:

```tsx
// app/(auth)/auth/[...slug]/page.tsx  (server component, no 'use client' needed)
import { AuthLayout, AuthCard } from '@main12/auth-login/rsc'

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  return (
    <AuthLayout backgroundClass="bg-white">
      <div className="min-h-screen grid md:grid-cols-2">
        <div className="hidden md:block bg-cover bg-center" style={{ backgroundImage: 'url(/hero.jpg)' }} />
        <div className="flex items-center justify-center">
          <AuthCard
            slug={slug?.[0] ?? 'login'}
            removeShadow
            removeBorder
            basePath="/auth"
            redirectTo="/admin"
          />
        </div>
      </div>
    </AuthLayout>
  )
}
```

`AuthCard` also accepts `children` instead of `slug` for fully custom form content — see [Building Custom Pages](#building-custom-pages) below.

---

## Building Custom Pages

Use the plugin's hooks to build your own UI with any component library (HeroUI, shadcn, plain Tailwind).

### Hook Quick-Reference

| Hook | Returns | Key inputs |
|------|---------|------------|
| `useLoginFlow({ redirectTo, onPasswordLogin })` | `step, email, password, error, isLoading, isSendingOtp, showPassword, setEmail, setPassword, setShowPassword, handleEmailSubmit, handlePasswordSubmit, handleSendOtp, handleEditEmail, handleGoogleLogin` | `redirectTo: string`, `onPasswordLogin: (creds) => Promise<void>` |
| `useForgotPasswordFlow()` | `email, error, isLoading, setEmail, handleSubmit` | none |
| `useVerifyOtpFlow({ email, purpose, redirectTo })` | `otp, error, isLoading, isResending, resendCooldown, setOtp, handleSubmit, handleResendCode` | `email: string`, `purpose: 'login'\|'signup'\|'password-reset'` |
| `useSetPasswordFlow({ redirectTo })` | `password, confirmPassword, error, isLoading, showPassword, strength, setPassword, setConfirmPassword, setShowPassword, handleSubmit` | `redirectTo?: string` |

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

## Exports & Components Reference

| Import path | Contents |
|-------------|----------|
| `@main12/auth-login` | Plugin factory (`authLoginPlugin`), types, server config |
| `@main12/auth-login/client` | Page components, `AuthPages`, hooks, services, UI/locale utilities |
| `@main12/auth-login/rsc` | Server component `AuthPages` wrapper, email template generators, email translations |
| `@main12/auth-login/proxy` | Next.js 16 proxy for route redirects |

### Components (`@main12/auth-login/client` unless noted)

| Component | Description | Typical usage |
|-----------|-------------|----------------|
| `AuthPages` (also `@main12/auth-login/rsc`) | Catch-all component — renders the correct page based on `slug`. The `/rsc` version is a server component that auto-resolves plugin config + locale from headers; the `/client` version needs `'use client'` and manual config props | `<AuthPages slug={slug} />` in your `[...slug]/page.tsx` |
| `LoginPage` | Standalone login page (email → password/OTP flow) | Individual route setup, or full customization via props |
| `SignupPage` | Standalone signup page | Individual route setup |
| `ForgotPasswordPage` | Standalone forgot-password page | Individual route setup |
| `VerifyOtpPage` | Standalone OTP verification page — **requires `?email=...` in the URL** | Reached via redirect from signup/login/forgot-password |
| `SetPasswordPage` | Standalone set/reset password page | Individual route setup, or post-OTP password creation |
| `AuthCard` | The card chrome (logo, title/subtitle, footer, "Powered by" badge) — pass `slug` to auto-render the matching form, or `children` for fully custom content. `removeBorder`/`removeShadow`/`cardClassName`/`mobileVariant` support custom layouts like split-screen | `<AuthCard slug="login" removeShadow basePath="/auth" />` or `<AuthCard title="..." subtitle="...">{children}</AuthCard>` |
| `AuthLayout` | Outermost full-height background wrapper used by every page — compose it with `AuthCard` (and e.g. a split-screen image) when building fully custom layouts | `<AuthLayout backgroundClass="bg-white"><AuthCard slug="login" /></AuthLayout>` |
| `AuthClientInit` | Drop into your root layout to sync server plugin config (`style`, Google OAuth flag) to client bundles. Optional — only needed if you hit issues with plugin config not reaching client components in certain bundler setups | `<AuthClientInit />` inside `<body>` |
| `PoweredBy` | The "Powered by Main 12" footer badge, rendered automatically on every page (configurable via `poweredBy` prop) | Rarely used standalone — mostly internal |

### Hooks (`@main12/auth-login/client`)

| Hook | Returns | Key inputs |
|------|---------|------------|
| `useLoginFlow({ redirectTo, onPasswordLogin })` | `step, email, password, error, isLoading, isSendingOtp, showPassword, setEmail, setPassword, setShowPassword, handleEmailSubmit, handlePasswordSubmit, handleSendOtp, handleEditEmail, handleGoogleLogin` | `redirectTo: string`, `onPasswordLogin: (creds) => Promise<void>` |
| `useForgotPasswordFlow()` | `email, error, isLoading, setEmail, handleSubmit` | none |
| `useVerifyOtpFlow({ email, purpose, redirectTo })` | `otp, error, isLoading, isResending, resendCooldown, setOtp, handleSubmit, handleResendCode` | `email: string`, `purpose: 'login'\|'signup'\|'password-reset'` |
| `useSetPasswordFlow({ redirectTo })` | `password, confirmPassword, error, isLoading, showPassword, strength, setPassword, setConfirmPassword, setShowPassword, handleSubmit` | `redirectTo?: string` |

### Service functions (`@main12/auth-login/client`)

Low-level `fetch` wrappers used internally by the hooks — call directly for fully custom flows:

| Function | Description |
|----------|--------------|
| `checkEmail(email)` | Checks whether an email is already registered |
| `sendOtp(email, purpose)` | Requests a new OTP code |
| `verifyOtp(email, otp, purpose)` | Verifies an OTP code, logs the user in on success |
| `setUserPassword(password)` | Sets/updates the current user's password |
| `signup(name, email)` | Creates a new account, triggers welcome email + OTP verification |
| `initiateGoogleLogin()` | Redirects to the Google OAuth flow |

### Utilities & config (`@main12/auth-login/client`)

| Export | Description |
|--------|--------------|
| `initClientConfig(opts)` | Manually sync plugin config into the client bundle (used internally by `AuthPages`/`AuthClientInit`) |
| `evaluatePasswordStrength(password)` | Returns `{ score, isValid, ... }` — used by the password strength meter |
| `isPasswordValid(password)` / `MIN_PASSWORD_LENGTH` | Password validation helpers |
| `getUiTranslations(locale, messages)` | Resolve translated UI copy — see [Multi-Language Support](#multi-language-support) |
| `uiTranslations` | Raw built-in `{ en, es }` dictionaries, if you need to read them directly |
| `detectClientLocale()` | Client-side locale auto-detection (cookie → `<html lang>` → `'en'`) |

### Email templates (`@main12/auth-login/rsc`)

| Export | Description |
|--------|--------------|
| `generateWelcomeEmail(params)` | Welcome email after signup |
| `generateOtpEmail(params)` | OTP code email (login/signup/password-reset) |
| `generatePasswordResetEmail(params)` | Password reset code email |
| `generatePasswordChangedEmail(params)` | Confirmation after password change |
| `getEmailTranslations(locale)` | English/Spanish email copy (separate dictionary from the UI translations above) |
| `wrapInBaseTemplate(options)` | Wraps any HTML body in the plugin's branded email shell |

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
| Payload CMS | `^3.90.0` | ✅ |
| Next.js | `^16.3.3` | ✅ |
| React | `^19.0.0` | ✅ |
| HeroUI | `>=3.2.0` | Only for `style: 'hero-ui'` |
| Framer Motion | `^12.x` | Only for `style: 'hero-ui'` |

---

## License

MIT © Main 12
