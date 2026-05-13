# Dev Environment & HTML/CSS Patterns

## HTML Form Input Types

HTML has several built-in input types, and using the right one matters:

- `type="date"` — renders a native date picker in the browser. No JavaScript needed. The value you get back is always in `YYYY-MM-DD` format regardless of how the browser displays it.
- `type="number"` — only allows numeric input. You can set `min`, `max`, and `step` to constrain what's valid (e.g. `step="0.5"` allows half-miles). The browser won't submit the form if the value is outside the range.
- `type="text"` — a plain text box, used here for the custom race distance where any format is acceptable ("50K", "100 miles", etc.).
- `type="radio"` — a group of options where only one can be selected at a time. All radios with the same `name` attribute are treated as a group.
- `textarea` — for longer free-form text. Unlike `input`, it has a closing tag and supports multi-line entry. `resize: vertical` in CSS lets the user make it taller but not wider.

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

## Conditional Required Fields

The custom distance input is hidden by default. When the user selects "Custom" from the dropdown, two things happen:

1. The input becomes visible (`display: block`)
2. Its `required` attribute is set to `true`

When the user switches away from Custom, `required` is set back to `false`. This matters because the browser won't submit a form if a visible required field is empty — but it also won't complain about hidden fields, even if they're technically `required`. Toggling `required` dynamically keeps validation honest.

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

## Why One HTML File?

Splitting into `index.html`, `styles.css`, and `app.js` is cleaner for larger projects. But for a small app that doesn't need a build process or a server, keeping everything in one file has real advantages: you can open it directly in a browser by double-clicking, share it as a single attachment, and there are no import paths to get wrong. The tradeoff is that the file gets longer — but for a project this size, that's fine.

The project was eventually split into three files (Stage 10) as it grew — at that point the single-file convenience no longer outweighed the maintainability cost.
