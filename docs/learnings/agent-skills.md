# Agent Skills and Knowledge/Implementation Separation

## What Agent Skills Are

Anthropic's Agent Skills standard is a convention for packaging a tool so it can be consumed by Claude (or another agent) with appropriate context at each level of detail. A skill has:

1. **`SKILL.md`** — the entry point. YAML frontmatter (`name`, `description`) identifies the skill. The body provides an architecture overview, data flow, key inputs/outputs, and cross-references to deeper knowledge files.
2. **Knowledge files** (e.g. `training-logic.md`, `injury-protocols.md`) — domain-specific reference documents. They contain the actual rules, tables, and rationale that the implementation follows.

The design principle is **progressive disclosure**: an agent or developer reading `SKILL.md` gets enough context to understand what the skill does and how to invoke it. They only need to open a knowledge file when they need to reason about a specific subsystem in detail.

---

## Why Separating Knowledge from Implementation Matters

When logic lives only in code, the *why* is invisible. Code can tell you what it computes; it can't easily tell you why those numbers were chosen or what they're based on. Separating knowledge into markdown files:

- Makes the intent verifiable — a reader can check whether `app.js` matches the spec without reverse-engineering it
- Creates a single place to update rules — change `training-logic.md`, then update the code to match
- Lets agents and developers reason about the domain without reading JavaScript

The `// See: training-logic.md — Phase structure (§ 1)` comments in `app.js` make this link explicit. Every major logic block points to its authoritative source.

---

## How to Structure a SKILL.md

A minimal `SKILL.md` needs:
- **YAML frontmatter**: `name` (kebab-case, unique) and `description` (one-paragraph summary of what the skill does and when to use it)
- **File map**: what each file in the project does — essential for an agent navigating a new codebase
- **Architecture and data flow**: how the major components relate, in plain language or a short diagram
- **Key inputs and outputs**: what goes in, what comes out, at a data level

Knowledge files are linked from `SKILL.md` but kept separate so they can be read independently. Don't duplicate content between `SKILL.md` and knowledge files — summarize in the entry point, elaborate in the reference.

---

## Document Rejected Approaches

When you evaluate and reject a design approach, write down why. In this project, the `PEAK_LONG_RUN` table documentation explicitly notes:

> A multiplier formula (`race distance × factor`) was evaluated and rejected: it overestimates badly for sub-marathon distances (half × 1.2 = 15.7 mi vs. Higdon Novice's 10 mi cap).

Without this note, a future developer (or agent) reading the code would see a lookup table and have no idea that a formula was considered and found to be wrong. They'd likely re-derive the formula, think it looks reasonable, and replace the table — reintroducing the bug. Documenting dead ends prevents that. The pattern: "X was considered and rejected because Y" is more valuable than "we use Z" alone, because it closes off a category of future changes.

---

## Knowledge Files as Source of Truth

Knowledge files are authoritative over the code — when a number or rule conflicts between a `.md` file and `app.js`, the markdown wins and the code is updated to match. This was enforced during authoring: the peak mileage attribution was corrected from "Pfitzinger" to "Hal Higdon + Nike Run Club" after cross-checking against the `PEAK_MILEAGE` comment in `app.js`.

This direction of authority matters. If code were authoritative, knowledge files would drift out of sync and become misleading documentation. Making markdown authoritative forces the code to be the follower, which means the human-readable spec is always correct.
