import './integration.css'
import type { ReactNode } from 'react'
export const metadata = { title: 'Packed authentication consumer' }
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
