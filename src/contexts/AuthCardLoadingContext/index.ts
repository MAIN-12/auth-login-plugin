'use client'

import { createContext } from 'react'

/** Data-only handshake: visual children defer to the card's enclosing reveal. */
export const AuthCardLoadingContext = createContext(false)
