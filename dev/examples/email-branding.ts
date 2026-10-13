import type { BaseTemplateOptions } from '@main12/auth-login/rsc'

/** Shared by preview samples and the plugin's email settings. */
export const emailBranding: BaseTemplateOptions = {
  projectName: 'Dev Test',
  // Public HTTPS placeholder for testing remote images; replace with your hosted brand logo.
  logoUrl:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/Test-Logo.svg/960px-Test-Logo.svg.png?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail',
  contactEmail: 'support@example.com',
  domain: 'https://example.com',
  colors: { primary: '#3e86b0', primaryText: '#ffffff' },
}
