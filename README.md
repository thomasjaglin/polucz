# Polucz

A Polish vocabulary trainer for Android. Cards you write yourself, spaced
repetition, pronunciation, and a quiz that builds its own questions on the
device.

Polucz is bring-your-own-key: the language features call whichever LLM provider
you configure, with your key, from your phone. There is no Polucz account, no
Polucz server, and nothing to sign up for.

## What it does

- **Vocabulary** — add a Polish word and the app fills in its translation, part
  of speech and inflected forms. Browse, search, and filter by tag or type.
- **A starter deck** — 26 common words, fully declined and conjugated, offered
  on first run. Flashcards and the quiz work immediately, before any key is
  entered; the samples are marked, and App settings can remove them in one tap
  without touching words you added.
- **Flashcards** — spaced repetition with an SRS schedule, plus a hard mode for
  the cards you keep missing.
- **Quiz** — fill-in-the-blank questions over the forms of your own words. See
  [Where quiz questions come from](#where-quiz-questions-come-from).
- **Pronunciation** — the device's own speech engine reads Polish aloud. Needs
  no key and no network. If the device has no Polish voice installed, App
  settings says so and opens the screen where one can be added.
- **Import / export** — the whole collection as one JSON file, written to your
  Downloads folder.

Everything lives on the device. Vocabulary, review history and keys are stored
locally; the app ships the entire UI inside the APK and works offline apart from
the features that call a provider.

## Keys

| Feature | Needs | Notes |
|---|---|---|
| Pronunciation, flashcards, quiz, browsing | nothing | Works on a fresh install, on the starter deck |
| Adding and enriching words, sentence analysis | an LLM key | Google Gemini, Anthropic Claude, or any OpenAI-compatible endpoint |
| Translation | a DeepL key | Free tier is enough |

Keys are entered in **App settings** and kept in `localStorage`. They are sent
directly to the provider you chose, as request headers. This is the ordinary
shape for a bring-your-own-key app, and it is worth being explicit about what it
means: any script running on the app's origin could read them, and every call
spends your own provider quota.

## Where quiz questions come from

Questions are generated on the device, in three tiers, cheapest first:

1. **A bundled corpus.** `public/pol-corpus.txt` is a filtered snapshot of
   124,433 Polish sentences from [Tatoeba](https://tatoeba.org). Real sentences,
   no network, no key. Covers roughly half the inflected forms in a typical
   collection.
2. **Your LLM**, for the forms the corpus misses — only if you configured a key,
   only on request, and bounded per run so one tap cannot spend an unbounded
   amount of your quota.
3. **The paradigm itself**, which always has an answer. This is why the quiz
   works on a fresh install with nothing configured.

Corpus sentences are matched by spelling rather than by part of speech, so a
homograph can slip through — the question stays answerable and its answer stays
correct, but the sentence may not demonstrate the sense you expect.
`scripts/curate.mjs` runs a local LanguageTool over an exported collection to
find those; see the file header for setup.

## Attribution

Polish sentences in `public/pol-corpus.txt` come from **[Tatoeba](https://tatoeba.org)**
and are used under **[CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/)**.
Tatoeba must be credited wherever these sentences are shown; the app does so in
the quiz. See `public/pol-corpus.LICENCE.txt`.

## Building

Requires Node 18+, and Android Studio for the app itself.

```sh
npm install
npm run dev          # web build, on localhost
npm run build        # typecheck + production build into dist/
npm run cap:sync     # build, then copy into the Android project
npm run cap:open     # open android/ in Android Studio
```

The APK bundles `dist`, so it runs entirely offline and never depends on a URL
being reachable.

### A patched dependency

`patches/@capacitor+android+8.4.2.patch` adds a null check to Capacitor's own
`SystemBars.injectSafeAreaCSS`. Its inset callbacks can fire before the WebView
has a document, and it then threw `Cannot read properties of null` into the log
three times on most launches — noise that would hide a real error later. Gradle
compiles Capacitor's Android sources straight out of `node_modules`, so the
patch reaches the APK. `patch-package` reapplies it on `npm install`; if
Capacitor is upgraded the patch will fail loudly rather than silently stop
applying.

The app itself reads `env(safe-area-inset-*)`, not the custom properties that
injection sets, so nothing depended on it succeeding.

### Release builds

`bundleRelease` needs a signing key and fails loudly without one. Copy
`android/keystore.properties.example` to `android/keystore.properties` and fill
it in, or set `POLUCZ_KEYSTORE_FILE`, `POLUCZ_KEYSTORE_PASSWORD`,
`POLUCZ_KEY_ALIAS` and `POLUCZ_KEY_PASSWORD` in the environment for CI.
`keystore.properties` is gitignored; keep the keystore itself outside the repo.

The version code is derived from `package.json`'s `version`, so bump it there.

### Tests

```sh
npm test          # once
npm run test:watch
```

Vitest, covering the places where a silent bug costs data rather than pixels:
the SRS schedule in `src/lib/scheduler.ts`, the card store in
`src/lib/storage.ts`, backup parsing in `src/lib/backup.ts`, and the
schema-strictify step in `src/lib/llmClient.ts` that adapts one shared schema to
three providers.

### Other scripts

```sh
npm run build:corpus   # rebuild the Tatoeba snapshot from a fresh export
npm run curate         # check an exported collection against a local LanguageTool
npm run check:deck     # spell-check every form in the starter deck
```

`check:deck` runs `src/data/starterDeck.json` through the Hunspell Polish
dictionary. The deck ships as fact — a new user meets it before they can judge
whether the Polish is right — so its 581 forms are machine-checked rather than
trusted. The check catches malformed forms; it cannot catch a real word in the
wrong grammatical slot.

## About `api/`

`api/` is a set of Vercel functions used by the **web** build, where browsers
cannot call the providers directly. The Android app does not use them: it calls
each provider natively, so CORS never applies and no proxy of ours sits in the
middle. A fork building only the app can ignore the directory entirely.

## Licence

[GPL-3.0](LICENSE). You may read, fork and build this; if you distribute a
modified version — including an APK — it must ship its source under the same
terms. Bundled Tatoeba data keeps its own licence, above.
