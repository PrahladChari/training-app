# Training Domain Knowledge

## Jack Daniels' VDOT Pace Zones

Daniels' system derives training zones from a single race result (VDOT = VO2max proxy). Each zone has a specific physiological purpose and a characteristic offset from race pace:

| Zone | Physiological role | Typical offset from 10K race pace |
|---|---|---|
| Easy (E) | Aerobic base, recovery | +70–90 sec/km slower |
| Threshold/Tempo (T) | Raise lactate threshold | +8–15 sec/km slower |
| Interval (I) | Improve VO2max | −15–20 sec/km faster (≈ 5K effort) |
| Race pace (I, long) | Race-specific lactate clearance | −3–6 sec/km faster |

The key insight: Easy runs must be genuinely slow (most runners run them too fast). Intervals must be genuinely hard. Moderate "junk miles" at in-between intensity are the least productive use of training time.

---

## 80/20 Running (Fitzgerald/Seiler)

The polarized model says ~80% of weekly volume should be at low intensity (Zone 1–2, fully conversational) and ~20% at high intensity (threshold or above). Research on elite and recreational runners alike shows this distribution produces better adaptations than the moderate-heavy approach most recreational runners default to. The practical implication: if a runner feels like their easy days are "too easy," that's correct — the easy days exist to absorb the stress of the hard days, not to add more stimulus.

---

## Why Arbitrary Mileage Numbers Break Down

Invented mileage caps feel reasonable until you compare them to published plans. A beginner half marathon runner doing a 15-mile long run sounds like a lot — and it is: Hal Higdon's Novice 1 half marathon plan peaks at 10 miles, which is already 77% of the race distance. Training instincts borrowed from marathon planning (where 20-mile long runs are standard) don't transfer to shorter distances.

---

## The Multiplier Formula Problem

A formula like `peak_long_run = race_distance × multiplier` produces reasonable numbers at marathon distance (where a hard cap saves it) but breaks badly for shorter races. A 1.2× multiplier on a half marathon gives 15.7 miles — higher than what Higdon prescribes for *intermediate* runners. The formula ignores that the relationship between long run and race distance isn't linear: a 5K runner needs a long run that builds aerobic capacity, not one that scales with 5K distance.

**This approach was evaluated and rejected.** The named-source lookup table is more accurate and auditable. See `training-logic.md — Long run distance` for the current values.

---

## The Three-Source Hierarchy

When evaluating training prescriptions, sources aren't equally authoritative for all runner types:

- **Hal Higdon**: best reference for recreational beginners and intermediates — plans are explicitly designed for that population, and the week-by-week schedules are publicly available and verifiable
- **Pfitzinger** (*Faster Road Racing*, *Advanced Marathoning*): best reference for serious amateurs and advanced runners — higher volume, more complex periodization, assumes a real aerobic base
- **Jack Daniels** (*Running Formula*): best for understanding the physiology (VDOT, pace zones, time caps) — his plans are highly individualized and less prescriptive about fixed distances

For a tool targeting recreational runners across all levels, Higdon's published schedules are the most reliable anchor. Pfitzinger fills in the advanced cells where Higdon's plans are less detailed.

---

## Verifying Numbers Before Using Them

Peak long run values should be verified against actual plan schedules, not just the book's summary pages. Higdon's Novice 1 half marathon long run truly does peak at 10 miles — that's Week 11 of a 12-week plan, one week before race day. Any generated plan that prescribes higher should be questioned.

The same applies to peak weekly mileage: the `PEAK_MILEAGE` table in `app.js` is attributed to Hal Higdon (beginner/intermediate) and Nike Run Club (advanced). If those numbers are ever updated, check them against the source plans, not just against each other.

---

## Why Keyword Matching Fails for Injury Severity

Keyword matching treats every mention of "knee" the same regardless of context. "Slight knee soreness after a hard race" and "dislocated knee" both match the `knee` keyword and historically both produced `moderate` severity. The fundamental problem: severity isn't about which body part is mentioned — it's about the nature and acuity of the problem. Only a language model can make that distinction reliably from free text.

The keyword fallback (used when no Gemini API key is provided) is still useful for identifying *which* injury type is mentioned and applying the corresponding avoid list and rehab exercises — but severity classification from keywords alone is inherently coarse.

---

## Research Domain Protocols, Don't Guess Numbers *(2026-05-17)*

### The problem with intuitive thresholds

When implementing the check-in underperformance adjustments, the obvious temptation is to pick round numbers that "feel right": cut mileage by 20% if the user missed half their sessions, hold for a week if they missed one. But intuitive numbers in a health domain carry real risk — a plan that ramps too aggressively after underperformance increases injury risk; one that backs off too conservatively kills fitness adaptation before the race.

### What the research actually says

The adjustment protocol used in `applyCheckinAdjustments` was grounded in documented principles rather than invented:

**80% completion threshold**: Coaches and exercise scientists treat ~80% session completion as the boundary between "normal variation" (life happens, skip a run) and "the training load is mismatched to the athlete." Below 80% consistently signals a structural problem — the prescribed load is too high for the athlete's current recovery capacity.

**10% mileage reduction for sustained underperformance**: The same 10% figure from the injury-prevention literature (don't increase more than 10% per week) applies in reverse: a 10% downward adjustment is a meaningful but non-destructive correction. Cutting 20–30% wastes weeks of accumulated fitness; cutting 5% is noise.

**One frozen week, not a full restart**: Holding week N+1 at the same mileage as week N gives the body one additional recovery stimulus without abandoning the plan progression. This is analogous to adding an unplanned cutback week — standard coaching practice when an athlete shows signs of overreaching.

**Downgrade quality sessions before downgrading volume**: When both a quality session was missed and completion is low, the safest next step is to replace the *first* easy run with a Recovery Run. Volume stays the same; intensity is briefly reduced. This follows the "reduce intensity before reducing volume" principle — aerobic base is preserved while fatigue is managed.

### How to apply this going forward

Before choosing a threshold or correction magnitude in any health or fitness feature:

1. **Name the principle first.** Can you state in one sentence the physiological or coaching rationale for the number?
2. **Find a published reference.** Higdon, Pfitzinger, Daniels, or peer-reviewed exercise science — any of these beats intuition.
3. **Document the rejected alternative.** If you considered a different threshold and rejected it (e.g. 70% vs. 80%, 15% mileage cut vs. 10%), write down why in the knowledge file. Future maintainers will otherwise re-derive the same question.

The same discipline that produced the `PEAK_LONG_RUN` lookup table (see `training-domain.md — The Multiplier Formula Problem`) should govern every domain-specific threshold in the app.
