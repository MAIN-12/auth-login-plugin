import { authLoginPlugin } from '@main12/auth-login'

export const plugins = [
  authLoginPlugin({
    projectName: 'Dev Test',
    domain: 'http://localhost:3000',
    style: 'hero-ui',
    // style: 'tailwind',
  }),
]
