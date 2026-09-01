import GlassButton from '../GlassButton'
import EmptyState from '../EmptyState'
import { setAnchor } from '../tour/anchors'

interface Props {
  /** Questions ready to ask — stored sentences plus computed paradigm slots. */
  questionCount: number
  onStart: (type: 'declension' | 'conjugation') => void
  /** Coverage tools, rendered below the two quiz types. */
  coverage?: React.ReactNode
  /** Empty state only: install the welcome words. */
  onWelcome?: () => void
}

export default function QuizTypeSelector({ questionCount, onStart, coverage, onWelcome }: Props) {
  const hasEnough = questionCount >= 4

  // Nothing to ask about: show the way out rather than two greyed-out modes and
  // an instruction to go elsewhere.
  if (questionCount === 0) {
    return (
      <EmptyState
        icon="quiz"
        title="No questions yet"
        action={onWelcome && { label: 'Start with dzień dobry', onClick: onWelcome }}
        footnote="Questions are built from the forms of your own words — no key needed."
      >
        The quiz asks for the declensions and conjugations of words you have.
        Start with <em>dzień dobry</em> and there are eleven waiting.
      </EmptyState>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div ref={setAnchor('quiz-count')}>
        <h2 className="font-instrument text-[22px] font-semibold text-ink/90">Quiz Game</h2>
        <p className="mt-1 font-instrument text-[14px] ink-tertiary">
          {`${questionCount} question${questionCount === 1 ? '' : 's'} ready`}
        </p>
      </div>

      <div ref={setAnchor('quiz-modes')} className="flex flex-col gap-4">
      <GlassButton
        onClick={() => onStart('declension')}
        disabled={!hasEnough}
        radius={24}
        pane="bg-ink/[0.02]"
        contentClassName="block w-full text-left"
        className="w-full border border-ink/10 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] disabled:opacity-35"
      >
        <div className="flex items-center gap-4">
          <span className="material-symbols-rounded shrink-0 text-[24px] text-ink/70">table_chart</span>
          <div className="min-w-0">
            <div className="font-instrument text-[17px] font-semibold text-ink/90">Declension Quiz</div>
            <div className="font-instrument text-[13px] ink-tertiary">Multiple choice · nouns &amp; adjectives</div>
          </div>
          <span className="material-symbols-rounded ml-auto shrink-0 text-[20px] ink-glyph">chevron_right</span>
        </div>
      </GlassButton>

      <GlassButton
        onClick={() => onStart('conjugation')}
        disabled={!hasEnough}
        radius={24}
        pane="bg-ink/[0.02]"
        contentClassName="block w-full text-left"
        className="w-full border border-ink/10 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] disabled:opacity-35"
      >
        <div className="flex items-center gap-4">
          <span className="material-symbols-rounded shrink-0 text-[24px] text-ink/70">edit</span>
          <div className="min-w-0">
            <div className="font-instrument text-[17px] font-semibold text-ink/90">Conjugation Quiz</div>
            <div className="font-instrument text-[13px] ink-tertiary">Fill in the blank · verbs</div>
          </div>
          <span className="material-symbols-rounded ml-auto shrink-0 text-[20px] ink-glyph">chevron_right</span>
        </div>
      </GlassButton>
      </div>

      {coverage}
    </div>
  )
}
