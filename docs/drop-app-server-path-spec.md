# Stop the packaged app using the server — Spec

## Goal

On Android, the app must **only** talk to LLM/DeepL providers directly. Remove the
fallback that sends `/api/*` to a hardcoded Vercel URL.

The browser build is **unchanged** — it keeps calling `/api/*` on its own origin.
The `api/` folder is **not touched**.

## Why

`src/lib/apiBase.ts` bakes `https://polish-vocab-app-git-main-thomasjaglin-4584s-projects.vercel.app`
into the APK. Two problems:

1. That URL is generated from the branch name and project slug. Rename either and every
   installed copy breaks, with no way to fix it remotely.
2. It is behind Vercel SSO, so it returns a login page rather than JSON. The code path is
   already dead — it cannot succeed today.

Users now supply their own keys, and `CapacitorHttp` (enabled in `capacitor.config.ts`)
sends requests through Android's native stack, so the phone reaches providers directly
without needing any server.

## Scope

Three files. Roughly 30 lines. No behaviour change in the browser.

---

## Change 1 — delete `src/lib/apiBase.ts`

Delete the whole file. It exists only to produce the absolute URL.

Both callers switch to the plain relative path (see changes 2 and 3), which is what the
browser needs and what the file already returned in the browser.

## Change 2 — `src/lib/llmApi.ts`

**Remove the import:**

```ts
import { apiUrl } from './apiBase'
```

**Replace the tail of `llmFetch`.** Currently:

```ts
  // Native with a key goes direct; everything else keeps the server hop, which
  // is what the browser build needs (provider CORS blocks it from a web page).
  if (Capacitor.isNativePlatform() && configured) {
    try {
      return await direct(path, body)
    } catch (e) {
      const code = e instanceof LlmError ? e.code : 'upstream'
      console.error('Direct LLM call failed', path, code, (e as Error)?.message)
      return json({ error: code }, code === 'rate_limited' ? 429 : 502)
    }
  }

  return fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...llmHeaders() },
    body: JSON.stringify(body),
  })
```

Replace with:

```ts
  // Android always goes direct — there is no server fallback. Without a key
  // there is nothing to fall back to, so say so plainly instead of issuing a
  // request that cannot succeed.
  if (Capacitor.isNativePlatform()) {
    if (!configured) return json({ error: 'not_configured' }, 503)
    try {
      return await direct(path, body)
    } catch (e) {
      const code = e instanceof LlmError ? e.code : 'upstream'
      console.error('Direct LLM call failed', path, code, (e as Error)?.message)
      return json({ error: code }, code === 'rate_limited' ? 429 : 502)
    }
  }

  // Browser: same-origin call to api/*. Providers block direct browser calls,
  // so this path stays.
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...llmHeaders() },
    body: JSON.stringify(body),
  })
```

Note the two differences: the `&& configured` moves inside as an early return with a
`503 not_configured`, and `apiUrl(path)` becomes `path`.

## Change 3 — `src/lib/useTTS.ts`

**Remove the import:**

```ts
import { apiUrl } from './apiBase'
```

**Change the fetch** inside `fetchBlob`:

```ts
const res = await fetch(apiUrl('/api/tts'), {
```

to:

```ts
const res = await fetch('/api/tts', {
```

This is browser-only in practice — on Android `USE_NATIVE_TTS` is true, `prefetch` returns
early and `playSequence` resolves clips through `getCachedBlob`, so `fetchBlob` is never
reached. The relative path is correct for the browser.

---

## Do NOT change

- **`api/`** — all eight function files stay. The website still uses them. They are removed
  separately at launch.
- **`shared/llmTasks.js`** — still shared by both paths.
- **`llmHeaders()` / `deeplHeaders()`** in `src/lib/llmConfig.ts` — still used by the browser
  path so the site honours a user's key.
- **`CapacitorHttp`** in `capacitor.config.ts` — this is what makes the direct path work.
- **The provider adapters** in `src/lib/llmClient.ts`.
- **`api/_cors.js`** — leave it. It is harmless and belongs with the server's removal.

---

## Verification

Run in order. All must pass.

1. **No hardcoded deployment URL remains**

   ```
   grep -rn "vercel.app" src/
   ```

   Must return nothing.

2. **No dangling references**

   ```
   grep -rn "apiUrl\|apiBase" src/
   ```

   Must return nothing.

3. **Typecheck and build**

   ```
   npx tsc --noEmit -p tsconfig.app.json
   npm run build
   ```

   Both clean.

4. **Browser unchanged** — `npm run dev`, open the app, use Translate. The request must go
   to a relative `/api/translate` on localhost, exactly as before.

5. **Device, no keys configured** — build and install the APK with the Translation and API
   key fields empty. Translate should fail *immediately* with a `503 not_configured` in the
   console, not hang and not attempt any network call.

6. **Device, keys configured** — enter a DeepL key and an LLM key in App settings. Translate
   and "fetch examples" must both work, calling the provider directly.

Steps 5 and 6 need a phone connected over USB:

```
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

## Acceptance criteria

- `src/lib/apiBase.ts` no longer exists.
- No file under `src/` contains a `vercel.app` URL.
- The browser build still reaches `/api/*` on its own origin.
- On Android with keys set, translation and examples work against the providers.
- On Android without keys, the failure is immediate and identifiable rather than a timeout.

## Out of scope

- Deleting `api/` (planned for launch).
- Any UI change for the `not_configured` case — surfacing "set your keys" to the user is a
  separate onboarding task. This spec only makes the state distinguishable in code.
