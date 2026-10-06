import { DEFAULT_COLORS, SOCIAL_ICONS, type EmailColors, type SocialLink, type SocialPlatform } from './constants'
import { getEmailTranslations, type SupportedLanguage } from './translations'

export interface BaseTemplateOptions {
  logoUrl?: string
  projectName?: string
  domain?: string
  colors?: Partial<EmailColors>
  preheader?: string
  language?: SupportedLanguage
  socialLinks?: SocialLink[]
  userEmail?: string
}

function getEmailHeader(logoUrl?: string, projectName = ''): string {
  const logoSrc = logoUrl || ''
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="${projectName}" width="200" style="max-width:200px;height:auto;display:block;margin:0 auto;">`
    : `<span style="font-size:28px;font-weight:bold;color:${DEFAULT_COLORS.primary};">${projectName}</span>`

  return `
    <tr>
      <td style="padding:24px 8px;text-align:center;">
        ${logoHtml}
      </td>
    </tr>`
}

function getSocialSection(socialLinks: SocialLink[]): string {
  if (!socialLinks?.length) return ''
  const iconsHtml = socialLinks
    .map(({ platform, url }) => {
      const icon = SOCIAL_ICONS[platform as SocialPlatform]
      if (!icon) return ''
      return `<a href="${url}" target="_blank" rel="noopener" style="display:inline-block;width:40px;height:40px;margin:0 6px;color:${DEFAULT_COLORS.textTertiary};text-decoration:none;">${icon}</a>`
    })
    .filter(Boolean)
    .join('')
  return `<tr><td style="padding:0 0 24px;text-align:center;">${iconsHtml}</td></tr>`
}

function getEmailFooter(
  language: SupportedLanguage = 'en',
  socialLinks?: SocialLink[],
  userEmail?: string,
  contactEmail?: string,
  projectName?: string,
): string {
  const t = getEmailTranslations(language)
  const year = new Date().getFullYear()
  const emailLine = userEmail
    ? `<p style="margin:16px 0 0;font-size:14px;color:${DEFAULT_COLORS.textSecondary};line-height:1.5;">${t.footerEmailSentTo} <strong>${userEmail}</strong>. ${t.footerSecurityNotice}</p>`
    : ''

  return `
    <tr>
      <td style="padding:16px;text-align:center;color:${DEFAULT_COLORS.textSecondary};font-size:14px;line-height:1.5;">
        <p style="margin:0;">${t.footerContactMessage} <a href="mailto:${contactEmail || ''}" style="color:${DEFAULT_COLORS.text};text-decoration:none;font-weight:bold;">${contactEmail || ''}</a></p>
        ${emailLine}
      </td>
    </tr>
    ${getSocialSection(socialLinks || [])}
    <tr>
      <td style="padding:16px 0 32px;text-align:center;">
        <p style="margin:0 0 8px;font-size:12px;color:${DEFAULT_COLORS.textTertiary};">© ${year} ${projectName || ''}. ${t.footerCopyright}</p>
        <p style="margin:0;font-size:12px;color:${DEFAULT_COLORS.textTertiary};">${t.footerTagline}</p>
      </td>
    </tr>`
}

export function wrapInBaseTemplate(content: string, options: BaseTemplateOptions = {}): string {
  const {
    logoUrl, projectName = '', preheader,
    language = 'en', socialLinks, userEmail,
  } = options

  const preheaderHtml = preheader
    ? `<span style="display:none;font-size:1px;color:#fff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>`
    : ''

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${projectName}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:${DEFAULT_COLORS.background};-webkit-font-smoothing:antialiased;">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${DEFAULT_COLORS.background};">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;">
          ${getEmailHeader(logoUrl, projectName)}
          ${content}
          ${getEmailFooter(language, socialLinks, userEmail, undefined, projectName)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()
}