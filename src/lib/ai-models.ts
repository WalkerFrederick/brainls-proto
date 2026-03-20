export interface ProviderConfig {
  name: "anthropic" | "openai";
  model: string;
  envKey: string;
  pricing: { inputPerM: number; outputPerM: number };
}

export interface ModelConfig {
  providers: readonly ProviderConfig[];
  maxOutputTokens: number;
}

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
};
