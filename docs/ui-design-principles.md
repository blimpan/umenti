# Metis UI Design Principles

Research-grounded design guidelines for the Metis learning platform, derived from analysis of Khanmigo, Duolingo, Linear, and teacher analytics platforms. These principles apply across both student and teacher surfaces.

---

## Visual Language

### Spacing System
All spacing values are multiples of 8px. Consistent use of 8, 16, 24, 32, 48px prevents the "designed by committee" feeling and creates visual rhythm without effort.

### Color Usage
- **Neutral base**: Near-black on near-white. `foreground` on `background`. Educational content lives here.
- **Teal accent** (`--primary`): Reserved for primary actions, mastery state indicators, and gamification signals only. Never use for decorative or structural purposes.
- **Surface differentiation** (not color) separates content types — see message types below.
- **Status colors**: Red = intervention needed, Amber = attention warranted, Green = positive signal. Always paired with a human-readable reason, never shown alone.
- **No multiple accent colors** for different content types — use border, background tint, and shadow instead.

### Typography
- Body: Nunito (existing). Warm, rounded, appropriate for the 14–16 student age group.
- Weight variation is the primary typographic tool: 400 (body), 600 (labels, card headers), 700 (concept names, headings).
- Keep educational text at 15–16px / line-height 1.65 for sustained reading comfort.

---

## Student Learning Session

The chat-stream is the core student surface. Students spend the majority of their time here. Every component decision should serve legibility and cognitive flow.

### Message Type Differentiation

All message types live in the same vertical feed. Differentiation uses **surface + border**, not color:

| Type | Visual Treatment |
|---|---|
| **AI tutor message** | White bubble, left-aligned, no border. Max-width ~70% of feed. Subtle drop shadow on hover to reveal action buttons. |
| **Theory block** | Tinted card (`#F0FDF9` — teal-50), full-width, left border accent (3px, `--primary`). Signals "reference material, not conversation." |
| **Exercise card** | White card, full-width, 1px border (`--border`), subtle box shadow. Signals "this requires action." Has state machine (see below). |
| **Student message** | Right-aligned, teal-tinted background (`--accent`). Plain text. |
| **System message** | Centered, muted gray text (`--muted-foreground`). 12px, letter-spaced. Used for quiet transitions. |
| **Mastery card** | Compact inline pill, teal background, centered. "Concept mastered ✓" — not a modal, not disruptive. |
| **Module end card** | Full-width card, summary of effective scores, CTA to next module. |

### Exercise Card — State Machine

The exercise card must communicate its state unambiguously without requiring the student to read status text.

```
ACTIVE       →  EVALUATING    →  RESULT (correct)
                               →  RESULT (partial / incorrect)
```

**ACTIVE state**
- White card, `1px border (--border)`, subtle shadow
- Question text, textarea/input, Submit button (primary), Hint button (ghost, right-aligned)
- Textarea: single line, auto-grows to max 5 lines before internal scroll

**EVALUATING state**
- Submit button replaced with spinner + "Checking…" label
- Card border animates: subtle opacity pulse (0.4s ease-in-out loop)
- Input is disabled

**RESULT — Correct**
- Left border: 3px solid green (`#16a34a`)
- Card background: very light green tint (`#f0fdf4`)
- Brief affirmation label below question (e.g. "Correct")
- No correct answer shown (Socratic constraint: the answer is never revealed)
- Card becomes read-only; student answer stays visible
- +XP toaster appears top-right, fades after 2s

**RESULT — Incorrect / Partial**
- Left border: 3px solid amber (`#d97706`)
- Card background: very light amber tint (`#fffbeb`)
- Brief status label (e.g. "Good start — keep going")
- Card becomes read-only
- AI tutor message appears below in the feed with a Socratic follow-up

**Hint button behavior**
Clicking Hint does not show an answer inline on the card. It appends an AI tutor message below in the feed with a guiding question. This enforces the Socratic constraint while keeping the interaction in the feed.

### Scroll Anchoring

- Auto-scroll to bottom while the AI is streaming
- Stop auto-scrolling the moment the user scrolls up manually (they are reading previous content)
- Show a "↓ Jump to latest" FAB (floating action button) when the user is not at the bottom
- FAB disappears when the user is at the bottom again

### Hover-Reveal Message Actions

AI message action buttons (copy, thumbs up/down, show source) are invisible at rest (`opacity: 0`). They fade in on message hover (`opacity: 1`, 100ms transition). This keeps the feed clean but keeps controls discoverable. Applies only to AI tutor messages — not system messages or cards.

### Layout

```
[ Left sidebar — 240px ]  [ Chat feed — flex-1 ]  [ Materials panel — 320px ]
  collapsible               always visible           click-to-open (not hover)
```

**Left sidebar**: collapsed to 48px icon-only mode. Collapse state persists in localStorage. Icon-only mode shows tooltips on hover (not flyout menus).

**Materials panel**: closed by default. Opened via:
1. A persistent toggle button (top-right of the feed area)
2. Clicking a source citation link in an AI message

Avoid hover-reveal for the materials panel — cursor edge detection is fiddly and unreliable. Explicit click-to-open is more predictable.

---

## Gamification

### Show Mastery as State, Not Percentage

Do not show concept scores as percentages. Show them as named states:

| Score range | Display label | Visual |
|---|---|---|
| 0% | Not started | Gray dot |
| 1–49% | Attempted | Gray progress ring, ~25% filled |
| 50–74% | Practicing | Amber ring, ~60% filled |
| 75–89% | Fluent | Green ring, ~85% filled |
| ≥90% | Mastered | Teal ring, fully filled + checkmark |

This reframes progress as a skill arc rather than a grade. Teenagers disengage from score-dominant designs that feel like a report card.

### Ambient XP, Not Dominant

Points and streaks live in a quiet persistent header row. Never in a hero banner. The hero of the student dashboard shows the **next learning objective**, not the score.

- Streak: small flame icon + count. Only show prominently after 7+ day streak.
- XP: subtle counter in header. The +XP toaster on exercise completion is the primary moment of reward (immediate, cause-and-effect, then fades).

### Points types

The platform has three point types (exploration, repetition, feedback). These should be visually distinct but not cluttered — consider three small icons in the header with counts rather than a unified XP number when the points system is built out.

---

## Teacher Dashboard

### Action-Oriented, Not Information-Dense

Teachers are busy. A dashboard that shows 47 data points is worse than one that surfaces 3 urgent items.

**"Needs attention" widget** — top of dashboard, above course grid:
- Shows 3–5 highest-priority alerts across all courses
- Format: `[Student name] in [Course] — [human-readable reason]`
- Inline "View student" and "Dismiss" buttons
- No alert = widget is not shown

### Student Status Language

Show *why* a student is flagged, not just a score:
- "Hasn't engaged in 8 days"
- "Failed this concept 3 times without improvement"
- "Quiz average dropped from 78% to 51% over 3 sessions"

Never show: "Score: 43%". That is information, not action.

### Status colors (always with label)
- 🔴 Red: intervention needed now
- 🟡 Amber: attention warranted
- 🟢 Green: on track or recently mastered something (positive signal)
- → ↑ ↓ Trend arrows next to metrics. More scannable than percentage-point deltas.

### Three-Zoom Architecture — One Page

Don't build a separate analytics page. Embed analytics in the course detail page at three levels, switchable via tabs:

1. **Class tab**: Which concepts is the whole class struggling with? (bar chart or ranked list)
2. **Students tab**: Which students are at risk? (alert list with status colors)
3. **Individual** (click-through): Student session history + concept mastery map (slide-in panel)

---

## Micro-interactions

| Trigger | Animation |
|---|---|
| Exercise correct | 300ms green flash on card border + +XP toaster slides in from top-right, fades after 2s |
| Exercise incorrect | 200ms horizontal shake (±3px oscillation, 3 cycles) on card |
| Concept mastered | Inline mastery pill fades in with a subtle scale-up (105% → 100%, 200ms) |
| AI streaming | Typing indicator (3-dot pulse) before first token arrives |
| Panel open/close | Slide in/out, 200ms ease-in-out |
| Sidebar collapse | Width transition, 200ms ease-in-out |

All durations are short. Micro-interactions should feel responsive, not theatrical.

---

## What Not To Do

- Do not show the correct answer on an exercise card at any point — this breaks the Socratic constraint
- Do not use percentage scores to represent concept mastery on student-facing surfaces
- Do not put XP/streaks in a hero banner or make them the first thing a student sees
- Do not use multiple accent colors for different content types — use surface + border instead
- Do not hover-reveal the materials panel — use explicit toggle
- Do not build a separate analytics page for teachers — embed alerts contextually
- Do not show alerts without human-readable explanations of why they were triggered
- Do not re-add dark mode CSS (dark mode is a future planned feature)
