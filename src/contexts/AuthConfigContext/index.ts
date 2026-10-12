'use client'

import { createContext } from 'react'
import type { PublicAuthConfig } from '../../shared/contracts/publicConfig'

/** Data-only context. Presentation must not load the transport provider. */
export const AuthConfigContext = createContext<PublicAuthConfig | null>(null)
