import Link from 'next/link'
import { samples } from './templates'
import { TestEmailForm } from './TestEmailForm'
import { EmailPreview } from './EmailPreview'
import { CustomizationHelp } from './CustomizationHelp'
import { projectAuthEmails } from '../../../examples/auth-emails'

export const metadata = { title: 'Email previews | Main12' }

export default async function EmailDemo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const custom = query.design === 'custom'
  const mobile = query.width === 'mobile'
  const selected = samples.find((sample) => sample.id === query.email) ?? samples[0]
  const email = await selected.render(custom ? projectAuthEmails : {})
  const href = (changes: Record<string, string>) =>
    `/email-demo?${new URLSearchParams({ email: selected.id, design: custom ? 'custom' : 'default', width: mobile ? 'mobile' : 'desktop', ...changes })}`
  const pill = (active: boolean) =>
    `inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium ${active ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900'} focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-500`

  return (
    <div className="light min-h-dvh bg-[#f5f5f7] text-zinc-900" style={{ colorScheme: 'light' }}>
      <main className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Email previews</h1>
          <CustomizationHelp title={selected.title} note={selected.note} />
        </header>
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside
            aria-label="Email preview options"
            className="min-w-0 p-3 md:sticky md:top-4 md:max-h-[calc(100dvh-2rem)] md:overflow-y-auto"
          >
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Design
            </h2>
            <nav
              aria-label="Email design"
              className="grid grid-cols-2 gap-1 rounded-2xl bg-zinc-200/60 p-1"
            >
              <Link
                scroll={false}
                href={href({ design: 'default' })}
                aria-current={!custom ? 'page' : undefined}
                className={pill(!custom)}
              >
                Plugin
              </Link>
              <Link
                scroll={false}
                href={href({ design: 'custom' })}
                aria-current={custom ? 'page' : undefined}
                className={pill(custom)}
              >
                Project
              </Link>
            </nav>
            <h2 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Emails
            </h2>
            <nav
              aria-label="Email templates"
              className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible"
            >
              {samples.map((sample) => (
                <Link
                  scroll={false}
                  key={sample.id}
                  href={href({ email: sample.id })}
                  aria-current={sample.id === selected.id ? 'page' : undefined}
                  className={`${pill(sample.id === selected.id)} shrink-0 md:justify-start`}
                >
                  {sample.title}
                </Link>
              ))}
            </nav>
          </aside>
          <section className="min-w-0 text-zinc-900" aria-label="Selected email preview">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
              <h2 className="text-xl font-semibold">{selected.title}</h2>
              <TestEmailForm
                key={`${selected.id}-${custom}`}
                template={selected.id}
                title={selected.title}
                design={custom ? 'custom' : 'default'}
                enabled={process.env.NODE_ENV === 'development'}
              />
            </div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-200/70 pt-4">
              <p className="min-w-0 flex-1 text-sm text-zinc-600">
                <span className="mr-2 text-zinc-400">Subject</span>
                {email.subject}
              </p>
              <nav
                aria-label="Preview width"
                className="ml-auto flex gap-1 rounded-xl bg-zinc-200/70 p-1"
              >
                <Link
                  scroll={false}
                  href={href({ width: 'desktop' })}
                  aria-current={!mobile ? 'page' : undefined}
                  className={`${pill(!mobile)} gap-2`}
                >
                  Desktop
                </Link>
                <Link
                  scroll={false}
                  href={href({ width: 'mobile' })}
                  aria-current={mobile ? 'page' : undefined}
                  className={`${pill(mobile)} gap-2`}
                >
                  Mobile
                </Link>
              </nav>
            </div>
            <EmailPreview
              title={`${selected.title} — ${custom ? 'project override' : 'plugin default'}`}
              html={email.html}
              mobile={mobile}
            />
          </section>
        </div>
      </main>
    </div>
  )
}
