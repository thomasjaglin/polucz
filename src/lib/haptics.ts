const isSupported = () => 'vibrate' in navigator
const isEnabled = () => localStorage.getItem('polucz_haptics') !== 'false'
const fire = (pattern: number | number[]) => {
  if (isSupported() && isEnabled()) navigator.vibrate(pattern)
}

export const haptics = {
  tap:         () => fire(15),
  scrollTick:  () => fire(6),   // tiny ratchet tick as the list scrolls
  select:      () => fire(12),  // nav / page change
  doubleTap:   () => fire([20, 30, 20]),
  swipeRight:  () => fire(30),
  swipeLeft:   () => fire(60),
  conquered:   () => fire([30, 50, 30]),
  repeat:      () => fire(80),
  correct:     () => fire([20, 30, 20]),
  wrong:       () => fire(70),
  sessionDone: () => fire([30, 40, 30, 40, 30]),
  ttsStart:    () => fire(20),
  destructive: () => fire([40, 30, 80]),
}
