import { AuthCard as AuthCardClient, type AuthCardWithSlugProps, type AuthCardWithChildrenProps } from './AuthCard'
import { getServerAllowSignup, getServerGoogleOAuthEnabled, pluginConfig } from '../config'
import { AuthSignupConfig } from './AuthSignupConfig'
import { AuthPresentationDefaults } from './auth-presentation/AuthPresentationContext'
import { getServerPresentationDefaults } from './auth-presentation/serverDefaults'

export type { AuthCardWithSlugProps, AuthCardWithChildrenProps }
export type AuthCardProps = AuthCardWithSlugProps | AuthCardWithChildrenProps

/** Resolve plugin settings internally. A disabled signup slug renders Login without redirecting. */
export async function AuthCard(props: AuthCardProps) {
  const presentation = await getServerPresentationDefaults()
  const card = 'slug' in props && props.slug !== undefined
    ? <AuthCardClient
        {...props}
        showGoogleOAuth={props.showGoogleOAuth ?? getServerGoogleOAuthEnabled()}
        passwordLogin={props.passwordLogin ?? pluginConfig.passwordLogin}
        otpLogin={props.otpLogin ?? pluginConfig.otpLogin}
      />
    : <AuthCardClient {...props} />

  return (
    <AuthPresentationDefaults value={presentation}>
      <AuthSignupConfig enabled={getServerAllowSignup()}>
        {card}
      </AuthSignupConfig>
    </AuthPresentationDefaults>
  )
}
