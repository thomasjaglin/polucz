import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// package.json is the single source of the version: the Android build derives
// versionCode from it too (android/app/build.gradle), so the About screen and
// the store listing can never drift apart.
const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string }

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
})
