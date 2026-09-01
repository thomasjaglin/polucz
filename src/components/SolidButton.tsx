import GlassPane from './GlassPane'
import { buttonGradient } from '../data/gradients'

interface Props {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  /** Adds the blob wash. Reserved for the one action on a screen that commits
   *  something — that scarcity is what makes it read as "press this" rather
   *  than as decoration. */
  gradient?: boolean
  /** 'primary' is raised and full strength; 'quiet' is the flat sibling that
   *  sits beside it (Cancel, the delete icon). */
  emphasis?: 'primary' | 'quiet'
  className?: string
  'aria-label'?: string
}

// The app's heaviest button: a 50px pill on a glass pane, an ink hairline, and
// an inset highlight over a drop shadow. Nine hand-rolled copies of this lived
// across ApiConfigPage and AddVocabPage before it became a component.
export default function SolidButton({
  children,
  onClick,
  disabled,
  gradient = false,
  emphasis = 'primary',
  className = '',
  ...rest
}: Props) {
  const raised = emphasis === 'primary'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex h-[50px] items-center justify-center overflow-hidden rounded-full border border-ink/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${
        raised ? 'shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_4px_12px_rgba(0,0,0,0.2)]' : ''
      } ${className}`}
      {...rest}
    >
      <GlassPane
        borderRadius={24}
        className="absolute inset-0 z-0 rounded-full bg-ink/5 transition-colors group-hover:bg-ink/10"
      />
      {gradient && (
        // The wash is drawn larger than the button and cropped by the pill's own
        // overflow, so the blur is never cut by the edge of its own layer.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[-236%_-22.61%_-190%_-29.79%] z-[1] opacity-70"
          dangerouslySetInnerHTML={{ __html: buttonGradient }}
        />
      )}
      <span
        className={`relative z-10 flex items-center justify-center gap-2 font-instrument text-[16px] ${
          raised ? 'font-semibold text-ink' : 'text-ink/70'
        }`}
      >
        {children}
      </span>
    </button>
  )
}
