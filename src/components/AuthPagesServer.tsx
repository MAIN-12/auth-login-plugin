import AuthPagesClient from './AuthPages'
import type { AuthPagesProps as ClientAuthPagesProps } from './AuthPages'
import type { PublicAuthConfig } from '../config'
import { AuthConfigProvider } from './AuthConfigContext'
import { AuthSignupConfig } from './AuthSignupConfig'
import { AuthPresentationDefaults } from './auth-presentation/AuthPresentationContext'
import { getServerPresentationDefaults } from './auth-presentation/serverDefaults'

export type AuthPagesProps = ClientAuthPagesProps & { publicConfig: PublicAuthConfig }

/** Server settings feed the card internally; signup visibility never changes the URL. */
export default async function AuthPages({ publicConfig, ...props }: AuthPagesProps) {
  const presentation = await getServerPresentationDefaults(publicConfig)
  return (
    <AuthConfigProvider publicConfig={publicConfig}>
    <AuthPresentationDefaults value={presentation}>
      <AuthSignupConfig enabled={publicConfig.allowSignup}>
        <AuthPagesClient
          {...props}
          showGoogleOAuth={props.showGoogleOAuth ?? publicConfig.googleOAuthEnabled}
          passwordLogin={props.passwordLogin ?? publicConfig.passwordLogin}
          otpLogin={props.otpLogin ?? publicConfig.otpLogin}
        />
      </AuthSignupConfig>
    </AuthPresentationDefaults>
    </AuthConfigProvider>
  )
}
