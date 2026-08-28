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
  /** Read-only display (e.g. a saved API key) — dimmed and non-interactive. */
  disabled?: boolean
}

export default function GlassInput({ placeholder, type = 'text', icon, value, onChange, onKeyDown, className = '', clearable = false, disabled = false }: Props) {
  return (
    <div className={`relative w-full rounded-[36px] border border-ink/20 shadow-[0_4px_12px_rgba(0,0,0,0.1)] group ${disabled ? 'opacity-60' : ''} ${className}`}>
      <GlassPane borderRadius={36} className="absolute inset-0 z-0 rounded-[36px] bg-ink/10 transition-colors group-focus-within:bg-ink/15" />
      <div className="relative z-10 flex items-center gap-3 px-[18px] py-3">
        {icon && <span className="material-symbols-rounded text-[18px] text-ink/50 shrink-0">{icon}</span>}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          className="w-full bg-transparent font-instrument text-[16px] text-ink placeholder-ink/40 outline-none"
        />
        {clearable && !disabled && !!value && (
          <button
            onClick={() => onChange?.('')}
            aria-label="Clear input"
            className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full bg-ink/10 text-ink/50 transition-colors hover:bg-ink/15 hover:text-ink"
          >
            <span className="material-symbols-rounded text-[16px]">close</span>
          </button>
        )}
      </div>
    </div>
  )
}
