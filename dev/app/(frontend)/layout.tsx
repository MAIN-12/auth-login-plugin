import './globals.css'
import { AuthClientInit } from '../../components/AuthClientInit'

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        {/* mirrors style: 'hero-ui' from dev/plugins/index.ts */}
        <AuthClientInit style="hero-ui" />
        {children}
      </body>
    </html>
  )
}