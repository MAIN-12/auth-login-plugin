import type { Metadata } from 'next'
import ThemeLoginDemo from '../../../components/ThemeLoginDemo'

import { authPlugin } from '../../../plugins'

export const metadata: Metadata = { title: 'Login themes | Main12' }

export default function ThemeDemoPage() {
  return <ThemeLoginDemo pluginTheme={authPlugin.publicConfig.theme ?? 'inherit'} />
}
