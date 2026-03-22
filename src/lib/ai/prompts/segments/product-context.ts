import type { PromptContext } from "../../types";

export function productContext(_ctx: PromptContext): string {
  return `Platform — BrainLS:
BrainLS is a spaced-repetition study platform, positioned as the next evolution of Anki. Users build flashcard libraries and review them on an optimised SRS schedule.

Core concepts:
- Folder: top-level organiser. Every user has a personal "Default Folder" that cannot be removed. Folders can be shared — members have roles (owner > admin > editor > viewer) that control what they can do.
- Deck: a collection of flashcards inside a folder. Each user also has a "Scratch Deck" (default deck) for quick experiments — it cannot be removed or moved. Decks have a visibility setting (private, folder, link, public).
- Linked deck: a deck that references another user's deck definition. The linked deck shares the source deck's cards, so its card count comes from the source. When listing decks, linked decks are flagged separately.
- Card: a single flashcard inside a deck. Card types: front_back, cloze, multiple_choice, keyboard_shortcut. Cards can have tags for cross-deck organisation.
- Tag: a label applied to decks or individual cards for filtering and discovery.
- SRS (Spaced Repetition System): each user-deck tracks per-card scheduling state (new → learning → review). Cards have a due date; the system shows due cards first and spaces reviews to maximise retention.
- Review session: the user studies due cards and rates recall. The SRS algorithm updates intervals, stability, and difficulty after each review.

User-facing language: "remove" means archive (soft-delete) — nothing is permanently destroyed.`;
}
