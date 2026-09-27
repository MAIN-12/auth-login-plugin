import './globals.css'
import config from '@payload-config'
import { AuthProvider } from '@main12/auth-login/rsc'
import Logo from '../../components/Logo'

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  await config

  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        <AuthProvider
          logo={<Logo />}
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
        >
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
