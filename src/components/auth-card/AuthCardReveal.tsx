'use client'

import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export function AuthCardReveal({ children }: { children: React.ReactNode }) {
  const reducedMotion = useReducedMotion()
  return (
    <motion.div
      data-auth-card-ready=""
      initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  )
}
