import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../prompts/builder";
import type { PromptContext } from "../types";

const mockTool = (name: string, category: "read" | "write", examples: string[] = []) => ({
  tool: { name } as never,
  category,
  examples,
});

describe("buildSystemPrompt", () => {
  it("assembles all segments with tools", () => {
    const ctx: PromptContext = {
      tools: [
        mockTool("list_decks", "read", ['User: "Show me my decks" → Call list_decks']),
        mockTool("create_card", "write", ['User: "Make a card about X" → Call create_card']),
      ],
      maxIterations: 12,
    };

    const result = buildSystemPrompt(ctx);
    expect(result).toMatchSnapshot();
  });

  it("omits tool segments when no tools", () => {
    const ctx: PromptContext = {
      tools: [],
      maxIterations: 12,
    };

    const result = buildSystemPrompt(ctx);
    expect(result).not.toContain("Tools:");
    expect(result).not.toContain("Tool usage examples:");
    expect(result).toContain("BrainLS Assistant");
    expect(result).toContain("Flashcard Guidance");
    expect(result).toContain("Rules:");
  });

  it("omits examples when tools have none", () => {
    const ctx: PromptContext = {
      tools: [mockTool("get_user_details", "read")],
      maxIterations: 8,
    };

    const result = buildSystemPrompt(ctx);
    expect(result).toContain("Tools:");
    expect(result).toContain("budget of 8 tool-use rounds");
    expect(result).not.toContain("Tool usage examples:");
  });
});
