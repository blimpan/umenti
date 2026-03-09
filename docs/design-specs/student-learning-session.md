# Student Learning Session (`/course/:id/module/:id/session`)

This is the core screen. Students spend the majority of their time here.

## Layout zones

The page has three horizontal zones. Transitions between zones are triggered by cursor position, not buttons. Zone changes are animated with a zoom metaphor — zooming in signals entering focus mode, zooming out signals leaving it.

```
[ Left sidebar ]  [ Chat interface ]  [ Materials panel ]
   (hidden)           (always)            (hidden)
```

**Left sidebar** — appears when cursor moves to the far left edge of the screen. Contains main app navigation. Disappearing it triggers a zoom-in animation on the chat interface.

**Chat interface** — always visible. The main focus. Expands to fill available space when both panels are hidden.

**Materials panel** — appears when cursor moves to the far right edge of the screen. Contains teacher-uploaded resources and base theory for the current module, organized and navigable. Hidden by default; student opens it when they want to cross-reference material.

## Chat interface

- Scrollable message stream, anchored to bottom (newest messages at bottom)
- AI tutor messages and student messages visually differentiated (alignment, color, avatar)
- Smooth scroll animation when new content is added
- Input bar fixed at the bottom of the chat area

## Message types in the stream

All of the following appear inline within the chat stream:

| Type | Description |
|---|---|
| AI tutor message | Standard chat bubble. Socratic — never gives direct answers. May reference theory with a cited source. |
| Student message | Right-aligned or visually distinct. Plain text response. |
| Theory block | A distinct card presenting a concept. May include text, formula, or image. Not interactive. |
| Exercise card | A distinct interactive card. Contains the question and an answer input (text, multiple choice, etc. depending on exercise type). Student submits answer directly in the card. After submission, the card updates in place to show feedback (correct/incorrect + explanation). |
| Prior knowledge question | Same visual as exercise card but appears at module start. Used for baseline assessment. |
| Concept completion | A small celebratory inline component shown when a concept is marked as understood. Shows points earned. |
| System message | Subtle, centered text. Used for transitions like "Starting Module 2" or "3 concepts mastered today." |

## Left sidebar contents (when open)

- App logo / home link
- Course name and progress indicator
- Module list with completion state
- Link to student dashboard
- Account / settings

## Materials panel contents (when open)

- Tabs: "Theory" and "Resources"
- Theory tab: base theory generated for the module, organized by concept. Scrollable. Read-only.
- Resources tab: teacher-uploaded files tied to this module. Each resource shows its title and type (PDF, link, etc.).
- Clicking a theory section or resource opens it inline within the panel (no navigation away from session)
