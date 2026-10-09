'use client'
import React from 'react'
import type { CardProps } from './types'
export const CardHeader: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`flex flex-col items-center gap-2 pt-8 pb-4 px-8 ${className}`}>{children}</div>
)
