import type { ReactNode } from 'react'
import GlassPane from './GlassPane'

interface Props {
  children: ReactNode
  className?: string        // outer gradient-border wrapper
  contentClassName?: string // inner content div (controls padding, gap, etc.)
}

export default function GlassCard({ children, className = '', contentClassName = '' }: Props) {
  return (
    <div className={`relative w-full rounded-[36px] glass-raise ${className}`}>
      <div className="relative flex w-full flex-col rounded-[36px]">
        <GlassPane borderRadius={36} className="absolute inset-0 z-0 bg-ink/[0.02] rounded-[36px]" />
        <div className={`relative z-10 ${contentClassName}`}>
          {children}
        </div>
      </div>
    </div>
  )
}
