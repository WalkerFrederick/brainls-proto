import type { PromptContext } from "../types";
import { identity } from "./segments/identity";
import { style } from "./segments/style";
import { flashcardGuidance } from "./segments/flashcard-guidance";
import { toolRules } from "./segments/tool-rules";
import { toolExamples } from "./segments/tool-examples";
import { guardrails } from "./segments/guardrails";

type SegmentFn = (ctx: PromptContext) => string | null;

const SEGMENT_ORDER: SegmentFn[] = [
  identity,
  style,
  flashcardGuidance,
  toolRules,
  toolExamples,
  guardrails,
];

export function buildSystemPrompt(ctx: PromptContext): string {
  return SEGMENT_ORDER.map((fn) => fn(ctx))
    .filter(Boolean)
    .join("\n\n");
}
