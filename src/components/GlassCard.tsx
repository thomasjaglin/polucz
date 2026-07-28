import type { ReactNode } from 'react'
import GlassPane from './GlassPane'

interface Props {
  children: ReactNode
  className?: string        // outer gradient-border wrapper
  contentClassName?: string // inner content div (controls padding, gap, etc.)
}

export default function GlassCard({ children, className = '', contentClassName = '' }: Props) {
  return (
    <div className={`relative w-full rounded-[36px] shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(255,255,255,0.12)] ${className}`}>
      <div className="relative flex w-full flex-col rounded-[36px]">
        <GlassPane borderRadius={36} className="absolute inset-0 z-0 bg-[#F8FAFC]/[0.02] rounded-[36px]" />
        <div className={`relative z-10 ${contentClassName}`}>
          {children}
        </div>
      </div>
    </div>
  )
}
