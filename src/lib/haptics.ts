import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

// Haptic feedback via Capacitor: real device haptics in the native (APK) shell,
// and the plugin's built-in web fallback (navigator.vibrate) in the browser —
// so the same calls work in Chrome and in the packaged Android app. All calls
// are best-effort and no-op on unsupported devices.

const isEnabled = () => localStorage.getItem('polucz_haptics') !== 'false'

const impact = (style: ImpactStyle) => { if (isEnabled()) Haptics.impact({ style }).catch(() => {}) }
const notify = (type: NotificationType) => { if (isEnabled()) Haptics.notification({ type }).catch(() => {}) }

export const haptics = {
  tap:         () => impact(ImpactStyle.Light),
  scrollTick:  () => impact(ImpactStyle.Light),   // crisp ratchet tick while scrolling
  select:      () => impact(ImpactStyle.Light),   // nav / page change
  doubleTap:   () => impact(ImpactStyle.Medium),
  swipeRight:  () => impact(ImpactStyle.Medium),
  swipeLeft:   () => impact(ImpactStyle.Heavy),
  conquered:   () => notify(NotificationType.Success),
  repeat:      () => impact(ImpactStyle.Heavy),
  correct:     () => notify(NotificationType.Success),
  wrong:       () => notify(NotificationType.Error),
  sessionDone: () => notify(NotificationType.Success),
  ttsStart:    () => impact(ImpactStyle.Light),
  destructive: () => notify(NotificationType.Warning),
}
