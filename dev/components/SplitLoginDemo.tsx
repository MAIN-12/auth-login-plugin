import { AuthLayout, AuthCard } from '@main12/auth-login/rsc'

/**
 * Demo: custom split layout — AuthCard on the right, image on the left.
 * Built entirely from the plugin's exported AuthLayout + AuthCard primitives.
 *
 * Uses the slug-based API — just pass `slug="login"` and the form is auto-selected
 * with shared branding and translations inherited from the layout provider.
 * The plugin signup setting is supplied internally by the server provider.
 */
export default async function SplitLoginDemo() {
  return (
    <AuthLayout backgroundClass="bg-white">
      <div className="min-h-screen grid md:grid-cols-2">
        {/* Left: image pane (hidden on mobile) */}
        <div
          className="hidden md:block bg-cover bg-center"
          style={{
            backgroundImage:
              'url(https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=80)',
          }}
        />

        {/* Right: the auth card with login form auto-selected via slug */}
        <div className="flex items-center justify-center">
          <AuthCard slug="login" removeShadow removeBorder redirectTo="/admin" basePath="/auth" />
        </div>
      </div>
    </AuthLayout>
  )
}
