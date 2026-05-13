# Training Logic Reference

Source of truth for schedule generation in `app.js`. When numbers or rules conflict
between this file and the code, this file is authoritative — update the code to match.

---

## 1. Phase Structure

Every plan is divided into four sequential phases: **Base → Build → Peak → Taper**.
Phase lengths are computed in `calculatePhases(totalWeeks)`.

### Phase proportions

| Phase | Proportion | Min weeks | Notes |
|-------|-----------|-----------|-------|
| Base  | 35% | 0 | Aerobic foundation, no quality work for beginners |
| Build | remainder | 1 | Adds tempo and interval sessions |
| Peak  | 20% | 1 | Highest mileage, most race-specific work |
| Taper | 10% | 1 (2 if plan > 10 wks) | Volume reduction; legs freshen for race day |

Build absorbs all rounding: `build = totalWeeks − base − peak − taper`.

**Short-plan override** (totalWeeks ≤ 3): `base = 0, build = 0, peak = 1, taper = totalWeeks − 1`.

### Cutback weeks

A cutback week appears every **4th week within Base and Build** phases:

```
isCutbackWeek: (phase.indexInPhase + 1) % 4 === 0
```

- Applies only in Base and Build — never in Peak or Taper
- Reduces that week's computed mileage to **80%** of its target
- The 10% weekly cap (§ 2) skips cutback weeks; the cap reference carries forward from the last non-cutback value

---

## 2. Weekly Mileage Progression

### Internal unit

All mileage is computed and stored in **miles**. The user's input is converted to miles
at the start of `generateSchedule` and converted back for display only.

```js
startMileage = metric ? weeklyMileage / 1.60934 : weeklyMileage
```

### Phase-by-phase targets

Let `buildStart = max(startMileage, peakMileage × 0.60)` and
`progress = indexInPhase / (totalInPhase − 1)` (0.0 = first week, 1.0 = last).

| Phase | Mileage formula |
|-------|----------------|
| Base  | `startMileage + (buildStart − startMileage) × progress` |
| Build | `buildStart + (peakMileage − buildStart) × progress` |
| Peak  | `peakMileage × (1 − 0.05 × progress)` |
| Taper | `peakMileage × (0.80 − 0.30 × progress)` |

Taper volume therefore runs from **80% of peak** (first taper week) down to **50% of peak**
(last taper week).

### 10% weekly cap

A pre-computation pass runs before the main schedule loop. For each **non-cutback** week:

```
weekMileage[w] = min(raw, prevNonCutbackMiles × 1.10)
```

Cutback weeks bypass the cap — they are intentional dips, not progression weeks.
The reference value (`prevNonCutbackMiles`) carries forward from the last non-cutback week,
so recovery from a cutback resumes from the pre-dip level.

### Floor

Weekly mileage never drops below `startMileage × 0.75` (enforced inside `calcWeeklyMileage`).

### Peak mileage table

Peak weekly mileage targets in miles, sourced from Hal Higdon Novice/Intermediate plans
(beginner, intermediate) and Nike Run Club benchmarks (advanced). See: `PEAK_MILEAGE` in `app.js`.

| Distance | Beginner | Intermediate | Advanced |
|----------|----------|--------------|---------|
| 5K       | 16 mi    | 25 mi        | 35 mi   |
| 10K      | 21 mi    | 30 mi        | 45 mi   |
| Half     | 28 mi    | 40 mi        | 55 mi   |
| Marathon | 40 mi    | 55 mi        | 70 mi   |
| Custom   | 25 mi    | 38 mi        | 55 mi   |

---

## 3. Long Run Distance

### Peak long run caps

Capped values in miles, anchored to published plans:
- **Hal Higdon** Novice/Intermediate for beginner and intermediate
- **Pfitzinger** *Faster Road Racing* for advanced sub-marathon
- **Pfitzinger** *Advanced Marathoning* / Higdon Advanced for marathon

See: `PEAK_LONG_RUN` in `app.js`.

| Distance | Beginner | Intermediate | Advanced |
|----------|----------|--------------|---------|
| 5K       | 5 mi     | 7 mi         | 9 mi    |
| 10K      | 6 mi     | 9 mi         | 12 mi   |
| Half     | 10 mi    | 13 mi        | 15 mi   |
| Marathon | 20 mi    | 20 mi        | 22 mi   |
| Custom   | 10 mi    | 13 mi        | 15 mi   |

A multiplier formula (`race distance × factor`) was evaluated and rejected: it
overestimates badly for sub-marathon distances (half × 1.2 = 15.7 mi vs Higdon Novice's
10 mi cap). The named-source table is more accurate and auditable.

### Progression formula

Long run ramps linearly across the **combined Base + Build + Peak span**:

```
globalProg = globalWeekIndex / (totalNonTaperWeeks − 1)   // 0.0 → 1.0
longRun    = peakLongRun × (0.60 + 0.40 × globalProg)
```

- Week 1 of Base: **60% of peak long run**
- Last week of Peak: **100% of peak long run**

Minimum long run distance: **3 miles** at any phase.

### Taper drop

```
longRun = peakLongRun × (0.50 − 0.15 × taperProgress)
```

Taper long runs therefore fall from **50%** (first taper week) to **35%** (last taper
week) of the peak long run cap, with a 3-mile floor.

---

## 4. Workout Type Assignment

Computed by `getWorkoutTypes(phase, fitnessCardio, numRunSlots, injuryProfile)`.

**The last run slot is always the Long Run** (Saturday by default). All preceding slots
are assigned quality or easy work depending on phase and fitness level.

### Assignment rules (in priority order)

| Condition | Slot | Assigned type |
|-----------|------|---------------|
| Taper, slot 0 | Recovery Run | Always — legs must be fresh |
| Taper, slot 1+ | Easy Run | Always |
| Base, advanced, slot 0 | Easy Run w/ Strides | Adds neuromuscular stimulus without intensity |
| Build/Peak, non-beginner, slot 0, not avoiding tempo | Tempo Run | Raises lactate threshold |
| Build, non-beginner, slot 1, not avoiding intervals | Interval — 6 × 800m | Builds VO2max |
| Peak, non-beginner, slot 1, not avoiding intervals | Interval — 8 × 600m *or* 5 × 1000m | Alternates by `indexInPhase % 2` |
| All other slots | Easy Run | Default aerobic work |

**Injury override:** if `injuryProfile.severity === 'severe'`, the long run slot becomes
`Cross-Training (Long Effort)`. If any avoided keyword matches `'long run'`, it becomes
`Long Run (moderate effort — see notes)`.

**Ambitious goal bump:** if the user's improvement target exceeds 5% and fitness is not
already `advanced`, `qualityFitnessCardio` is promoted one level (`beginner →
intermediate`, `intermediate → advanced`) for workout-type assignment only — this adds
interval sessions that wouldn't otherwise appear. Mileage and distances are unaffected.

### Fitness level × phase matrix

| Phase | Beginner | Intermediate | Advanced |
|-------|---------|--------------|---------|
| Base | Easy Run only | Easy Run only | Easy Run w/ Strides (slot 0) |
| Build | Easy Run + Long Run | Tempo + Easy + Long | Tempo + Interval + Easy + Long |
| Peak | Easy Run + Long Run | Tempo + Easy + Long | Tempo + Interval + Easy + Long |
| Taper | Recovery + Easy + Long | Recovery + Easy + Long | Recovery + Easy + Long |

---

## 5. Interval Session Structure

### Build phase

```
6 × 800m  at 5K effort (90–95% max HR)
90 sec recovery jog between reps
Warm up 10–15 min easy beforehand
```

Assigned when: Build phase, `fitnessCardio !== 'beginner'`, injury profile not avoiding intervals.

### Peak phase — alternating by week

Peak weeks alternate between two structures based on `phase.indexInPhase % 2`:

**Even index weeks (0, 2, 4 …):**
```
8 × 600m  at race pace (90–95% max HR)
90 sec recovery jog between reps
Focus: maintaining consistent splits
```

**Odd index weeks (1, 3, 5 …):**
```
5 × 1000m  at race pace (88–93% max HR)
2 min recovery jog between reps
Focus: even-effort splits across all reps
```

Both structures warm up 10–15 min easy. The alternation varies the stimulus (speed vs.
volume) while keeping the training goal (race pace) constant across Peak.

### Label-matching pattern

Interval labels are exact strings, not category keys. Three functions must stay in sync:
`getWorkoutTypes` (assigns), `getDistLabel` (formats distance string), and
`getSessionGuidance` (formats effort/recovery cues). Each uses
`dayType.toLowerCase().includes(...)` matching with a generic `'interval'` catch-all
as fallback.

---

## 6. Taper Rules

### Minimum length

```
totalWeeks > 10  →  taper = max(2, round(totalWeeks × 0.10))
totalWeeks ≤ 10  →  taper = max(1, round(totalWeeks × 0.10))
```

Plans of 11+ weeks always have at least 2 taper weeks.

### Workout composition in Taper

- Slot 0: Recovery Run (always)
- Slots 1 to n−2: Easy Run (always)
- Last slot: Long Run (tapered distance per § 3)
- No tempo runs, no intervals in Taper regardless of fitness level

### Easy run distance in Taper

The standard subtraction formula — `(weeklyMiles − longRunMiles) / (numRunSlots − 1)` —
produces inflated easy runs during Taper because the long run drops 50% while weekly
mileage drops only 20%, inflating the numerator. Taper uses a **proportional formula**
instead:

```
easyRunDist = weeklyMiles / numRunSlots × 0.65
```

**Secondary safeguard:** if the subtraction formula would produce an easy run longer than
the long run (`rawEasy > longRunMiles`), the proportional formula is used regardless of
phase. An easy run can never exceed the long run distance.

### Volume targets

| Taper week | % of peak weekly mileage |
|------------|--------------------------|
| First      | ~80% |
| Last       | ~50% |
| Long run first | ~50% of peak long run |
| Long run last  | ~35% of peak long run |
