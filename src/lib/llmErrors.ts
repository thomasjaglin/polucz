// One place to turn an llmFetch failure into something a person can act on.
//
// llmFetch answers with a code in the body — `not_configured` (503, no key
// saved), `rate_limited` (429), or `upstream` (502) — but every call site was
// throwing that away and showing the same "check your connection". On a fresh
// install the commonest failure by far is the missing key, and blaming the
// network sends the user to look at their wifi instead of at App settings.

export type LlmErrorCode = 'not_configured' | 'rate_limited' | 'upstream'

/** Reads the error code out of a non-ok llmFetch Response. */
export async function readLlmError(res: Response): Promise<LlmErrorCode> {
  try {
    const body = await res.clone().json()
    const code = body?.error
    if (code === 'not_configured' || code === 'rate_limited') return code
  } catch { /* no JSON body — fall through */ }
  // A 503 without a readable body still means the same thing.
  return res.status === 503 ? 'not_configured' : 'upstream'
}

/** Short, actionable copy. `not_configured` names the fix; the caller may also
 *  offer a route into App settings. */
export function llmErrorMessage(code: LlmErrorCode): string {
  switch (code) {
    case 'not_configured': return 'No API key set yet'
    case 'rate_limited':   return 'Your provider is rate-limiting — try again shortly'
    default:               return 'Couldn’t reach your provider — check your connection'
  }
}
