'use client'
import React from 'react'
import type { CardProps } from './types'
export const CardFooter: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`px-8 pb-8 flex justify-center ${className}`}>{children}</div>
)
