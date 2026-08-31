// The motion for answering a quiz question.
//
// Answering was previously a colour swap followed by 1.2s (right) or 2s (wrong)
// of stillness before the next question. That pause is the moment the answer
// actually lands, and it was carrying no signal at all. This fills it, without
// adding a millisecond: the timings below finish well inside the existing wait.
//
// Deliberately restrained. Right is a settle, not a celebration — you will see
// it hundreds of times in a session, and anything bouncier becomes irritating by
// the tenth. Wrong is a short shake, which is the one gesture everybody already
// reads as "no" without a label.
//
// Only transform is animated, so both stay on the compositor. Reduced motion is
// handled globally by <MotionConfig reducedMotion="user"> in App: it drops these
// transforms and leaves the colour change, which still carries the answer.

import type { MotionProps } from 'framer-motion'

/**
 * @param option      the option this element renders
 * @param chosen      what the user picked, or null before they answer
 * @param isCorrect   whether `option` is the right answer
 */
export function answerMotion(
  option: string,
  chosen: string | null,
  isCorrect: boolean,
): MotionProps {
  if (chosen === null) return {}

  // The right answer settles, whether or not it was the one picked — when the
  // user got it wrong this is what draws the eye to the correct form.
  if (isCorrect) {
    return {
      animate: { scale: [1, 1.045, 1] },
      transition: { duration: 0.42, times: [0, 0.35, 1], ease: [0.33, 1, 0.68, 1] },
    }
  }

  // Their wrong pick shakes. Two oscillations, decaying, 4px at the widest —
  // enough to read as a refusal, small enough not to look like an error dialog.
  if (option === chosen) {
    return {
      animate: { x: [0, -4, 4, -2.5, 0] },
      transition: { duration: 0.28, ease: 'easeOut' },
    }
  }

  // Everything else recedes rather than just greying out, which keeps the two
  // answers that matter as the only things holding weight.
  return {
    animate: { scale: 0.985, opacity: 0.75 },
    transition: { duration: 0.2, ease: 'easeOut' },
  }
}
