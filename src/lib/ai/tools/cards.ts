import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "@/db";
import { cardDefinitions, deckDefinitions, tags, cardTags } from "@/db/schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { canViewDeck, canEditDeck } from "@/lib/permissions";
import { insertCard, updateCardContent } from "@/lib/card-helpers";
import { upsertTags } from "@/lib/tag-helpers";
import { summarizeCardContent, stripContentFields, truncate } from "./helpers";
import type { ToolDefinition } from "../types";
import { cleanupRemovedAssets } from "@/lib/asset-cleanup";

const MAX_CARD_CONTENT_LENGTH = 4000;

export function createCardTools(userId: string): ToolDefinition[] {
  const listCards = tool(
    async ({ deckId, limit }: { deckId: string; limit?: number }) => {
      const [deck] = await db
        .select({
          id: deckDefinitions.id,
          linkedDeckDefinitionId: deckDefinitions.linkedDeckDefinitionId,
        })
        .from(deckDefinitions)
        .where(eq(deckDefinitions.id, deckId));

      if (!deck) {
        return JSON.stringify({
          error: `Deck not found (id: ${deckId}). Verify the deck ID is correct.`,
        });
      }

      const allowed = await canViewDeck(deckId, userId);
      if (!allowed) {
        return JSON.stringify({ error: "You don't have access to this deck" });
      }

      const sourceDeckId = deck.linkedDeckDefinitionId ?? deckId;
      const take = Math.min(limit ?? 20, 50);

      const cardRows = await db
        .select({
          id: cardDefinitions.id,
          cardType: cardDefinitions.cardType,
          contentJson: cardDefinitions.contentJson,
        })
        .from(cardDefinitions)
        .where(
          and(
            eq(cardDefinitions.deckDefinitionId, sourceDeckId),
            isNull(cardDefinitions.archivedAt),
            isNull(cardDefinitions.parentCardId),
          ),
        )
        .orderBy(cardDefinitions.createdAt)
        .limit(take);

      if (cardRows.length === 0) {
        return JSON.stringify({ cards: [], totalCount: 0 });
      }

      const cardIds = cardRows.map((c) => c.id);

      const tagRows = await db
        .select({
          cardDefinitionId: cardTags.cardDefinitionId,
          tagName: tags.name,
        })
        .from(cardTags)
        .innerJoin(tags, eq(cardTags.tagId, tags.id))
        .where(inArray(cardTags.cardDefinitionId, cardIds));

      const cardTagsMap = new Map<string, string[]>();
      for (const r of tagRows) {
        const arr = cardTagsMap.get(r.cardDefinitionId) ?? [];
        arr.push(r.tagName);
        cardTagsMap.set(r.cardDefinitionId, arr);
      }

      const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(cardDefinitions)
        .where(
          and(
            eq(cardDefinitions.deckDefinitionId, sourceDeckId),
            isNull(cardDefinitions.archivedAt),
            isNull(cardDefinitions.parentCardId),
          ),
        );

      const cards = cardRows.map((c) => ({
        id: c.id,
        cardType: c.cardType,
        preview: summarizeCardContent(c.contentJson, c.cardType),
        tags: cardTagsMap.get(c.id) ?? [],
      }));

      return JSON.stringify({ cards, totalCount: countRow?.count ?? 0 });
    },
    {
      name: "list_cards",
      description:
        "List cards in a deck with a short preview of each card's content. Use get_card for full content.",
      schema: z.object({
        deckId: z.string().uuid().describe("The deck ID to list cards from."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Max cards to return (default 20, max 50)."),
      }),
    },
  );

  const getCard = tool(
    async ({ cardId }: { cardId: string }) => {
      const [card] = await db
        .select({
          id: cardDefinitions.id,
          deckDefinitionId: cardDefinitions.deckDefinitionId,
          cardType: cardDefinitions.cardType,
          contentJson: cardDefinitions.contentJson,
          createdAt: cardDefinitions.createdAt,
          updatedAt: cardDefinitions.updatedAt,
        })
        .from(cardDefinitions)
        .where(eq(cardDefinitions.id, cardId));

      if (!card) {
        return JSON.stringify({
          error: `Card not found (id: ${cardId}). Verify the card ID is correct.`,
        });
      }

      const allowed = await canViewDeck(card.deckDefinitionId, userId);
      if (!allowed) {
        return JSON.stringify({ error: "You don't have access to this card" });
      }

      const tagRows = await db
        .select({ name: tags.name })
        .from(cardTags)
        .innerJoin(tags, eq(cardTags.tagId, tags.id))
        .where(eq(cardTags.cardDefinitionId, cardId));

      const cleanedContent = stripContentFields(card.contentJson);
      const contentStr = JSON.stringify(cleanedContent);
      const finalContent =
        contentStr.length > MAX_CARD_CONTENT_LENGTH
          ? JSON.parse(truncate(contentStr, MAX_CARD_CONTENT_LENGTH))
          : cleanedContent;

      return JSON.stringify({
        id: card.id,
        cardType: card.cardType,
        content: finalContent,
        tags: tagRows.map((r) => r.name),
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      });
    },
    {
      name: "get_card",
      description:
        "Get the full content of a specific card by ID. Returns the card type, full content fields (HTML stripped), and tags.",
      schema: z.object({
        cardId: z.string().uuid().describe("The card ID to look up."),
      }),
    },
  );

  const createCard = tool(
    async ({
      deckId,
      cardType,
      content,
      createReverse,
      tagNames,
    }: {
      deckId: string;
      cardType: string;
      content: Record<string, unknown>;
      createReverse?: boolean;
      tagNames?: string[];
    }) => {
      const [deckRow] = await db
        .select({ id: deckDefinitions.id })
        .from(deckDefinitions)
        .where(eq(deckDefinitions.id, deckId));

      if (!deckRow) {
        return JSON.stringify({
          error: `Deck not found (id: ${deckId}). Verify the deck ID is correct.`,
        });
      }

      const canEdit = await canEditDeck(deckId, userId);
      if (!canEdit) {
        return JSON.stringify({ error: "You don't have permission to add cards to this deck" });
      }

      const result = await insertCard({
        deckDefinitionId: deckId,
        cardType,
        contentJson: content,
        userId,
        createReverse,
      });

      if (!result.success) {
        return JSON.stringify({ error: result.error });
      }

      if (tagNames && tagNames.length > 0) {
        const normalized = tagNames
          .slice(0, 10)
          .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
          .filter((t) => t.length > 0 && t.length <= 50 && /^[a-z0-9-]+$/.test(t));

        if (normalized.length > 0) {
          const nameToId = await upsertTags(normalized);
          const tagIds = normalized.map((n) => nameToId.get(n)).filter(Boolean) as string[];
          if (tagIds.length > 0) {
            await db
              .insert(cardTags)
              .values(tagIds.map((tagId) => ({ cardDefinitionId: result.data.id, tagId })));
          }
        }
      }

      return JSON.stringify({ id: result.data.id, cardType });
    },
    {
      name: "create_card",
      description: `Create a new flashcard in a deck. Requires editor role. Content shape depends on cardType:

- front_back: { "front": "question text", "back": "answer text" }
- cloze: { "text": "The {{c1::mitochondria}} is the powerhouse of the cell" }
- multiple_choice: { "question": "What is 2+2?", "choices": ["3", "4", "5", "6"], "correctChoiceIndexes": [1] }
- keyboard_shortcut: { "prompt": "Save file", "shortcut": { "key": "s", "ctrl": true }, "explanation": "Ctrl+S saves" }

Set createReverse=true for front_back cards to also generate a reversed card. Tags are optional.`,
      schema: z.object({
        deckId: z.string().uuid().describe("The deck ID to add the card to."),
        cardType: z
          .enum(["front_back", "cloze", "multiple_choice", "keyboard_shortcut"])
          .describe("The card type."),
        content: z
          .record(z.string(), z.unknown())
          .describe("Card content JSON — shape depends on cardType (see description)."),
        createReverse: z
          .boolean()
          .optional()
          .describe("For front_back cards, also create a reversed version."),
        tagNames: z
          .array(z.string())
          .max(10)
          .optional()
          .describe("Optional tags to attach to the card."),
      }),
    },
  );

  const updateCard = tool(
    async ({ cardId, content }: { cardId: string; content: Record<string, unknown> }) => {
      const [card] = await db
        .select({
          deckDefinitionId: cardDefinitions.deckDefinitionId,
          cardType: cardDefinitions.cardType,
        })
        .from(cardDefinitions)
        .where(eq(cardDefinitions.id, cardId));

      if (!card) {
        return JSON.stringify({
          error: `Card not found (id: ${cardId}). Verify the card ID is correct.`,
        });
      }

      const canEdit = await canEditDeck(card.deckDefinitionId, userId);
      if (!canEdit) {
        return JSON.stringify({ error: "You don't have permission to edit this card" });
      }

      const result = await updateCardContent({ cardId, contentJson: content, userId });

      if (!result.success) {
        return JSON.stringify({ error: result.error });
      }

      return JSON.stringify({ id: cardId, cardType: card.cardType });
    },
    {
      name: "update_card",
      description:
        "Update a card's content. The content JSON must match the card's existing type. Use get_card first to see the current content and type.",
      schema: z.object({
        cardId: z.string().uuid().describe("The card ID to update."),
        content: z
          .record(z.string(), z.unknown())
          .describe("Updated card content JSON — must match the card's type."),
      }),
    },
  );

  const archiveCard = tool(
    async ({ cardId }: { cardId: string }) => {
      const [card] = await db
        .select({
          id: cardDefinitions.id,
          deckDefinitionId: cardDefinitions.deckDefinitionId,
          cardType: cardDefinitions.cardType,
          contentJson: cardDefinitions.contentJson,
          parentCardId: cardDefinitions.parentCardId,
        })
        .from(cardDefinitions)
        .where(eq(cardDefinitions.id, cardId));

      if (!card) {
        return JSON.stringify({ error: `Card not found (id: ${cardId})` });
      }

      const canEdit = await canEditDeck(card.deckDefinitionId, userId);
      if (!canEdit) {
        return JSON.stringify({ error: "You don't have permission to remove this card" });
      }

      await db
        .update(cardDefinitions)
        .set({ archivedAt: new Date(), updatedAt: new Date(), updatedByUserId: userId })
        .where(eq(cardDefinitions.id, cardId));

      if (card.cardType === "cloze" && !card.parentCardId) {
        await db
          .update(cardDefinitions)
          .set({ archivedAt: new Date(), updatedAt: new Date(), updatedByUserId: userId })
          .where(and(eq(cardDefinitions.parentCardId, cardId), isNull(cardDefinitions.archivedAt)));
      }

      await cleanupRemovedAssets(card.contentJson, {}, cardId);

      return JSON.stringify({ id: cardId, archived: true });
    },
    {
      name: "archive_card",
      description:
        "Remove (archive) a card. The card is hidden from the user but not permanently deleted. Requires editor role.",
      schema: z.object({
        cardId: z.string().uuid().describe("The card ID to archive."),
      }),
    },
  );

  return [
    {
      tool: listCards,
      category: "read" as const,
      examples: ['User: "Show me the cards in that deck" → Call list_cards with deckId'],
    },
    {
      tool: getCard,
      category: "read" as const,
      examples: ['User: "What does that card say?" → Call get_card to read full content'],
    },
    {
      tool: createCard,
      category: "write" as const,
      examples: [
        'User: "Make me a card about mitochondria" → Call create_card with cardType "front_back", front: "What is the primary function of mitochondria?", back: "ATP production (cellular energy)"',
        'User: "Add 3 cards about the water cycle" → Batch all 3 create_card calls in a single round to conserve budget',
      ],
    },
    {
      tool: updateCard,
      category: "write" as const,
      examples: [
        'User: "Make that card a cloze instead" → Call get_card to read current content, then create a new card (you cannot change card type via update)',
      ],
    },
    {
      tool: archiveCard,
      category: "write" as const,
      examples: ['User: "Remove that card" → Call archive_card with the card ID'],
    },
  ];
}
