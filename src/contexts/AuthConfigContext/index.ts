'use client'

import { createContext } from 'react'
import type { PublicAuthConfig } from '../../auth/contracts/publicConfig'

/** Data-only context. Presentation must not load the transport provider. */
export const AuthConfigContext = createContext<PublicAuthConfig | null>(null)
