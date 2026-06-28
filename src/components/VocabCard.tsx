import { forwardRef } from 'react'
import { tagGradients } from '../data/gradients'
import type { VocabEntry } from '../data/types'

interface Props {
  entry: VocabEntry
  onClick: () => void
}

const VocabCard = forwardRef<HTMLDivElement, Props>(function VocabCard({ entry, onClick }, ref) {
  return (
    <div className="perspective w-full cursor-pointer" onClick={onClick}>
      <div
        ref={ref}
        className="card-inner relative flex w-full flex-col rounded-[36px] bg-gradient-to-br from-white/30 via-white/5 to-transparent p-[1px] shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
      >
        <div className="relative flex w-full flex-col rounded-[35px] border border-white/5 bg-[#1a1a1a]/40 p-[20px] kube-glass-bg">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="font-instrument text-[24px] font-semibold leading-tight tracking-wide text-[#F8FAFC]">
                {entry.pl}
              </span>
              <span className="font-instrument text-[18px] font-medium leading-snug text-[#B4A0FF]">
                {entry.en}
              </span>
            </div>
            <div className="relative mt-1 flex items-center justify-center overflow-hidden rounded-[124px] border border-[#F8FAFC]/20 bg-[#F8FAFC]/10 px-[12px] py-[4px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] kube-glass-bg">
              <div
                className="absolute inset-0 z-0 flex items-center justify-center opacity-70 mix-blend-screen"
                dangerouslySetInnerHTML={{ __html: tagGradients[entry.type] }}
              />
              <span className="relative z-10 font-instrument text-[10px] font-normal capitalize text-[#F8FAFC]">
                {entry.type}
              </span>
            </div>
          </div>

          <div className="my-[16px] h-[1px] w-full bg-[#F8FAFC]/10" />

          <div className="flex items-center justify-between px-1">
            <span className="font-instrument text-[14px] italic text-[#F8FAFC]/50">{entry.left}</span>
            <span className="font-instrument text-[14px] text-[#F8FAFC]/50">{entry.right}</span>
          </div>
        </div>
      </div>
    </div>
  )
})

export default VocabCard
