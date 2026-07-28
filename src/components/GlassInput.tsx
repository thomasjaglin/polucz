import GlassPane from './GlassPane'

interface Props {
  placeholder: string
  type?: 'text' | 'password'
  icon?: string
  value?: string
  onChange?: (v: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  className?: string
  clearable?: boolean
}

export default function GlassInput({ placeholder, type = 'text', icon, value, onChange, onKeyDown, className = '', clearable = false }: Props) {
  return (
    <div className={`relative w-full rounded-[36px] border border-[#F8FAFC]/20 shadow-[0_4px_12px_rgba(0,0,0,0.1)] group ${className}`}>
      <GlassPane borderRadius={36} className="absolute inset-0 z-0 rounded-[36px] bg-[#F8FAFC]/10 transition-colors group-focus-within:bg-[#F8FAFC]/15" />
      <div className="relative z-10 flex items-center gap-[12px] px-[18px] py-[12px]">
        {icon && <span className="material-symbols-rounded text-[18px] text-[#F8FAFC]/50 shrink-0">{icon}</span>}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent font-instrument text-[16px] text-[#F8FAFC] placeholder-[#F8FAFC]/40 outline-none"
        />
        {clearable && !!value && (
          <button
            onClick={() => onChange?.('')}
            aria-label="Clear input"
            className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full bg-[#F8FAFC]/10 text-[#F8FAFC]/50 transition-colors hover:bg-[#F8FAFC]/15 hover:text-[#F8FAFC]"
          >
            <span className="material-symbols-rounded text-[16px]">close</span>
          </button>
        )}
      </div>
    </div>
  )
}
