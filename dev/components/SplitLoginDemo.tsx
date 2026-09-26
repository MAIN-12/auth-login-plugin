import { AuthLayout, AuthCard } from '@main12/auth-login/rsc'
import Logo from './Logo'
import { authPluginOptions } from '../plugins'

/**
 * Demo: custom split layout — AuthCard on the right, image on the left.
 * Built entirely from the plugin's exported AuthLayout + AuthCard primitives.
 *
 * Uses the slug-based API — just pass `slug="login"` and the form is auto-selected
 * with full translations support via the `messages` prop. `allowSignup` is
 * intentionally omitted so the server AuthCard falls back to the plugin's
 * `pluginConfig.allowSignup` singleton — the single source of truth.
 */
export default async function SplitLoginDemo() {
  return (
    <AuthLayout backgroundClass="bg-white">
      <div className="min-h-screen grid md:grid-cols-2">
        {/* Left: image pane (hidden on mobile) */}
        <div
          className="hidden md:block bg-cover bg-center"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=80)' }}
        />

        {/* Right: the auth card with login form auto-selected via slug */}
        <div className="flex items-center justify-center">
          <AuthCard
            slug="login"
            logo={<Logo />}
            removeShadow
            removeBorder
            redirectTo="/admin"
            basePath="/auth"
            allowSignup={authPluginOptions.allowSignup}
            messages={{
              en: {
                login: {
                  title: 'Welcome Back',
                  subtitle: 'Sign in with your email to continue.',
                  noAccount: "Don't have an account?",
                  signUpLink: 'Sign up',
                },
              },
            }}
          />
        </div>
      </div>
    </AuthLayout>
  )
}
