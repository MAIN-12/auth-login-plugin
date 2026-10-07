import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Auth playground | Main12' }

const sections = [
  {
    title: 'Login layouts',
    description: 'Explore the same authentication flow in different presentations.',
    demos: [
      { title: 'Centered login', href: '/centered-demo', description: 'The default full-page layout with a centered auth card.' },
      { title: 'Card alignment', href: '/alignment-demo', description: 'The centered login card with tabs to switch between left, center, and right alignment.' },
      { title: 'Split login', href: '/split-demo', description: 'An image alongside the login form. Stacks down to the form on mobile.' },
      { title: 'Modal login', href: '/modal-demo', description: 'Open login over a page, preserve your draft, and check the session.' },
    ],
  },
  {
    title: 'Backgrounds',
    description: 'Compare the configured textures on the dark login page.',
    demos: [
      { title: 'Spotlight dots', href: '/texture-demo?texture=spotlight-dots', description: 'The auth card over a dotted spotlight texture.' },
      { title: 'Spotlight grid', href: '/texture-demo?texture=spotlight-grid', description: 'The same card with the grid texture.' },
      { title: 'Plain background', href: '/texture-demo?texture=none', description: 'A solid dark background without a texture.' },
    ],
  },
  {
    title: 'Auth screens',
    description: 'These screens use the active plugin settings and real authentication flows.',
    demos: [
      { title: 'Current login', href: '/auth/login', description: 'The login presentation currently configured in the development app.' },
      { title: 'Sign up', href: '/auth/signup', description: 'Create an account using the configured signup flow.' },
      { title: 'Forgot password', href: '/auth/forgot-password', description: 'Start the password recovery flow.' },
      { title: 'Verify code', href: '/auth/verify-otp', description: 'Preview the verification screen. Completing it requires an email and a valid code from a login or signup flow.' },
      { title: 'Set password', href: '/auth/set-password', description: 'Preview the password screen. Completing it requires a valid recovery session.' },
    ],
  },
]

export default function DemoHomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
        <header className="mb-14 max-w-2xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">Main12 · Development</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Auth playground</h1>
          <p className="mt-5 text-lg leading-8 text-muted">
            One place to explore the login layouts, backgrounds, and authentication screens.
            Choose a demo to get started.
          </p>
        </header>
        <div className="space-y-12">
          {sections.map((section, index) => (
            <section key={section.title} aria-labelledby={`demo-section-${index}`}>
              <h2 id={`demo-section-${index}`} className="text-xl font-semibold">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{section.description}</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.demos.map((demo) => (
                  <article key={demo.href} className="flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm">
                    <h3 className="text-lg font-medium">{demo.title}</h3>
                    <p className="mb-6 mt-2 flex-1 text-sm leading-6 text-muted">{demo.description}</p>
                    <Link href={demo.href} aria-label={`Open ${demo.title.toLowerCase()} demo`}
                      className="inline-flex min-h-11 items-center justify-between gap-3 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                      Open demo <span aria-hidden="true">↗</span>
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
