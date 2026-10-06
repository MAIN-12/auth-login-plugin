import type { OtpOptions } from '../../config'
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
/** No environment defaults or legacy unsafe templates; explicit per-instance locale/branding. */
export function otpEmail(code: string, settings?: OtpOptions['email']) {
  const es = settings?.locale === 'es'
  const name = escape(settings?.projectName ?? 'Account')
  const title = es ? 'Tu código de acceso' : 'Your sign-in code'
  const preview = es ? 'Usa este código para iniciar sesión.' : 'Use this code to sign in.'
  const logo = settings?.logoUrl ? `<img src="${escape(settings.logoUrl)}" alt="${name}" width="120">` : ''
  const contact = settings?.contactUrl ? `<p><a href="${escape(settings.contactUrl)}">${es ? 'Contacto' : 'Contact'}</a></p>` : ''
  return { subject: `${title} — ${settings?.projectName ?? 'Account'}`, html: `<!doctype html><html lang="${es ? 'es' : 'en'}"><body><div style="display:none;max-height:0;overflow:hidden">${preview}</div>${logo}<h1>${name}</h1><p>${preview}</p><p style="font-size:32px;letter-spacing:8px">${escape(code)}</p><p>${es ? 'No compartas este código.' : 'Do not share this code.'}</p>${contact}</body></html>` }
}
