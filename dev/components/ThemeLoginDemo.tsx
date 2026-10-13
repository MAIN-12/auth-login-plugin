'use client'

import { useState } from 'react'
import { AuthCard, type AuthCardTheme } from '@main12/auth-login/client'

export default function ThemeLoginDemo({ pluginTheme }: { pluginTheme: AuthCardTheme }) {
  const [pageTheme, setPageTheme] = useState<'light' | 'dark'>('light')
  const [cardTheme, setCardTheme] = useState<AuthCardTheme | 'default'>('default')
  const resolvedTheme = cardTheme === 'default' ? pluginTheme : cardTheme
  const effectiveTheme = resolvedTheme === 'inherit' ? pageTheme : resolvedTheme
  const optionClass =
    'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-soft-foreground'

  return (
    <main
      data-theme={pageTheme}
      className="min-h-dvh bg-background text-foreground transition-colors"
    >
      <div className="mx-auto max-w-6xl px-5 py-12 pb-28 sm:px-8">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Main12 · Appearance
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Make the login feel at home
          </h1>
          <p className="mt-4 text-base leading-7 text-muted">
            Let the login follow your app, or give it its own light or dark appearance.
          </p>
        </header>
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
          <section
            aria-label="Theme controls"
            className="rounded-2xl border border-border bg-surface p-6"
          >
            <fieldset>
              <legend className="font-semibold">Page theme</legend>
              <p className="mt-1 text-sm text-muted">The surrounding application.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(['light', 'dark'] as const).map((theme) => (
                  <label key={theme} className={optionClass}>
                    <input
                      type="radio"
                      name="page-theme"
                      value={theme}
                      checked={pageTheme === theme}
                      onChange={() => setPageTheme(theme)}
                      className="accent-accent"
                    />
                    {theme === 'light' ? 'Light page' : 'Dark page'}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-8">
              <legend className="font-semibold">Login appearance</legend>
              <p className="mt-1 text-sm text-muted">
                Plugin default: {pluginTheme}. Override it for this card below.
              </p>
              <div className="mt-4 grid gap-2">
                {(
                  [
                    { value: 'default', label: 'Use plugin default' },
                    { value: 'inherit', label: 'Follow the page' },
                    { value: 'light', label: 'Always light' },
                    { value: 'dark', label: 'Always dark' },
                  ] as const
                ).map(({ value, label }) => (
                  <label key={value} className={optionClass}>
                    <input
                      type="radio"
                      name="card-theme"
                      value={value}
                      checked={cardTheme === value}
                      onChange={() => setCardTheme(value)}
                      className="accent-accent"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <p role="status" className="mt-6 text-sm text-muted">
              The login is {effectiveTheme}
              {resolvedTheme === 'inherit'
                ? ', following the page.'
                : ', regardless of the page theme.'}
            </p>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-background p-3 text-xs leading-6">
              <code>{`<AuthCard
  style="hero-ui"
${cardTheme === 'default' ? '' : `  theme="${cardTheme}"\n`}  slug="login"
/>`}</code>
            </pre>
          </section>
          <section aria-label="Login preview" className="min-w-0">
            <p className="text-center text-sm text-muted">
              Type an email, then switch themes. Your draft stays in place.
            </p>
            <AuthCard
              slug="login"
              style="hero-ui"
              theme={cardTheme === 'default' ? undefined : cardTheme}
              mobileVariant="card"
              locale="en"
              redirectTo="/theme-demo"
            />
          </section>
        </div>
      </div>
    </main>
  )
}
