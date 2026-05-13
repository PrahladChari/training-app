---
name: running-training-planner
description: >
  Generates personalized, periodized running training plans based on race distance,
  goal time, current fitness, and injury status. Produces a week-by-week schedule
  with phase-appropriate workouts, session guidance, and optional Strava prefill.
  Exports to Excel. Use this skill whenever a user wants a structured training plan
  for a 5K, 10K, half marathon, or marathon.
---

# Running Training Planner — Skill Reference

## What this skill does

Given a target race date, race distance, current weekly mileage, fitness level, and optional injury information, this skill generates a complete week-by-week training schedule structured around four training phases (Base → Build → Peak → Taper). Each week contains daily workout assignments with distances, effort cues, and session guidance calibrated to the user's fitness level and goal time.

## When to use this skill

- User asks for a running training plan or schedule
- User wants to prepare for a specific race (5K, 10K, half marathon, marathon, or custom distance)
- User wants to understand how their training plan was generated or why a workout was prescribed
- User wants to modify a generated plan based on injury, goal changes, or timeline constraints

## Files in this project

| File | Purpose |
|---|---|
| [index.html](index.html) | HTML form — collects race date, distance, fitness level, mileage, injuries |
| [app.js](app.js) | All JavaScript logic — schedule generation, Excel export, Strava integration |
| [styles.css](styles.css) | All CSS — layout, form, preview table, Strava panel |
| [training-logic.md](training-logic.md) | Phase structure, mileage progression, workout type assignment, taper rules |
| [injury-protocols.md](injury-protocols.md) | Severity classification, rehab phases, avoid lists, race date adjustment |
| [race-standards.md](race-standards.md) | Peak mileage/long run tables, pace zones, fitness multipliers, goal validation |

## Architecture

The app is a single-page browser tool with no backend. All logic runs client-side in `app.js`. The entry point is `generateSchedule(inputs)`, which orchestrates all sub-functions and returns `{ schedule, meta }`.

**Internal unit convention:** all calculations use miles. Metric display is applied at output boundaries only (`toDisplay()` inside `getDistLabel`).

**Data flow:**
```
Form submit
  → resolveInjuryProfile()     (Gemini AI or keyword fallback)
  → generateSchedule(inputs)
      → calculatePhases()
      → weekMileageArr[]       (10% cap pre-pass)
      → per-week loop
          → getWorkoutTypes()
          → getDistLabel()
          → getInjuryNote()
          → getSessionGuidance()
  → renderPreview()
  → exportToExcel()            (on demand)
```

**Strava integration** (optional): OAuth Authorization Code flow pre-fills `weeklyMileage` and `currentTime` from the past 4 weeks of Strava activities. See `stravaOnLoad()` → `stravaHandleCallback()` → `stravaFetchActivities()`.

## Key inputs

| Input | Field ID | Notes |
|---|---|---|
| Race date | `raceDate` | Adjusted forward by injury severity |
| Race distance | `raceDistance` | `5k`, `10k`, `half`, `full`, `custom` |
| Current weekly distance | `weeklyMileage` | In user's chosen unit; converted to miles internally |
| Running days/week | `runDays` | 1–7; maps to `RUN_SLOTS` |
| Strength days/week | `strengthDays` | Overflow layered onto run days |
| Cardio fitness level | `fitnessCardio` | `beginner`, `intermediate`, `advanced` |
| Current race time | `currentTime` | `MM:SS` or `H:MM:SS`; drives recovery/long run paces |
| Goal race time | `goalTime` | Drives quality session paces; triggers ambition warning |
| Injuries | `injuries` | Free text; assessed by Gemini or keyword fallback |
| Gemini API key | `anthropicKey` | Optional; enables AI injury assessment |

## Key output shape

Each row in `schedule[]`:
```js
{
  weekStartDate,      // ISO string — Monday of the week
  weekNumber,         // 1-indexed
  date,               // ISO string — specific day
  dayOfWeek,          // 'Monday' … 'Sunday'
  dayType,            // e.g. 'Easy Run', 'Tempo Run', 'Long Run', 'Rest'
  distanceDuration,   // e.g. '8 mi', '6 × 800m w/ 90 s rest', '45–60 min'
  notes,              // phase label, injury notes, cutback marker
  sessionGuidance,    // effort cues, pace ranges, fueling instructions
  isHistorical,       // true if week is before today (grayed out in UI)
  phase,              // 'Base', 'Build', 'Peak', 'Taper', 'Race'
}
```

## Supporting knowledge files

For the rules and rationale behind each piece of logic, see:

- **Phase structure, mileage progression, workout types, taper:** [training-logic.md](training-logic.md)
- **Injury severity, rehab phases, avoid lists, race date shifts:** [injury-protocols.md](injury-protocols.md)
- **Peak long run caps, pace zones, goal validation thresholds:** [race-standards.md](race-standards.md)
