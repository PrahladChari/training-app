# Race Standards Reference

Source of truth for pace zones, goal validation, peak mileage tables, and Strava
activity matching in `app.js`. Cross-references `training-logic.md` for long run caps
and weekly mileage tables — those values are not duplicated here.

---

## 1. Race Distance Constants

Exact mile equivalents used for all pace calculations. See: `DIST_MILES` in `app.js`.

| Distance | Miles |
|----------|-------|
| 5K | 3.10686 |
| 10K | 6.21371 |
| Half Marathon | 13.1094 |
| Marathon | 26.2188 |

Custom distances do not produce race pace calculations — `DIST_MILES` has no
`custom` key, so `racePaceSec` and `goalPaceSec` resolve to `null` for custom
races. Guidance falls back to HR zone language only.

---

## 2. Pace Zone Definitions

All pace calculations originate in `getSessionGuidance`. Offsets are stored and
computed in **seconds per mile** and converted to the user's unit at display time via
`formatPace(secPerMile, units)`.

### Pace bases

Two pace bases are tracked separately:

| Variable | Source | Used for |
|----------|--------|----------|
| `goalPaceSec` | Goal race time ÷ distance in miles | Easy runs, tempo, intervals — sessions that train toward the target |
| `racePaceSec` | Current race time ÷ distance in miles | Long runs, recovery runs — sessions keyed to current fitness |

If only one time is provided, it fills both roles (`goalPaceSec ?? racePaceSec` and
`racePaceSec ?? goalPaceSec`).

### Zone offsets

Derived from Jack Daniels' VDOT system. All offsets are relative to the **goal pace**
base unless noted. Positive = slower than goal pace.

| Zone | Session | Base | Offset (sec/mile) | Offset (sec/km) | HR |
|------|---------|------|-------------------|-----------------|-----|
| Easy (E) | Easy Run | goal pace | +113 to +145 | +70 to +90 | 65–75% max |
| Easy (E) | Easy Run w/ Strides | goal pace | +113 to +145 | +70 to +90 | 65–75% max |
| Threshold (T) | Tempo Run | goal pace | +13 to +24 | +8 to +15 | 82–88% max |
| Interval (I) | 6 × 800m (Build) | goal pace | −32 to −24 | −20 to −15 | 90–95% max |
| Interval (I) | 8 × 600m (Peak) | goal pace | −32 to −24 | −20 to −15 | 90–95% max |
| Interval (I) | 5 × 1000m (Peak) | goal pace | −10 to −5 | −6 to −3 | 88–93% max |
| Recovery (R) | Recovery Run | **current pace** | +144 to +192 | +89 to +119 | 60–65% max |
| Endurance (M) | Long Run | **current pace** | +97 to +145 | +60 to +90 | conversational |

**Tempo runs are slower than goal race pace**, not faster. In Daniels' system,
threshold pace sits between easy and race pace — comfortably hard but sustainable for
20–40 minutes. For 5K/10K runners, goal pace is faster than threshold, so tempo at
+8 to +15 sec/km slower than goal pace is correct.

**6×800m and 8×600m use the aggressive interval offset** (−20 to −15 sec/km) because
these are short, high-intensity repeats at 5K effort. **5×1000m uses a controlled
offset** (−6 to −3 sec/km) because these are longer reps targeting race pace — the
goal is even-effort splits, not maximal speed.

### Physiological framework

Pace zones are grounded in two research frameworks:

**Jack Daniels' VDOT** (*Daniels' Running Formula*, 3rd ed.):
- Derives training zones from a single race result (VDOT = VO2max proxy)
- Easy (E): 59–74% VO2max — aerobic base and recovery
- Threshold (T): 83–89% VO2max — raises lactate threshold
- Interval (I): 95–100% VO2max — develops VO2max ceiling
- The key insight: Easy runs must be genuinely slow. Intervals must be genuinely hard. Moderate "junk miles" produce the least adaptation per unit of fatigue.

**80/20 Running** (Fitzgerald / Seiler polarized model):
- ~80% of weekly volume at low intensity (Zone 1–2, conversational)
- ~20% at threshold or above
- Research shows this distribution outperforms moderate-heavy approaches across both elite and recreational runners

---

## 3. Fitness Level Multipliers

Fitness level (`fitnessCardio`) selects a column from the `PEAK_MILEAGE` and
`PEAK_LONG_RUN` lookup tables. These are absolute values, not multipliers applied
to user input. The tables are cross-referenced from `training-logic.md` — exact
values are authoritative there. The ratios below show relative scaling between levels.

### Weekly mileage ratios (10K as representative distance)

| | Beginner | Intermediate | Advanced |
|--|----------|--------------|---------|
| Peak weekly (mi) | 21 | 30 | 45 |
| vs beginner | 1.0× | 1.43× | 2.14× |
| vs intermediate | — | 1.0× | 1.50× |

### Long run ratios (10K as representative distance)

| | Beginner | Intermediate | Advanced |
|--|----------|--------------|---------|
| Peak long run (mi) | 6 | 9 | 12 |
| vs beginner | 1.0× | 1.50× | 2.00× |
| vs intermediate | — | 1.0× | 1.33× |

The ratios are not fixed across distances — marathon advanced peaks at 22 mi vs
beginner at 20 mi (only 1.1×), while 5K advanced peaks at 9 vs beginner at 5 (1.8×).
Use the full tables in `training-logic.md` for accurate per-distance values.

### Ambitious goal bump

When `improvementPct > 5%` and `fitnessCardio !== 'advanced'`, the workout-type
assignment promotes fitness one level:

```
beginner → intermediate   (adds tempo in Build/Peak)
intermediate → advanced   (adds intervals in Build/Peak)
```

This affects only the `qualityFitnessCardio` variable passed to `getWorkoutTypes`.
Mileage, long run distances, and all display labels remain at the user's stated level.

---

## 4. Goal Time Validation

Computed in `generateSchedule` after parsing `currentTime` and `goalTime`.

```js
improvementPct = (currentSecs − goalSecs) / currentSecs × 100
```

### Warning thresholds

| Condition | Warning level | Banner color | Suggested alternative |
|-----------|--------------|-------------|----------------------|
| `improvementPct > 15%` | `unrealistic` | Red | `currentSecs × 0.92` |
| `improvementPct > 8%` | `ambitious` | Orange | `currentSecs × 0.92` |
| `totalWeeks < 8` and `improvementPct > 5%` | `ambitious` | Orange | `currentSecs × 0.92` |
| `improvementPct ≤ 0` | `info` | Blue | *(no suggestion — goal is at or slower than current)* |
| `0 < improvementPct ≤ 8%` | *(no warning)* | — | — |

The suggested alternative time is always **8% improvement** from current:
`formatSeconds(round(currentSecs × 0.92))`. This sits at the top of what a focused
training cycle reliably delivers for most runners.

### Rationale for thresholds

- **3–8%**: typical improvement range per training cycle for a recreational runner
  following a structured plan
- **8–15%**: at the upper limit; achievable in ideal conditions but not the norm
- **>15%**: requires either a very long baseline (e.g. returning from injury) or
  would necessitate a multi-year development arc, not a single training block

### Effect on the plan

The warning is informational only — the plan is generated regardless. The user's goal
pace is used for quality session targeting. A warning does not modify distances,
phases, or workout types (except via the ambitious goal bump in § 3).

---

## 5. Strava Activity Matching Windows

`findRaceTime` matches recent Strava activities to the selected race distance using
meter-range windows. See: `STRAVA_RACE_WINDOWS` in `app.js`.

| Race | Window (meters) | Approx. tolerance |
|------|----------------|-------------------|
| 5K (5,000m) | 4,000 – 6,000 | −20% to +20% |
| 10K (10,000m) | 8,000 – 12,400 | −20% to +24% |
| Half (21,097m) | 18,000 – 24,000 | −15% to +14% |
| Marathon (42,195m) | 36,000 – 48,000 | −15% to +14% |

The windows are intentionally asymmetric for half and marathon because Strava GPS
distances cluster tightly around the certified course distance — a wide upper
tolerance catches overlong GPS traces while the lower bound excludes training runs.
The 10K upper bound of 12,400m (vs a strict ±20% value of 12,000m) provides a small
additional buffer for slightly long courses.

### Matching priority

1. **Race-tagged activities** (`workout_type === 1`) are preferred over regular runs
2. Among candidates, the **most recent** activity is selected
3. If no activity falls within the window, race time is left blank — no fallback to
   nearest distance
4. Custom race distances have no window defined — race time is always blank

---

## 6. VDOT Reference (Daniels)

The pace offsets in § 2 were derived from Daniels' VDOT tables. For reference, the
following representative VDOT values show how zones scale across fitness levels.
`app.js` does not use VDOT directly — it derives zones from the user's provided
race time, which is equivalent.

| Approximate fitness | 5K time | Easy pace | Tempo pace | 5K (I) pace |
|--------------------|---------|-----------|------------|-------------|
| Beginner | 30:00 | 7:55/km | 6:35/km | 5:50/km |
| Recreational | 25:00 | 6:55/km | 5:45/km | 5:05/km |
| Intermediate | 22:00 | 6:15/km | 5:10/km | 4:35/km |
| Competitive amateur | 19:00 | 5:25/km | 4:30/km | 3:58/km |

Pace zones scale continuously with the user's input time — the app produces a
personalized zone for each user rather than bucketing by fitness tier.
