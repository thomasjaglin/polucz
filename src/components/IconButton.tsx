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
      className={`relative flex h-[42px] w-[42px] items-center justify-center rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.12)] transition-all hover:scale-105 active:scale-95 ${className}`}
    >
      <GlassPane borderRadius={21} className="absolute inset-0 z-0 rounded-full bg-[#F8FAFC]/[0.02]" />
      <span className="material-symbols-rounded relative z-10 text-[24px] text-[#F8FAFC]">
        {icon}
      </span>
    </button>
  )
})

export default IconButton
