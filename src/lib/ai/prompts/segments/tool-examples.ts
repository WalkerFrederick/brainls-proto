import type { PromptContext } from "../../types";

export function toolExamples(ctx: PromptContext): string | null {
  const examples = ctx.tools.flatMap((t) => t.examples);
  if (examples.length === 0) return null;

  return `Tool usage examples:\n${examples.map((e) => `- ${e}`).join("\n")}`;
}
