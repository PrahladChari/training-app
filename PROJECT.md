# Training Planner — Project Overview

## What We're Building

A single-page web app that takes user inputs about a race goal and current fitness, then generates a week-by-week training schedule and exports it as an Excel file. No backend, no login, no database — everything runs in the browser.

## Current Status

**Stage 1 complete:** The form is built with all inputs. Schedule generation and Excel export are not yet implemented.

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

### JavaScript (currently ~30 lines)
- `applyUnits()` — runs on toggle change; updates labels, swaps height inputs, adjusts mileage field max
- Race distance change handler — shows/hides the custom distance input and sets its `required` attribute conditionally

---

## What Comes Next

- Schedule generation logic (base/build/peak/taper phases, injury parsing, fitness-level scaling)
- In-browser preview table
- Excel export with SheetJS (one sheet, week-start-date column, grayed historical block for mid-cycle injuries)
