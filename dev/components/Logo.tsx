import { LockKeyhole } from 'lucide-react'

export default function Logo() {
  return (
    <div className="flex items-center gap-2 text-2xl font-bold text-foreground">
      <LockKeyhole size={28} aria-hidden="true" />
      Auth Test
    </div>
  )
}
