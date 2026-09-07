# Privacy policy

**Last updated: 7 September 2026** · Applies to the Polucz Android app (version 1.0.0 and later) and to polu.cz.

Polucz has no servers, no accounts and no analytics. Your vocabulary, your review history and your API keys are stored on your phone and nowhere else. Nothing about you is collected, transmitted to us, or shared with anyone — there is no "us" to transmit it to.

The rest of this page explains that in detail, including the cases where data does leave your device.

## What Polucz stores, and where

Everything the app knows about you lives in the app's own storage on your device:

- the words you have added, with their translations, grammar tables and example sentences
- your review history and the schedule built from it
- your API keys, if you have added any
- your settings, such as theme and haptics
- any audio the app has cached for playback

None of this is copied off the device. There is no Polucz account to create, no sign-in, and no Polucz server holding a copy. Uninstalling the app removes all of it.

## What leaves your device, and when

Polucz talks to three outside services. Each is optional, each happens only because you configured a key for it, and each receives only what it needs to answer:

| Service | What it receives | When |
| --- | --- | --- |
| Your chosen AI provider — Google Gemini, Anthropic, or any OpenAI-compatible endpoint you point the app at | The word or sentence being looked up, plus your API key as authentication | Only when you ask the app to fill in a card or fetch examples, and only if you have saved an AI key |
| DeepL | The text you asked to translate, plus your DeepL key | Only when you use the Translate page, and only if you have saved a DeepL key |
| Tatoeba | A single word, as a search query | Only while fetching example sentences, which requires a saved AI key |

These requests go straight from your phone to the service. They do not pass through any server of ours.

Once a request reaches one of these services, that service's own privacy policy governs what it does with it. You chose the provider, you hold the account, and you can read its terms before adding a key:

- [Google Gemini / Google AI](https://ai.google.dev/gemini-api/terms)
- [Anthropic](https://www.anthropic.com/legal/privacy)
- [DeepL](https://www.deepl.com/privacy)
- [Tatoeba](https://tatoeba.org/en/terms_of_use)

If you point Polucz at an OpenAI-compatible endpoint, you are choosing that operator, and their terms apply instead.

## With no keys configured, nothing leaves at all

If you have not added a key, the app makes no network requests. Not a reduced set — none. Browsing your words, flashcards, quizzes, pronunciation, export and import all run entirely on the device.

## Pronunciation

Speech uses your device's own text-to-speech engine. It needs no key, makes no network request, and sends nothing anywhere. Whether a Polish voice is available depends on what your device has installed.

## Your API keys

Keys are stored in the app's storage on your device, in the same place as the rest of your data. They are never sent to us. They are sent only to the service they belong to, as that service's authentication, over an encrypted connection.

Two consequences worth stating plainly, because they are the normal trade of a bring-your-own-key app:

- Usage is billed to your own account with that provider, under their pricing.
- A key is exactly as safe as the device holding it. Anyone with access to your unlocked phone has access to the app.

After saving, the app shows a fixed-length mask rather than the key. The length is fixed deliberately: the real length would hint at which provider the key belongs to. You can replace or delete a key at any time from **App settings**.

## Your data is yours

You can export everything as a JSON file and import it back, from **App settings**. This is how you move your vocabulary to a new phone, and it is the only copy that exists beyond the app itself — you make it, you hold it, you decide where it goes.

There is no data of yours for us to delete, because we never receive any. Deleting the app deletes everything it stored.

## Permissions

The app requests two Android permissions and no others:

- **Internet** — used only for the optional requests listed above.
- **Vibrate** — used for haptic feedback, which you can turn off.

Polucz does not request access to your location, contacts, camera, microphone, photos, or device storage outside its own sandbox.

## Children

Polucz is not directed at children and collects no personal information from anyone, including children.

## This website

polu.cz is a static site. It sets no cookies, runs no analytics, and embeds no third-party trackers. Its fonts are bundled and served from the same domain rather than fetched from a font provider.

The site is hosted on Vercel, which — like any web host — records ordinary server request logs, including IP addresses and browser user-agent strings, for delivery and security. Those logs are Vercel's, handled under [Vercel's privacy policy](https://vercel.com/legal/privacy-policy). We do not analyse them or connect them to anything.

## Verifying any of this

Polucz is open source under GPL-3.0. If you would rather check these claims than take them on trust, the source is at [github.com/thomasjaglin/polucz](https://github.com/thomasjaglin/polucz), and every network call the app can make is visible in it.

## Changes to this policy

If this policy changes, the date at the top changes with it, and the previous versions remain in the repository's history.

## Contact

Questions about privacy, or anything else: **hello@polu.cz**
