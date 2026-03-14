# Anki Keyboard Shortcuts Reference

Research on Anki's keyboard shortcuts for informing brainls hotkey design.
Targeting users converting from Anki — these are the shortcuts burned into their muscle memory.

---

## Tier 1 — The Essentials (every Anki user knows these)

These are used hundreds of times per study session. Non-negotiable for Anki converts.

| Shortcut         | Action                          | Context  |
| ---------------- | ------------------------------- | -------- |
| `Space` / `Enter`| Flip card / show answer         | Review   |
| `1`              | Rate: Again (fail)              | Review   |
| `2`              | Rate: Hard                      | Review   |
| `3`              | Rate: Good                      | Review   |
| `4`              | Rate: Easy                      | Review   |
| `Ctrl/Cmd + Z`   | Undo last action                | Global   |

## Tier 2 — Frequent Use (daily users rely on these)

Used during review to manage cards without leaving the study flow.

| Shortcut         | Action                          | Context  |
| ---------------- | ------------------------------- | -------- |
| `E`              | Edit current card               | Review   |
| `*`              | Mark / star note                | Review   |
| `-`              | Bury card (skip until tomorrow) | Review   |
| `=`              | Suspend card (remove from rotation) | Review |
| `@`              | Suspend note (all cards for this note) | Review |
| `R`              | Replay audio                    | Review   |
| `V`              | Play recorded voice             | Review   |
| `Shift + V`      | Record voice                    | Review   |

## Tier 3 — Navigation (home screen / global)

Single-key navigation from the main screen. Very fast, very loved.

| Shortcut | Action             | Context     |
| -------- | ------------------ | ----------- |
| `D`      | Go to Decks        | Home        |
| `A`      | Add new card       | Home        |
| `B`      | Open Browser       | Home        |
| `T`      | Open Stats         | Home        |
| `Y`      | Sync               | Home        |
| `S`      | Start studying     | Deck screen |
| `/`      | Study custom / filtered deck | Home |

## Tier 4 — Editor / Card Creation

Used when adding or editing cards.

| Shortcut              | Action                    | Context |
| --------------------- | ------------------------- | ------- |
| `Ctrl/Cmd + B`        | Bold                      | Editor  |
| `Ctrl/Cmd + I`        | Italic                    | Editor  |
| `Ctrl/Cmd + U`        | Underline                 | Editor  |
| `Ctrl/Cmd + Shift + C`| Cloze deletion            | Editor  |
| `Ctrl/Cmd + Shift + X`| Open HTML editor          | Editor  |
| `Ctrl/Cmd + Enter`    | Add card & keep editor open | Editor |
| `Ctrl/Cmd + Shift + T`| Tag card                  | Editor  |
| `Tab`                 | Move to next field        | Editor  |
| `Shift + Tab`         | Move to previous field    | Editor  |
| `F5`                  | Toggle sticky field       | Editor  |

## Tier 5 — Browser (Power Users)

The Browse window (`B`) is where power users spend serious time organizing.

| Shortcut                   | Action                        | Context |
| -------------------------- | ----------------------------- | ------- |
| `Ctrl/Cmd + F`             | Find / search notes           | Browser |
| `Ctrl/Cmd + Shift + S`     | Filter by tag                 | Browser |
| `Ctrl/Cmd + A`             | Select all                    | Browser |
| `Ctrl/Cmd + D`             | Delete selected notes         | Browser |
| `Ctrl/Cmd + Alt + T`       | Toggle Cards / Notes view     | Browser |
| `Ctrl/Cmd + Enter`         | Preview card                  | Browser |
| `Ctrl + Click`             | AND search (append filter)    | Browser sidebar |
| `Shift + Click`            | OR search                     | Browser sidebar |
| `Alt/Opt + Click`          | Negate search (NOT)           | Browser sidebar |

---

## Patterns Worth Noting

### Single-key shortcuts during review
Anki uses bare keys (`1-4`, `E`, `R`, `*`, `-`, `=`) during review because the user
isn't typing — they're just answering cards. This is a huge part of what makes Anki
feel fast. Any brainls review mode should preserve this pattern.

### Single-key navigation from home
`D`, `A`, `B`, `T`, `Y` from the home screen lets users jump anywhere instantly.
No modifier keys needed. This works because the home screen has no text inputs.

### Modifier keys only in editors
`Ctrl/Cmd` combos only appear where the user might be typing (editor, browser).
This prevents conflicts with text input.

### The `Space` flip is sacred
Every Anki user's deepest muscle memory is `Space` to flip a card. This must be
preserved exactly.

### Number keys for grading
`1-4` for difficulty rating is so ingrained that many users don't even think about it.
The mapping (1 = worst, 4 = best) is counterintuitive but universally learned.

### Bury vs Suspend mental model
- **Bury** (`-`): "I don't want to see this today, but bring it back tomorrow"
- **Suspend** (`=`): "Remove this from rotation entirely until I manually unsuspend"
- Both are used constantly. Users expect both concepts to exist.

---

## Sources
- https://keycombiner.com/collections/anki/
- https://docs.ankiweb.net/browsing
- https://anki-decks.com/blog/post/anki-shortcuts-cheatsheet/
- https://forums.ankiweb.net/t/keyboard-shortcut-usage/21280
