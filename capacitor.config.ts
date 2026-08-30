import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.polucz.app',
  appName: 'Polucz',
  webDir: 'dist',

  plugins: {
    // Route fetch/XHR through the native HTTP stack instead of the WebView.
    // The app calls Gemini/Anthropic/OpenAI/DeepL directly with the user's own
    // keys, and those hosts don't allow browser origins — going native means
    // CORS never applies, so no proxy of ours has to sit in the middle.
    CapacitorHttp: { enabled: true },
  },

  // By default the APK bundles the local `dist` build → works fully offline and
  // never depends on a URL being reachable. To instead auto-update from the
  // deployed site (like the old wrapper did), uncomment `server` below and set
  // it to your production URL, then rebuild the APK once:
  //
  // server: {
  //   url: 'https://polish-vocab-app-git-main-thomasjaglin-4584s-projects.vercel.app',
  //   cleartext: false,
  // },
}

export default config
