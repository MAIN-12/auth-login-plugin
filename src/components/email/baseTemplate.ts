import { SOCIAL_ICONS, type EmailColors, type SocialLink } from './constants'
import {
  escapeEmailText,
  validatedEmailUrl,
  resolveEmailColors,
} from '../../auth/domain/emailPresentation'
export {
  escapeEmailText,
  validatedEmailUrl,
  resolveEmailColors,
} from '../../auth/domain/emailPresentation'
import { getEmailTranslations, type SupportedLanguage } from './translations'

export interface BaseTemplateOptions {
  logoUrl?: string
  projectName?: string
  domain?: string
  contactEmail?: string
  contactUrl?: string
  colors?: Partial<EmailColors>
  preheader?: string
  language?: SupportedLanguage
  socialLinks?: SocialLink[]
  userEmail?: string
}
/** Content is trusted template HTML. All dynamic values must be escaped before composing it. */
export function wrapInBaseTemplate(content: string, options: BaseTemplateOptions = {}): string {
  const language = options.language === 'es' ? 'es' : 'en'
  const t = getEmailTranslations(language)
  const colors = resolveEmailColors(options.colors)
  const name = escapeEmailText(options.projectName ?? 'Account')
  const logo = options.logoUrl
    ? `<img src="${validatedEmailUrl(options.logoUrl)}" alt="${name}" width="180">`
    : `<h1 style="color:${colors.primary}">${name}</h1>`
  if (options.domain) validatedEmailUrl(options.domain)
  const email = options.contactEmail
  if (email && !/^[^\s<>"'@]+@[^\s<>"'@]+\.[^\s<>"'@]+$/.test(email))
    throw new Error('auth-login: invalid contact email')
  const contact = options.contactUrl
    ? `<a href="${validatedEmailUrl(options.contactUrl)}">${escapeEmailText(t.footerContactMessage)}</a>`
    : email
      ? `<a href="mailto:${escapeEmailText(email)}">${escapeEmailText(email)}</a>`
      : ''
  const social = (options.socialLinks ?? [])
    .map(
      ({ platform, url }) =>
        `<a href="${validatedEmailUrl(url)}" aria-label="${escapeEmailText(platform)}">${SOCIAL_ICONS[platform] ?? ''}</a>`,
    )
    .join('')
  const recipient = options.userEmail
    ? `<p>${escapeEmailText(t.footerEmailSentTo)} ${escapeEmailText(options.userEmail)}</p>`
    : ''
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title></head><body style="background:${colors.background};color:${colors.text};font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escapeEmailText(options.preheader ?? '')}</div><table role="presentation" style="width:100%;max-width:600px;margin:auto;background:${colors.backgroundSecondary};border:1px solid ${colors.border}"><tr><td style="padding:24px;text-align:center">${logo}</td></tr>${content}<tr><td style="padding:24px;text-align:center;color:${colors.textSecondary}">${contact}${recipient}${social}<p>© ${new Date().getFullYear()} ${name}. ${escapeEmailText(t.footerCopyright)}</p></td></tr></table></body></html>`
}
