'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function DemoNavigation() {
  const pathname = usePathname()
  if (pathname === '/') return null

  return (
    <nav aria-label="Demo navigation" className="fixed bottom-4 left-4 z-40">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <span aria-hidden="true">←</span> All demos
      </Link>
    </nav>
  )
}
