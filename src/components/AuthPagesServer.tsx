import AuthPagesClient from './AuthPages'
import type { AuthPagesProps } from './AuthPages'
import { getServerAllowSignup, getServerGoogleOAuthEnabled, pluginConfig } from '../config'
import { AuthSignupConfig } from './AuthSignupConfig'
import { AuthPresentationDefaults } from './auth-presentation/AuthPresentationContext'
import { getServerPresentationDefaults } from './auth-presentation/serverDefaults'

export type { AuthPagesProps }

/** Server settings feed the card internally; signup visibility never changes the URL. */
export default async function AuthPages(props: AuthPagesProps) {
  const presentation = await getServerPresentationDefaults()
  return (
    <AuthPresentationDefaults value={presentation}>
      <AuthSignupConfig enabled={getServerAllowSignup()}>
        <AuthPagesClient
          {...props}
          showGoogleOAuth={props.showGoogleOAuth ?? getServerGoogleOAuthEnabled()}
          passwordLogin={props.passwordLogin ?? pluginConfig.passwordLogin}
          otpLogin={props.otpLogin ?? pluginConfig.otpLogin}
        />
      </AuthSignupConfig>
    </AuthPresentationDefaults>
  )
}
