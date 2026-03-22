import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { reportError } from "@/lib/errors";
import { stripHtml } from "@/lib/sanitize-html";
import { createLlm, getAvailableProviders, isFallbackWorthy } from "../llm";
import { AI_MODELS } from "../models";
import type { ProviderConfig } from "../types";

const TAG_REGEX = /^[a-zA-Z0-9\s-]+$/;
const MAX_TAG_LENGTH = 50;
const MAX_CARD_CONTENT_LENGTH = 2000;
const MAX_USER_TAGS = 50;

const tagSuggestionSchema = z.object({
  tags: z.array(z.string()).length(3),
});

export interface SuggestTagsInput {
  deckTitle: string;
  deckDescription: string | null;
  deckTags: string[];
  cardContent: string | null;
  cardType: string | null;
  existingCardTags: string[];
  userTags: string[];
}

export interface SuggestTagsResult {
  tags: string[];
  usage: { inputTokens: number; outputTokens: number };
  provider: ProviderConfig;
}

export async function suggestTags(input: SuggestTagsInput): Promise<SuggestTagsResult | null> {
  const providers = getAvailableProviders("tagSuggestion");
  if (providers.length === 0) return null;

  const cardText = input.cardContent
    ? stripHtml(input.cardContent).slice(0, MAX_CARD_CONTENT_LENGTH)
    : "";

  const userTagsList = input.userTags.slice(0, MAX_USER_TAGS);

  const systemPrompt = [
    "You are a tagging assistant for a flashcard study app.",
    "Tags are used to create custom study sessions that pull cards from multiple decks by topic. A user studying 'cell biology' should get all relevant cards across all their decks, so tags must accurately group related content.",
    "Given a flashcard's context, suggest exactly 3 short, relevant tags.",
    "",
    "Rules:",
    "- Tags must be lowercase, using hyphens instead of spaces (e.g. 'organic-chemistry', not 'organic chemistry').",
    "- Tags can only contain letters, numbers, and hyphens. Each tag must be at most 50 characters.",
    "- Avoid purely meta tags like 'review' or 'important', 'advanced', 'beginner' that say nothing about the subject.",
    "- Primary goal: reuse tags from the user's existing tags whenever a relevant match exists. Grouping related cards across decks is the core purpose of tags, so consistent reuse is critical.",
    "- Secondary goal: if no existing tag fits, create a new topic-specific tag relevant to the card content.",
    "- Try and include at least 1 tag that is already used by the user.",
    "- Return exactly 3 unique tags that are NOT in the excluded list.",
    input.existingCardTags.length > 0
      ? `- EXCLUDED (do NOT return any of these, the card already has them): ${input.existingCardTags.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = [
    `Deck: ${input.deckTitle}`,
    input.deckDescription ? `Deck description: ${input.deckDescription}` : "",
    input.deckTags.length > 0 ? `Deck tags: ${input.deckTags.join(", ")}` : "",
    input.cardType ? `Card type: ${input.cardType.replace(/_/g, " ")}` : "",
    cardText ? `Card content: ${cardText}` : "",
    userTagsList.length > 0
      ? `User's existing tags (prefer reusing these): ${userTagsList.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)];

  if (process.env.NODE_ENV !== "production") {
    console.debug("[ai] system prompt:\n", systemPrompt);
    console.debug("[ai] user prompt:\n", userPrompt);
  }

  let lastError: unknown;

  for (const provider of providers) {
    const llm = createLlm(provider, AI_MODELS.tagSuggestion.maxOutputTokens);
    const structured = llm.withStructuredOutput(tagSuggestionSchema, { includeRaw: true });

    try {
      const { raw, parsed } = await structured.invoke(messages);

      const usage = (
        raw as unknown as { usage_metadata?: { input_tokens?: number; output_tokens?: number } }
      ).usage_metadata;
      const inputTokens = usage?.input_tokens ?? 0;
      const outputTokens = usage?.output_tokens ?? 0;

      const validTags = parsed.tags
        .map((t: string) => t.toLowerCase().trim().replace(/\s+/g, "-"))
        .filter((t: string) => t.length > 0 && t.length <= MAX_TAG_LENGTH && TAG_REGEX.test(t));

      return { tags: validTags, usage: { inputTokens, outputTokens }, provider };
    } catch (e: unknown) {
      lastError = e;

      if (isFallbackWorthy(e)) {
        reportError(e, {
          context: "suggestTags",
          provider: provider.name,
          model: provider.model,
          fallback: true,
        });
        continue;
      }

      throw e;
    }
  }

  throw lastError;
}
