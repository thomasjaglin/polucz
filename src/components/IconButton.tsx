import { forwardRef } from 'react'

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
      className={`relative flex h-[42px] w-[42px] items-center justify-center rounded-full bg-gradient-to-br from-white/30 via-white/5 to-transparent p-[1px] shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-all hover:scale-105 active:scale-95 ${className}`}
    >
      <div className="absolute inset-[1px] z-0 rounded-full bg-[#1a1a1a]/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.3)] kube-glass-bg" />
      <span className="material-symbols-rounded relative z-10 text-[24px] text-[#F8FAFC]">
        {icon}
      </span>
    </button>
  )
})

export default IconButton
