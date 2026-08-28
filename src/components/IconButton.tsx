import { forwardRef } from 'react'
import GlassPane from './GlassPane'

interface Props {
  icon: string
  onClick: () => void
  className?: string
}

const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { icon, onClick, className = '' },
  ref
) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`relative flex h-[42px] w-[42px] items-center justify-center rounded-full glass-raise-sm transition-all hover:scale-105 active:scale-95 ${className}`}
    >
      <GlassPane borderRadius={20} className="absolute inset-0 z-0 rounded-full bg-ink/[0.02]" />
      <span className="material-symbols-rounded relative z-10 text-[24px] text-ink">
        {icon}
      </span>
    </button>
  )
})

export default IconButton
