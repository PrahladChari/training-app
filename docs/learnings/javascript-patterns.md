# JavaScript Patterns

## Phases and Progressive Overload

The training plan uses a classic four-phase structure: **Base → Build → Peak → Taper**. Each phase has a different goal:

- **Base**: build an aerobic foundation at comfortable effort. Mileage rises slowly. No intensity work for beginners.
- **Build**: add quality workouts (tempo runs, intervals). Mileage continues climbing.
- **Peak**: highest mileage and most race-specific work. Short — 1–2 weeks.
- **Taper**: reduce volume so the body can recover and arrive at race day fresh.

The code calculates how many weeks each phase gets as a percentage of total weeks (`35% / 35% / 20% / 10%`), then adjusts for the edge case where the timeline is very short.

**Cutback weeks** appear every 4th week in Base and Build. They reduce that week's mileage to 80% of the target. This is standard training practice — the body needs periodic recovery to absorb the stress of the preceding weeks.

---

## Linear Interpolation for Mileage Ramps

Within each phase, mileage increases linearly from the start value to the end value. The code computes a `progress` ratio (`0.0` = first week of phase, `1.0` = last week) and uses it to interpolate:

```js
target = startMileage + (endMileage - startMileage) * progress;
```

This is called **linear interpolation** — a very common pattern for smoothly transitioning between two values over time. You'll see it everywhere in animation, audio, and simulation code.

---

## Keyword Parsing for Injuries

The injury input is free text, so the code can't know exactly what the user means. Instead, it scans the text for known keywords (`knee`, `shin`, `it band`, etc.) and maps each one to a set of workout types to avoid and a note to attach to affected days.

Severity is assessed by counting how many keywords matched and looking for modifier words like "severe" or "chronic". This is a simple rule-based approach — not AI, not NLP — but it works well for a constrained domain where the vocabulary is predictable.

---

## Why Dates Are Stored as ISO Strings

JavaScript's `Date` object is notoriously tricky. One common bug: `new Date('2026-05-12')` creates a date in **UTC midnight**, which can display as May 11th in timezones west of UTC. To avoid this, all dates are parsed using a local-time constructor: `new Date(year, month - 1, day)`. They're then stored as `YYYY-MM-DD` strings using a manual formatter — not `toISOString()`, which would re-introduce the UTC issue.

---

## The `isHistorical` Flag

Each row in the schedule has an `isHistorical` boolean. If the user entered a training start date before today, the app reconstructs what the plan would have looked like for those past weeks — using the original plan with no injury modifications. Marking them `isHistorical: true` lets the preview table and Excel exporter gray them out visually, making it clear they're already done.

---

## Strength Slot Overflow

The weekly schedule has 7 slots (Mon–Sun). If `runDays + strengthDays > 7`, there aren't enough rest days to fit everything separately. Rather than throwing an error, the code does a two-pass fill: first it places strength days on rest days, then if there are still strength days left it layers them onto run days, creating "Run + Strength" combo sessions. This degrades gracefully instead of crashing.

---

## State That Changes Over Time Within a Single Output

The injury notes feature was originally stateless — every row got the same note regardless of where it fell in the plan. The rehab model required making the note generation **time-aware**: the output for a given row now depends on which week of the forward plan it belongs to, not just what the injury is.

The key design decision was adding a `weekNum` parameter to `getInjuryNote` rather than pre-computing all notes at the start. This keeps the function pure and testable — given the same inputs, it always returns the same output — while allowing the generator loop to control what it passes in.

---

## Using a Phase Function as a Router

`getRehabPhase(weekNum, severity)` is a simple lookup — it takes two inputs and returns one of four string labels. That label is then used as a switch key in `getInjuryNote`. This pattern (compute a state label, then dispatch on it) is easier to reason about than embedding the boundary logic inside the function that uses it. If the phase boundaries ever change, you only touch one place.

---

## Passing a Modified Context Rather Than Adding Flags

`getWorkoutTypes` uses the injury profile to decide whether to substitute Cross-Training for long runs. In the loading and full rehab phases, that substitution should stop — but `getWorkoutTypes` has no concept of rehab phases. Rather than adding a parameter to it, the generator loop passes a clean `{ severity: 'none' }` profile as `effForTypes` while keeping the real profile for the note generation. This avoids adding logic to a function that doesn't need it, and preserves the separation between "what workout to assign" and "what note to attach."

---

## Lookup Tables for Domain-Specific Content

`REHAB_EXERCISES` is a plain JavaScript object — just string values keyed by injury keyword. The same keywords that `parseInjuries` extracts are used here as keys, so no extra parsing step is needed. When a user has multiple injuries (e.g. knee + IT band), the rehab note shows exercises for both, joined with a separator. This pattern — parse once, reuse the parsed result across multiple lookups — avoids duplicating the parsing logic.

---

## Graceful Re-Entry as a Design Principle

The progressive model naturally supports users who return to the platform mid-recovery. Because the schedule always starts from today and uses `weeksSinceInjury` counted from the first forward week, a user who re-submits with an updated injury description gets a correctly-phased plan from that moment onward, with completed weeks shown as historical. This wasn't explicitly built as a feature — it's a consequence of the "start from today" design decision made at the beginning.

---

## Two Paces, Two Purposes

The app tracks two distinct paces internally (both in sec/mile):
- `racePaceSec` — derived from the user's **current** race time. Used for recovery runs and long runs, which should reflect where you actually are, not where you want to be.
- `goalPaceSec` — derived from the user's **goal** race time. Used for tempo, intervals, and easy runs, which are calibrated to the effort level needed to achieve the goal.

Keeping them separate avoids a subtle conceptual error: if you always train at current pace, you never push toward the goal. If you always train at goal pace, your recovery runs become too hard. The right pattern is to use goal pace for quality sessions and current pace for aerobic base work.

---

## The Unit Mismatch Bug

The mileage tables (`PEAK_MILEAGE`, `PEAK_LONG_RUN`) were written in miles, but the user's `weeklyMileage` form input was passed in as-is — kilometers when the metric toggle was on. The easy-run formula subtracted a miles value from a km value and then multiplied the result by 1.609 to convert to km, compounding the error. The symptom: a 20km/week runner saw a ~10.5km easy run on day one.

The fix: convert `weeklyMileage` to miles at the very top of `generateSchedule` using the selected unit flag, then work exclusively in miles throughout. The display function (`toDisplay`) already handled the conversion back to km for output.

This is a classic example of why it's important to pick one internal unit and convert at the boundary (input + output), rather than letting values flow through in mixed units.

---

## Pace as Seconds-Per-Mile Internally

The optional "current time" field (e.g. "25:00 for 5K") is parsed into seconds, divided by the distance in miles, and stored internally as **seconds per mile**. All pace offsets (easy = race pace + N seconds, tempo = race pace + M seconds) are added in the same unit. The `formatPace` function converts to min/km or min/mi at display time.

Working in a single numeric unit (seconds/mile) avoids the same class of bug as the mileage mismatch — you never subtract km values from mile values by accident.

---

## Graceful Degradation Without Pace Input

`getSessionGuidance` checks `racePaceSec != null` before producing pace ranges. When null (no reference time entered), it falls back to HR zone language and effort descriptions ("Zone 2 — fully conversational, 65–75% max HR"). The guidance is still useful; it's just expressed in relative terms rather than absolute pace. This pattern — provide specifics when you have them, fall back to qualitative guidance when you don't — is common in health and fitness apps.

---

## Warning Banners for Unrealistic Goals

When a goal time implies an improvement percentage that exceeds standard training adaptation rates, the app shows a styled warning banner before the schedule. The thresholds:
- **>15% improvement**: flagged as unrealistic regardless of timeline
- **>8% improvement**: flagged as very ambitious
- **<8 weeks remaining with >5% gap**: timeline too short

The suggested realistic alternative is always current time × 0.92 (8% improvement — the high end of what a focused training cycle typically delivers).

---

## Improving the Plan by Bumping Session Variety

If a user's goal requires >5% improvement, `qualityFitnessCardio` is set one level above their stated fitness level for the purpose of assigning workout types. This means a beginner with an ambitious goal will see interval sessions in the Build phase, which they otherwise wouldn't. The bump is narrow in scope — it doesn't affect mileage, long run distances, or any display labels, only which quality session types appear.

---

## The 10% Weekly Mileage Cap

### What the rule is and why it exists

The 10% rule (don't increase weekly mileage more than 10% per week) is one of the most widely cited injury-prevention principles in running. The reasoning: the musculoskeletal system — tendons, ligaments, bone — adapts more slowly than the cardiovascular system. A runner can feel aerobically ready to handle more volume before their connective tissue has caught up. The 10% rule caps the rate of load increase to give that slower-adapting tissue time to keep pace.

### Pre-computing vs. enforcing inline

The 10% cap could be enforced inside `calcWeeklyMileage`, but that function only knows about a single week — it has no memory of what came before. The cleaner approach: a pre-computation pass builds a `weekMileageArr` array before the main schedule loop, carrying forward a running reference. This pattern (compute first, then consume) keeps the loop itself simple and avoids threading state through a pure function.

### Cutback weeks and the cap interaction

A naive 10% cap applied every week creates a problem: after a cutback week (which intentionally drops volume to 80%), the next non-cutback week is capped at 10% above the reduced value. For a runner at 30 miles/week who drops to 24 for a cutback, the next week would be limited to 26.4 — far below where the progression was heading. The fix: skip updating the reference mileage on cutback weeks. The reference carries the pre-cutback value forward, so the progression resumes from where it was, not from the recovery dip.

---

## Interval Session Variety by Phase

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

## The JavaScript Temporal Dead Zone (TDZ)

`let` and `const` declarations are *hoisted* (the variable name is known to the scope from the start) but not *initialized* — accessing them before their declaration line evaluates throws a `ReferenceError`. This is called the Temporal Dead Zone. Unlike `var` (which initializes to `undefined` on hoist), `let` gives you an error, which is safer but can be surprising.

In a large single-file app where declarations and references are hundreds of lines apart, TDZ errors can crash silently — the error appears in the console but doesn't surface to the user, and all subsequent code in the script block stops executing. The lesson: in any large inline script, declare variables before the earliest function that references them, not next to the code that "owns" them logically. For shared state like `_stravaWeeklyMiles`, the declaration belongs near the top of the script, not buried in the feature section.

---

## Full Schedule Persistence for Multi-Session Workflows *(2026-05-17)*

### Why it matters

A training plan spans 12–18 weeks. Without persistence, every browser refresh or tab close resets the app to blank — the user must regenerate their plan from scratch and lose any check-in history. This is fine for a demo but not for any tool someone uses week after week.

The fix is two localStorage keys written on every plan generation and every check-in submission:

| Key | Contents |
|---|---|
| `training_schedule` | Full `{ schedule, meta, inputs }` snapshot — the schedule array, the meta object (planId, phases, totalWeeks, etc.), and the raw form inputs that produced it |
| `training_checkins` | Array of all check-in records, keyed by `planId` and `weekNumber` — survives plan regenerations because `planId` is preserved across regens |

On page load, a `restorePlanFromStorage()` call rehydrates `window._currentSchedule` and `window._currentInputs` and re-renders both the preview table and check-in section. The user lands back where they left off without touching the form.

### The planId is load-bearing

`planId` is a `Date.now()` timestamp set once when the form is first submitted and threaded through every subsequent regen. This is what ties check-in history to a specific plan. Without a stable ID, a regenerated schedule would be orphaned from its check-ins. The rule: set `planId` at creation, never change it on regen — always pass `_planId: meta.planId` into `generateSchedule` when regenerating.

### Upsert, not append

Check-ins are stored as an array with an upsert pattern: find-and-replace if the same `(planId, weekNumber)` pair exists, otherwise append. This lets the user update a week's check-in after the fact (e.g. they forgot to log Thursday's run) without accumulating duplicate records.

---

## Bridging localStorage to a Future Database

### The localStorage layer as an interface boundary

The two storage functions (`savePlanToStorage` / `restorePlanFromStorage`, `getCheckins` / `saveCheckins`) are thin wrappers around `localStorage.getItem/setItem` with JSON serialization. This is intentional: all reads and writes go through these four functions — nothing in the rest of the app touches localStorage directly.

When the time comes to move to a real backend (IndexedDB, a REST API, Supabase), only these four functions need to change. The rest of the app — schedule generation, check-in logic, rendering — calls the same interface and remains untouched.

### What to preserve when migrating

Three things make a localStorage → database migration non-trivial in a training app:

1. **planId stability**: The ID must migrate with the plan record. A new auto-increment ID from the DB would break all existing check-in linkage.
2. **Date serialization**: Dates are stored as ISO strings (`YYYY-MM-DD`). A database that stores timestamps needs a conversion at the boundary — not in the core logic.
3. **Optimistic UI**: localStorage writes are synchronous and instant. A database write is async and can fail. The migration point is a good time to add loading states and error handling to the storage functions — but that cost is paid once at the boundary, not scattered through the feature code.

The pattern to follow: keep the same four-function interface, make them `async`, handle errors at that layer, and add a `userId` field to the stored records when authentication is introduced.

---

## localStorage Key Migration Pattern *(2026-05-17)*

When you rename a localStorage key (e.g. `training_plan_history` → `training_archived_plans`), a one-time migration in the read function prevents existing users from losing data silently:

```js
function getArchivedPlans() {
  const raw = localStorage.getItem('training_archived_plans');
  if (raw) return JSON.parse(raw);
  const old = localStorage.getItem('training_plan_history');
  if (!old) return [];
  const migrated = JSON.parse(old).map(h => ({ /* normalize shape */ }));
  saveArchivedPlans(migrated);   // write under new key
  return migrated;
}
```

The old key is left in place — it's harmless and avoids data loss if something goes wrong with the migration write. Migration runs once and then every subsequent read hits the new key. No special "migration flag" or version number is needed.

---

## Async Function Hoisting Pitfall

A `function` declaration inside an `async function` is technically hoisted within that scope, but in practice this can produce confusing bugs — especially when the inner function is called before it's "reached" in the flow. Promote any helper that's called from multiple callsites to a top-level function declaration instead. The symptom of the bug: a named function inside `async exportToExcel` was not found at calltime and returned `undefined` silently.

---

## ExcelJS Row Grouping for Collapsible Sections

ExcelJS supports Excel's native row outline/grouping, which lets users click [+] to expand hidden rows:

```js
// Must set summaryBelow: false so the [+] button appears ABOVE the group
planSheet.properties.outlineProperties = { summaryBelow: false };

// Visible summary row (level 0 — always shown)
const sumRow = planSheet.addRow(['Plan v1 — 8 weeks completed']);

// Detail rows (level 1 — hidden by default)
detailRows.forEach(r => {
  const row = planSheet.addRow([...]);
  row.outlineLevel = 1;
  row.hidden       = true;
});
```

Key gotcha: `summaryBelow: false` must be set on `planSheet.properties.outlineProperties` *before* any rows are added, not after. If omitted, Excel places the [+] below the group, which is confusing when the summary row is at the top.
