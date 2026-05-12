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

## What Comes Next

- Excel export with SheetJS (one sheet, week-start-date column, styled historical block, sessionGuidance column)
