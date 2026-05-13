# Injury Protocols Reference

Source of truth for injury assessment, rehab phase logic, and workout modifications
in `app.js`. When rules here conflict with the code, this file is authoritative.

---

## 1. Severity Classification

Every injury description resolves to one of four severity levels. Classification
uses the **Gemini API when an API key is provided**, falling back to **keyword
matching** when no key is present or the API call fails.

### Severity levels

| Level | Clinical meaning | Training impact |
|-------|-----------------|-----------------|
| `none` | General fatigue, vague post-race tiredness, fully resolved symptoms | No changes — full plan applied |
| `mild` | Tightness, soreness, overuse symptoms without structural concern; user-expressed uncertainty | Monitoring + targeted rehab exercises; training continues |
| `moderate` | Clear pain during activity, limited range of motion, confirmed overuse, persistent symptoms | Significant modifications; race date may shift |
| `severe` | Acute trauma: dislocation, fracture, torn tissue, inability to weight-bear | Medical clearance required; running replaced with cross-training |

---

## 2. Assessment Methods

### Method 1: Gemini API (primary)

`assessInjurySeverity(injuryText, apiKey)` sends the free-text injury description to
`gemini-2.0-flash` with a structured system prompt that returns JSON.

**Classification rules sent to the model:**

| Severity | Triggered by |
|----------|-------------|
| `none` | General fatigue, vague post-race tiredness, fully resolved symptoms |
| `mild` | Tightness, soreness, overuse WITHOUT structural concern; language like "maybe not an injury", "just soreness", "a bit tight", "from a race" |
| `moderate` | Clear pain during activity, limited ROM, confirmed overuse; words like "chronic", "limiting my running", "pain above 4/10" |
| `severe` | Structural terms: "dislocated", "torn", "can't walk", "fracture", "surgery", "severe pain" |

**Model bias rules:**
- Soreness/tightness after a race = `mild` at most, often `none`
- When uncertain between two levels, choose the lower one
- Structural terms always override to `severe`
- Always recommend physio for anything beyond mild soreness

**Gemini output shape:**
```json
{
  "severityLevel": "moderate",
  "injuryTypes": ["IT band syndrome"],
  "reasoning": "...",
  "raceDateAdjustment": 2,
  "avoidList": ["hill", "long run"],
  "modifications": ["Add hip strengthening; avoid cambered roads"],
  "rehabExercises": "Foam roll IT band 2–3 min each side..."
}
```

The `rehabExercises` field is used directly in schedule notes during the rehab phase,
replacing the static `REHAB_EXERCISES` lookup.

### Method 2: Keyword matching (fallback)

`parseInjuries(text)` runs when no API key is provided, or when the Gemini call
fails. `resolveInjuryProfile` catches all errors and falls back automatically.

**Step 1 — keyword scan:** scans lowercased input against `INJURY_KEYWORDS`
(see § 4). Any match is recorded; multiple matches are all applied.

**Step 2 — severity from match count and modifier words:**

```
0 keyword matches                               → none
1+ keyword matches                              → mild (base)
2+ keyword matches  OR  any moderateWord found  → moderate
any severeWord found                            → severe  (overrides moderate)
```

**moderateWords:** `significant`, `limiting`, `chronic`, `persistent`, `multiple`, `severe`

**severeWords:** `surgery`, `fracture`, `broken`, `torn`, `can't run`, `cannot run`,
`unable to run`, `non-weight`

---

## 3. Rehab Phase Progression

`getRehabPhase(weekNum, severity)` maps a 1-indexed forward-plan week number to one
of four phase labels. `weekNum` resets to 1 at the first non-historical week.

### Phase boundaries by severity

| Rehab phase | Mild | Moderate | Severe |
|-------------|------|----------|--------|
| **Acute** — strict avoidance | Week 1 | Weeks 1–2 | Weeks 1–4 |
| **Rehab** — targeted exercises | Week 2 | Weeks 3–4 | Weeks 5–8 |
| **Loading** — progressive return | Week 3 | Weeks 5–8 | Weeks 9–12 |
| **Full** — no restrictions | Week 4+ | Week 9+ | Week 13+ |

Moderate serves as the baseline. Mild compresses each band to one week. Severe
doubles each band relative to moderate.

### What each phase produces in schedule notes

`getInjuryNote(dayType, injuryProfile, weekNum)`:

| Rehab phase | Note content |
|-------------|-------------|
| `acute` | Avoidance instructions for the specific workout type (e.g. "Avoid downhill running and lateral movements"). Falls back to all modification notes if the workout type doesn't match any avoid list. |
| `rehab` | Named exercises from `rehabExercises` (Gemini-provided) or `REHAB_EXERCISES` lookup (keyword fallback). Prefixed with "Rehab:". |
| `loading` | "Progressive loading — monitor for discomfort, stop if pain exceeds 3/10" |
| `full` | No note — empty string returned |

---

## 4. Per-Injury Avoid Lists and Rehab Exercises

All entries are in `INJURY_KEYWORDS` (avoid + notes) and `REHAB_EXERCISES` (exercises)
in `app.js`. Keyword matching is case-insensitive substring search.

| Injury | Keywords matched | Avoid | Training note | Rehab exercises |
|--------|-----------------|-------|---------------|-----------------|
| **Knee** | `knee` | interval, hill, speed | Avoid downhill running and lateral movements | Terminal knee extensions 3×15, wall sits 3×30 sec, straight leg raises 3×15 |
| **Shin** | `shin` | interval, speed | Prefer soft surfaces; reduce pace | Calf raises 3×15, toe taps 3×20, shin stretches 3×30 sec |
| **IT Band** | `it band` | hill, long run | Add hip strengthening; avoid cambered roads | Foam roll IT band 2–3 min each side, hip abductions 3×15, banded lateral walks 3×15 |
| **Hip** | `hip` | hill, tempo | Reduce intensity; prioritise hip mobility | Clamshells 3×15, hip flexor stretches 3×30 sec, glute bridges 3×15 |
| **Back** | `back` | heavy, lift | Avoid loaded spinal compression; focus on core | Cat-cow 3×10, bird dog 3×10 each side, dead bug 3×10 each side |
| **Hamstring** | `hamstring` | interval, speed, tempo | No explosive efforts; ease into every run | Slow eccentric leg curls 3×8, hip hinges with dowel 3×10 |
| **Calf** | `calf` | speed, hill | Avoid uphills; reduce pace | Eccentric calf raises off step 3×15 (3 sec lower), calf stretches 3×30 sec |
| **Achilles** | `achilles` | speed, hill, interval | Avoid steep inclines; no sprinting | Eccentric heel drops off step 3×15, Achilles stretches 3×30 sec |
| **Plantar fascia** | `plantar` | speed, hill | Stretch calves and plantar fascia daily | Toe curls 3×15, towel scrunches, plantar fascia stretch 3×30 sec |
| **Ankle** | `ankle` | trail, uneven | Stick to flat even surfaces | Single-leg balance 3×30 sec, resistance band dorsiflexion 3×15 |
| **Stress fracture** | `stress fracture` | run, impact | No impact — cross-train only until medically cleared | *(none — cross-training only)* |
| **Fracture** | `fracture` | run, impact | No impact — cross-train only until medically cleared | *(none — cross-training only)* |
| **Piriformis / sciatic** | `piriformis`, `sciatic` | hill, speed, long run | Deep buttock pain may radiate down leg; avoid prolonged sitting between runs | Piriformis stretch 3×30 sec each side, hip internal/external rotations 3×15, glute bridges 3×15 |
| **Groin / adductor** | `groin`, `adductor` | speed, interval, hill | Avoid explosive push-off and wide strides; no rapid direction changes | Isometric adductor squeeze 3×15, standing adductor stretch 3×30 sec, resistance band side steps 3×15 |
| **Glute / gluteal** | `glute` | hill, speed | Outer hip or buttock pain; pelvic drop during running is a warning sign | Clamshells 3×15, banded lateral walks 3×15, hip abductions 3×15, single-leg glute bridge 3×12 |
| **Hip flexor / psoas** | `hip flexor`, `psoas` | hill, speed, interval | Pain at front of hip when extending leg back or lifting knee; sensitive to volume spikes | Hip flexor stretch 3×30 sec, reverse lunges 3×10, dead bug 3×10 each side |
| **Patellar tendon** | `patellar` | interval, speed, hill | Load-related pain just below the kneecap; distinct from patellofemoral (runner's knee) | Eccentric single-leg squats off step 3×15 (3 sec lower), quad stretches 3×30 sec, isometric wall sit 3×45 sec |
| **Peroneal** | `peroneal` | trail, uneven, speed | Outer ankle or lateral lower leg pain; often follows ankle sprains | Resistance band eversion 3×15, single-leg balance 3×30 sec, ankle circles 3×20 |
| **Morton's neuroma** | `neuroma` | speed, interval | Burning or tingling between 3rd and 4th toes; worse in narrow shoes or on hard surfaces | Toe splay exercises 3×15, intrinsic foot strengthening, soft tissue massage to ball of foot |
| **Sacroiliac joint** | `sacroiliac`, `si joint` | long run, hill, uneven | One-sided lower back or buttock pain; uneven surfaces and single-leg loading aggravate it | Clamshells 3×15, glute bridges 3×12, bird dog 3×10 each side, supine knee-to-chest stretch 3×30 sec |

**Multiple injuries:** all matched keyword entries are applied. Avoid lists are
unioned; rehab notes are joined with ` | `.

---

## 5. Race Date Adjustment

The race date is shifted forward to allow recovery time before the event.
`raceShiftDays` is computed in `generateSchedule`:

```js
raceShiftDays = injuryProfile.raceDateAdjustment != null
  ? injuryProfile.raceDateAdjustment * 7   // Gemini value takes precedence
  : severity === 'severe'   ? 28            // keyword fallback: 4 weeks
  : severity === 'moderate' ? 14            // keyword fallback: 2 weeks
  : 0
```

### Adjustment ranges by source

| Severity | Keyword fallback (fixed) | Gemini AI (range) |
|----------|------------------------|-------------------|
| `none` | 0 weeks | 0 weeks |
| `mild` | 0 weeks | 0 weeks |
| `moderate` | 2 weeks | 1–3 weeks (model judgment) |
| `severe` | 4 weeks | 4–8 weeks (model judgment) |

Gemini's value always takes precedence when present (`raceDateAdjustment != null`),
allowing finer-grained adjustment than the keyword fallback's two fixed values.

The adjustment extends the total plan length, since `totalWeeks` is recomputed from
the adjusted race date. The race day row note records the shift amount and the
injury keyword(s) that caused it.

---

## 6. Integration with Workout Type Assignment

Injury profile affects workout types in `getWorkoutTypes` through two mechanisms.

### Severity-based long run substitution

| `injuryProfile.severity` | Long run slot becomes |
|--------------------------|----------------------|
| `severe` | `Cross-Training (Long Effort)` |
| any (if avoiding `'long run'`) | `Long Run (moderate effort — see notes)` |
| all others | `Long Run` |

The `avoiding(keyword)` check: returns true if any entry in
`injuryProfile.modifications` has an `avoid` list containing a term that is a
substring of the workout type label (case-insensitive).

### Quality session suppression

If the injury's avoid list includes a quality session keyword, that session type is
skipped and replaced with `Easy Run`:

- Avoid `tempo` → Tempo Run replaced by Easy Run
- Avoid `interval` → Interval session replaced by Easy Run
- Avoid `stride` → Easy Run w/ Strides replaced by Easy Run

### Rehab phase lifting

Once the rehab phase reaches `loading` or `full`, workout-type assignment uses a
**clean injury profile** (`{ severity: 'none', modifications: [], keywords: [] }`):

```js
effForTypes = (rehabPhase === 'loading' || rehabPhase === 'full')
  ? { severity: 'none', modifications: [], keywords: [] }
  : eff
```

This stops cross-training substitutions and quality-session suppression from applying
indefinitely — the injury only restricts workouts during the acute and rehab windows.
Injury notes (`getInjuryNote`) continue using the real profile throughout.
