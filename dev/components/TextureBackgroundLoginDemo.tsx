import Link from 'next/link'
import { AuthLayout, AuthCard, type AuthTexture } from '@main12/auth-login/rsc'

/** Default auth card over a black page and a transparent, optional texture. */
export default function TextureBackgroundLoginDemo({
  texture = 'spotlight-dots',
}: {
  texture?: AuthTexture
}) {
  return (
    <AuthLayout backgroundClass="bg-zinc-900" texture={texture}>
      <nav
        aria-label="Background texture"
        className="absolute top-6 inset-x-0 flex justify-center gap-2 px-4"
      >
        {(
          [
            ['spotlight-dots', 'Dots'],
            ['spotlight-grid', 'Grid'],
            ['none', 'None'],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={`/texture-demo?texture=${value}`}
            aria-current={texture === value ? 'page' : undefined}
            className={`rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${texture === value ? 'border-white/40 bg-white/15 text-white' : 'border-white/10 bg-black/30 text-slate-400 hover:text-white'}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-6 py-24">
        <AuthCard slug="login" basePath="/auth" mobileVariant="card" />
      </div>
    </AuthLayout>
  )
}
