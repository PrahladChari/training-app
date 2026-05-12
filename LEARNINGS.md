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

## Why One HTML File?

Splitting into `index.html`, `styles.css`, and `app.js` is cleaner for larger projects. But for a small app that doesn't need a build process or a server, keeping everything in one file has real advantages: you can open it directly in a browser by double-clicking, share it as a single attachment, and there are no import paths to get wrong. The tradeoff is that the file gets longer — but for a project this size, that's fine.
