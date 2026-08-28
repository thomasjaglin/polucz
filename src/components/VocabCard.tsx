import { forwardRef } from 'react'
import { tagGradients, masteredBase, tagImages } from '../data/gradients'
import { type VocabEntry, typeLabel } from '../data/types'
import GlassPane from './GlassPane'
import { haptics } from '../lib/haptics'

interface Props {
  entry: VocabEntry
  mastered?: boolean
  onClick: () => void
}

function cardMeta(entry: VocabEntry): string | null {
  if (entry.type === 'noun') return entry.gender || null
  if (entry.type === 'verb') return entry.left || null
  return null
}

const VocabCard = forwardRef<HTMLDivElement, Props>(function VocabCard({ entry, mastered = false, onClick }, ref) {
  const meta = cardMeta(entry)
  return (
    <div className="perspective w-full cursor-pointer" onClick={() => { haptics.tap(); onClick() }}>
      <div
        ref={ref}
        className={`card-inner relative flex w-full flex-col rounded-[36px] transition-transform hover:scale-[1.02] active:scale-[0.98] ${
          mastered
            ? 'shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_0_30px_rgba(255,200,100,0.15),inset_0_0_0_1px_rgba(255,220,150,0.3)]'
            : 'glass-raise'
        }`}
      >
        <GlassPane forceCss borderRadius={36} className={`relative flex w-full flex-col rounded-[36px] bg-ink/[0.02] p-5 ${mastered ? 'card-mastered' : ''}`}>
          {/* Per-type colour base (same as the modal) so the cosmos holo has a
              colourful "illustration" to sit on — mastered cards only. */}
          {mastered && (
            <div
              className="absolute inset-0 z-0 rounded-[36px]"
              aria-hidden="true"
              style={{ background: masteredBase[entry.type] ?? masteredBase.unknown }}
            />
          )}
          {mastered && <div className="cosmos-shine" aria-hidden="true" />}
          {mastered && <div className="holo-edge" aria-hidden="true" />}
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 items-center gap-2">
                <span lang="pl" className={`hyphens-auto break-words font-instrument text-[24px] font-semibold leading-tight tracking-wide text-ink ${mastered ? 'holo-text' : ''}`}>
                  {entry.pl}
                </span>
                {mastered && (
                  <span className="holo-icon shrink-0 text-[14px] leading-none">★</span>
                )}
                {entry.enriched && (
                  <span
                    aria-label={entry.audioReady ? 'Fully prepared (details + audio)' : 'Details populated'}
                    className="holo-icon material-symbols-rounded shrink-0 text-[16px] leading-none"
                  >
                    {entry.audioReady ? 'done_all' : 'done'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`font-instrument text-[18px] font-medium leading-snug text-[#B4A0FF]/80 ${mastered ? 'holo-outline' : ''}`}>
                  {entry.en}
                </span>
                {meta && (
                  <>
                    <span className={mastered ? 'text-white' : 'text-ink/20'}>·</span>
                    <span className={`font-instrument text-[13px] italic ${mastered ? 'text-white' : 'text-ink/40'}`}>{meta}</span>
                  </>
                )}
              </div>
            </div>
            {mastered ? (
              <div
                className="tag-holo relative mt-1 flex flex-shrink-0 items-center justify-center overflow-hidden rounded-[124px] border border-ink/20 bg-cover bg-center px-3 py-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]"
                style={{ backgroundImage: `url(${tagImages[entry.type] ?? tagImages.unknown})` }}
              >
                <span className="relative z-10 font-instrument text-[10px] font-normal capitalize text-white">
                  {typeLabel(entry.type)}
                </span>
              </div>
            ) : (
              <GlassPane forceCss borderRadius={62} className="relative mt-1 flex flex-shrink-0 items-center justify-center rounded-[124px] border border-ink/20 bg-ink/10 px-3 py-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
                <div
                  className="absolute inset-0 z-0 flex items-center justify-center opacity-70 mix-blend-screen"
                  dangerouslySetInnerHTML={{ __html: tagGradients[entry.type] }}
                />
                <span className="relative z-10 font-instrument text-[10px] font-normal capitalize text-ink">
                  {typeLabel(entry.type)}
                </span>
              </GlassPane>
            )}
          </div>
        </GlassPane>
      </div>
    </div>
  )
})

export default VocabCard
