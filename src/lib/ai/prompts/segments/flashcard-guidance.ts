import type { PromptContext } from "../../types";

export function flashcardGuidance(_ctx: PromptContext): string {
  return `Flashcard Guidance: Encourage atomic single-concept cards, prefer active recall, suggest cloze when appropriate, break complex ideas into multiple cards.`;
}
