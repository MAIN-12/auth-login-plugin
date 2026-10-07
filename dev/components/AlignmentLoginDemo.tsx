'use client'

import { useState, type ReactNode } from 'react'
import { Tabs } from '@heroui/react'

type Alignment = 'left' | 'center' | 'right'

const positions: Record<Alignment, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
}

export default function AlignmentLoginDemo({ children }: { children: ReactNode }) {
  const [alignment, setAlignment] = useState<Alignment>('center')

  return (
    <Tabs
      selectedKey={alignment}
      onSelectionChange={(key) => {
        if (key === 'left' || key === 'center' || key === 'right') setAlignment(key)
      }}
      className="relative w-full min-h-screen"
    >
      <div className="absolute inset-x-0 top-6 z-10 flex justify-center px-4">
        <Tabs.List aria-label="Auth card alignment" className="gap-2 bg-transparent p-0">
          {(['left', 'center', 'right'] as const).map((value) => (
            <Tabs.Tab
              key={value}
              id={value}
              className={`h-auto w-auto rounded-full border px-4 py-2 text-sm font-normal transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${alignment === value ? 'border-white/40 bg-white/15 text-white' : 'border-white/10 bg-black/30 text-slate-400 hover:text-white'}`}
            >
              {value === 'left' ? 'Left' : value === 'center' ? 'Center' : 'Right'}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </div>
      {/* Reuse one panel and card instance so changing alignment keeps form state. */}
      <Tabs.Panel
        id={alignment}
        className={`flex min-h-screen w-full items-center px-0 py-24 md:px-8 ${positions[alignment]}`}
      >
        <div className="w-full max-w-[432px]">{children}</div>
      </Tabs.Panel>
    </Tabs>
  )
}
