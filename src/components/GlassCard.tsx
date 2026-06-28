import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string        // outer gradient-border wrapper
  contentClassName?: string // inner content div (controls padding, gap, etc.)
}

export default function GlassCard({ children, className = '', contentClassName = '' }: Props) {
  return (
    <div className={`relative w-full rounded-[36px] bg-gradient-to-br from-white/30 via-white/5 to-transparent p-[1px] shadow-[0_8px_32px_rgba(0,0,0,0.3)] ${className}`}>
      <div className="relative flex w-full flex-col rounded-[35px]">
        <div className="absolute inset-0 z-0 bg-[#1a1a1a]/40 rounded-[35px] kube-glass-bg" />
        <div className={`relative z-10 ${contentClassName}`}>
          {children}
        </div>
      </div>
    </div>
  )
}
