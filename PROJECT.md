# Training Planner — Project Overview

## What We're Building

A single-page web app that takes user inputs about a race goal and current fitness, then generates a week-by-week training schedule and exports it as an Excel file. No backend, no login, no database — everything runs in the browser.

## Current Status

**Stage 3 in progress:** Schedule generation, preview table, and two rounds of refinement are complete. Excel export is not yet implemented.

---

## Technical Decisions

### Single HTML file
All HTML, CSS, and JavaScript live in one `index.html`. No build step, no npm, no framework. The user can open it directly in a browser. This keeps it simple and portable — easy to share or run offline.

### No backend
The entire app runs client-side. Schedule logic will be written in plain JavaScript, and Excel export will use a third-party library (SheetJS) loaded via CDN. There's nothing to host or maintain.

### SheetJS (planned)
For Excel export, we'll load `xlsx.js` from a CDN. It handles all the spreadsheet formatting in the browser, including cell styling (e.g. grayed-out rows for historical weeks).

### Plain CSS, no framework
No Tailwind, no Bootstrap. The form uses CSS Grid for two-column and three-column layouts, which is built into modern browsers and needs no dependencies.

---

## What's in index.html

### Sections (in order)
1. **Units toggle** — imperial/metric pill toggle at the top of the form; controls labels and input variants throughout
2. **Race** — race date (date picker) and race distance (dropdown with 5K / 10K / Half / Marathon / Custom); selecting Custom reveals a free-text input
3. **Training Volume** — current weekly distance, training start date (optional, for mid-cycle re-planning), running days/week, strength days/week
4. **Physical Stats** — weight and height; height renders as ft+in (imperial) or a single cm input (metric)
5. **Fitness Level** — three radio groups (Cardio / Strength / Flexibility), each with Beginner / Intermediate / Advanced
6. **Health & Limitations** — free-text textarea for injuries; this will directly affect the generated schedule

### JavaScript
- `applyUnits()` — runs on toggle change; updates labels, swaps height inputs, adjusts mileage field max
- Race distance change handler — shows/hides the custom distance input and sets its `required` attribute conditionally
- Schedule generation engine (~250 lines) — see Stage 2 section below
- Form submit handler — collects inputs, calls generator, stores result in `window._currentSchedule`, displays summary

---

## Stage 2: Schedule Generation

Added in this session. All logic lives in the `<script>` block of `index.html`.

### Key functions

| Function | Purpose |
|---|---|
| `parseInjuries(text)` | Keyword-matches injury text → severity (none/mild/moderate/severe) + per-keyword avoid lists and notes |
| `calculatePhases(totalWeeks)` | Splits total weeks into base/build/peak/taper proportions |
| `getPhaseForWeek(weekIdx, phases)` | Returns which phase a given week falls in, plus its index within that phase |
| `isCutbackWeek(weekIdx, phases)` | Returns true every 4th week in base or build phase |
| `calcWeeklyMileage(...)` | Linear ramp within each phase; applies 80% cutback on cutback weeks |
| `calcLongRunDist(...)` | Long run distance scales toward a race-distance peak, then tapers |
| `getWorkoutTypes(...)` | Returns ordered workout type labels for all run slots in a week |
| `getDistLabel(...)` | Translates a workout type + mileage into a human-readable distance/duration string |
| `getInjuryNote(...)` | Returns injury-specific notes for a given workout type |
| `generateSchedule(inputs)` | Orchestrates everything; returns `{ schedule: [...], meta: {...} }` |

### Data shape (one row per day)
```
{ weekStartDate, weekNumber, date, dayOfWeek, dayType,
  distanceDuration, notes, sessionGuidance, isHistorical, phase }
```

### Design decisions
- **Dates stored as ISO strings** (`YYYY-MM-DD`) — the preview table and Excel export will format them for display
- **Historical weeks** use a clean injury profile (severity: none) so past weeks show the original plan, not the modified one
- **Strength overflow**: if `runDays + strengthDays > 7`, extra strength days are layered onto run days as combo sessions rather than rejected
- **Race date adjustment**: injury severity pushes the race date forward (+14 days moderate, +28 severe); this is reflected in the status message and the final race day row

---

## Stage 3: Refinements — Unit Fix, Mileage Tables, Session Guidance

### Bug fix: unit conversion

The `PEAK_MILEAGE` and `PEAK_LONG_RUN` tables are in miles, but `weeklyMileage` from the form is in the user's chosen unit (km when metric). Passing km and miles into the same arithmetic produced inflated easy-run distances (traced to exactly 10.5km for a 20km/week metric user).

Fix: at the top of `generateSchedule`, convert `weeklyMileage` to miles unconditionally (`startMileage = weeklyMileage / 1.60934` when metric). All downstream calculations use `startMileage`. The display function `toDisplay` already converted back to km for output — so only the input boundary needed fixing.

### Revised mileage tables (evidence-based)

Original values were invented and too aggressive. Tables are now anchored to Hal Higdon Novice / Intermediate / Advanced and Nike Run Club benchmarks. Example changes for 10K:

| Level | Peak weekly (before → after) | Peak long run (before → after) |
|---|---|---|
| Beginner | 25 mi → 21 mi | 10 mi → 6 mi |
| Intermediate | 38 mi → 30 mi | 13 mi → 10 mi |
| Advanced | 55 mi → 45 mi | 15 mi → 13 mi |

Base phase long run now starts at 40% of peak (was 50%), so week-one long runs are approachable for someone starting from a low base.

### `sessionGuidance` field

Each schedule row now includes a `sessionGuidance` string with actionable, workout-specific instructions. Generated by `getSessionGuidance(dayType, phaseName, fitnessCardio, fitnessStrength, racePaceSec, units)`.

- **Easy run**: Zone 2 HR cue + specific pace range if a reference time was provided
- **Tempo run**: effort cue, HR zone, target duration by phase, warm-up/cool-down reminder
- **Interval / Speed Work**: rep scheme (varies by fitness level), target effort, recovery interval
- **Long run**: fueling strategy varies by phase (no fueling in base, gels in build/peak), effort notes
- **Recovery run**: Zone 1 guidance, pace range if available
- **Strength**: rep/set ranges and exercise examples keyed by `fitnessStrength` level and phase
- **Rest / Cross-Training**: brief purpose note

### New form field: Current performance

A "Reference distance + Your time" pair added to the Race section (both optional). Time is parsed as `MM:SS` or `H:MM:SS` into total seconds, divided by the reference distance in miles, giving a `racePaceSec` (seconds/mile) value that feeds into `getSessionGuidance`. When not provided, guidance uses HR zone language only.

### New functions added
| Function | Purpose |
|---|---|
| `parseTime(str)` | Parses `"25:00"` or `"1:05:30"` → total seconds |
| `getRacePaceSec(timeStr, distKey)` | Converts time + distance key → seconds/mile |
| `formatPace(secPerMile, units)` | Formats to `"5:30/km"` or `"8:51/mi"` |
| `getSessionGuidance(...)` | Returns workout-specific guidance string |

---

---

## Stage 4: Progressive Injury Rehabilitation Model

### What changed

`getInjuryNote` previously returned the same avoidance message on every row for the entire plan duration. It now returns phase-specific content based on how many weeks into the forward plan a row falls.

### Rehab phase boundaries

| Phase | Mild | Moderate | Severe |
|---|---|---|---|
| Acute (strict avoidance) | week 1 | weeks 1–2 | weeks 1–4 |
| Early rehab (exercises) | week 2 | weeks 3–4 | weeks 5–8 |
| Progressive loading (caution) | week 3 | weeks 5–8 | weeks 9–12 |
| Full training (no notes) | week 4+ | week 9+ | week 13+ |

### New data and functions

- **`REHAB_EXERCISES`** — lookup table keyed by injury keyword (knee, shin, IT band, hip, back, hamstring, calf, achilles, plantar, ankle). Each entry is a ready-to-use prescription with sets and reps.
- **`getRehabPhase(weekNum, severity)`** — maps a 1-indexed forward week number and severity level to one of four phase strings: `acute / rehab / loading / full`.
- **`getInjuryNote(dayType, injuryProfile, weekNum)`** — now accepts `weekNum`; dispatches to phase-specific logic: avoidance notes (acute), named exercises from `REHAB_EXERCISES` (rehab), a generic monitoring note (loading), or empty string (full).

### Workout type clearing in loading/full phases

`getWorkoutTypes` uses the injury profile to substitute Cross-Training for long runs and flag restricted sessions. In loading and full phases this substitution should no longer apply. Rather than changing `getWorkoutTypes`'s signature, the loop passes a clean `effForTypes = { severity: 'none', ... }` to `getWorkoutTypes` while still passing the real `eff` to `getInjuryNote`. This keeps each function's responsibility clean.

### Re-entry pattern

Because the schedule always starts from today, a user who re-submits the form after recovering (or with an updated injury description) naturally gets a new forward plan with the correct rehab phase for their current week — with previously completed weeks showing as grayed-out historical rows. No special re-entry feature is needed.

---

---

## Stage 5: Goal Race Time, Strength Guidance Cleanup, Pace Zone Overhaul

### Strength session guidance removed

`getSessionGuidance` previously returned phase- and fitness-level-specific exercise prescriptions for Strength rows (goblet squats, RDLs, etc.). These were removed — the schedule has no concept of "leg day" vs. "full body," so any guidance was always generic. Returning `''` for Strength sessions is cleaner than misleading specificity.

### Goal race time form fields

Replaced the old "Reference distance + Your time" two-col row with:
- **Current [race distance] time** — text input, `MM:SS` or `H:MM:SS`, for the selected race distance
- **Goal [race distance] time** — same format, target finish time

Both field labels update dynamically when the user changes the race distance dropdown (e.g. "Current 10K time" → "Current Half Marathon time"). The reference distance dropdown was removed — both times are always relative to the selected race distance.

### Improvement % calculation and ambition flags

In `generateSchedule`, after `totalWeeks` is computed:
- `currentSecs` and `goalSecs` are parsed from the new fields
- `racePaceSec = currentSecs / distMiles` (sec/mile, current fitness)
- `goalPaceSec  = goalSecs    / distMiles` (sec/mile, training target)
- `improvementPct = (currentSecs - goalSecs) / currentSecs × 100`

**Warning thresholds** (returned as `ambitionWarning` in `meta`, displayed as a styled banner above the schedule):

| Condition | Level | Banner style |
|---|---|---|
| `improvementPct > 15%` | `unrealistic` | Red |
| `improvementPct > 8%` | `ambitious` | Orange |
| `totalWeeks < 8` and `improvementPct > 5%` | `ambitious` | Orange |
| `improvementPct ≤ 0` | `info` | Blue |

Warning message includes a suggested realistic goal time (current time × 0.92 = 8% improvement).

### Pace zone overhaul (Daniels VDOT + 80/20)

`getSessionGuidance` now accepts both `racePaceSec` (current) and `goalPaceSec` (target). Pace offsets are based on Jack Daniels' VDOT zones and the 80/20 polarized methodology:

| Session | Base pace | Offset (sec/mile) | Offset (sec/km) |
|---|---|---|---|
| Easy run | `goalPaceSec` | +113 to +145 | +70 to +90 |
| Tempo | `goalPaceSec` | +13 to +24 | +8 to +15 |
| Interval | `goalPaceSec` | −16 to −8 | −10 to −5 |
| Long run | `racePaceSec` | +97 to +145 | +60 to +90 |
| Recovery | `racePaceSec` | +144 to +192 | +89 to +119 |

Quality sessions (tempo, intervals, easy runs) use goal pace as the base — training at goal effort. Long runs and recovery runs use current fitness pace — keeping aerobic base work honest.

### Intensity scaling for aggressive goals

If `improvementPct > 5%` and `fitnessCardio !== 'advanced'`, the internal `qualityFitnessCardio` is bumped up one level (beginner → intermediate, intermediate → advanced) when calling `getWorkoutTypes`. This adds quality session variety (e.g. intervals in Build phase for a beginner with an ambitious goal) that would otherwise only appear for higher fitness levels.

---

---

## Stage 6: AI-Powered Injury Assessment

### Problem with keyword matching

The original `parseInjuries` function matched against a hardcoded keyword list (`knee`, `shin`, etc.) and used severity modifier words (`severe`, `chronic`). This couldn't distinguish between structural injuries and post-race soreness — both inputs produced `moderate` severity and a 2-week race date push even when the user explicitly said "maybe not an injury, just soreness."

### Solution: Anthropic API call for injury assessment

When a Haiku API key is provided, the app sends the free-text injury description to `claude-haiku-4-5-20251001` with a structured system prompt that returns JSON:

```json
{
  "severityLevel": "none|mild|moderate|severe",
  "injuryTypes": ["list of identified issues"],
  "reasoning": "1-2 sentence explanation",
  "raceDateAdjustment": 0,
  "avoidList": ["workout types to restrict"],
  "modifications": ["specific training modifications"],
  "rehabExercises": "exercises with sets and reps"
}
```

The system prompt explicitly instructs the model to:
- Treat post-race soreness and tightness as `mild` at most, often `none`
- Recognize language like "maybe not an injury", "just soreness" as mild indicators
- Reserve `severe` for structural trauma: dislocation, fracture, torn tissue, surgery
- Choose the lower severity when uncertain

### API key handling

- User enters their Anthropic API key in a password field in the Health & Limitations section
- Optional "Remember key" checkbox persists it to `localStorage` (opt-in)
- Key is loaded from `localStorage` on page load when present
- The `anthropic-dangerous-allow-browser: true` header enables direct browser → Anthropic API calls

### Graceful fallback

`resolveInjuryProfile(injuryText, apiKey)`:
1. No injury text → return `severity: 'none'`
2. No API key → fall back to `parseInjuries` (keyword matching)
3. API error or malformed JSON → fall back to `parseInjuries`, log warning

### Dynamic race date adjustment

Previously hardcoded: `moderate → +14 days`, `severe → +28 days`. Now uses `raceDateAdjustment` (weeks) directly from Claude's response. For keyword-based fallback, the old hardcoded values are preserved. The race day row note and status message both reflect the actual shift amount.

### Data flow changes

- `generateSchedule` now accepts `inputs.injuryProfile` (pre-computed), falling back to `parseInjuries(injuries)` if not provided — keeps the function synchronous while the async API call happens in the submit handler
- Form submit handler is now `async`; disables the Generate button and shows "Assessing injury..." while the API call is in flight
- `getInjuryNote` now prefers `injuryProfile.rehabExercises` (Claude-provided, specific to the described injury) over the generic `REHAB_EXERCISES` keyword lookup
- Status message appends Claude's `reasoning` field so the user can see why their injury was classified as it was

---

---

## Stage 7: Excel Export (ExcelJS)

### Library choice

SheetJS Community Edition (originally planned) does not apply cell styles in `.xlsx` output — the `.s` property is silently ignored. **ExcelJS** (loaded via CDN `exceljs@4`) is free, actively maintained, and supports full xlsx styling: background fills, bold/italic fonts, freeze panes, column widths, merged cells, and multiple worksheets.

### Two worksheets

**Sheet 1 — Training Plan** (8 columns: Week, Week Start, Date, Day, Day Type, Distance/Duration, Notes, Session Guidance):
- Header row: dark charcoal background (`#2D3436`), white bold text, frozen (stays visible when scrolling)
- Phase divider rows: inserted when the phase changes in the forward plan, full-width merged cell, centered bold label (`— BASE PHASE —` etc.)
- Historical rows: light gray background, italic gray font
- Current week rows: light blue background (detected by comparing `weekStartDate` to today's Monday ISO string)
- Future weeks: alternating white / very light gray by week number
- Race day row: blue background, bold font
- Notes and Session Guidance columns: `wrapText: true` so long text is readable without manual resizing
- Column widths: 6/14/10/6/22/18/42/62

**Sheet 2 — Summary**: label/value pairs in four sections: Race & Goal, Plan Overview, Fitness Level, Injury Assessment. Section headers use the same dark charcoal style as the main sheet header. Peak mileage is converted to km when metric.

### Download button

A "Download Excel" button (`btn-export`, outlined style) appears above the preview table after the first plan is generated. It calls `async function exportToExcel()`, which reads `window._currentSchedule` (schedule + meta) and `window._currentInputs` (raw form values). Triggers a browser download via `URL.createObjectURL` + programmatic `<a>` click.

### Data stored for export

`window._currentInputs = inputs` is set in the form submit handler before `generateSchedule` is called. This gives the export function access to raw form values (current time, goal time, fitness levels, etc.) that aren't all present in `meta`.

---

---

## Stage 8: Training Plan Refinements and Bug Fixes

### API switch: Anthropic → Google Gemini Flash

The injury assessment API was switched from Anthropic (`claude-haiku-4-5-20251001`) to Google Gemini Flash (`gemini-2.0-flash`). Gemini offers a free tier via Google AI Studio and supports CORS from browsers natively — no special `anthropic-dangerous-allow-browser` header required. The request shape uses `system_instruction.parts[]` + `contents[].parts[]` and `generationConfig.response_mime_type: "application/json"` to force structured output at the API level. The response is read from `candidates[0].content.parts[0].text`. The `localStorage` key was renamed from `anthropic_api_key` to `gemini_api_key`. All other behavior (structured JSON schema, fallback to keyword matching, graceful error handling) is unchanged.

### Evidence-based peak long run table

The `PEAK_LONG_RUN` table was rebuilt from three primary sources:

- **Hal Higdon** (primary reference for beginner/intermediate): 5K Novice peaks at 3 mi, 10K Novice at 5.5 mi, 10K Intermediate at 8 mi, Half Novice 1 at 10 mi, Half Intermediate 1 & 2 at 12 mi, all marathon plans at 20 mi.
- **Pfitzinger Faster Road Racing** (reference for advanced sub-marathon): half marathon plans peak ~14–15 mi depending on weekly volume tier.
- **Pfitzinger Advanced Marathoning** (reference for advanced marathon): 18/55 plan peaks at 20 mi; 18/70 peaks at 22 mi.

A multiplier formula (`race distance × fitness multiplier`) was evaluated and rejected: it overestimates significantly for half marathon (1.2× = 15.7 mi vs. Higdon Novice's 10 mi) and 10K (1.2× = 7.5 mi vs. Higdon's 5.5 mi). The named-source table is more accurate and auditable.

| Race | Beginner | Intermediate | Advanced |
|---|---|---|---|
| 5K | 5 mi | 7 mi | 9 mi |
| 10K | 6 mi | 9 mi | 12 mi |
| Half | 10 mi | 13 mi | 15 mi |
| Marathon | 20 mi | 20 mi | 22 mi |

`calcPeakLongRun(distance, fitnessCardio)` wraps the table lookup. `calcLongRunDist` uses this ceiling and ramps linearly from 60% (first week of Base) to 100% (last week of Peak), then drops from 50% to 35% across Taper.

### 10% weekly mileage cap

A pre-computation pass now runs before the main schedule loop. For each non-cutback week, mileage is capped at 110% of the previous non-cutback week's value:

```js
weekMileageArr[w] = cutback ? raw : Math.min(raw, prevNonCutbackMiles * 1.10);
if (!cutback) prevNonCutbackMiles = weekMileageArr[w];
```

Cutback weeks bypass the cap — they are intentional volume drops, not progression weeks, so the 10% ramp reference continues from the last non-cutback value. The main loop reads `weekMileageArr[w]` instead of calling `calcWeeklyMileage` directly.

### Taper minimum 2 weeks

`calculatePhases` now enforces a minimum of 2 taper weeks for plans longer than 10 weeks:

```js
const taper = totalWeeks > 10
  ? Math.max(2, Math.round(totalWeeks * 0.10))
  : Math.max(1, Math.round(totalWeeks * 0.10));
```

### Interval variety by phase

`getWorkoutTypes` now assigns specific interval labels instead of the generic `'Interval / Speed Work'`:

- **Build phase**: always `'Interval — 6 × 800m'` at 5K effort, 90 sec recovery
- **Peak phase**: alternates `'Interval — 8 × 600m'` (even `indexInPhase`) and `'Interval — 5 × 1000m'` (odd `indexInPhase`) at race pace

`getDistLabel` and `getSessionGuidance` pattern-match on these specific strings to return appropriate rep counts, recovery intervals, and effort cues. A generic `'interval'` catch-all remains as fallback.

### Bug fixes

- **Race day `weekStartDate`**: was `isoDate(getMonday(raceAdj))`, duplicating the last taper week's Monday. Fixed to `isoDate(raceAdj)`.
- **Excel Week / Week Start columns**: previously only filled on the first row of each week. Now filled for every row; RACE DAY gets `''` in the Week column.

---

## What Comes Next

- Fix known bug: taper easy run on Week 12 Thursday showing incorrect distance (~16 km) — likely a long run distance not being correctly excluded from easy run mileage distribution
- User testing and iterative refinements
