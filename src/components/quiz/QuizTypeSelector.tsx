import GlassButton from '../GlassButton'

interface Props {
  sentenceCount: number
  onStart: (type: 'declension' | 'conjugation') => void
}

export default function QuizTypeSelector({ sentenceCount, onStart }: Props) {
  const hasEnough = sentenceCount >= 4

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h2 className="font-instrument text-[22px] font-semibold text-[#F8FAFC]/90">Quiz Game</h2>
        <p className="mt-1 font-instrument text-[14px] text-[#F8FAFC]/40">
          {sentenceCount === 0
            ? 'No sentences loaded — use "Sync sentences" in settings first.'
            : `${sentenceCount} sentences available`}
        </p>
      </div>

      <GlassButton
        onClick={() => onStart('declension')}
        disabled={!hasEnough}
        radius={24}
        pane="bg-[#F8FAFC]/[0.02]"
        contentClassName="block w-full text-left"
        className="w-full border border-[#F8FAFC]/10 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] disabled:opacity-35"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#C8AB2A]/15">
            <span className="material-symbols-rounded text-[24px] text-[#FFDEB3]">table_chart</span>
          </div>
          <div className="min-w-0">
            <div className="font-instrument text-[17px] font-semibold text-[#F8FAFC]/90">Declension Quiz</div>
            <div className="font-instrument text-[13px] text-[#F8FAFC]/45">Multiple choice · nouns &amp; adjectives</div>
          </div>
          <span className="material-symbols-rounded ml-auto shrink-0 text-[20px] text-[#F8FAFC]/25">chevron_right</span>
        </div>
      </GlassButton>

      <GlassButton
        onClick={() => onStart('conjugation')}
        disabled={!hasEnough}
        radius={24}
        pane="bg-[#F8FAFC]/[0.02]"
        contentClassName="block w-full text-left"
        className="w-full border border-[#F8FAFC]/10 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] disabled:opacity-35"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#2ABFC8]/15">
            <span className="material-symbols-rounded text-[24px] text-[#7DF5EE]">edit</span>
          </div>
          <div className="min-w-0">
            <div className="font-instrument text-[17px] font-semibold text-[#F8FAFC]/90">Conjugation Quiz</div>
            <div className="font-instrument text-[13px] text-[#F8FAFC]/45">Fill in the blank · verbs</div>
          </div>
          <span className="material-symbols-rounded ml-auto shrink-0 text-[20px] text-[#F8FAFC]/25">chevron_right</span>
        </div>
      </GlassButton>
    </div>
  )
}
