import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.polucz.app',
  appName: 'Polucz',
  webDir: 'dist',

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
