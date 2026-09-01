// Where a tour step points.
//
// Screens register the elements a tour can highlight; the tour looks them up by
// name. A plain module-level map rather than context, because the registry is
// read imperatively (on a timer, as layout settles) and nothing should re-render
// when an anchor mounts.

export type AnchorName =
  | 'translate-input' | 'translate-button' | 'translate-result'
  | 'vocab-filter' | 'vocab-cards'
  | 'card-declensions' | 'card-comparative' | 'examples-button' | 'modal-close'
  | 'nav-flashcards'
  | 'fc-play-all' | 'fc-card' | 'fc-hard-mode'
  | 'quiz-count' | 'quiz-modes' | 'quiz-coverage'
  | 'audio-play' | 'audio-speed' | 'audio-repeat'

const anchors = new Map<AnchorName, HTMLElement>()

/** Ref callback: `ref={setAnchor('translate-button')}`. */
export function setAnchor(name: AnchorName) {
  return (el: HTMLElement | null) => {
    if (el) anchors.set(name, el)
    else anchors.delete(name)
  }
}

export function getAnchor(name: AnchorName): HTMLElement | undefined {
  const el = anchors.get(name)
  // A registered element can still be detached — a page swap leaves the ref
  // cleanup to React, which may not have run yet.
  return el && el.isConnected ? el : undefined
}
