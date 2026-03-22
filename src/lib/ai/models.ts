import type { ModelConfig } from "./types";

export const AI_MODELS: Record<string, ModelConfig> = {
  tagSuggestion: {
    providers: [
      {
        name: "anthropic",
        model: "claude-haiku-4-5-20251001",
        envKey: "ANTHROPIC_API_KEY",
        pricing: { inputPerM: 1.0, outputPerM: 5.0 },
      },
      {
        name: "openai",
        model: "gpt-4o-mini",
        envKey: "OPENAI_API_KEY",
        pricing: { inputPerM: 0.15, outputPerM: 0.6 },
      },
    ],
    maxOutputTokens: 100,
  },
  chat: {
    providers: [
      {
        name: "anthropic",
        model: "claude-sonnet-4-20250514",
        envKey: "ANTHROPIC_API_KEY",
        pricing: { inputPerM: 3.0, outputPerM: 15.0 },
      },
      {
        name: "openai",
        model: "gpt-4o",
        envKey: "OPENAI_API_KEY",
        pricing: { inputPerM: 2.5, outputPerM: 10.0 },
      },
    ],
    maxOutputTokens: 4096,
  },
};
