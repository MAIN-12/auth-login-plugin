import './globals.css'
import config from '@payload-config'
import { AuthProvider } from '@main12/auth-login/rsc'
import Logo from '../../components/Logo'
import DemoNavigation from '../../components/DemoNavigation'
import { authPlugin } from '../../plugins'

// Explicit host-app choice, not automatic browser/request detection.
const locale = 'es-CO'

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  await config

  return (
    <html lang={locale}>
      <body style={{ margin: 0, padding: 0 }}>
        <AuthProvider
          publicConfig={authPlugin.publicConfig}
          locale={locale}
          logo={<Logo />}
          messages={{
            [locale]: {
              login: {
                title: 'Bienvenido de nuevo',
                subtitle: 'Inicia sesión con tu correo para continuar.',
                noAccount: '¿No tienes cuenta?',
                signUpLink: 'Regístrate',
              },
            },
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
          <DemoNavigation />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
