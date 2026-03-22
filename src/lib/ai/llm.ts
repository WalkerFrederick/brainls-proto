import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AI_MODELS } from "./models";
import type { ProviderConfig } from "./types";

export function createLlm(
  provider: ProviderConfig,
  maxTokens: number,
  temperature = 0.3,
): BaseChatModel {
  switch (provider.name) {
    case "anthropic":
      return new ChatAnthropic({
        modelName: provider.model,
        maxTokens,
        temperature,
      });
    case "openai":
      return new ChatOpenAI({
        modelName: provider.model,
        maxTokens,
        temperature,
      });
  }
}

export function getAvailableProviders(modelKey: string): ProviderConfig[] {
  const config = AI_MODELS[modelKey];
  if (!config) return [];
  return config.providers.filter((p) => !!process.env[p.envKey]);
}

export function isFallbackWorthy(e: unknown): boolean {
  const status = (e as { status?: number }).status;
  if (typeof status === "number") {
    return status === 404 || status === 429 || status >= 500;
  }
  const message = e instanceof Error ? e.message : String(e);
  return /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|fetch failed|network/i.test(message);
}
