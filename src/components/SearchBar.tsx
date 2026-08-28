import GlassPane from './GlassPane'

interface Props {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

export default function SearchBar({ value, onChange, autoFocus = false }: Props) {
  return (
    <div className="relative w-full rounded-[36px] border border-ink/20 shadow-[0_4px_12px_rgba(0,0,0,0.1)] group">
      <GlassPane forceCss borderRadius={36} className="absolute inset-0 z-0 rounded-[36px] bg-ink/10 transition-colors group-focus-within:bg-ink/15" />
      <div className="relative z-10 flex items-center gap-3 px-[18px] py-3">
        <input
          type="text"
          placeholder="Search..."
          value={value}
          onChange={e => onChange(e.target.value)}
          autoFocus={autoFocus}
          className="w-full bg-transparent font-instrument text-[16px] text-ink placeholder-ink/40 outline-none"
        />
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
          <path d="M14.7 15.75L9.975 11.025C9.6 11.325 9.16875 11.5625 8.68125 11.7375C8.19375 11.9125 7.675 12 7.125 12C5.7625 12 4.60938 11.5281 3.66563 10.5844C2.72188 9.64062 2.25 8.4875 2.25 7.125C2.25 5.7625 2.72188 4.60938 3.66563 3.66563C4.60938 2.72188 5.7625 2.25 7.125 2.25C8.4875 2.25 9.64062 2.72188 10.5844 3.66563C11.5281 4.60938 12 5.7625 12 7.125C12 7.675 11.9125 8.19375 11.7375 8.68125C11.5625 9.16875 11.325 9.6 11.025 9.975L15.75 14.7L14.7 15.75ZM7.125 10.5C8.0625 10.5 8.85938 10.1719 9.51562 9.51562C10.1719 8.85938 10.5 8.0625 10.5 7.125C10.5 6.1875 10.1719 5.39062 9.51562 4.73438C8.85938 4.07812 8.0625 3.75 7.125 3.75C6.1875 3.75 5.39062 4.07812 4.73438 4.73438C4.07812 5.39062 3.75 6.1875 3.75 7.125C3.75 8.0625 4.07812 8.85938 4.73438 9.51562C5.39062 10.1719 6.1875 10.5 7.125 10.5Z" fill="#F8FAFC" fillOpacity="0.4"/>
        </svg>
      </div>
    </div>
  )
}
