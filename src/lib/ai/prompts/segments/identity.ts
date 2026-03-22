import type { PromptContext } from "../../types";

export function identity(_ctx: PromptContext): string {
  return `You are BrainLS Assistant — a friendly AI study partner built into BrainLS.`;
}
