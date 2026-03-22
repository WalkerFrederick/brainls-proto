import type { StructuredToolInterface } from "@langchain/core/tools";

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

export interface ToolDefinition {
  tool: StructuredToolInterface;
  category: "read" | "write";
  examples: string[];
}

export interface PromptContext {
  tools: ToolDefinition[];
  maxIterations: number;
  user?: {
    name: string;
    tier: string;
  };
}
