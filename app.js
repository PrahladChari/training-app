// ── Schedule Generation ───────────────────────────────────────

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

// Last entry in each array is always the long-run slot (Saturday)
const RUN_SLOTS = {
  1: [5],
  2: [2, 5],
  3: [0, 3, 5],
  4: [0, 2, 4, 5],
  5: [0, 1, 3, 5, 6],
  6: [0, 1, 2, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getMonday(date) {
  const d = new Date(date);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d;
}

// ── Injury Parsing ────────────────────────────────────────────
// See: injury-protocols.md — Keyword matching (§ 2)
const INJURY_KEYWORDS = {
  'knee':            { avoid: ['interval', 'hill', 'speed'],          note: 'Avoid downhill running and lateral movements' },
  'shin':            { avoid: ['interval', 'speed'],                   note: 'Prefer soft surfaces; reduce pace' },
  'it band':         { avoid: ['hill', 'long run'],                    note: 'Add hip strengthening; avoid cambered roads' },
  'hip':             { avoid: ['hill', 'tempo'],                       note: 'Reduce intensity; prioritise hip mobility' },
  'back':            { avoid: ['heavy', 'lift'],                       note: 'Avoid loaded spinal compression; focus on core' },
  'plantar':         { avoid: ['speed', 'hill'],                       note: 'Stretch calves and plantar fascia daily' },
  'ankle':           { avoid: ['trail', 'uneven'],                     note: 'Stick to flat even surfaces' },
  'hamstring':       { avoid: ['interval', 'speed', 'tempo'],          note: 'No explosive efforts; ease into every run' },
  'calf':            { avoid: ['speed', 'hill'],                       note: 'Avoid uphills; reduce pace' },
  'achilles':        { avoid: ['speed', 'hill', 'interval'],           note: 'Avoid steep inclines; no sprinting' },
  'stress fracture': { avoid: ['run', 'impact'],                       note: 'No impact — cross-train only until medically cleared' },
  'fracture':        { avoid: ['run', 'impact'],                       note: 'No impact — cross-train only until medically cleared' },
  'piriformis':      { avoid: ['hill', 'speed', 'long run'],           note: 'Deep buttock pain may radiate down leg; avoid prolonged sitting between runs' },
  'sciatic':         { avoid: ['hill', 'speed', 'long run'],           note: 'Deep buttock pain may radiate down leg; avoid prolonged sitting between runs' },
  'groin':           { avoid: ['speed', 'interval', 'hill'],           note: 'Avoid explosive push-off and wide strides; no rapid direction changes' },
  'adductor':        { avoid: ['speed', 'interval', 'hill'],           note: 'Avoid explosive push-off and wide strides; no rapid direction changes' },
  'glute':           { avoid: ['hill', 'speed'],                       note: 'Outer hip or buttock pain; pelvic drop during running is a warning sign' },
  'hip flexor':      { avoid: ['hill', 'speed', 'interval'],           note: 'Pain at front of hip when extending leg back or lifting knee; sensitive to volume spikes' },
  'psoas':           { avoid: ['hill', 'speed', 'interval'],           note: 'Pain at front of hip when extending leg back or lifting knee; sensitive to volume spikes' },
  'patellar':        { avoid: ['interval', 'speed', 'hill'],           note: 'Load-related pain just below the kneecap; distinct from patellofemoral (runner\'s knee)' },
  'peroneal':        { avoid: ['trail', 'uneven', 'speed'],            note: 'Outer ankle or lateral lower leg pain; often follows ankle sprains' },
  'neuroma':         { avoid: ['speed', 'interval'],                   note: 'Burning or tingling between 3rd and 4th toes; worse in narrow shoes or on hard surfaces' },
  'sacroiliac':      { avoid: ['long run', 'hill', 'uneven'],          note: 'One-sided lower back or buttock pain; uneven surfaces and single-leg loading aggravate it' },
  'si joint':        { avoid: ['long run', 'hill', 'uneven'],          note: 'One-sided lower back or buttock pain; uneven surfaces and single-leg loading aggravate it' },
};

function parseInjuries(text) {
  if (!text || !text.trim()) return { severity: 'none', modifications: [], keywords: [] };
  const lower = text.toLowerCase();
  const found = [], mods = [];
  for (const [kw, mod] of Object.entries(INJURY_KEYWORDS)) {
    if (lower.includes(kw)) { found.push(kw); mods.push(mod); }
  }
  const severeWords   = ['surgery','fracture','broken','torn',"can't run",'cannot run','unable to run','non-weight'];
  const moderateWords = ['significant','limiting','chronic','persistent','multiple','severe'];
  let severity = found.length > 0 ? 'mild' : 'none';
  if (found.length >= 2 || moderateWords.some(w => lower.includes(w))) severity = 'moderate';
  if (severeWords.some(w => lower.includes(w)))                         severity = 'severe';
  return { severity, modifications: mods, keywords: found };
}

// ── Rehab Data & Phase Logic ──────────────────────────────────
// See: injury-protocols.md — Per-injury avoid lists and rehab exercises (§ 4)
const REHAB_EXERCISES = {
  'knee':      'Terminal knee extensions 3×15, wall sits 3×30 sec, straight leg raises 3×15',
  'shin':      'Calf raises 3×15, toe taps 3×20, shin stretches 3×30 sec',
  'it band':   'Foam roll IT band 2–3 min each side, hip abductions 3×15, banded lateral walks 3×15',
  'hip':       'Clamshells 3×15, hip flexor stretches 3×30 sec, glute bridges 3×15',
  'back':      'Cat-cow 3×10, bird dog 3×10 each side, dead bug 3×10 each side',
  'hamstring': 'Slow eccentric leg curls 3×8, hip hinges with dowel 3×10',
  'calf':      'Eccentric calf raises off step 3×15 (3 sec lower), calf stretches 3×30 sec',
  'achilles':  'Eccentric heel drops off step 3×15, Achilles stretches 3×30 sec',
  'plantar':   'Toe curls 3×15, towel scrunches, plantar fascia stretch 3×30 sec',
  'ankle':      'Single-leg balance 3×30 sec, resistance band dorsiflexion 3×15',
  'piriformis': 'Piriformis stretch 3×30 sec each side, hip internal/external rotations 3×15, glute bridges 3×15',
  'sciatic':    'Piriformis stretch 3×30 sec each side, hip internal/external rotations 3×15, glute bridges 3×15',
  'groin':      'Isometric adductor squeeze 3×15, standing adductor stretch 3×30 sec, resistance band side steps 3×15',
  'adductor':   'Isometric adductor squeeze 3×15, standing adductor stretch 3×30 sec, resistance band side steps 3×15',
  'glute':      'Clamshells 3×15, banded lateral walks 3×15, hip abductions 3×15, single-leg glute bridge 3×12',
  'hip flexor': 'Hip flexor stretch 3×30 sec, reverse lunges 3×10, dead bug 3×10 each side',
  'psoas':      'Hip flexor stretch 3×30 sec, reverse lunges 3×10, dead bug 3×10 each side',
  'patellar':   'Eccentric single-leg squats off step 3×15 (3 sec lower), quad stretches 3×30 sec, isometric wall sit 3×45 sec',
  'peroneal':   'Resistance band eversion 3×15, single-leg balance 3×30 sec, ankle circles 3×20',
  'neuroma':    'Toe splay exercises 3×15, intrinsic foot strengthening, soft tissue massage to ball of foot',
  'sacroiliac': 'Clamshells 3×15, glute bridges 3×12, bird dog 3×10 each side, supine knee-to-chest stretch 3×30 sec',
  'si joint':   'Clamshells 3×15, glute bridges 3×12, bird dog 3×10 each side, supine knee-to-chest stretch 3×30 sec',
};

// See: injury-protocols.md — Rehab phase progression (§ 3)
// weekNum is 1-indexed from the first forward (non-historical) week
function getRehabPhase(weekNum, severity) {
  const bounds = {
    mild:     { acute: 1, rehab: 2,  loading: 3  },
    moderate: { acute: 2, rehab: 4,  loading: 8  },
    severe:   { acute: 4, rehab: 8,  loading: 12 },
  }[severity] || { acute: 2, rehab: 4, loading: 8 };

  if (weekNum <= bounds.acute)   return 'acute';
  if (weekNum <= bounds.rehab)   return 'rehab';
  if (weekNum <= bounds.loading) return 'loading';
  return 'full';
}

// ── Phases ────────────────────────────────────────────────────
// See: training-logic.md — Phase structure (§ 1)
function calculatePhases(totalWeeks) {
  if (totalWeeks <= 3) return { base: 0, build: 0, peak: 1, taper: Math.max(0, totalWeeks - 1) };
  const taper = totalWeeks > 10
    ? Math.max(2, Math.round(totalWeeks * 0.10))
    : Math.max(1, Math.round(totalWeeks * 0.10));
  const peak  = Math.max(1, Math.round(totalWeeks * 0.20));
  const base  = Math.round(totalWeeks * 0.35);
  const build = Math.max(1, totalWeeks - base - peak - taper);
  return { base, build, peak, taper };
}

function getPhaseForWeek(weekIdx, phases) {
  let i = weekIdx;
  if (i < phases.base)  return { name: 'Base',  indexInPhase: i, totalInPhase: phases.base };
  i -= phases.base;
  if (i < phases.build) return { name: 'Build', indexInPhase: i, totalInPhase: phases.build };
  i -= phases.build;
  if (i < phases.peak)  return { name: 'Peak',  indexInPhase: i, totalInPhase: phases.peak };
  i -= phases.peak;
  return { name: 'Taper', indexInPhase: i, totalInPhase: phases.taper };
}

function isCutbackWeek(weekIdx, phases) {
  const p = getPhaseForWeek(weekIdx, phases);
  if (p.name === 'Peak' || p.name === 'Taper') return false;
  return (p.indexInPhase + 1) % 4 === 0;
}

// ── Mileage Tables ────────────────────────────────────────────
// See: training-logic.md — Weekly mileage progression and peak mileage tables (§ 2)
// Peak weekly mileage (miles) — based on Hal Higdon, Nike Run Club, standard plans
const PEAK_MILEAGE = {
  '5k':     { beginner: 16, intermediate: 25, advanced: 35 },
  '10k':    { beginner: 21, intermediate: 30, advanced: 45 },
  'half':   { beginner: 28, intermediate: 40, advanced: 55 },
  'full':   { beginner: 40, intermediate: 55, advanced: 70 },
  'custom': { beginner: 25, intermediate: 38, advanced: 55 },
};

// Peak long run distances (miles) — anchored to Hal Higdon (novice/intermediate),
// Pfitzinger Faster Road Racing (advanced shorter distances),
// and Pfitzinger Advanced Marathoning / Higdon Advanced (marathon).
const PEAK_LONG_RUN = {
  '5k':     { beginner: 5,  intermediate: 7,  advanced: 9  },
  '10k':    { beginner: 6,  intermediate: 9,  advanced: 12 },
  'half':   { beginner: 10, intermediate: 13, advanced: 15 },
  'full':   { beginner: 20, intermediate: 20, advanced: 22 },
  'custom': { beginner: 10, intermediate: 13, advanced: 15 },
};

function calcPeakLongRun(distance, fitnessCardio) {
  return (PEAK_LONG_RUN[distance] || PEAK_LONG_RUN['half'])[fitnessCardio] || 10;
}

function getPeakMileage(distance, fitnessCardio) {
  return (PEAK_MILEAGE[distance] || PEAK_MILEAGE['half'])[fitnessCardio] || 35;
}

function calcWeeklyMileage(weekIdx, phases, startMileage, peakMileage) {
  const p = getPhaseForWeek(weekIdx, phases);
  const prog = p.totalInPhase > 1 ? p.indexInPhase / (p.totalInPhase - 1) : 1;
  const buildStart = Math.max(startMileage, peakMileage * 0.60);
  let target;
  switch (p.name) {
    case 'Base':  target = startMileage + (buildStart - startMileage) * prog; break;
    case 'Build': target = buildStart   + (peakMileage - buildStart)  * prog; break;
    case 'Peak':  target = peakMileage  * (1 - 0.05 * prog);                  break;
    case 'Taper': target = peakMileage  * (0.80 - 0.30 * prog);               break;
    default:      target = startMileage;
  }
  if (isCutbackWeek(weekIdx, phases)) target *= 0.80;
  return Math.max(startMileage * 0.75, Math.round(target * 2) / 2);
}

// See: training-logic.md — Long run distance (§ 3)
function calcLongRunDist(weekIdx, phases, distance, fitnessCardio) {
  const p   = getPhaseForWeek(weekIdx, phases);
  const max = calcPeakLongRun(distance, fitnessCardio);

  if (p.name === 'Taper') {
    const prog = p.totalInPhase > 1 ? p.indexInPhase / (p.totalInPhase - 1) : 1;
    return Math.max(3, Math.round(max * (0.50 - 0.15 * prog) * 2) / 2);
  }

  // Base → Build → Peak: linear ramp from 60% (first week of Base) to 100% (last week of Peak)
  const totalNonTaper = phases.base + phases.build + phases.peak;
  const phaseOffset   = p.name === 'Base' ? 0
    : p.name === 'Build' ? phases.base
    : phases.base + phases.build;
  const globalIdx  = phaseOffset + p.indexInPhase;
  const globalProg = totalNonTaper > 1 ? globalIdx / (totalNonTaper - 1) : 1;
  return Math.max(3, Math.round(max * (0.60 + 0.40 * globalProg) * 2) / 2);
}

// ── Pace Utilities ────────────────────────────────────────────
// See: race-standards.md — Race distance constants and pace zone definitions (§ 1–2)
const DIST_MILES = { '5k': 3.10686, '10k': 6.21371, 'half': 13.1094, 'full': 26.2188 };

function parseTime(str) {
  if (!str || !str.trim()) return null;
  const parts = str.trim().split(':').map(Number);
  if (parts.some(isNaN) || parts.length < 2 || parts.length > 3) return null;
  return parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts[0] * 60 + parts[1];
}

function getRacePaceSec(timeStr, distKey) {
  const secs  = parseTime(timeStr);
  const miles = DIST_MILES[distKey];
  return (secs && miles) ? secs / miles : null; // seconds per mile
}

function formatPace(secPerMile, units) {
  const s   = units === 'metric' ? secPerMile / 1.60934 : secPerMile;
  const min = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${min}:${String(sec).padStart(2, '0')}${units === 'metric' ? '/km' : '/mi'}`;
}

function formatSeconds(totalSecs) {
  totalSecs = Math.round(totalSecs);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Workout Types ─────────────────────────────────────────────
// See: training-logic.md — Workout type assignment (§ 4)
function getWorkoutTypes(phase, fitnessCardio, numRunSlots, injuryProfile) {
  const avoiding = kw => injuryProfile.modifications.some(m =>
    m.avoid.some(a => kw.toLowerCase().includes(a.toLowerCase()))
  );
  const types = [];
  for (let i = 0; i < numRunSlots - 1; i++) {
    if (phase.name === 'Taper') {
      types.push(i === 0 ? 'Recovery Run' : 'Easy Run');
    } else if (i === 0 && phase.name !== 'Base' && fitnessCardio !== 'beginner' && !avoiding('tempo')) {
      types.push('Tempo Run');
    } else if (i === 0 && phase.name === 'Base' && fitnessCardio === 'advanced' && !avoiding('stride')) {
      types.push('Easy Run w/ Strides');
    } else if (i === 1 && phase.name === 'Build' && fitnessCardio !== 'beginner' && !avoiding('interval')) {
      types.push('Interval — 6 × 800m');
    } else if (i === 1 && phase.name === 'Peak' && fitnessCardio !== 'beginner' && !avoiding('interval')) {
      types.push(phase.indexInPhase % 2 === 0 ? 'Interval — 8 × 600m' : 'Interval — 5 × 1000m');
    } else {
      types.push('Easy Run');
    }
  }
  // Long run (last slot)
  if (injuryProfile.severity === 'severe') {
    types.push('Cross-Training (Long Effort)');
  } else if (avoiding('long run')) {
    types.push('Long Run (moderate effort — see notes)');
  } else {
    types.push('Long Run');
  }
  return types;
}

// ── Distance / Duration Labels ────────────────────────────────
function getDistLabel(dayType, weeklyMiles, numRunSlots, longRunMiles, units, fitnessCardio, phaseName) {
  const toDisplay = mi => {
    const val = units === 'metric' ? Math.round(mi * 1.60934 * 2) / 2 : Math.round(mi * 2) / 2;
    return `${val} ${units === 'metric' ? 'km' : 'mi'}`;
  };
  const dt = dayType.toLowerCase();
  if (dt.includes('rest'))       return '—';
  if (dt.includes('cross'))      return '45–60 min';
  if (dt.includes('long run'))   return toDisplay(longRunMiles);
  if (dt.includes('recovery'))   return toDisplay(Math.max(2, Math.round((weeklyMiles / numRunSlots) * 0.55 * 2) / 2));
  if (dt.includes('tempo'))      return toDisplay(Math.max(2, Math.round((weeklyMiles / numRunSlots) * 0.75 * 2) / 2));
  if (dt.includes('6 × 800m'))  return '6 × 800m w/ 90 s rest';
  if (dt.includes('8 × 600m'))  return '8 × 600m w/ 90 s rest';
  if (dt.includes('5 × 1000m')) return '5 × 1000m w/ 2 min rest';
  if (dt.includes('interval'))  return '6 × 800m w/ 90 s rest';
  // Easy / strides: use proportional formula in taper (long run drops 50% while weekly mileage
  // drops only 20%, making the subtraction formula inflate easy runs to nonsensical values).
  // Secondary safeguard: if subtraction formula would exceed the long run distance, use
  // proportional formula instead — an easy run can never be longer than the long run.
  const rawEasy = Math.max(2, Math.round(((weeklyMiles - longRunMiles) / Math.max(1, numRunSlots - 1)) * 2) / 2);
  if (phaseName === 'Taper' || rawEasy > longRunMiles) {
    return toDisplay(Math.max(2, Math.round((weeklyMiles / numRunSlots) * 0.65 * 2) / 2));
  }
  return toDisplay(rawEasy);
}

function getStrengthLabel() { return '45–60 min'; }

// ── Injury Notes ──────────────────────────────────────────────
// See: injury-protocols.md — Rehab phase progression, what each phase produces (§ 3)
function getInjuryNote(dayType, injuryProfile, weekNum) {
  if (injuryProfile.severity === 'none') return '';

  const phase = getRehabPhase(weekNum, injuryProfile.severity);
  if (phase === 'full') return '';

  const dt = dayType.toLowerCase();

  if (phase === 'acute') {
    const relevant = injuryProfile.modifications.filter(m =>
      m.avoid.some(a => dt.includes(a.toLowerCase()))
    );
    const pool = relevant.length > 0 ? relevant : injuryProfile.modifications;
    return [...new Set(pool.map(m => m.note))].join(' | ');
  }

  if (phase === 'rehab') {
    const exercises = injuryProfile.rehabExercises
      || injuryProfile.keywords.map(kw => REHAB_EXERCISES[kw]).filter(Boolean).join(' | ');
    return exercises
      ? `Rehab: ${exercises}`
      : 'Perform prescribed rehab exercises — consult a physio for your specific protocol';
  }

  if (phase === 'loading') {
    return 'Progressive loading — monitor for discomfort, stop if pain exceeds 3/10';
  }

  return '';
}

// ── Session Guidance ──────────────────────────────────────────
// See: race-standards.md — Pace zone definitions (§ 2)
// Pace offsets are in sec/mile (Daniels VDOT zones, relative to goal race pace):
//   Easy:          +113 to +145 sec/mile (+70 to +90 sec/km)
//   Tempo:          +13 to  +24 sec/mile  (+8 to +15 sec/km)
//   Interval 800m:  -32 to  -24 sec/mile (-20 to -15 sec/km)  ← 5K effort, aggressive
//   Interval 1000m: -10 to   -5 sec/mile  (-6 to  -3 sec/km)  ← race pace, controlled
//   Recovery:      +144 to +192 sec/mile (keyed to current fitness pace)
//   Long run:       +97 to +145 sec/mile  (+60 to +90 sec/km)
function getSessionGuidance(dayType, phaseName, fitnessCardio, fitnessStrength, racePaceSec, goalPaceSec, units) {
  const dt = dayType.toLowerCase();
  const qualityBase = goalPaceSec ?? racePaceSec;
  const currentBase = racePaceSec ?? goalPaceSec;
  const hasQuality  = qualityBase != null;
  const hasCurrent  = currentBase != null;

  const pr = (base, lo, hi) => `${formatPace(base + lo, units)}–${formatPace(base + hi, units)}`;

  if (dt === 'rest') {
    return 'Full rest. Prioritise sleep and nutrition. Light walking or gentle stretching is fine.';
  }

  if (dt.includes('cross')) {
    return 'Low-impact aerobic work — cycling, swimming, elliptical, or rowing at easy conversational effort (Zone 1–2). Maintain fitness without stressing the injured area.';
  }

  if (dt.includes('recovery run')) {
    const p = hasCurrent ? ` Target ${pr(currentBase, 144, 192)}.` : '';
    return `Very easy — Zone 1 (60–65% max HR).${p} Purposely slower than your normal easy pace. Goal: flush fatigue, not build fitness.`;
  }

  if (dt.includes('easy run') && dt.includes('stride')) {
    const p = hasQuality ? ` Easy portion: ${pr(qualityBase, 113, 145)}.` : '';
    return `Easy aerobic run with strides.${p} In the final 10 min: 4–6 × 20 sec smooth accelerations near mile effort, with 60–90 sec walk/jog recovery between each. Stay relaxed — not a full sprint.`;
  }

  if (dt.includes('easy run')) {
    const p = hasQuality ? ` Target ${pr(qualityBase, 113, 145)}.` : '';
    const phaseNote = {
      Base:  'Focus on building aerobic base — effort matters more than pace.',
      Build: 'Keep truly easy on easy days to balance your quality sessions.',
      Peak:  'Stay conservative — save your legs for quality sessions.',
      Taper: 'Very easy — let your body absorb the training load.',
    }[phaseName] || '';
    return `Zone 2 effort — fully conversational, 65–75% max HR.${p} ${phaseNote}`;
  }

  if (dt.includes('tempo')) {
    const p = hasQuality ? ` Target ${pr(qualityBase, 13, 24)}.` : '';
    const dur = { Base: '15–20 min', Build: '20–30 min', Peak: '25–40 min' }[phaseName] || '20–30 min';
    return `Comfortably hard — 82–88% max HR, short sentences only.${p} Warm up 10–15 min easy, hold steady tempo for ${dur}, cool down 10 min. If pace drops sharply, ease off rather than forcing it.`;
  }

  if (dt.includes('6 × 800m')) {
    const p = hasQuality ? ` Target ${pr(qualityBase, -32, -24)} per rep.` : '';
    return `6 × 800m at 5K effort — 90–95% max HR.${p} 90 sec recovery jog between reps. Warm up 10–15 min easy beforehand. Stop if form breaks down significantly.`;
  }

  if (dt.includes('8 × 600m')) {
    const p = hasQuality ? ` Target ${pr(qualityBase, -32, -24)} per rep.` : '';
    return `8 × 600m at race pace — 90–95% max HR.${p} 90 sec recovery jog between reps. Warm up 10–15 min easy beforehand. Focus on maintaining consistent splits.`;
  }

  if (dt.includes('5 × 1000m')) {
    const p = hasQuality ? ` Target ${pr(qualityBase, -10, -5)} per rep.` : '';
    return `5 × 1000m at race pace — 88–93% max HR.${p} 2 min recovery jog between reps. Warm up 10–15 min easy beforehand. Aim for even-effort splits across all reps.`;
  }

  if (dt.includes('interval')) {
    const p = hasQuality ? ` Target ${pr(qualityBase, -32, -24)} per rep.` : '';
    return `Intervals at 5K effort — 90–95% max HR.${p} 90 sec recovery jog between reps. Warm up 10–15 min easy beforehand.`;
  }

  if (dt.includes('long run')) {
    const p = hasCurrent ? ` Target ${pr(currentBase, 97, 145)}.` : '';
    const fuel = phaseName === 'Base'
      ? 'No fueling needed if under 75 min. Hydrate every 20–25 min.'
      : phaseName === 'Build'
      ? 'Gel or chews every 40–45 min once over 75 min. Hydrate every 20 min.'
      : 'Practice full race-day fueling — gel every 30–40 min, hydrate every 20 min.';
    const effort = phaseName === 'Peak'
      ? 'Start easy. Run the final 20–30 min at goal race effort if feeling strong.'
      : 'Conversational effort throughout — builds fat-burning efficiency and mental durability.';
    return `${effort}${p} ${fuel}`;
  }

  if (dt.includes('strength')) {
    return '';
  }

  return '';
}

// ── AI Injury Assessment ──────────────────────────────────────
// See: injury-protocols.md — Assessment methods, Gemini API (§ 2)
async function assessInjurySeverity(injuryText, apiKey) {
  const SYSTEM_PROMPT = `You are a sports medicine assistant evaluating a runner's self-reported injury or discomfort to generate conservative training plan modifications.

Return ONLY valid JSON with exactly this structure — no markdown, no explanation, no wrapping text:
{
  "severityLevel": "none",
  "injuryTypes": ["list of identified issues in plain language"],
  "reasoning": "1-2 sentence explanation of your severity assessment",
  "raceDateAdjustment": 0,
  "avoidList": ["workout types to restrict, e.g. interval, hill, tempo, long run"],
  "modifications": ["specific training modifications, e.g. Avoid downhill running"],
  "rehabExercises": "specific exercises with sets and reps appropriate for the identified issues"
}

severityLevel rules:
- "none"     : general fatigue, vague post-race tiredness, fully resolved symptoms. No training changes needed.
- "mild"     : tightness, soreness, overuse symptoms WITHOUT structural concern, or user-expressed uncertainty ("maybe not an injury", "just soreness", "a bit tight", "from a race"). Needs monitoring and targeted exercises but doesn't significantly limit training.
- "moderate" : clear pain during activity, limited range of motion, confirmed overuse injury, or persistent symptoms ("chronic", "limiting my running", "pain above 4/10"). Significant training modifications required.
- "severe"   : acute trauma, dislocation, fracture, torn tissue, inability to weight-bear ("dislocated", "torn", "can't walk", "fracture", "surgery", "severe pain"). Medical clearance required before return to running.

raceDateAdjustment (integer weeks):
  none/mild  → 0
  moderate   → 1 to 3 based on your judgment
  severe     → 4 to 8 based on your judgment

Key distinctions:
- Soreness and tightness after a race = mild at most, often none
- Language like "maybe", "not sure if it's an injury", "just" = lean toward none/mild
- Structural terms (dislocation, fracture, torn, surgery) = always severe
- If uncertain between two levels, choose the lower one
- Always include a physio recommendation in reasoning for anything beyond mild soreness`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: injuryText }] }],
        generationConfig: {
          response_mime_type: 'application/json',
          maxOutputTokens: 600,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`API ${response.status}: ${err.error?.message || response.statusText}`);
  }
  const data    = await response.json();
  const rawText = data.candidates[0].content.parts[0].text;
  // Strip markdown code fences if the model wrapped the JSON anyway
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(cleaned);
}

function mapClaudeResponse(parsed) {
  return {
    severity:           parsed.severityLevel || 'none',
    modifications:      [{ avoid: parsed.avoidList || [], note: (parsed.modifications || []).join('. ') }],
    keywords:           parsed.injuryTypes   || [],
    rehabExercises:     parsed.rehabExercises || '',
    raceDateAdjustment: typeof parsed.raceDateAdjustment === 'number' ? parsed.raceDateAdjustment : null,
    reasoning:          parsed.reasoning     || '',
    source:             'claude',
  };
}

async function resolveInjuryProfile(injuryText, apiKey) {
  if (!injuryText.trim()) return { severity: 'none', modifications: [], keywords: [] };
  if (!apiKey.trim())     return parseInjuries(injuryText);
  try {
    const parsed = await assessInjurySeverity(injuryText, apiKey);
    return mapClaudeResponse(parsed);
  } catch (err) {
    console.warn('Claude injury assessment failed — falling back to keyword matching:', err.message);
    return parseInjuries(injuryText);
  }
}

// ── Main Generator ────────────────────────────────────────────
function generateSchedule(inputs) {
  const { raceDate, raceDistance, customDistance, weeklyMileage,
          trainingStartDate, runDays, strengthDays,
          fitnessCardio, fitnessStrength, injuries, units,
          currentTime, goalTime,
          _planId, _peakMileageMultiplier = 1.0, _freezeFirstWeek = false } = inputs;

  // Always work internally in miles; display converts to km when metric
  const startMileage  = units === 'metric' ? weeklyMileage / 1.60934 : weeklyMileage;
  const currentSecs   = parseTime(currentTime);
  const goalSecs      = parseTime(goalTime);
  const distMiles     = DIST_MILES[raceDistance];
  const racePaceSec   = (currentSecs && distMiles) ? currentSecs / distMiles : null;
  const goalPaceSec   = (goalSecs    && distMiles) ? goalSecs    / distMiles : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMonday = getMonday(today);
  const startDate   = trainingStartDate ? getMonday(trainingStartDate) : todayMonday;
  const raceDateObj = parseLocalDate(raceDate);

  const injuryProfile = inputs.injuryProfile || parseInjuries(injuries);

  const raceAdj      = new Date(raceDateObj);
  const raceShiftDays = injuryProfile.raceDateAdjustment != null
    ? injuryProfile.raceDateAdjustment * 7
    : injuryProfile.severity === 'severe'   ? 28
    : injuryProfile.severity === 'moderate' ? 14
    : 0;
  if (raceShiftDays > 0) raceAdj.setDate(raceAdj.getDate() + raceShiftDays);

  const totalWeeks = Math.max(1, Math.round((raceAdj - startDate) / (7 * 86400000)));
  const histWeeks  = Math.max(0, Math.round((todayMonday - startDate) / (7 * 86400000)));

  // See: race-standards.md — Goal time validation (§ 4)
  let improvementPct  = null;
  let ambitionWarning = null;
  if (currentSecs && goalSecs && currentSecs > 0) {
    improvementPct = (currentSecs - goalSecs) / currentSecs * 100;
    const suggested = formatSeconds(Math.round(currentSecs * 0.92));
    if (improvementPct > 15) {
      ambitionWarning = { level: 'unrealistic', msg: `Your goal requires a ${improvementPct.toFixed(1)}% improvement in ${totalWeeks} weeks. Most runners achieve 3–8% per training cycle. Consider ${suggested} as a more realistic target, or extend your race date.` };
    } else if (improvementPct > 8) {
      ambitionWarning = { level: 'ambitious', msg: `Your goal requires a ${improvementPct.toFixed(1)}% improvement in ${totalWeeks} weeks. This is at the upper limit of what most training cycles deliver (3–8%). Consider ${suggested} as a stretch goal, or extending your race date.` };
    } else if (totalWeeks < 8 && improvementPct > 5) {
      ambitionWarning = { level: 'ambitious', msg: `Improvements above 5% typically require at least 8 weeks of training. With only ${totalWeeks} weeks remaining, ${suggested} may be more achievable.` };
    } else if (improvementPct <= 0) {
      ambitionWarning = { level: 'info', msg: `Your goal time is at or slower than your current performance. The plan will focus on maintaining and consolidating fitness.` };
    }
  }

  const QUAL_UP = { beginner: 'intermediate', intermediate: 'advanced' };
  const qualityFitnessCardio = (improvementPct > 5 && fitnessCardio !== 'advanced')
    ? QUAL_UP[fitnessCardio]
    : fitnessCardio;

  const phases    = calculatePhases(totalWeeks);
  const peakMiles = Math.max(startMileage, getPeakMileage(raceDistance, fitnessCardio) * _peakMileageMultiplier);

  // Pre-compute capped weekly mileage: non-cutback weeks may not increase >10% week-over-week
  const weekMileageArr = new Array(totalWeeks);
  let prevNonCutbackMiles = startMileage;
  for (let w = 0; w < totalWeeks; w++) {
    if (_freezeFirstWeek && w === 0) {
      weekMileageArr[0] = startMileage;
      // don't update prevNonCutbackMiles — resume progression from pre-freeze level
      continue;
    }
    const raw     = calcWeeklyMileage(w, phases, startMileage, peakMiles);
    const cutback = isCutbackWeek(w, phases);
    weekMileageArr[w] = cutback ? raw : Math.min(raw, prevNonCutbackMiles * 1.10);
    if (!cutback) prevNonCutbackMiles = weekMileageArr[w];
  }

  // Build weekly slot map (shared template, applied to every week)
  const runSlots  = RUN_SLOTS[Math.min(7, Math.max(1, runDays))];
  const slotTypes = Array.from({ length: 7 }, () => ({ run: false, strength: false }));
  runSlots.forEach(i => { slotTypes[i].run = true; });
  let sLeft = strengthDays;
  for (let i = 0; i < 7 && sLeft > 0; i++) {
    if (!slotTypes[i].run)                         { slotTypes[i].strength = true; sLeft--; }
  }
  for (let i = 0; i < 7 && sLeft > 0; i++) {
    if (slotTypes[i].run && !slotTypes[i].strength){ slotTypes[i].strength = true; sLeft--; }
  }

  const schedule = [];

  for (let w = 0; w < totalWeeks; w++) {
    const weekStart        = addDays(startDate, w * 7);
    const isHistorical     = w < histWeeks;
    const eff              = isHistorical ? { severity: 'none', modifications: [], keywords: [] } : injuryProfile;
    const weeksSinceInjury = isHistorical ? 0 : (w - histWeeks + 1);
    const rehabPhase       = getRehabPhase(weeksSinceInjury, injuryProfile.severity);
    // In loading/full phases, clear the injury profile for workout-type assignment
    // so cross-training substitutions and long-run flags no longer apply
    const effForTypes      = (rehabPhase === 'loading' || rehabPhase === 'full')
      ? { severity: 'none', modifications: [], keywords: [] }
      : eff;
    const phase      = getPhaseForWeek(w, phases);
    const weekMiles  = weekMileageArr[w];
    const longMiles  = calcLongRunDist(w, phases, raceDistance, fitnessCardio);
    const runTypes   = getWorkoutTypes(phase, qualityFitnessCardio, runSlots.length, effForTypes);
    let runIdx = 0;

    for (let d = 0; d < 7; d++) {
      const slot = slotTypes[d];
      const date = addDays(weekStart, d);
      const parts = [], notes = [];

      if (slot.run) {
        const wt = runTypes[runIdx++] || 'Easy Run';
        parts.push(wt);
        const n = getInjuryNote(wt, eff, weeksSinceInjury);
        if (n) notes.push(n);
      }
      if (slot.strength) {
        parts.push('Strength');
        const n = getInjuryNote('Strength', eff, weeksSinceInjury);
        if (n) notes.push(n);
      }
      if (parts.length === 0) parts.push('Rest');

      const dayType = parts.join(' + ');
      const sessionGuidance = parts
        .map(p => getSessionGuidance(p.trim(), phase.name, fitnessCardio, fitnessStrength, racePaceSec, goalPaceSec, units))
        .filter(Boolean)
        .join(' | ');
      let distDur;
      if (slot.run) {
        distDur = getDistLabel(dayType, weekMiles, runSlots.length, longMiles, units, fitnessCardio, phase.name);
      } else if (slot.strength) {
        distDur = getStrengthLabel();
      } else {
        distDur = '—';
      }

      if (d === 0 && !isHistorical) {
        const cutback = isCutbackWeek(w, phases) ? ' — Cutback Week' : '';
        notes.unshift(`${phase.name} Phase${cutback}`);
      }

      schedule.push({
        weekStartDate: isoDate(weekStart),
        weekNumber:    w + 1,
        date:          isoDate(date),
        dayOfWeek:     DAYS[d],
        dayType,
        distanceDuration: distDur,
        notes:          notes.join(' | '),
        sessionGuidance,
        isHistorical,
        phase:          phase.name,
      });
    }
  }

  // Race day row
  const raceDow = raceAdj.getDay();
  schedule.push({
    weekStartDate: isoDate(raceAdj),
    weekNumber:    totalWeeks + 1,
    date:          isoDate(raceAdj),
    dayOfWeek:     DAYS[raceDow === 0 ? 6 : raceDow - 1],
    dayType:       'RACE DAY',
    distanceDuration: (() => {
      const labels = { '5k':'5K','10k':'10K','half':'Half Marathon (13.1 mi)','full':'Marathon (26.2 mi)' };
      return labels[raceDistance] || customDistance || 'Race';
    })(),
    notes: raceShiftDays > 0
      ? `Race date shifted +${Math.round(raceShiftDays / 7)} week${raceShiftDays !== 7 ? 's' : ''} due to ${injuryProfile.keywords.join(', ') || injuryProfile.severity} injury`
      : '',
    isHistorical: false,
    phase: 'Race',
  });

  return {
    schedule,
    meta: {
      planId: _planId || String(Date.now()),
      totalWeeks, histWeeks, phases, peakMiles,
      injuryProfile,
      raceDateOriginal: isoDate(raceDateObj),
      raceDateAdjusted: isoDate(raceAdj),
      units,
      improvementPct,
      ambitionWarning,
    },
  };
}

// ── Form Submit ───────────────────────────────────────────────
document.getElementById('plannerForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const fd          = new FormData(this);
  const apiKey      = (document.getElementById('anthropicKey').value || '').trim();
  const rememberKey = document.getElementById('rememberKey').checked;

  if (rememberKey && apiKey) {
    localStorage.setItem('gemini_api_key', apiKey);
  } else {
    localStorage.removeItem('gemini_api_key');
  }

  const injuryText = fd.get('injuries') || '';
  const submitBtn  = this.querySelector('.btn-generate');

  if (apiKey && injuryText.trim()) {
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Assessing injury...';
  }

  let injuryProfile;
  try {
    injuryProfile = await resolveInjuryProfile(injuryText, apiKey);
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Generate Training Plan';
  }

  const inputs = {
    raceDate:           fd.get('raceDate'),
    raceDistance:       fd.get('raceDistance'),
    customDistance:     fd.get('customDistance') || '',
    weeklyMileage:      parseFloat(fd.get('weeklyMileage'))  || 0,
    trainingStartDate:  fd.get('trainingStartDate') ? parseLocalDate(fd.get('trainingStartDate')) : null,
    runDays:            parseInt(fd.get('runDays'))      || 4,
    strengthDays:       parseInt(fd.get('strengthDays')) || 0,
    fitnessCardio:      fd.get('fitnessCardio')      || 'beginner',
    fitnessStrength:    fd.get('fitnessStrength')    || 'beginner',
    fitnessFlexibility: fd.get('fitnessFlexibility') || 'beginner',
    injuries:           injuryText,
    units:              document.getElementById('unitToggle').checked ? 'metric' : 'imperial',
    currentTime:        fd.get('currentTime') || '',
    goalTime:           fd.get('goalTime')    || '',
    injuryProfile,
  };

  archiveCurrentPlan();
  inputs._planId = String(Date.now());
  window._currentInputs   = inputs;
  const result = generateSchedule(inputs);
  result.meta.planVersion = getArchivedPlans().length + 1;
  window._currentSchedule = result;

  // Persist plan and original inputs for check-in regeneration
  savePlanToStorage(result, inputs);

  const { totalWeeks, histWeeks, phases, raceDateOriginal, raceDateAdjusted, ambitionWarning } = result.meta;
  let msg = `Plan generated: ${totalWeeks} weeks — Base ${phases.base} / Build ${phases.build} / Peak ${phases.peak} / Taper ${phases.taper}.`;
  if (histWeeks > 0) msg += ` Includes ${histWeeks} historical week(s) shown grayed out.`;
  if (injuryProfile.severity !== 'none') {
    msg += ` Race date adjusted: ${raceDateOriginal} → ${raceDateAdjusted} (${injuryProfile.severity} injury).`;
    if (injuryProfile.source === 'claude' && injuryProfile.reasoning) {
      msg += ` Assessment: ${injuryProfile.reasoning}`;
    }
  }

  const statusEl = document.getElementById('statusMsg');
  statusEl.textContent = msg;
  statusEl.style.display = 'block';

  const warningEl = document.getElementById('warningBanner');
  if (ambitionWarning) {
    const prefix = { unrealistic: 'Unrealistic target:', ambitious: 'Ambitious target:', info: 'Note:' }[ambitionWarning.level] || '';
    warningEl.className = `warning-banner warning-${ambitionWarning.level}`;
    warningEl.innerHTML = `<strong>${prefix}</strong> ${ambitionWarning.msg}`;
    warningEl.style.display = 'block';
  } else {
    warningEl.style.display = 'none';
  }

  renderPreview(result);
  renderCheckinSection();
  console.log('Schedule result:', result);
});

// ── Excel Export ──────────────────────────────────────────────
function getSessionFeedback(allCheckins, planId, weekNum, dayOfWeek) {
  const checkin = allCheckins.find(c => c.planId === planId && c.weekNumber === weekNum);
  if (!checkin) return '';
  const sess = checkin.sessions?.find(s => s.dayOfWeek === dayOfWeek);
  if (!sess?.completed) return '';
  const parts = [];
  if (sess.actualDist)   parts.push(`Actual: ${sess.actualDist}`);
  if (sess.effort)       parts.push(`Effort: ${sess.effort}/5`);
  if (sess.sessionNotes) parts.push(sess.sessionNotes);
  return parts.join(' · ');
}

async function exportToExcel() {
  if (!window._currentSchedule) return;

  const { schedule, meta } = window._currentSchedule;
  const inputs = window._currentInputs || {};
  const { totalWeeks, histWeeks, phases, peakMiles, injuryProfile,
          raceDateOriginal, raceDateAdjusted, units, improvementPct } = meta;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Training Planner';
  workbook.created = new Date();

  // ── Sheet 1: Training Plan ──────────────────────────────────
  const planSheet = workbook.addWorksheet('Training Plan');

  planSheet.columns = [
    { key: 'week',     width: 6  },
    { key: 'wkStart',  width: 14 },
    { key: 'date',     width: 10 },
    { key: 'day',      width: 6  },
    { key: 'status',   width: 10 },
    { key: 'dayType',  width: 22 },
    { key: 'distDur',  width: 18 },
    { key: 'notes',    width: 42 },
    { key: 'feedback', width: 30 },
    { key: 'guidance', width: 62 },
  ];

  // Header row
  const headerRow = planSheet.addRow([
    'Week', 'Week Start', 'Date', 'Day', 'Status', 'Day Type',
    'Distance / Duration', 'Notes', 'Session Feedback', 'Session Guidance',
  ]);
  headerRow.height = 22;
  headerRow.eachCell(cell => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3436' } };
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle' };
  });

  // Freeze header
  planSheet.views = [{ state: 'frozen', ySplit: 1 }];
  planSheet.properties.outlineProperties = { summaryBelow: false };

  // Today's Monday for current week highlight
  const _today = new Date();
  _today.setHours(0, 0, 0, 0);
  const todayMondayIso = isoDate(getMonday(_today));

  const FULL_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const XL_DAY   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const fmtDate  = iso => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const xlHistory  = getArchivedPlans();
  const xlCheckins = getCheckins();

  // Flatten all plans into render items: archived-summary + detail rows, then current plan rows
  const renderItems = [];

  if (xlHistory.length > 0) {
    for (const h of xlHistory) {
      const v         = h.version;
      const raceStr   = h.originalRaceDate ? ` · race ${h.originalRaceDate}` : (h.meta?.raceDateOriginal ? ` · race ${h.meta.raceDateOriginal}` : '');
      const startStr  = h.planStartDate ? ` · started ${h.planStartDate}` : '';
      const wkStr     = h.weeksCompleted ? `${h.weeksCompleted} weeks completed` : '';
      renderItems.push({
        type:  'archived-summary',
        label: `Plan v${v}${startStr}${raceStr} — ${wkStr} · archived ${h.archivedAt}`,
        planId: h.planId || h.meta?.planId || '',
        weeksCompleted: h.weeksCompleted,
      });
      for (const row of h.schedule) {
        renderItems.push({ type: 'row', row, planId: h.planId || h.meta?.planId || '', isArchivedPlan: true });
      }
    }
    const curV    = meta.planVersion || (xlHistory.length + 1);
    const curRace = meta.raceDateOriginal ? ` · race ${meta.raceDateOriginal}` : '';
    renderItems.push({ type: 'plan-divider', label: `— Plan v${curV}${curRace} (current) —`, color: 'FFE8F5E9' });
  }

  for (const row of schedule) {
    renderItems.push({ type: 'row', row, planId: meta.planId, isArchivedPlan: false });
  }

  let lastPhase = null;

  for (const item of renderItems) {
    if (item.type === 'archived-summary') {
      // Visible summary row for the archived plan block (acts as the outline group header)
      const sumRow = planSheet.addRow([item.label]);
      planSheet.mergeCells(`A${sumRow.number}:J${sumRow.number}`);
      sumRow.height = 22;
      const sc = sumRow.getCell(1);
      sc.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F7' } };
      sc.font      = { bold: true, color: { argb: 'FF1A3A6B' }, size: 10 };
      sc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      lastPhase    = null;
      continue;
    }

    if (item.type === 'plan-divider') {
      const divRow = planSheet.addRow([item.label]);
      planSheet.mergeCells(`A${divRow.number}:J${divRow.number}`);
      divRow.height = 20;
      const dc = divRow.getCell(1);
      dc.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: item.color } };
      dc.font      = { bold: true, color: { argb: 'FF333333' }, size: 10 };
      dc.alignment = { horizontal: 'center', vertical: 'middle' };
      lastPhase    = null;
      continue;
    }

    const { row, planId, isArchivedPlan } = item;

    // Phase divider rows only for the current plan
    if (!isArchivedPlan && !row.isHistorical && row.phase !== 'Race' && row.phase !== lastPhase) {
      const divRow  = planSheet.addRow([`— ${row.phase.toUpperCase()} PHASE —`]);
      planSheet.mergeCells(`A${divRow.number}:J${divRow.number}`);
      divRow.height = 18;
      const dc = divRow.getCell(1);
      dc.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
      dc.font      = { bold: true, color: { argb: 'FF444444' }, size: 10 };
      dc.alignment = { horizontal: 'center', vertical: 'middle' };
      lastPhase = row.phase;
    }

    const xlStatus = row.checkinStatus === 'completed' ? '✓ Done'
      : row.checkinStatus === 'missed' ? '✗ Missed' : '';
    const feedback = getSessionFeedback(xlCheckins, planId, row.weekNumber, row.dayOfWeek);

    const dataRow = planSheet.addRow([
      row.dayType === 'RACE DAY' ? '' : row.weekNumber,
      row.weekStartDate ? fmtDate(row.weekStartDate) : '',
      row.date ? fmtDate(row.date) : '',
      XL_DAY[FULL_DAYS.indexOf(row.dayOfWeek)] ?? row.dayOfWeek.slice(0, 3),
      xlStatus,
      row.dayType,
      row.distanceDuration,
      row.notes           || '',
      feedback,
      row.sessionGuidance || '',
    ]);

    // Collapse archived plan rows under the summary header
    if (isArchivedPlan) {
      dataRow.outlineLevel = 1;
      dataRow.hidden       = true;
    }

    // Choose row background
    let bgArgb;
    if (isArchivedPlan) {
      bgArgb = 'FFEEEEEE';
    } else if (row.dayType === 'RACE DAY') {
      bgArgb = 'FFCFE2FF';
    } else if (row.isHistorical) {
      bgArgb = 'FFF5F5F5';
    } else if (row.weekStartDate === todayMondayIso) {
      bgArgb = 'FFDBEAFE';
    } else {
      bgArgb = row.weekNumber % 2 === 0 ? 'FFFFFFFF' : 'FFF9F9F9';
    }

    const fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };

    dataRow.eachCell({ includeEmpty: true }, cell => {
      cell.fill = fill;
      if (isArchivedPlan) {
        cell.font = { italic: true, color: { argb: 'FF777777' } };
      } else if (row.dayType === 'RACE DAY') {
        cell.font = { bold: true };
      } else if (row.isHistorical) {
        cell.font = { italic: true, color: { argb: 'FF999999' } };
      }
    });

    // Status cell coloring (col 5)
    if (xlStatus) {
      const sc = dataRow.getCell(5);
      sc.font = { bold: true, color: { argb: xlStatus.startsWith('✓') ? 'FF2E7D32' : 'FFC62828' } };
    }

    // Wrap long text columns
    dataRow.getCell(8).alignment  = { wrapText: true, vertical: 'top' }; // Notes
    dataRow.getCell(9).alignment  = { wrapText: true, vertical: 'top' }; // Session Feedback
    dataRow.getCell(10).alignment = { wrapText: true, vertical: 'top' }; // Session Guidance
  }

  // ── Sheet 2: Summary ────────────────────────────────────────
  const sumSheet = workbook.addWorksheet('Summary');
  sumSheet.columns = [{ width: 26 }, { width: 44 }];

  const addTitle = text => {
    sumSheet.addRow([]);
    const r = sumSheet.addRow([text]);
    sumSheet.mergeCells(`A${r.number}:B${r.number}`);
    r.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3436' } };
    r.getCell(1).font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    r.getCell(1).alignment = { vertical: 'middle' };
    r.height = 20;
  };

  const addPair = (label, value) => {
    const r = sumSheet.addRow([label, value != null && value !== '' ? String(value) : '—']);
    r.getCell(1).font      = { bold: true, color: { argb: 'FF555555' } };
    r.getCell(2).alignment = { wrapText: true };
  };

  const DIST_NAMES  = { '5k': '5K', '10k': '10K', 'half': 'Half Marathon', 'full': 'Marathon',
                        'custom': inputs.customDistance || 'Custom' };
  const unitLabel   = units === 'metric' ? 'km' : 'mi';
  const peakDisplay = units === 'metric'
    ? `${Math.round(peakMiles * 1.60934)} km/wk`
    : `${peakMiles} mi/wk`;

  addTitle('Race & Goal');
  addPair('Race distance',   DIST_NAMES[inputs.raceDistance] || inputs.raceDistance || '—');
  addPair('Race date',       raceDateOriginal);
  if (raceDateOriginal !== raceDateAdjusted) {
    addPair('Adjusted race date', `${raceDateAdjusted} — shifted due to injury`);
  }
  addPair('Current race time', inputs.currentTime || '—');
  addPair('Goal race time',    inputs.goalTime    || '—');
  if (improvementPct != null) {
    addPair('Improvement required', `${improvementPct.toFixed(1)}%`);
  }

  addTitle('Plan Overview');
  addPair('Training start',       inputs.trainingStartDate ? isoDate(inputs.trainingStartDate) : 'Today');
  addPair('Total weeks',          totalWeeks);
  addPair('Phase breakdown',      `Base ${phases.base} / Build ${phases.build} / Peak ${phases.peak} / Taper ${phases.taper}`);
  addPair('Peak weekly mileage',  peakDisplay);
  addPair('Running days / week',  inputs.runDays);
  addPair('Strength days / week', inputs.strengthDays);

  addTitle('Fitness Level');
  addPair('Cardio',      inputs.fitnessCardio);
  addPair('Strength',    inputs.fitnessStrength);
  addPair('Flexibility', inputs.fitnessFlexibility);

  addTitle('Injury Assessment');
  if (injuryProfile && injuryProfile.severity !== 'none') {
    addPair('Severity',          injuryProfile.severity);
    addPair('Issues identified', (injuryProfile.keywords || []).join(', ') || '—');
    addPair('Assessment method', injuryProfile.source === 'claude' ? 'AI (Gemini Flash)' : 'Keyword matching');
    if (injuryProfile.reasoning) {
      addPair('AI reasoning', injuryProfile.reasoning);
    }
    const noteText = (injuryProfile.modifications || []).map(m => m.note).filter(Boolean).join('; ');
    if (noteText) addPair('Training modifications', noteText);
  } else {
    addPair('Status', 'No injuries reported — full plan applied');
  }

  // ── Check-In Summary ────────────────────────────────────────
  const planCheckins = getCheckins()
    .filter(c => c.planId === meta.planId)
    .sort((a, b) => a.weekNumber - b.weekNumber);

  if (planCheckins.length > 0) {
    addTitle('Check-In Summary');
    addPair('Weeks logged', `${planCheckins.length} of ${totalWeeks}`);
    const avgRate = planCheckins.reduce((s, c) => s + computeWeekAnalysis(c).volumeRate, 0) / planCheckins.length;
    addPair('Average volume completion', `${Math.round(Math.min(avgRate, 1) * 100)}%`);
    for (const c of planCheckins) {
      const analysis       = computeWeekAnalysis(c);
      const completedCount = c.sessions.filter(s => s.completed).length;
      const pct            = Math.round(Math.min(analysis.volumeRate, 1) * 100);
      let line = `${completedCount}/${c.plannedSessions.length} sessions (${pct}%)`;
      if (analysis.effortAvg !== null) line += ` · avg effort ${analysis.effortAvg.toFixed(1)}`;
      if (c.painIssues) line += ` — ${c.painIssues}`;
      addPair(`Week ${c.weekNumber}`, line);
    }
  }

  // ── Plan Transitions ─────────────────────────────────────────
  if (xlHistory.length > 0) {
    addTitle('Plan Transitions');
    for (const h of xlHistory) {
      const hStart  = h.planStartDate || h.schedule?.[0]?.weekStartDate || '—';
      const raceStr = h.originalRaceDate ? ` · race ${h.originalRaceDate}` : '';
      const offStr  = h.weeksOffTrack ? `, ${h.weeksOffTrack} off-track week${h.weeksOffTrack !== 1 ? 's' : ''}` : '';
      addPair(
        `Plan v${h.version}`,
        `started ${hStart}${raceStr} · ${h.weeksCompleted || 0} weeks completed · replaced ${h.archivedAt}${offStr}`,
      );
    }
    const curV     = meta.planVersion || (xlHistory.length + 1);
    const curStart = meta.planStartDate || schedule[0]?.weekStartDate || '—';
    const curRace  = meta.raceDateOriginal ? ` · race ${meta.raceDateOriginal}` : '';
    addPair(`Plan v${curV}`, `started ${curStart}${curRace} (current)`);
  }

  // ── Trigger download ────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href       = url;
  a.download   = 'training-plan.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Preview Table ─────────────────────────────────────────────
function displayDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const DAY_ABBR = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function renderPreview(result) {
  const { schedule, meta } = result;
  const tbody = document.getElementById('previewTbody');
  tbody.innerHTML = '';

  let lastWeekNum = null;

  for (const row of schedule) {
    const tr = document.createElement('tr');
    const isFirstOfWeek = row.weekNumber !== lastWeekNum;

    if (isFirstOfWeek)   tr.classList.add('week-first');
    if (row.isHistorical) tr.classList.add('historical');
    if (row.dayType === 'RACE DAY') tr.classList.add('race-day');

    const dayIdx = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].indexOf(row.dayOfWeek);

    const statusText = row.checkinStatus === 'completed' ? '✓ Done'
      : row.checkinStatus === 'missed' ? '✗ Missed' : '';
    const statusCls  = row.checkinStatus === 'completed' ? 'status-completed'
      : row.checkinStatus === 'missed' ? 'status-missed' : '';

    const cells = [
      { text: isFirstOfWeek ? String(row.weekNumber) : '' },
      { text: isFirstOfWeek ? displayDate(row.weekStartDate) : '' },
      { text: displayDate(row.date) },
      { text: dayIdx >= 0 ? DAY_ABBR[dayIdx] : row.dayOfWeek },
      { text: statusText, cls: statusCls },
      { text: row.dayType },
      { text: row.distanceDuration },
      { text: row.notes, cls: 'notes-cell' },
      { text: row.sessionGuidance || '', cls: 'guidance-cell' },
    ];

    cells.forEach(({ text, cls }) => {
      const td = document.createElement('td');
      td.textContent = text;
      if (cls) td.className = cls;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
    lastWeekNum = row.weekNumber;
  }

  const { totalWeeks, histWeeks, peakMiles, units } = meta;
  const unit = units === 'metric' ? 'km' : 'mi';
  document.getElementById('previewMeta').textContent =
    `${totalWeeks} weeks · Peak ${peakMiles} ${unit}/wk` +
    (histWeeks > 0 ? ` · ${histWeeks} historical week${histWeeks > 1 ? 's' : ''} shown` : '');

  document.getElementById('exportSection').style.display = 'block';

  const section = document.getElementById('previewSection');
  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Units toggle ──────────────────────────────────────────────
let _stravaWeeklyMiles = null; // miles fetched from Strava; null = not prefilled
const unitToggle = document.getElementById('unitToggle');

function applyUnits() {
  const metric = unitToggle.checked;

  document.getElementById('weeklyMileageHint').textContent =
    metric ? 'km per week' : 'Miles per week';

  document.getElementById('weightLabel').textContent =
    metric ? 'Weight (kg)' : 'Weight (lbs)';

  const mileageInput = document.getElementById('weeklyMileage');
  mileageInput.max = metric ? 240 : 150;

  document.getElementById('heightFtIn').style.display   = metric ? 'none'  : 'flex';
  document.getElementById('heightCmWrap').style.display = metric ? 'block' : 'none';

  // Re-derive Strava-prefilled mileage in the new unit
  if (_stravaWeeklyMiles !== null) {
    const converted = metric
      ? Math.round(_stravaWeeklyMiles * 1.60934 * 10) / 10
      : Math.round(_stravaWeeklyMiles * 10) / 10;
    document.getElementById('weeklyMileage').value = converted;
  }
}

unitToggle.addEventListener('change', applyUnits);
applyUnits();

// ── Custom distance ───────────────────────────────────────────
const raceDistanceSelect = document.getElementById('raceDistance');
const customDistanceWrap = document.getElementById('customDistanceWrap');
const customDistanceInput = document.getElementById('customDistance');

// ── API key restore ───────────────────────────────────────────
(function () {
  const saved = localStorage.getItem('gemini_api_key');
  if (saved) {
    document.getElementById('anthropicKey').value  = saved;
    document.getElementById('rememberKey').checked = true;
  }
})();

const RACE_DIST_LABELS = { '5k': '5K', '10k': '10K', 'half': 'Half Marathon', 'full': 'Marathon', 'custom': 'Race' };

raceDistanceSelect.addEventListener('change', function () {
  const isCustom = this.value === 'custom';
  customDistanceWrap.style.display = isCustom ? 'block' : 'none';
  customDistanceInput.required = isCustom;
  const distLabel = RACE_DIST_LABELS[this.value] || 'Race';
  document.getElementById('currentTimeDistLabel').textContent = `Current ${distLabel} time`;
  document.getElementById('goalTimeDistLabel').textContent = `Goal ${distLabel} time`;
});

// ── Strava Integration ────────────────────────────────────────

function stravaCredentials() {
  return {
    clientId:     localStorage.getItem('strava_client_id')     || '',
    clientSecret: localStorage.getItem('strava_client_secret') || '',
  };
}

function setDataSource(src) {
  const isStrava  = src === 'strava';
  const connected = !!localStorage.getItem('strava_access_token');
  document.getElementById('srcManual').classList.toggle('src-active', !isStrava);
  document.getElementById('srcManual').classList.remove('src-strava-active');
  document.getElementById('srcStrava').classList.toggle('src-active',        isStrava && !connected);
  document.getElementById('srcStrava').classList.toggle('src-strava-active', isStrava &&  connected);
  document.getElementById('stravaPanel').classList.toggle('sp-visible', isStrava);
  if (isStrava) renderStravaPanel();
}

function renderStravaPanel() {
  const token = localStorage.getItem('strava_access_token');
  const name  = localStorage.getItem('strava_athlete_name');
  const panel = document.getElementById('stravaPanel');

  if (token) {
    panel.innerHTML = `
      <div class="strava-connected-row">
        <span class="strava-dot"></span>
        <span class="strava-name">${escHtml(name || 'Athlete')}</span>
        <button type="button" class="btn-strava-secondary" onclick="stravaFetchActivities()">Refresh from Strava</button>
        <button type="button" class="btn-strava-disconnect" onclick="stravaDisconnect()">Disconnect</button>
      </div>
      <div class="strava-status" id="stravaStatus"></div>
    `;
  } else {
    const { clientId, clientSecret } = stravaCredentials();
    const isFile = window.location.protocol === 'file:';
    const notice = isFile
      ? `<p class="strava-notice">Strava OAuth requires a local HTTP server — open via <code>python -m http.server</code> or VS Code Live Server.</p>`
      : '';
    panel.innerHTML = `
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:13px;font-weight:500;margin-bottom:5px;color:#444;">Strava Client ID</label>
        <input type="text" id="stravaClientId" value="${escHtml(clientId)}"
               placeholder="Your numeric Client ID"
               style="width:100%;padding:8px 10px;border:1px solid #d0d0d0;border-radius:5px;font-size:13px;" />
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:13px;font-weight:500;margin-bottom:5px;color:#444;">Strava Client Secret</label>
        <input type="password" id="stravaClientSecret" value="${escHtml(clientSecret)}"
               placeholder="Your Client Secret"
               style="width:100%;padding:8px 10px;border:1px solid #d0d0d0;border-radius:5px;font-size:13px;font-family:monospace;" />
        <p style="font-size:12px;color:#aaa;margin-top:5px;line-height:1.5;">
          Stored in this browser only — never sent anywhere except Strava's token endpoint.
          Find these at strava.com/settings/api under "My API Application".
        </p>
      </div>
      <button type="button" class="btn-strava-connect" onclick="stravaConnect()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>
        Connect with Strava
      </button>
      ${notice}
      <div class="strava-status" id="stravaStatus"></div>
    `;
  }
}

function stravaSetStatus(msg, type) {
  const el = document.getElementById('stravaStatus');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'strava-status' + (type ? ` ss-${type}` : '');
}

function stravaSetPrefill(field, show) {
  const id = field === 'mileage' ? 'prefillBadgeMileage' : 'prefillBadgeTime';
  const el = document.getElementById(id);
  if (el) el.style.display = show ? 'inline-block' : 'none';
}

function stravaDisconnect() {
  ['strava_access_token','strava_refresh_token','strava_expires_at','strava_athlete_name']
    .forEach(k => localStorage.removeItem(k));
  _stravaWeeklyMiles = null;
  stravaSetPrefill('mileage', false);
  stravaSetPrefill('time',    false);
  setDataSource('strava');
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ── OAuth: initiate redirect ──────────────────────────────────
function stravaConnect() {
  const clientId     = (document.getElementById('stravaClientId')?.value     || '').trim();
  const clientSecret = (document.getElementById('stravaClientSecret')?.value || '').trim();

  if (!clientId || !clientSecret) {
    stravaSetStatus('Enter your Client ID and Client Secret first.', 'error');
    return;
  }

  localStorage.setItem('strava_client_id',     clientId);
  localStorage.setItem('strava_client_secret', clientSecret);

  // Save form state so the race distance survives the OAuth redirect
  sessionStorage.setItem('strava_pre_auth_race_dist',
    document.getElementById('raceDistance').value || '');

  const redirectUri = window.location.origin + window.location.pathname;
  const authUrl = 'https://www.strava.com/oauth/authorize'
    + '?client_id='       + encodeURIComponent(clientId)
    + '&redirect_uri='    + encodeURIComponent(redirectUri)
    + '&response_type=code'
    + '&scope=activity:read_all'
    + '&approval_prompt=auto';

  window.location.href = authUrl;
}

// ── OAuth: handle redirect-back callback ──────────────────────
async function stravaHandleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');
  const error  = params.get('error');

  if (!code && !error) return false;

  // Strip the OAuth params from the URL immediately so a refresh doesn't re-trigger
  history.replaceState(null, '', window.location.pathname);

  setDataSource('strava');

  if (error) {
    stravaSetStatus(`Authorization denied: ${error}`, 'error');
    return true;
  }

  const { clientId, clientSecret } = stravaCredentials();
  if (!clientId || !clientSecret) {
    stravaSetStatus('Credentials missing — please re-enter your Client ID and Secret.', 'error');
    return true;
  }

  stravaSetStatus('Exchanging authorization code with Strava…', 'loading');

  try {
    const resp = await fetch('https://www.strava.com/oauth/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        client_id:     clientId,
        client_secret: clientSecret,
        code,
        grant_type:    'authorization_code',
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${resp.status}`);
    }

    const data    = await resp.json();
    const athlete = data.athlete || {};
    const name    = [athlete.firstname, athlete.lastname].filter(Boolean).join(' ') || 'Athlete';

    localStorage.setItem('strava_access_token',  data.access_token);
    localStorage.setItem('strava_refresh_token', data.refresh_token);
    localStorage.setItem('strava_expires_at',    String(data.expires_at));
    localStorage.setItem('strava_athlete_name',  name);

    // Restore the race distance that was selected before the redirect
    const savedDist = sessionStorage.getItem('strava_pre_auth_race_dist');
    sessionStorage.removeItem('strava_pre_auth_race_dist');
    if (savedDist) {
      const el = document.getElementById('raceDistance');
      el.value = savedDist;
      el.dispatchEvent(new Event('change'));
    }

    setDataSource('strava');
    stravaSetStatus(`Connected as ${name}. Fetching your recent activities…`, 'success');

    await stravaFetchActivities();

  } catch (err) {
    stravaSetStatus(`Token exchange failed: ${err.message}`, 'error');
  }

  return true;
}

// ── Token refresh ─────────────────────────────────────────────
async function stravaEnsureFreshToken() {
  const expiresAt = parseInt(localStorage.getItem('strava_expires_at') || '0', 10);
  const now       = Math.floor(Date.now() / 1000);

  if (expiresAt - now > 300) return true; // valid for >5 more minutes

  const { clientId, clientSecret } = stravaCredentials();
  const refreshToken = localStorage.getItem('strava_refresh_token');

  if (!clientId || !clientSecret || !refreshToken) return false;

  stravaSetStatus('Refreshing Strava access token…', 'loading');

  try {
    const resp = await fetch('https://www.strava.com/oauth/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    localStorage.setItem('strava_access_token',  data.access_token);
    localStorage.setItem('strava_refresh_token', data.refresh_token);
    localStorage.setItem('strava_expires_at',    String(data.expires_at));
    stravaSetStatus('', '');
    return true;

  } catch (err) {
    stravaSetStatus(`Token refresh failed: ${err.message}. Try disconnecting and reconnecting.`, 'error');
    return false;
  }
}

// ── Activity fetch and field pre-fill ────────────────────────
// See: race-standards.md — Strava activity matching windows (§ 5)
const STRAVA_RACE_WINDOWS = {
  '5k':   [4000,   6000],
  '10k':  [8000,  12400],
  'half': [18000, 24000],
  'full': [36000, 48000],
};

function findRaceTime(runs, raceDistance) {
  const distWindow = STRAVA_RACE_WINDOWS[raceDistance];
  if (!distWindow) return null; // custom distance or nothing selected

  const [minM, maxM] = distWindow;
  const candidates   = runs.filter(a => a.distance >= minM && a.distance <= maxM);
  if (candidates.length === 0) return null;

  // Prefer activities tagged as races (workout_type 1); fall back to any run
  const races = candidates.filter(a => a.workout_type === 1);
  const pool  = races.length > 0 ? races : candidates;

  // Most recent first
  pool.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
  return formatSeconds(pool[0].elapsed_time);
}

async function stravaFetchActivities() {
  const token = localStorage.getItem('strava_access_token');
  if (!token) {
    stravaSetStatus('Not connected to Strava.', 'error');
    return;
  }

  const ok = await stravaEnsureFreshToken();
  if (!ok) return;

  const freshToken   = localStorage.getItem('strava_access_token');
  const fourWeeksAgo = Math.floor(Date.now() / 1000) - 28 * 24 * 3600;

  stravaSetStatus('Fetching recent activities from Strava…', 'loading');

  try {
    const resp = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${fourWeeksAgo}&per_page=100`,
      { headers: { Authorization: `Bearer ${freshToken}` } }
    );

    if (resp.status === 401) {
      stravaDisconnect();
      stravaSetStatus('Session expired — please reconnect Strava.', 'error');
      return;
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const activities = await resp.json();
    const runs       = activities.filter(a => a.type === 'Run' || a.sport_type === 'Run');

    // ── Weekly mileage ──────────────────────────────────────
    const totalMeters    = runs.reduce((sum, a) => sum + (a.distance || 0), 0);
    const avgMetersPerWk = totalMeters / 4;
    const weeklyMiles    = avgMetersPerWk / 1609.34;
    _stravaWeeklyMiles   = weeklyMiles > 0 ? weeklyMiles : null;

    const isMetric   = document.getElementById('unitToggle').checked;
    const weeklyDist = weeklyMiles > 0
      ? (isMetric
          ? Math.round(weeklyMiles * 1.60934 * 10) / 10
          : Math.round(weeklyMiles * 10) / 10)
      : 0;

    document.getElementById('weeklyMileage').value = weeklyDist > 0 ? weeklyDist : '';
    stravaSetPrefill('mileage', weeklyDist > 0);

    // ── Race time ───────────────────────────────────────────
    const raceDistKey = document.getElementById('raceDistance').value;
    const raceTime    = findRaceTime(runs, raceDistKey);

    if (raceTime) {
      document.getElementById('currentTime').value = raceTime;
      stravaSetPrefill('time', true);
    } else {
      stravaSetPrefill('time', false);
    }

    // ── Status summary ──────────────────────────────────────
    const unitLabel = isMetric ? 'km' : 'mi';
    const distLabel = RACE_DIST_LABELS[raceDistKey] || '';
    const runLine   = runs.length === 0
      ? 'No runs found in the past 4 weeks.'
      : `${runs.length} run${runs.length !== 1 ? 's' : ''} in the past 4 weeks.`;
    const mileLine  = weeklyDist > 0 ? `Weekly avg: ${weeklyDist} ${unitLabel}.` : '';
    const timeLine  = raceTime
      ? `${distLabel} time: ${raceTime}.`
      : raceDistKey && raceDistKey !== 'custom'
        ? `No recent ${distLabel} found — race time left blank.`
        : !raceDistKey
          ? 'Select a race distance to pull your recent race time.'
          : '';

    stravaSetStatus(
      [runLine, mileLine, timeLine].filter(Boolean).join(' '),
      runs.length > 0 ? 'success' : ''
    );

  } catch (err) {
    stravaSetStatus(`Error fetching activities: ${err.message}`, 'error');
  }
}

// ── Plan Persistence ──────────────────────────────────────────

function sanitizeInputsForStorage(inputs) {
  const { injuryProfile, trainingStartDate, ...rest } = inputs;
  return {
    ...rest,
    trainingStartDate: trainingStartDate ? isoDate(trainingStartDate) : null,
    injuryProfile: injuryProfile
      ? { severity: injuryProfile.severity,
          modifications: injuryProfile.modifications,
          keywords: injuryProfile.keywords,
          raceDateAdjustment: injuryProfile.raceDateAdjustment ?? null }
      : null,
  };
}

function savePlanToStorage(result, inputs) {
  try {
    const payload = {
      planId:      result.meta.planId,
      generatedAt: new Date().toISOString(),
      inputs:      sanitizeInputsForStorage(inputs),
      schedule:    result.schedule,
      meta:        result.meta,
    };
    localStorage.setItem('training_schedule', JSON.stringify(payload));
    // Preserve original inputs separately — never overwritten by check-in regeneration
    if (!inputs._isCheckinRegen) {
      localStorage.setItem('training_schedule_original_inputs', JSON.stringify(payload.inputs));
    }
  } catch (e) {
    console.warn('Failed to persist plan:', e.message);
  }
}

function restorePlanFromStorage() {
  try {
    const raw = localStorage.getItem('training_schedule');
    if (!raw) return;
    const stored = JSON.parse(raw);
    if (!stored.schedule || !stored.meta) return;
    if (stored.inputs?.trainingStartDate) {
      stored.inputs.trainingStartDate = parseLocalDate(stored.inputs.trainingStartDate);
    }
    window._currentSchedule = { schedule: stored.schedule, meta: stored.meta };
    window._currentInputs   = stored.inputs;
    renderPreview(window._currentSchedule);
    renderCheckinSection();
  } catch (e) {
    console.warn('Failed to restore plan:', e.message);
  }
}

function migrateCheckin(c) {
  if (c.sessions) return c;
  const completed = new Set(c.sessionsCompleted || []);
  const sessions = (c.plannedSessions || []).map(s => ({
    dayOfWeek:    s.dayOfWeek,
    completed:    completed.has(s.dayOfWeek),
    actualDist:   '',
    effort:       completed.has(s.dayOfWeek) ? (c.rating || null) : null,
    sessionNotes: '',
  }));
  return { ...c, sessions, weeklyNotes: c.notes || '' };
}

function getCheckins() {
  try {
    const raw = JSON.parse(localStorage.getItem('training_checkins') || '[]');
    return raw.map(migrateCheckin);
  } catch { return []; }
}

function saveCheckins(arr) {
  localStorage.setItem('training_checkins', JSON.stringify(arr));
}

function getArchivedPlans() {
  try {
    const raw = localStorage.getItem('training_archived_plans');
    if (raw) return JSON.parse(raw);
    // One-time migration from training_plan_history
    const oldRaw = localStorage.getItem('training_plan_history');
    if (!oldRaw) return [];
    const old = JSON.parse(oldRaw);
    const migrated = old.map((h, i) => ({
      version:          h.version || (i + 1),
      planId:           h.planId || '',
      originalRaceDate: h.meta?.raceDateOriginal || h.meta?.raceDateAdjusted || '',
      planStartDate:    h.schedule?.[0]?.weekStartDate || '',
      archivedAt:       h.archivedAt || '',
      weeksCompleted:   h.weeksCompleted || h.meta?.totalWeeks || (h.schedule ? Math.max(0, ...h.schedule.map(r => r.weekNumber || 0)) : 0),
      weeksOffTrack:    h.weeksOffTrack || 0,
      schedule:         h.schedule || [],
      meta:             h.meta || {},
      originalInputs:   h.originalInputs || {},
    }));
    saveArchivedPlans(migrated);
    return migrated;
  } catch { return []; }
}

function saveArchivedPlans(arr) {
  try {
    localStorage.setItem('training_archived_plans', JSON.stringify(arr));
  } catch (e) {
    console.warn('[Training] Failed to save archived plans:', e.message);
  }
}

// ── Tab switching ─────────────────────────────────────────────

function switchTab(tab) {
  if (tab === 'track' && !window._currentSchedule) return;
  const isGenerate = tab === 'generate';
  document.getElementById('panelGenerate').style.display = isGenerate ? '' : 'none';
  document.getElementById('panelTrack').style.display    = isGenerate ? 'none' : '';
  document.getElementById('tabGenerate').className = 'tab-btn' + (isGenerate ? ' tab-active' : '');
  document.getElementById('tabTrack').className    = 'tab-btn' + (!isGenerate ? ' tab-active' : (window._currentSchedule ? '' : ' tab-locked'));
}

function enableTrackTab() {
  document.getElementById('tabTrack').classList.remove('tab-locked');
}

// ── Plan summary ──────────────────────────────────────────────

function renderPlanSummary() {
  if (!window._currentSchedule) return;
  const { schedule, meta } = window._currentSchedule;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstRow     = schedule.find(r => r.weekNumber === 1);
  const startDate    = firstRow ? parseLocalDate(firstRow.weekStartDate) : getMonday(today);
  const weeksElapsed = Math.max(0, Math.floor((today - startDate) / (7 * 86400000)));
  const currentWeek  = Math.min(weeksElapsed + 1, meta.totalWeeks);

  const checkins       = getCheckins().filter(c => c.planId === meta.planId);
  const weeksCheckedIn = new Set(checkins.map(c => c.weekNumber)).size;
  const weeksRemaining = Math.max(0, meta.totalWeeks - currentWeek);
  const offTrackCount  = checkins.filter(c => computeWeekAnalysis(c).offTrack).length;

  document.getElementById('planSummary').innerHTML = `
    <div class="plan-summary">
      <div class="ps-stat">
        <span class="ps-num">${weeksCheckedIn}</span>
        <span class="ps-label">weeks checked in</span>
      </div>
      <div class="ps-stat">
        <span class="ps-num">${weeksRemaining}</span>
        <span class="ps-label">weeks remaining</span>
      </div>
      <div class="ps-stat">
        <span class="ps-num">${offTrackCount}</span>
        <span class="ps-label">off-track weeks</span>
      </div>
      <button type="button" class="btn-new-plan" onclick="triggerNewPlanFlow()">Generate New Plan</button>
    </div>`;
}

// ── Check-In Analysis ─────────────────────────────────────────

function parseDistance(str) {
  if (!str) return null;
  const m = String(str).match(/(\d+(?:\.\d+)?)\s*(?:mi|km|miles|kilometers)/i);
  return m ? parseFloat(m[1]) : null;
}

const RUN_TYPES = ['easy run', 'tempo run', 'interval', 'recovery run', 'long run', 'race pace run', 'strides'];

function isRunSession(dayType) {
  const lower = (dayType || '').toLowerCase();
  return RUN_TYPES.some(t => lower.includes(t));
}

function computeWeekAnalysis(checkin) {
  const planned  = checkin.plannedSessions || [];
  const sessions = checkin.sessions || [];

  // Separate run vs non-run planned sessions
  const runPlanned  = planned.filter(s => isRunSession(s.dayType));
  const allCompleted = sessions.filter(s => s.completed);
  const runCompleted = allCompleted.filter(s => {
    const plan = planned.find(p => p.dayOfWeek === s.dayOfWeek);
    return plan && isRunSession(plan.dayType);
  });

  // Completion rate: run sessions only (strength doesn't count)
  const completionRate = runCompleted.length / Math.max(1, runPlanned.length);

  // Volume: run sessions only, distance-based when available
  const plannedDists = runPlanned.map(s => parseDistance(s.distanceDuration)).filter(d => d !== null);
  const actualDists  = runCompleted.map(s => parseDistance(s.actualDist)).filter(d => d !== null);

  let volumeRate;
  if (plannedDists.length > 0 && actualDists.length > 0) {
    const plannedSum = plannedDists.reduce((a, b) => a + b, 0);
    const actualSum  = actualDists.reduce((a, b) => a + b, 0);
    volumeRate = actualSum / plannedSum;
  } else {
    volumeRate = completionRate;
  }

  // Effort: run sessions only
  const effortVals = runCompleted.map(s => s.effort).filter(e => e !== null);
  const effortAvg  = effortVals.length > 0
    ? effortVals.reduce((a, b) => a + b, 0) / effortVals.length
    : null;

  const QUALITY_TYPES = ['tempo', 'interval', 'long run', 'race pace'];
  const qualityCompleted = runCompleted.filter(s => {
    const plan = planned.find(p => p.dayOfWeek === s.dayOfWeek);
    return QUALITY_TYPES.some(q => plan?.dayType?.toLowerCase().includes(q));
  });

  const offTrack = volumeRate < 0.80
    || (effortAvg !== null && effortAvg < 2.0 && qualityCompleted.length >= 1);

  return { completionRate, volumeRate, effortAvg, offTrack };
}

function computeOffTrackStreak(planCheckins) {
  const sorted = [...planCheckins].sort((a, b) => b.weekNumber - a.weekNumber);
  let streak = 0;
  for (const c of sorted) {
    if (computeWeekAnalysis(c).offTrack) streak++;
    else break;
  }
  return streak;
}

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function dismissWarning() {
  if (!window._currentSchedule) return;
  localStorage.setItem('training_warning_dismissed', JSON.stringify({
    planId:  window._currentSchedule.meta.planId,
    isoWeek: getISOWeek(new Date()),
  }));
  document.getElementById('offTrackBanner').style.display = 'none';
}

function archiveCurrentPlan() {
  if (!window._currentSchedule) return;
  try {
    const { schedule, meta } = window._currentSchedule;
    const archived = getArchivedPlans();
    if (archived.some(h => h.planId === meta.planId)) return; // already archived

    // Determine how many weeks have elapsed
    const planStart = meta.planStartDate ? parseLocalDate(meta.planStartDate) : null;
    let currentWeek = meta.totalWeeks || 1;
    if (planStart) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weeksElapsed = Math.floor((today - planStart) / (7 * 24 * 60 * 60 * 1000));
      currentWeek = Math.min(weeksElapsed + 1, meta.totalWeeks || 1);
    }

    // Only keep completed weeks
    const completedSchedule = schedule.filter(r => (r.weekNumber || 0) <= currentWeek);

    const checkins = getCheckins().filter(c => c.planId === meta.planId);
    const weeksOffTrack = checkins.filter(c => {
      try { return computeWeekAnalysis(c).offTrack; } catch { return false; }
    }).length;

    archived.push({
      version:          meta.planVersion || (archived.length + 1),
      planId:           meta.planId,
      originalRaceDate: meta.raceDateOriginal || meta.raceDateAdjusted || '',
      planStartDate:    meta.planStartDate || schedule[0]?.weekStartDate || '',
      archivedAt:       isoDate(new Date()),
      weeksCompleted:   currentWeek,
      weeksOffTrack,
      schedule:         completedSchedule,
      meta,
      originalInputs:   window._currentInputs || {},
    });
    saveArchivedPlans(archived);
    console.log('[Training] Archived plan', meta.planId, '→ weeks completed:', currentWeek, '→ archived count:', archived.length);
  } catch (e) {
    console.warn('[Training] Failed to archive plan:', e.message);
  }
}

function triggerNewPlanFlow() {
  if (!window._currentInputs) return;
  const inputs = window._currentInputs;
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };

  setVal('raceDate',   '');
  setVal('goalTime',   '');
  setVal('currentTime', inputs.currentTime   || '');
  setVal('weeklyMileage', inputs.weeklyMileage || '');
  setVal('runDays',    inputs.runDays      || '');
  setVal('strengthDays', inputs.strengthDays || '');
  setVal('weight',     inputs.weight       || '');
  setVal('injuries',   inputs.injuries     || '');
  setVal('trainingStartDate', isoDate(getMonday(new Date())));

  if (inputs.raceDistance) setVal('raceDistance', inputs.raceDistance);

  ['fitnessCardio', 'fitnessStrength', 'fitnessFlexibility'].forEach(name => {
    const radio = document.querySelector(`input[name="${name}"][value="${inputs[name] || ''}"]`);
    if (radio) radio.checked = true;
  });

  document.getElementById('unitToggle').checked = inputs.units === 'metric';
  applyUnits();

  switchTab('generate');

  const warningEl = document.getElementById('warningBanner');
  warningEl.className = 'warning-banner warning-info';
  warningEl.innerHTML = '<strong>Replanning:</strong> Enter a new race date (and optionally a new goal time) then click Generate.';
  warningEl.style.display = 'block';
  document.getElementById('raceDate').focus();
}

function renderWarningBanner() {
  const banner = document.getElementById('offTrackBanner');
  if (!window._currentSchedule) { banner.style.display = 'none'; return; }

  const { meta } = window._currentSchedule;
  const checkins  = getCheckins().filter(c => c.planId === meta.planId);
  if (checkins.length < 2) { banner.style.display = 'none'; return; }

  const streak = computeOffTrackStreak(checkins);
  if (streak < 2) { banner.style.display = 'none'; return; }

  try {
    const dismissed = JSON.parse(localStorage.getItem('training_warning_dismissed') || 'null');
    if (dismissed?.planId === meta.planId && dismissed?.isoWeek === getISOWeek(new Date())) {
      banner.style.display = 'none';
      return;
    }
  } catch { /* ignore */ }

  const raceDate = meta.raceDateAdjusted || meta.raceDateOriginal || '';
  const racePart = raceDate ? `Your ${raceDate} race goal` : 'Your race goal';
  banner.className = 'off-track-banner';
  banner.innerHTML = `
    <div class="otb-message">
      <strong>You've been off-track for ${streak} week${streak > 1 ? 's' : ''}.</strong>
      ${racePart} may be unachievable at this pace.
    </div>
    <div class="otb-actions">
      <button type="button" class="btn-replan" onclick="triggerNewPlanFlow()">Generate New Plan</button>
      <button type="button" class="btn-keep-plan" onclick="dismissWarning()">Keep Current Plan</button>
    </div>`;
  banner.style.display = 'block';
}

// ── Check-In UI ───────────────────────────────────────────────

function renderCheckinSection() {
  if (!window._currentSchedule) return;
  enableTrackTab();
  renderPlanSummary();

  const { schedule, meta } = window._currentSchedule;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Determine current plan week from schedule dates
  const firstRow    = schedule.find(r => r.weekNumber === 1);
  const startDate   = firstRow ? parseLocalDate(firstRow.weekStartDate) : getMonday(today);
  const weeksElapsed = Math.max(0, Math.floor((today - startDate) / (7 * 86400000)));
  const currentWeek = Math.min(weeksElapsed + 1, meta.totalWeeks);

  const checkins = getCheckins().filter(c => c.planId === meta.planId);
  const select   = document.getElementById('checkinWeekSelect');
  select.innerHTML = '';

  const availableWeeks = [...new Set(
    schedule.filter(r => r.weekNumber <= currentWeek && r.phase !== 'Race').map(r => r.weekNumber)
  )].sort((a, b) => a - b);

  for (const w of availableWeeks) {
    const phaseRow   = schedule.find(r => r.weekNumber === w);
    const hasCheckin = checkins.some(c => c.weekNumber === w);
    const opt        = document.createElement('option');
    opt.value        = w;
    opt.textContent  = `Week ${w} — ${phaseRow?.phase || ''}${hasCheckin ? ' ✓' : ''}`;
    if (w === currentWeek) opt.selected = true;
    select.appendChild(opt);
  }

  document.getElementById('checkinResult').style.display = 'none';
  renderCheckinForm(currentWeek);
  renderCheckinHistory();
  renderWarningBanner();
}

function renderCheckinForm(weekNum) {
  if (!window._currentSchedule) return;
  const { schedule, meta } = window._currentSchedule;
  const checkins        = getCheckins();
  const existing        = checkins.find(c => c.planId === meta.planId && c.weekNumber === weekNum);
  const plannedSessions = schedule.filter(r => r.weekNumber === weekNum && !r.dayType.toLowerCase().includes('rest'));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const EFFORT_LABELS = ['', 'Very Easy', 'Easy', 'Moderate', 'Hard', 'Very Hard'];

  const list = document.getElementById('checkinSessionList');
  list.innerHTML = '';

  plannedSessions.forEach(s => {
    const sessionDate = parseLocalDate(s.date);
    const isFuture    = sessionDate > today;

    const existSess  = existing?.sessions?.find(e => e.dayOfWeek === s.dayOfWeek);
    const done       = !isFuture && (existSess?.completed ?? false);
    const effort     = existSess?.effort ?? null;
    const actualDist = escHtml(existSess?.actualDist ?? '');
    const sessNotes  = escHtml(existSess?.sessionNotes ?? '');

    const item = document.createElement('div');
    item.className = 'checkin-session-item' + (isFuture ? ' csi-future' : '');
    item.dataset.day = s.dayOfWeek;

    if (isFuture) {
      item.innerHTML = `
        <div class="csi-main">
          <input type="checkbox" class="checkin-session-cb" value="${s.dayOfWeek}" disabled>
          <span class="ci-day">${s.dayOfWeek.slice(0, 3)}</span>
          <span class="ci-type">${s.dayType}</span>
          <span class="ci-dist">${s.distanceDuration}</span>
          <span class="csi-future-label">upcoming</span>
        </div>`;
    } else {
      const effortBtns = [1,2,3,4,5].map(n =>
        `<button type="button" class="effort-btn${effort === n ? ' effort-active' : ''}"
                 data-day="${s.dayOfWeek}" data-effort="${n}" title="${EFFORT_LABELS[n]}"
                 onclick="selectEffort('${s.dayOfWeek}', ${n})">${n}</button>`
      ).join('');

      item.innerHTML = `
        <div class="csi-main">
          <input type="checkbox" class="checkin-session-cb" value="${s.dayOfWeek}"
                 ${done ? 'checked' : ''} onchange="toggleSessionDetail('${s.dayOfWeek}', this.checked)">
          <span class="ci-day">${s.dayOfWeek.slice(0, 3)}</span>
          <span class="ci-type">${s.dayType}</span>
          <span class="ci-dist">${s.distanceDuration}</span>
        </div>
        <div class="csi-detail csi-done" style="display:${done ? 'flex' : 'none'}">
          <div class="csi-row">
            <label class="csi-label">Actual</label>
            <input type="text" class="csi-dist-input" value="${actualDist}"
                   placeholder="${s.distanceDuration}" data-day="${s.dayOfWeek}">
          </div>
          <div class="csi-row">
            <label class="csi-label">Effort</label>
            <div class="csi-effort-btns">${effortBtns}</div>
            <span class="effort-label-text">${effort ? EFFORT_LABELS[effort] : '—'}</span>
          </div>
          <div class="csi-row">
            <label class="csi-label">Notes</label>
            <input type="text" class="csi-notes-input csi-done-notes" value="${sessNotes}"
                   placeholder="optional" data-day="${s.dayOfWeek}">
          </div>
        </div>
        <div class="csi-detail csi-skip" style="display:${!done ? 'flex' : 'none'}">
          <div class="csi-row">
            <label class="csi-label">Reason</label>
            <input type="text" class="csi-notes-input csi-skip-notes" value="${sessNotes}"
                   placeholder="skipped — optional" data-day="${s.dayOfWeek}">
          </div>
        </div>`;
    }

    list.appendChild(item);
  });

  document.getElementById('checkinPain').value  = existing?.painIssues  || '';
  document.getElementById('checkinNotes').value = existing?.weeklyNotes || '';
  document.getElementById('checkinSubmitBtn').textContent = existing ? 'Update Check-In' : 'Submit Check-In';
  updateSubmitButtonState();
}

function updateSubmitButtonState() {
  const btn = document.getElementById('checkinSubmitBtn');
  if (!btn) return;
  const anyChecked = [...document.querySelectorAll('.checkin-session-cb:not([disabled])')].some(cb => cb.checked);
  btn.disabled = !anyChecked;
}

function toggleSessionDetail(dayOfWeek, checked) {
  const item = document.querySelector(`.checkin-session-item[data-day="${dayOfWeek}"]`);
  if (!item) return;
  item.querySelector('.csi-done').style.display = checked ? 'flex' : 'none';
  item.querySelector('.csi-skip').style.display = checked ? 'none' : 'flex';
  updateSubmitButtonState();
}

function selectEffort(dayOfWeek, value) {
  const EFFORT_LABELS = ['', 'Very Easy', 'Easy', 'Moderate', 'Hard', 'Very Hard'];
  const item = document.querySelector(`.checkin-session-item[data-day="${dayOfWeek}"]`);
  if (!item) return;
  item.querySelectorAll('.effort-btn').forEach(btn => {
    btn.classList.toggle('effort-active', parseInt(btn.dataset.effort) === value);
  });
  const labelEl = item.querySelector('.effort-label-text');
  if (labelEl) labelEl.textContent = EFFORT_LABELS[value] || '—';
}

function renderCheckinHistory() {
  if (!window._currentSchedule) return;
  const { schedule: currentSchedule, meta: currentMeta } = window._currentSchedule;
  const allCheckins = getCheckins();
  const archived = getArchivedPlans();
  const EFFORT_SHORT = ['', 'VE', 'E', 'M', 'H', 'VH'];

  const allPlans = [
    {
      version:        currentMeta.planVersion || (archived.length + 1),
      meta:           currentMeta,
      schedule:       currentSchedule,
      isCurrent:      true,
      archivedAt:     null,
      weeksCompleted: null,
      weeksOffTrack:  null,
      planStartDate:  currentMeta.planStartDate || currentSchedule[0]?.weekStartDate || '',
      originalRaceDate: currentMeta.raceDateOriginal || '',
    },
    ...archived.slice().reverse().map(h => ({
      version:        h.version,
      meta:           h.meta,
      schedule:       h.schedule,
      isCurrent:      false,
      archivedAt:     h.archivedAt,
      weeksCompleted: h.weeksCompleted,
      weeksOffTrack:  h.weeksOffTrack,
      planStartDate:  h.planStartDate || h.schedule?.[0]?.weekStartDate || '',
      originalRaceDate: h.originalRaceDate || h.meta?.raceDateOriginal || '',
    })),
  ];

  const container = document.getElementById('checkinHistory');
  container.innerHTML = '<h3 class="checkin-history-title">Check-In History</h3>';

  for (const planEntry of allPlans) {
    const planCheckins = allCheckins
      .filter(c => c.planId === planEntry.meta.planId)
      .sort((a, b) => b.weekNumber - a.weekNumber);

    if (!planEntry.isCurrent && planCheckins.length === 0) continue;

    const sectionId  = `phsec-${planEntry.meta.planId}`;
    const startStr   = planEntry.planStartDate
      ? (() => { try { return parseLocalDate(planEntry.planStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return ''; } })()
      : '';
    const raceStr    = planEntry.originalRaceDate
      ? (() => { try { return ' · race ' + parseLocalDate(planEntry.originalRaceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return ''; } })()
      : '';

    let headerText;
    if (planEntry.isCurrent) {
      headerText = `Plan v${planEntry.version}${startStr ? ' — started ' + startStr : ''}${raceStr} (current)`;
    } else {
      const wkStr  = planEntry.weeksCompleted != null ? ` · ${planEntry.weeksCompleted} wk${planEntry.weeksCompleted !== 1 ? 's' : ''} completed` : '';
      const endStr = planEntry.archivedAt
        ? (() => { try { return ' → ' + parseLocalDate(planEntry.archivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return ''; } })()
        : '';
      headerText = `Plan v${planEntry.version}${startStr ? ' — ' + startStr : ''}${endStr}${raceStr}${wkStr}`;
    }

    const section = document.createElement('div');
    section.className = 'plan-history-section';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'plan-history-toggle' + (planEntry.isCurrent ? ' pht-expanded' : '');
    toggle.setAttribute('aria-expanded', planEntry.isCurrent ? 'true' : 'false');
    toggle.textContent = headerText;

    const contentEl = document.createElement('div');
    contentEl.id = sectionId;
    contentEl.style.display = planEntry.isCurrent ? 'block' : 'none';

    toggle.onclick = () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      toggle.classList.toggle('pht-expanded', !expanded);
      contentEl.style.display = expanded ? 'none' : 'block';
    };

    if (planCheckins.length === 0) {
      contentEl.innerHTML = '<p class="chc-empty">No check-ins yet.</p>';
    } else {
      for (const c of planCheckins) {
        const analysis       = computeWeekAnalysis(c);
        const completedCount = c.sessions.filter(s => s.completed).length;
        const pct            = Math.round(Math.min(analysis.volumeRate, 1) * 100);
        const phase          = planEntry.schedule.find(r => r.weekNumber === c.weekNumber)?.phase || '';

        const dots = c.sessions.map(s => {
          const cls         = s.completed ? 'chc-done' : 'chc-miss';
          const effortLabel = s.completed && s.effort ? ` ${EFFORT_SHORT[s.effort]}` : '';
          return `<span class="chc-session-dot ${cls}">${s.dayOfWeek.slice(0, 3)}${effortLabel} ${s.completed ? '✓' : '✗'}</span>`;
        }).join('');

        const effortStr = analysis.effortAvg !== null
          ? ` · avg effort ${analysis.effortAvg.toFixed(1)}` : '';
        const volumeStr = analysis.volumeRate !== analysis.completionRate
          ? ` · ${pct}% vol` : '';

        const card = document.createElement('div');
        card.className = 'checkin-history-card' + (analysis.offTrack ? ' chc-off-track' : '');
        card.innerHTML = `
          <div class="chc-header">
            <span class="chc-week">Week ${c.weekNumber}</span>
            <span class="chc-phase">${phase}</span>
            <span class="chc-completion">${completedCount}/${c.plannedSessions.length} sessions${volumeStr}${effortStr}</span>
            ${analysis.offTrack ? '<span class="chc-off-track-badge">off-track</span>' : ''}
          </div>
          <div class="chc-sessions">${dots}</div>
          ${c.painIssues ? `<div class="chc-pain">${escHtml(c.painIssues)}</div>` : ''}`;
        contentEl.appendChild(card);
      }
    }

    section.appendChild(toggle);
    section.appendChild(contentEl);
    container.appendChild(section);
  }
}

async function submitCheckin() {
  if (!window._currentSchedule) return;
  const { schedule, meta } = window._currentSchedule;

  const weekNum = parseInt(document.getElementById('checkinWeekSelect').value);
  if (!weekNum) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const plannedSessions = schedule.filter(r =>
    r.weekNumber === weekNum && !r.dayType.toLowerCase().includes('rest')
  );

  // Collect per-session data
  const sessions = [];
  document.querySelectorAll('#checkinSessionList .checkin-session-item').forEach(item => {
    const dayOfWeek  = item.dataset.day;
    const cb         = item.querySelector('.checkin-session-cb');
    const completed  = cb?.checked ?? false;
    const actualDist = completed
      ? (item.querySelector('.csi-dist-input')?.value.trim() || '')
      : '';
    const effortBtn  = item.querySelector('.effort-btn.effort-active');
    const effort     = completed && effortBtn ? parseInt(effortBtn.dataset.effort) : null;
    const notesInput = item.querySelector(
      completed ? '.csi-done-notes' : '.csi-skip-notes'
    );
    const sessionNotes = notesInput?.value.trim() || '';
    sessions.push({ dayOfWeek, completed, actualDist, effort, sessionNotes });
  });

  const painIssues  = document.getElementById('checkinPain').value.trim();
  const weeklyNotes = document.getElementById('checkinNotes').value.trim();

  // Reject if any future-dated session was checked as completed
  const invalidSessions = sessions.filter(s => {
    if (!s.completed) return false;
    const row = plannedSessions.find(r => r.dayOfWeek === s.dayOfWeek);
    return row && parseLocalDate(row.date) > today;
  });
  if (invalidSessions.length > 0) {
    const names = invalidSessions.map(s => s.dayOfWeek.slice(0, 3)).join(', ');
    const resultEl = document.getElementById('checkinResult');
    resultEl.textContent = `Can't log future sessions (${names}). Uncheck them to submit.`;
    resultEl.className   = 'checkin-result cr-adjusted';
    resultEl.style.display = 'block';
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  const checkin = {
    planId:          meta.planId,
    weekNumber:      weekNum,
    plannedSessions: plannedSessions.map(s => ({
      dayOfWeek: s.dayOfWeek, dayType: s.dayType, distanceDuration: s.distanceDuration,
    })),
    sessions,
    painIssues,
    weeklyNotes,
    timestamp: new Date().toISOString(),
  };

  // Upsert
  const allCheckins = getCheckins();
  const idx = allCheckins.findIndex(c => c.planId === meta.planId && c.weekNumber === weekNum);
  if (idx >= 0) allCheckins[idx] = checkin; else allCheckins.push(checkin);
  saveCheckins(allCheckins);

  // Injury assessment (informational only — no plan regeneration)
  const btn = document.getElementById('checkinSubmitBtn');
  if (painIssues) {
    btn.disabled    = true;
    btn.textContent = 'Assessing injury…';
    try {
      const apiKey = localStorage.getItem('gemini_api_key') || '';
      await resolveInjuryProfile(painIssues, apiKey);
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Update Check-In';
    }
  }

  // Refresh week selector check marks
  const refreshedCheckins = getCheckins().filter(c => c.planId === meta.planId);
  const select = document.getElementById('checkinWeekSelect');
  Array.from(select.options).forEach(opt => {
    const w          = parseInt(opt.value);
    const hasCheckin = refreshedCheckins.some(c => c.weekNumber === w);
    const phaseRow   = schedule.find(r => r.weekNumber === w);
    opt.textContent  = `Week ${w} — ${phaseRow?.phase || ''}${hasCheckin ? ' ✓' : ''}`;
  });

  renderWarningBanner();
  renderCheckinHistory();

  // Show result
  const analysis       = computeWeekAnalysis(checkin);
  const completedCount = sessions.filter(s => s.completed).length;
  const pct            = Math.round(Math.min(analysis.volumeRate, 1) * 100);
  let msg              = `Week ${weekNum} logged: ${completedCount}/${plannedSessions.length} sessions`;
  if (analysis.effortAvg !== null) msg += ` · avg effort ${analysis.effortAvg.toFixed(1)}`;
  msg += ` (${pct}% volume)`;

  const resultEl        = document.getElementById('checkinResult');
  resultEl.textContent  = msg;
  resultEl.className    = 'checkin-result ' + (analysis.volumeRate >= 0.80 ? 'cr-good' : 'cr-adjusted');
  resultEl.style.display = 'block';
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Load-time init ────────────────────────────────────────────
(async function stravaOnLoad() {
  const handled = await stravaHandleCallback();
  if (handled) return;
  if (localStorage.getItem('strava_access_token')) {
    setDataSource('strava');
  }
})();

restorePlanFromStorage();
