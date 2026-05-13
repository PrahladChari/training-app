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
