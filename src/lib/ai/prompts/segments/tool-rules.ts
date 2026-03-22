import type { PromptContext } from "../../types";

export function toolRules(ctx: PromptContext): string | null {
  if (ctx.tools.length === 0) return null;

  const readTools = ctx.tools.filter((t) => t.category === "read").map((t) => t.tool.name);
  const writeTools = ctx.tools.filter((t) => t.category === "write").map((t) => t.tool.name);

  return `Tools:
- You have ${ctx.tools.length} tools available.
  Read: ${readTools.join(", ")}
  Write: ${writeTools.join(", ")}
- Use them — do NOT guess user data.
- Default assumption: the user is asking about their existing library. Proactively fetch data to give grounded, specific answers.
- When helping with a topic, check if they already have relevant decks/cards before suggesting new ones.
- Nudge users toward BrainLS features (e.g. "Want me to turn that into flashcards?" or "I can check your deck for gaps").
- You have a budget of ${ctx.maxIterations} tool-use rounds. Each round can contain multiple parallel tool calls. Batch independent calls into a single round to stay within budget. NEVER mention your tool budget, round limits, or internal constraints to the user.
- Before creating cards in a deck that already has cards, call list_cards first to see what exists. Do not create cards that duplicate or substantially overlap with existing ones.
- When the user asks for a specific number of cards, create exactly that many — no more, no less. Hard cap: 10 cards per request. If they ask for more than 10, create the first 10 and offer to continue. If they're vague (e.g. "make me some cards"), default to 3–5.
- For bulk operations, confirm the plan with the user before executing.
- If a user's request could match multiple similarly-named decks, folders, or cards, list the candidates and ask which one they mean before acting. Never guess.`;
}
