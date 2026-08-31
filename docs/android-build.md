# Building the Android app (Capacitor)

The app is wrapped with [Capacitor](https://capacitorjs.com) so it runs as a real
Android app with native capabilities (starting with **haptics**). Everything is
your existing web build — Capacitor just wraps it in a native shell.

## One-time setup on your machine
1. Install **Android Studio** (includes the Android SDK + a JDK):
   https://developer.android.com/studio
2. Open Android Studio once and let it finish downloading the SDK.
3. From the repo root: `npm install` (installs Capacitor + the Haptics plugin).

## Build / run the app
```bash
# 1. Build the web app and copy it into the native project
npm run cap:sync

# 2. Open the native project in Android Studio
npm run cap:open
```
In Android Studio: pick a device/emulator and press **Run** (▶) to install it, or
**Build → Build Bundle(s)/APK(s) → Build APK(s)** to produce an installable `.apk`.

## After changing the web app
Re-run `npm run cap:sync` (it rebuilds `dist` and copies it into the native
project), then re-run in Android Studio.

## Live-updating instead of bundling (optional)
By default the APK **bundles** the web build (works fully offline, but you rebuild
the APK to ship changes). To make it load the deployed site instead — so it
auto-updates like the old wrapper — uncomment the `server` block in
`capacitor.config.ts`, set it to your production URL, run `npm run cap:sync`, and
rebuild once. From then on web deploys reach the app without rebuilding.

## Notes
- Native haptics come from `@capacitor/haptics`; `src/lib/haptics.ts` calls it and
  it maps to real device haptics in the app (and to `navigator.vibrate` in a
  browser, so Chrome keeps working too). The `VIBRATE` permission is declared in
  `android/app/src/main/AndroidManifest.xml`.
- The `android/` folder is committed (native project source); build artifacts
  (`build/`, `.gradle/`, `*.apk`) are gitignored.
- App id: `com.polucz.app` — change it in `capacitor.config.ts` **and** the native
  project before publishing to the Play Store if desired.

## Versioning

`package.json` `version` is the single source of truth. `android/app/build.gradle`
reads it and derives both Android fields:

```
versionName = the semver string          1.0.0  →  "1.0.0"
versionCode = major*10000 + minor*100 + patch   →  10000
```

Bump with `npm version patch | minor | major` — never edit the Gradle file. Play
only requires `versionCode` to increase, and deriving it from semver makes that
automatic.

Deliberately **not** the git commit count: this repo's history has been rewritten
once already, which would have sent the count backwards and locked out every
future upload.

Minor and patch are capped at 99 by the scheme. The build fails with an
explanatory error rather than silently producing a wrong code if you exceed it.

## Curating quiz sentences (optional)

The app generates its own quiz questions. This desktop pass is the one thing a
phone cannot do: run them through the full LanguageTool rule engine and surface
only what looks wrong.

```
brew install languagetool
brew services start languagetool     # port 8081, restarts at login
```

Then, with a backup exported from the app (it lands in ~/Downloads):

```
npm run curate                       # newest backup, generated sentences only
npm run curate -- --all              # also check corpus sentences
```

It writes `polucz-flagged-<date>.json`. Open `tools/review.html`, load that file,
and keep or drop each flagged sentence — arrow keys work. Saving produces a
complete backup to import back into the app.

**Why only generated sentences by default:** corpus sentences were written by
humans and are grammatical by construction. `--all` is still worth running
occasionally, because a corpus sentence can match a form by spelling rather than
by part of speech (see the homograph note in
docs/tiered-quiz-generation-plan.md §7), and LanguageTool is the only thing in
this pipeline that could notice.

**The output is a complete backup, never a diff.** The app's import replaces
cards, reviews and sentences with whatever it is given, so a sentences-only file
would wipe the vocabulary on the way back in.
