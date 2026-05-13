# Learnings — Key Concepts from Stage 1

---

## HTML Form Input Types

HTML has several built-in input types, and using the right one matters:

- `type="date"` — renders a native date picker in the browser. No JavaScript needed. The value you get back is always in `YYYY-MM-DD` format regardless of how the browser displays it.
- `type="number"` — only allows numeric input. You can set `min`, `max`, and `step` to constrain what's valid (e.g. `step="0.5"` allows half-miles). The browser won't submit the form if the value is outside the range.
- `type="text"` — a plain text box, used here for the custom race distance where any format is acceptable ("50K", "100 miles", etc.).
- `type="radio"` — a group of options where only one can be selected at a time. All radios with the same `name` attribute are treated as a group.
- `textarea` — for longer free-form text. Unlike `input`, it has a closing tag and supports multi-line entry. `resize: vertical` in CSS lets the user make it taller but not wider.

---

## The Metric/Imperial Toggle

This is a good example of **one piece of state controlling many things at once**.

The toggle is a checkbox (`<input type="checkbox">`) styled to look like a pill switch. When it's checked = metric; unchecked = imperial.

A single function, `applyUnits()`, reads the checkbox state and updates everything that depends on it:
- Changes the text of the mileage hint ("Miles per week" → "km per week")
- Changes the weight label ("Weight (lbs)" → "Weight (kg)")
- Shows or hides the appropriate height inputs (ft + in vs. a single cm field)
- Adjusts the `max` attribute on the mileage input (150 miles ≈ 240 km)

The function runs once on page load to set the initial state, then again every time the toggle changes. This pattern — one function that applies all derived state — is much easier to maintain than scattering individual updates across multiple event listeners.

**Why hide/show instead of converting values?**
Simpler and less error-prone. The user enters values in their preferred unit from the start. The schedule generation logic will just need to know which unit system is active when it reads the form — no conversion needed until then.

---

## Conditional Required Fields

The custom distance input is hidden by default. When the user selects "Custom" from the dropdown, two things happen:

1. The input becomes visible (`display: block`)
2. Its `required` attribute is set to `true`

When the user switches away from Custom, `required` is set back to `false`. This matters because the browser won't submit a form if a visible required field is empty — but it also won't complain about hidden fields, even if they're technically `required`. Toggling `required` dynamically keeps validation honest.

---

## CSS Grid for Layout

The form uses `display: grid` for its two-column and three-column layouts:

```css
.two-col   { display: grid; grid-template-columns: 1fr 1fr;     gap: 20px; }
.fitness-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
```

`1fr` means "one fraction of the available space" — so `1fr 1fr` splits the row evenly in two. This is more predictable than `float` or `flexbox` for form layouts because it keeps columns aligned across rows automatically.

The `@media` query at the bottom collapses both grids to a single column on small screens — so the form is usable on mobile without any extra work.

---

---

## 2026-05-12 — Schedule Generation

### Phases and progressive overload

The training plan uses a classic four-phase structure: **Base → Build → Peak → Taper**. Each phase has a different goal:

- **Base**: build an aerobic foundation at comfortable effort. Mileage rises slowly. No intensity work for beginners.
- **Build**: add quality workouts (tempo runs, intervals). Mileage continues climbing.
- **Peak**: highest mileage and most race-specific work. Short — 1–2 weeks.
- **Taper**: reduce volume so the body can recover and arrive at race day fresh.

The code calculates how many weeks each phase gets as a percentage of total weeks (`35% / 35% / 20% / 10%`), then adjusts for the edge case where the timeline is very short.

**Cutback weeks** appear every 4th week in Base and Build. They reduce that week's mileage to 80% of the target. This is standard training practice — the body needs periodic recovery to absorb the stress of the preceding weeks.

### Linear interpolation for mileage ramps

Within each phase, mileage increases linearly from the start value to the end value. The code computes a `progress` ratio (`0.0` = first week of phase, `1.0` = last week) and uses it to interpolate:

```js
target = startMileage + (endMileage - startMileage) * progress;
```

This is called **linear interpolation** — a very common pattern for smoothly transitioning between two values over time. You'll see it everywhere in animation, audio, and simulation code.

### Keyword parsing for injuries

The injury input is free text, so the code can't know exactly what the user means. Instead, it scans the text for known keywords (`knee`, `shin`, `it band`, etc.) and maps each one to a set of workout types to avoid and a note to attach to affected days.

Severity is assessed by counting how many keywords matched and looking for modifier words like "severe" or "chronic". This is a simple rule-based approach — not AI, not NLP — but it works well for a constrained domain where the vocabulary is predictable.

### Why dates are stored as ISO strings

JavaScript's `Date` object is notoriously tricky. One common bug: `new Date('2026-05-12')` creates a date in **UTC midnight**, which can display as May 11th in timezones west of UTC. To avoid this, all dates are parsed using a local-time constructor: `new Date(year, month - 1, day)`. They're then stored as `YYYY-MM-DD` strings using a manual formatter — not `toISOString()`, which would re-introduce the UTC issue.

### The `isHistorical` flag

Each row in the schedule has an `isHistorical` boolean. If the user entered a training start date before today, the app reconstructs what the plan would have looked like for those past weeks — using the original plan with no injury modifications. Marking them `isHistorical: true` lets the preview table and Excel exporter gray them out visually, making it clear they're already done.

### Strength slot overflow

The weekly schedule has 7 slots (Mon–Sun). If `runDays + strengthDays > 7`, there aren't enough rest days to fit everything separately. Rather than throwing an error, the code does a two-pass fill: first it places strength days on rest days, then if there are still strength days left it layers them onto run days, creating "Run + Strength" combo sessions. This degrades gracefully instead of crashing.

---

## 2026-05-12 (continued) — Mileage Fix, Pace Targets, Session Guidance

### The unit mismatch bug

The mileage tables (`PEAK_MILEAGE`, `PEAK_LONG_RUN`) were written in miles, but the user's `weeklyMileage` form input was passed in as-is — kilometers when the metric toggle was on. The easy-run formula subtracted a miles value from a km value and then multiplied the result by 1.609 to convert to km, compounding the error. The symptom: a 20km/week runner saw a ~10.5km easy run on day one.

The fix: convert `weeklyMileage` to miles at the very top of `generateSchedule` using the selected unit flag, then work exclusively in miles throughout. The display function (`toDisplay`) already handled the conversion back to km for output.

This is a classic example of why it's important to pick one internal unit and convert at the boundary (input + output), rather than letting values flow through in mixed units.

### Evidence-based mileage tables

The original peak mileage values were invented; they were too high and caused plans to ramp too fast. The revised tables are anchored to published plans: Hal Higdon Novice/Intermediate/Advanced and Nike Run Club. Key changes: peak long run for a 10K beginner dropped from 10 miles to 6, and peak weekly mileage from 25 to 21. These still scale up through intermediate and advanced, but start conservatively.

### Pace as seconds-per-mile internally

The optional "current time" field (e.g. "25:00 for 5K") is parsed into seconds, divided by the distance in miles, and stored internally as **seconds per mile**. All pace offsets (easy = race pace + N seconds, tempo = race pace + M seconds) are added in the same unit. The `formatPace` function converts to min/km or min/mi at display time.

Working in a single numeric unit (seconds/mile) avoids the same class of bug as the mileage mismatch — you never subtract km values from mile values by accident.

### Graceful degradation without pace input

`getSessionGuidance` checks `racePaceSec != null` before producing pace ranges. When null (no reference time entered), it falls back to HR zone language and effort descriptions ("Zone 2 — fully conversational, 65–75% max HR"). The guidance is still useful; it's just expressed in relative terms rather than absolute pace. This pattern — provide specifics when you have them, fall back to qualitative guidance when you don't — is common in health and fitness apps.

### Fitness level affecting workout prescriptions

The same workout type (e.g. "Strength") produces different guidance depending on `fitnessStrength` level. A beginner gets bodyweight foundational work with high reps; an advanced athlete gets heavy compound lifts and plyometrics. This is implemented as a nested lookup table keyed by phase name then fitness level — simple, readable, and easy to update without touching any control flow.

---

## 2026-05-12 (continued) — Progressive Injury Rehabilitation

### State that changes over time within a single output

The injury notes feature was originally stateless — every row got the same note regardless of where it fell in the plan. The rehab model required making the note generation **time-aware**: the output for a given row now depends on which week of the forward plan it belongs to, not just what the injury is.

The key design decision was adding a `weekNum` parameter to `getInjuryNote` rather than pre-computing all notes at the start. This keeps the function pure and testable — given the same inputs, it always returns the same output — while allowing the generator loop to control what it passes in.

### Using a phase function as a router

`getRehabPhase(weekNum, severity)` is a simple lookup — it takes two inputs and returns one of four string labels. That label is then used as a switch key in `getInjuryNote`. This pattern (compute a state label, then dispatch on it) is easier to reason about than embedding the boundary logic inside the function that uses it. If the phase boundaries ever change, you only touch one place.

### Passing a modified context rather than adding flags

`getWorkoutTypes` uses the injury profile to decide whether to substitute Cross-Training for long runs. In the loading and full rehab phases, that substitution should stop — but `getWorkoutTypes` has no concept of rehab phases. Rather than adding a parameter to it, the generator loop passes a clean `{ severity: 'none' }` profile as `effForTypes` while keeping the real profile for the note generation. This avoids adding logic to a function that doesn't need it, and preserves the separation between "what workout to assign" and "what note to attach."

### Lookup tables for domain-specific content

`REHAB_EXERCISES` is a plain JavaScript object — just string values keyed by injury keyword. The same keywords that `parseInjuries` extracts are used here as keys, so no extra parsing step is needed. When a user has multiple injuries (e.g. knee + IT band), the rehab note shows exercises for both, joined with a separator. This pattern — parse once, reuse the parsed result across multiple lookups — avoids duplicating the parsing logic.

### Graceful re-entry as a design principle

The progressive model naturally supports users who return to the platform mid-recovery. Because the schedule always starts from today and uses `weeksSinceInjury` counted from the first forward week, a user who re-submits with an updated injury description gets a correctly-phased plan from that moment onward, with completed weeks shown as historical. This wasn't explicitly built as a feature — it's a consequence of the "start from today" design decision made at the beginning.

---

## 2026-05-12 (continued) — Goal Pace, Ambition Flags, Pace Zone Research

### Two paces, two purposes

The app now tracks two distinct paces internally (both in sec/mile):
- `racePaceSec` — derived from the user's **current** race time. Used for recovery runs and long runs, which should reflect where you actually are, not where you want to be.
- `goalPaceSec` — derived from the user's **goal** race time. Used for tempo, intervals, and easy runs, which are calibrated to the effort level needed to achieve the goal.

Keeping them separate avoids a subtle conceptual error: if you always train at current pace, you never push toward the goal. If you always train at goal pace, your recovery runs become too hard. The right pattern is to use goal pace for quality sessions and current pace for aerobic base work.

### Jack Daniels' VDOT pace zones

Daniels' system derives training zones from a single race result (VDOT = VO2max proxy). Each zone has a specific physiological purpose and a characteristic offset from race pace:

| Zone | Physiological role | Typical offset from 10K race pace |
|---|---|---|
| Easy (E) | Aerobic base, recovery | +70–90 sec/km slower |
| Threshold/Tempo (T) | Raise lactate threshold | +8–15 sec/km slower |
| Interval (I) | Improve VO2max | −5–10 sec/km faster (≈ 5K effort) |
| Repetition (R) | Running economy, speed | −15–25 sec/km faster |

The key insight: Easy runs must be genuinely slow (most runners run them too fast). Intervals must be genuinely hard. Moderate "junk miles" at in-between intensity are the least productive use of training time.

### 80/20 Running (Fitzgerald/Seiler)

The polarized model says ~80% of weekly volume should be at low intensity (Zone 1–2, fully conversational) and ~20% at high intensity (threshold or above). Research on elite and recreational runners alike shows this distribution produces better adaptations than the moderate-heavy approach most recreational runners default to. The practical implication: if a runner feels like their easy days are "too easy," that's correct — the easy days exist to absorb the stress of the hard days, not to add more stimulus.

### Warning banners for unrealistic goals

When a goal time implies an improvement percentage that exceeds standard training adaptation rates, the app shows a styled warning banner before the schedule. The thresholds:
- **>15% improvement**: flagged as unrealistic regardless of timeline
- **>8% improvement**: flagged as very ambitious
- **<8 weeks remaining with >5% gap**: timeline too short

The suggested realistic alternative is always current time × 0.92 (8% improvement — the high end of what a focused training cycle typically delivers).

### Improving the plan by bumping session variety

If a user's goal requires >5% improvement, `qualityFitnessCardio` is set one level above their stated fitness level for the purpose of assigning workout types. This means a beginner with an ambitious goal will see interval sessions in the Build phase, which they otherwise wouldn't. The bump is narrow in scope — it doesn't affect mileage, long run distances, or any display labels, only which quality session types appear.

---

## 2026-05-13 — Building an AI-Powered Browser App with the Anthropic API

### Making direct browser-to-API calls

Calling AI APIs directly from a browser works for personal tools, but the mechanics differ by provider:

- **Anthropic** requires `anthropic-dangerous-allow-browser: true` as an explicit header, and the API key goes in `x-api-key`. This is their opt-in gate for browser-side key exposure.
- **Google Gemini** (REST via `generativelanguage.googleapis.com`) supports CORS from browsers natively — no special header needed. The API key goes in the query string: `?key=API_KEY`. This makes Gemini easier to call from browser-only apps.

The two APIs also differ in request shape. Anthropic uses `system` + `messages[]` with `content` strings. Gemini uses `system_instruction.parts[]` + `contents[].parts[]` with `text` keys, and supports `generationConfig.response_mime_type: "application/json"` to force structured JSON output at the model level — cleaner than relying on prompt instructions alone. The response path also differs: Anthropic returns `content[0].text`; Gemini returns `candidates[0].content.parts[0].text`.

### The API key exposure problem and the opt-in localStorage pattern

An API key embedded in a browser page is visible to anyone who opens DevTools. For a personal-use tool, this is an acceptable tradeoff — the key is yours. For a shared or public tool, you'd need a backend proxy. The responsible pattern for personal tools:
1. Accept the key at runtime via a form field (not hardcoded in source)
2. Let the user opt in to persistence with a "Remember key" checkbox (`localStorage`)
3. Never write it to the DOM in a way that makes it visible (use `type="password"`)

This gives users full control: they can use the key ephemerally (cleared on refresh) or persistently (restored from `localStorage` on page load), with the choice explicitly theirs.

### Structured JSON output from Claude

When you need Claude to return machine-readable data, the most reliable approach is:
1. In the system prompt: say "Return ONLY valid JSON" with an exact example of the structure
2. In the parsing code: strip markdown code fences (```json ... ```) before `JSON.parse` — models occasionally wrap output in them despite instructions
3. Wrap the parse in try/catch and fall back gracefully if the output is malformed

The fallback is as important as the call itself. A broken API response should degrade gracefully, not crash the app.

### Async form submit

JavaScript form submit handlers are synchronous by default. To make one async (for an API call), just add `async` to the function keyword: `addEventListener('submit', async function(e) { ... })`. The `e.preventDefault()` still works synchronously — the form won't submit. You can then `await` inside the handler like any other async function. Disabling the submit button during the await prevents double-submits.

---

## 2026-05-13 — AI Injury Assessment via Anthropic API

### Why keyword matching fails for severity

Keyword matching treats every mention of "knee" the same regardless of context. "Slight knee soreness after a hard race" and "dislocated knee" both match the `knee` keyword and historically both produced `moderate` severity. The fundamental problem: severity isn't about which body part is mentioned — it's about the nature and acuity of the problem. Only a language model can make that distinction reliably from free text.

### Direct browser → Anthropic API calls

The app has no backend, so API calls happen client-side. Anthropic supports this with the `anthropic-dangerous-allow-browser: true` header, which must be sent alongside the API key. Without it, the request is rejected. This is intentional — Anthropic wants developers to explicitly opt in to browser-side key exposure (the key lives in a JS variable, visible to anyone with devtools access to the page).

### Keeping async I/O outside synchronous functions

`generateSchedule` is a pure synchronous function — it takes inputs, computes, returns. The async API call happens in the form submit handler (`async function`) before `generateSchedule` is called. The resolved `injuryProfile` is then passed in as `inputs.injuryProfile`. This pattern — resolve all I/O first, then call the synchronous core — keeps `generateSchedule` testable and composable without making its internals async.

### Graceful degradation for optional features

`resolveInjuryProfile` wraps the API call in a try/catch and falls back to the original keyword matching on any error (network failure, bad API key, invalid JSON response, quota exceeded). The user always gets a plan — just with less intelligent severity assessment. This is the right pattern for optional enhancement features: the fallback must be genuinely useful, not just an error message.

### Structured output from Claude

The system prompt instructs Claude to return ONLY valid JSON with a fixed schema. Claude occasionally wraps JSON in markdown code fences (```json ... ```) despite instructions. The parser strips these with a regex before calling `JSON.parse`. If parsing still fails, the error is caught and falls back gracefully. This "try to parse, fall back on failure" pattern is more robust than attempting to detect and prevent all possible output formats.

### Opt-in API key persistence

The "Remember key" checkbox triggers `localStorage.setItem`. Without checking the box, the key lives only in the DOM input's value — it's gone on page refresh. This respects user intent: some users don't want credentials persisted to browser storage, even for personal tools. The restore on page load checks for the saved key and pre-fills the field, with the checkbox checked so the user knows it's saved.

---

## Why One HTML File?

Splitting into `index.html`, `styles.css`, and `app.js` is cleaner for larger projects. But for a small app that doesn't need a build process or a server, keeping everything in one file has real advantages: you can open it directly in a browser by double-clicking, share it as a single attachment, and there are no import paths to get wrong. The tradeoff is that the file gets longer — but for a project this size, that's fine.

---

## 2026-05-13 — Switching AI Providers Mid-Project

### Why the switch from Anthropic to Gemini matters technically

The two APIs look similar at a high level but differ in meaningful ways:

| Detail | Anthropic | Google Gemini |
|---|---|---|
| Browser CORS | Requires `anthropic-dangerous-allow-browser: true` header | Native CORS support — no special header |
| Auth | `x-api-key` header | `?key=API_KEY` query param |
| System prompt | `system` top-level field | `system_instruction: { parts: [{ text }] }` |
| Messages | `messages: [{ role, content }]` | `contents: [{ role, parts: [{ text }] }]` |
| JSON output | Prompt instruction only | `generationConfig.response_mime_type: "application/json"` enforces it at API level |
| Response path | `content[0].text` | `candidates[0].content.parts[0].text` |

The Gemini `response_mime_type` setting is particularly useful — it guarantees the model returns parseable JSON without relying on prompt phrasing alone. The defensive markdown-fence stripping (`replace(/^```(?:json)?\s*/i, '')`) remains in place as a belt-and-suspenders measure.

When switching AI providers in a browser app, the main risk is auth shape and CORS. Test with a minimal fetch call first before wiring it into the full app.

---

## 2026-05-13 — Evidence-Based Training Plan Benchmarks

### Why arbitrary numbers break down

Invented mileage caps feel reasonable until you compare them to published plans. A beginner half marathon runner doing a 15-mile long run sounds like a lot — and it is: Hal Higdon's Novice 1 half marathon plan peaks at 10 miles, which is already 77% of the race distance. Training instincts borrowed from marathon planning (where 20-mile long runs are standard) don't transfer to shorter distances.

### The multiplier formula problem

A formula like `peak_long_run = race_distance × multiplier` produces reasonable numbers at marathon distance (where a hard cap saves it) but breaks badly for shorter races. A 1.2× multiplier on a half marathon gives 15.7 miles — higher than what Higdon prescribes for *intermediate* runners. The formula ignores that the relationship between long run and race distance isn't linear: a 5K runner needs a long run that builds aerobic capacity, not one that scales with 5K distance.

### The three-source hierarchy

When evaluating training prescriptions, sources aren't equally authoritative for all runner types:

- **Hal Higdon**: best reference for recreational beginners and intermediates — plans are explicitly designed for that population, and the week-by-week schedules are publicly available and verifiable
- **Pfitzinger** (*Faster Road Racing*, *Advanced Marathoning*): best reference for serious amateurs and advanced runners — higher volume, more complex periodization, assumes a real aerobic base
- **Jack Daniels** (*Running Formula*): best for understanding the physiology (VDOT, pace zones, time caps) — his plans are highly individualized and less prescriptive about fixed distances

For a tool targeting recreational runners across all levels, Higdon's published schedules are the most reliable anchor. Pfitzinger fills in the advanced cells where Higdon's plans are less detailed.

### Verifying numbers before using them

Peak long run values should be verified against actual plan schedules, not just the book's summary pages. Higdon's Novice 1 half marathon long run truly does peak at 10 miles — that's Week 11 of a 12-week plan, one week before race day. Any generated plan that prescribes higher should be questioned.

---

## 2026-05-13 — The 10% Weekly Mileage Rule

### What the rule is and why it exists

The 10% rule (don't increase weekly mileage more than 10% per week) is one of the most widely cited injury-prevention principles in running. The reasoning: the musculoskeletal system — tendons, ligaments, bone — adapts more slowly than the cardiovascular system. A runner can feel aerobically ready to handle more volume before their connective tissue has caught up. The 10% rule caps the rate of load increase to give that slower-adapting tissue time to keep pace.

### Pre-computing vs. enforcing inline

The 10% cap could be enforced inside `calcWeeklyMileage`, but that function only knows about a single week — it has no memory of what came before. The cleaner approach: a pre-computation pass builds a `weekMileageArr` array before the main schedule loop, carrying forward a running reference. This pattern (compute first, then consume) keeps the loop itself simple and avoids threading state through a pure function.

### Cutback weeks and the cap interaction

A naive 10% cap applied every week creates a problem: after a cutback week (which intentionally drops volume to 80%), the next non-cutback week is capped at 10% above the reduced value. For a runner at 30 miles/week who drops to 24 for a cutback, the next week would be limited to 26.4 — far below where the progression was heading. The fix: skip updating the reference mileage on cutback weeks. The reference carries the pre-cutback value forward, so the progression resumes from where it was, not from the recovery dip.

---

## 2026-05-13 — Interval Session Variety by Phase

### Why generic "Interval / Speed Work" isn't enough

Labeling all interval sessions the same name loses meaningful variation that actually matters for training. An 800m repeat at 5K effort and a 1000m repeat at race pace are different physiological stimuli — the first targets VO2max, the second trains race-specific lactate clearance. Collapsing them into one label meant the schedule couldn't communicate the right effort cue or recovery interval.

### The phase-specific logic

Different interval structures suit different phases of training:

- **Build phase**: longer, moderate-pace repeats at 5K effort (6 × 800m) build VO2max without over-stressing a runner who's still accumulating base volume.
- **Peak phase**: two alternating structures targeting race-specific pace — shorter/more reps (8 × 600m) and slightly longer/fewer reps (5 × 1000m). Alternating week-to-week within the Peak phase varies the stimulus while keeping the goal pace constant.

The alternation uses `phase.indexInPhase % 2`, which is zero-indexed from the first week of the Peak phase — so even-indexed weeks get 8 × 600m and odd-indexed get 5 × 1000m. This is deterministic and reproducible: the same inputs always produce the same interval sequence.

### Matching labels across three functions

The interval type name is now a precise string (`'Interval — 6 × 800m'`) rather than a category label. Three functions must stay in sync: `getWorkoutTypes` (assigns the label), `getDistLabel` (reads the label to return a formatted distance string), and `getSessionGuidance` (reads the label to return effort/recovery instructions). Each uses `dayType.toLowerCase().includes(...)` pattern matching, with a generic `'interval'` catch-all as a fallback. This keeps the coupling loose — adding a new interval type means adding one entry in each of the three functions, with the catch-all ensuring nothing breaks if the label doesn't match.

---

## 2026-05-13 — OAuth 2.0 in Browser-Only Apps

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

### The JavaScript Temporal Dead Zone (TDZ)

`let` and `const` declarations are *hoisted* (the variable name is known to the scope from the start) but not *initialized* — accessing them before their declaration line evaluates throws a `ReferenceError`. This is called the Temporal Dead Zone. Unlike `var` (which initializes to `undefined` on hoist), `let` gives you an error, which is safer but can be surprising.

In a large single-file app where declarations and references are hundreds of lines apart, TDZ errors can crash silently — the error appears in the console but doesn't surface to the user, and all subsequent code in the script block stops executing. The lesson: in any large inline script, declare variables before the earliest function that references them, not next to the code that "owns" them logically. For shared state like `_stravaWeeklyMiles`, the declaration belongs near the top of the script, not buried in the feature section.
