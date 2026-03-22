import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "@/db";
import { deckDefinitions, cardDefinitions, tags, deckTags, cardTags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canEditDeck } from "@/lib/permissions";
import { upsertTags } from "@/lib/tag-helpers";
import type { ToolDefinition } from "../types";

export function createTagTools(userId: string): ToolDefinition[] {
  const setTags = tool(
    async ({
      targetType,
      targetId,
      tagNames: rawTags,
    }: {
      targetType: "card" | "deck";
      targetId: string;
      tagNames: string[];
    }) => {
      const normalized = [
        ...new Set(
          rawTags
            .slice(0, 10)
            .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
            .filter((t) => t.length > 0 && t.length <= 50 && /^[a-z0-9-]+$/.test(t)),
        ),
      ];

      if (targetType === "deck") {
        const [deckRow] = await db
          .select({ id: deckDefinitions.id })
          .from(deckDefinitions)
          .where(eq(deckDefinitions.id, targetId));

        if (!deckRow) {
          return JSON.stringify({
            error: `Deck not found (id: ${targetId}). Verify the deck ID is correct.`,
          });
        }

        const canEdit = await canEditDeck(targetId, userId);
        if (!canEdit) {
          return JSON.stringify({ error: "You don't have permission to edit this deck's tags" });
        }

        const nameToId = await upsertTags(normalized);
        await db.delete(deckTags).where(eq(deckTags.deckDefinitionId, targetId));
        if (normalized.length > 0) {
          const tagIds = normalized.map((n) => nameToId.get(n)).filter(Boolean) as string[];
          if (tagIds.length > 0) {
            await db
              .insert(deckTags)
              .values(tagIds.map((tagId) => ({ deckDefinitionId: targetId, tagId })));
          }
        }

        return JSON.stringify({ tags: normalized });
      }

      const [card] = await db
        .select({ deckDefinitionId: cardDefinitions.deckDefinitionId })
        .from(cardDefinitions)
        .where(eq(cardDefinitions.id, targetId));

      if (!card) {
        return JSON.stringify({
          error: `Card not found (id: ${targetId}). Verify the card ID is correct.`,
        });
      }

      const canEdit = await canEditDeck(card.deckDefinitionId, userId);
      if (!canEdit) {
        return JSON.stringify({ error: "You don't have permission to edit this card's tags" });
      }

      const nameToId = await upsertTags(normalized);
      await db.delete(cardTags).where(eq(cardTags.cardDefinitionId, targetId));
      if (normalized.length > 0) {
        const tagIds = normalized.map((n) => nameToId.get(n)).filter(Boolean) as string[];
        if (tagIds.length > 0) {
          await db
            .insert(cardTags)
            .values(tagIds.map((tagId) => ({ cardDefinitionId: targetId, tagId })));
        }
      }

      return JSON.stringify({ tags: normalized });
    },
    {
      name: "set_tags",
      description:
        "Set (replace) tags on a card or deck. Pass the full desired tag list — existing tags will be replaced. Requires editor role.",
      schema: z.object({
        targetType: z.enum(["card", "deck"]).describe("Whether to tag a card or a deck."),
        targetId: z.string().uuid().describe("The card or deck ID."),
        tagNames: z
          .array(z.string())
          .max(10)
          .describe("Tag names to set. Max 10. Tags should be lowercase with hyphens."),
      }),
    },
  );

  return [
    {
      tool: setTags,
      category: "write" as const,
      examples: [
        'User: "Tag that deck with biology and cells" → Call set_tags with targetType "deck" and tagNames ["biology", "cells"]',
      ],
    },
  ];
}
