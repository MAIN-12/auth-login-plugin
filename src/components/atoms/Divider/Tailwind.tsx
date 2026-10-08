'use client'
import React from 'react'
import type { DividerProps } from './types'
export const Divider: React.FC<DividerProps> = ({ className = '' }) => (
  <hr className={`border-0 h-px bg-gray-200 ${className}`} />
)
