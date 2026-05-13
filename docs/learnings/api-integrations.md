# API Integrations

## Making Direct Browser-to-API Calls

Calling AI APIs directly from a browser works for personal tools, but the mechanics differ by provider:

- **Anthropic** requires `anthropic-dangerous-allow-browser: true` as an explicit header, and the API key goes in `x-api-key`. This is their opt-in gate for browser-side key exposure.
- **Google Gemini** (REST via `generativelanguage.googleapis.com`) supports CORS from browsers natively — no special header needed. The API key goes in the query string: `?key=API_KEY`. This makes Gemini easier to call from browser-only apps.

The two APIs also differ in request shape. Anthropic uses `system` + `messages[]` with `content` strings. Gemini uses `system_instruction.parts[]` + `contents[].parts[]` with `text` keys, and supports `generationConfig.response_mime_type: "application/json"` to force structured JSON output at the model level — cleaner than relying on prompt instructions alone. The response path also differs: Anthropic returns `content[0].text`; Gemini returns `candidates[0].content.parts[0].text`.

---

## The API Key Exposure Problem and the Opt-In localStorage Pattern

An API key embedded in a browser page is visible to anyone who opens DevTools. For a personal-use tool, this is an acceptable tradeoff — the key is yours. For a shared or public tool, you'd need a backend proxy. The responsible pattern for personal tools:
1. Accept the key at runtime via a form field (not hardcoded in source)
2. Let the user opt in to persistence with a "Remember key" checkbox (`localStorage`)
3. Never write it to the DOM in a way that makes it visible (use `type="password"`)

This gives users full control: they can use the key ephemerally (cleared on refresh) or persistently (restored from `localStorage` on page load), with the choice explicitly theirs.

---

## Structured JSON Output from AI Models

When you need a model to return machine-readable data, the most reliable approach is:
1. In the system prompt: say "Return ONLY valid JSON" with an exact example of the structure
2. In the parsing code: strip markdown code fences (` ```json ... ``` `) before `JSON.parse` — models occasionally wrap output in them despite instructions
3. Wrap the parse in try/catch and fall back gracefully if the output is malformed

The Gemini `response_mime_type: "application/json"` setting enforces structure at the API level — reducing but not eliminating the need for defensive parsing.

The fallback is as important as the call itself. A broken API response should degrade gracefully, not crash the app.

---

## Async Form Submit

JavaScript form submit handlers are synchronous by default. To make one async (for an API call), just add `async` to the function keyword: `addEventListener('submit', async function(e) { ... })`. The `e.preventDefault()` still works synchronously — the form won't submit. You can then `await` inside the handler like any other async function. Disabling the submit button during the await prevents double-submits.

---

## Keeping Async I/O Outside Synchronous Functions

`generateSchedule` is a pure synchronous function — it takes inputs, computes, returns. The async API call happens in the form submit handler (`async function`) before `generateSchedule` is called. The resolved `injuryProfile` is then passed in as `inputs.injuryProfile`. This pattern — resolve all I/O first, then call the synchronous core — keeps `generateSchedule` testable and composable without making its internals async.

---

## Graceful Degradation for Optional Features

`resolveInjuryProfile` wraps the API call in a try/catch and falls back to the original keyword matching on any error (network failure, bad API key, invalid JSON response, quota exceeded). The user always gets a plan — just with less intelligent severity assessment. This is the right pattern for optional enhancement features: the fallback must be genuinely useful, not just an error message.

---

## Switching AI Providers Mid-Project

The injury assessment API was switched from Anthropic to Gemini mid-project. Key differences that required code changes:

| Detail | Anthropic | Google Gemini |
|---|---|---|
| Browser CORS | Requires `anthropic-dangerous-allow-browser: true` header | Native CORS support — no special header |
| Auth | `x-api-key` header | `?key=API_KEY` query param |
| System prompt | `system` top-level field | `system_instruction: { parts: [{ text }] }` |
| Messages | `messages: [{ role, content }]` | `contents: [{ role, parts: [{ text }] }]` |
| JSON output | Prompt instruction only | `generationConfig.response_mime_type: "application/json"` enforces it at API level |
| Response path | `content[0].text` | `candidates[0].content.parts[0].text` |

When switching AI providers in a browser app, the main risk is auth shape and CORS. Test with a minimal fetch call first before wiring it into the full app.

---

## OAuth 2.0 in Browser-Only Apps

### Why Authorization Code flow, not implicit

OAuth 2.0 originally offered an Implicit Grant flow for browser apps — it skips the server-side token exchange and returns the access token directly in the URL fragment. Strava (and most providers) deprecated it because the token is visible in browser history, referrer headers, and server logs. The Authorization Code flow exchanges a short-lived `code` for tokens via a server POST, keeping the token out of the URL. In a browser-only app without a backend, this POST goes directly from the browser to the provider's token endpoint — which is technically a client secret exposure, but acceptable when the user provides their own credentials (not developer-owned shared secrets).

### Why credentials are in localStorage, not the source code

Hardcoding a client secret in JavaScript means everyone who opens the page (or DevTools, or the source file) can read it and use it against your API quota. For a personal tool where the user provides their own Strava app credentials, the right approach is:

1. Accept credentials at runtime via form inputs
2. Store them in `localStorage` after first entry — they persist across sessions without ever being in the source
3. Never log or display them after initial entry (use `type="password"` for the secret field)

This is a meaningful distinction from the Gemini/Anthropic API key pattern: those keys are personal and tied to a billing account. Strava client credentials are also personal — the user registers their own app at strava.com/settings/api and gets their own Client ID and Secret. The developer never sees them.

### Handling the OAuth redirect wiping form state

An OAuth redirect is a full page navigation — it discards all JavaScript state, DOM values, and in-memory variables. Anything the user had entered in the form is gone when the page reloads after the Strava callback. The fix is to save any state you need to survive the redirect before leaving:

- `sessionStorage` is the right store for this: it survives page reloads and redirects within the same tab, but is cleared when the tab closes. Use it for transient cross-redirect state.
- `localStorage` persists indefinitely — use it for credentials and tokens that should survive across sessions.

Here, `raceDistance` is saved to `sessionStorage` before redirect and restored (with a `change` event dispatch to trigger label updates) after the callback completes. Only what's needed to correctly execute the post-redirect logic needs to be saved.

### Long-lived tokens and silent refresh

Strava access tokens expire in 6 hours. Rather than forcing the user to reconnect, the app uses the refresh token to silently obtain a new access token:

- Before every API call, check if `expires_at - now < 300` (expires within 5 minutes)
- If so, POST to `/oauth/token` with `grant_type=refresh_token` — this returns a new access token and refresh token
- Update all three localStorage values (`access_token`, `refresh_token`, `expires_at`)

This pattern keeps the session alive indefinitely as long as the user visits at least once every 6 months (Strava's refresh token expiry). The check is cheap and can be run unconditionally before any request. If the refresh fails (revoked permissions, changed password, expired refresh token), handle it as a session expiry: clear all tokens and prompt reconnection.

### API rate limiting considerations

Strava's rate limits are 100 requests per 15 minutes and 1,000 per day. For a personal training planner, staying within limits is straightforward:

- Fetch once on connect; offer a manual "Refresh" button rather than polling
- Request only what's needed (`per_page=100` for 4 weeks of activities) — avoid paginating if you can scope the date window tightly enough
- `after=<unix timestamp>` reduces server load and speeds response time compared to fetching all-time history

If you were building a multi-user app, you'd need a server-side token store and rate limit tracking per user. In a personal browser tool, you have one user and one Strava app, so the limits are never a practical concern.

### Cleaning up the OAuth callback URL

After handling a `?code=` callback, clean the URL immediately with `history.replaceState(null, '', window.location.pathname)`. If you don't, the code stays in the URL, the user sees it, and if they bookmark or share the URL the code might be re-submitted (it's single-use and will error on second use). `replaceState` changes the visible URL without triggering a navigation, so it's instant and invisible to the user.
