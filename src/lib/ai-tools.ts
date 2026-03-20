import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "@/db";
import {
  users,
  userDecks,
  userCardStates,
  cardDefinitions,
  deckDefinitions,
  folders,
  folderMembers,
  tags,
  deckTags,
  cardTags,
} from "@/db/schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { getAiLimitInfo, getAiUsageCount } from "@/lib/tiers";
import { canViewDeck } from "@/lib/permissions";
import { stripHtml } from "@/lib/sanitize-html";

const MAX_PREVIEW_LENGTH = 200;
const MAX_CARD_CONTENT_LENGTH = 4000;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

function summarizeCardContent(contentJson: unknown, cardType: string): string {
  const content = contentJson as Record<string, unknown>;
  try {
    switch (cardType) {
      case "front_back": {
        const front = stripHtml(String(content.front ?? "")).trim();
        const back = stripHtml(String(content.back ?? "")).trim();
        return truncate(`Front: ${front} | Back: ${back}`, MAX_PREVIEW_LENGTH);
      }
      case "cloze": {
        const text = stripHtml(String(content.text ?? "")).trim();
        return truncate(`Cloze: ${text}`, MAX_PREVIEW_LENGTH);
      }
      case "multiple_choice": {
        const q = stripHtml(String(content.question ?? "")).trim();
        const choices = Array.isArray(content.choices)
          ? content.choices.map((c: unknown) => stripHtml(String(c)).trim()).join(", ")
          : "";
        return truncate(`Q: ${q} | Choices: ${choices}`, MAX_PREVIEW_LENGTH);
      }
      case "keyboard_shortcut": {
        const prompt = stripHtml(String(content.prompt ?? "")).trim();
        return truncate(`Shortcut prompt: ${prompt}`, MAX_PREVIEW_LENGTH);
      }
      default: {
        const raw = JSON.stringify(content);
        return truncate(raw, MAX_PREVIEW_LENGTH);
      }
    }
  } catch {
    return truncate(JSON.stringify(content), MAX_PREVIEW_LENGTH);
  }
}

function stripContentFields(contentJson: unknown): Record<string, unknown> {
  const content = contentJson as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) {
    if (typeof value === "string") {
      cleaned[key] = truncate(stripHtml(value).trim(), MAX_CARD_CONTENT_LENGTH);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

async function getUserFolderIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ folderId: folderMembers.folderId })
    .from(folderMembers)
    .where(and(eq(folderMembers.userId, userId), eq(folderMembers.status, "active")));
  return rows.map((r) => r.folderId);
}

export function createTools(userId: string) {
  // ── get_user_details ──

  const getUserDetails = tool(
    async () => {
      const [user] = await db
        .select({ name: users.name, tier: users.tier, createdAt: users.createdAt })
        .from(users)
        .where(eq(users.id, userId));

      const [stats] = await db
        .select({
          deckCount: sql<number>`count(distinct ${userDecks.id})::int`,
          totalCards: sql<number>`count(${userCardStates.id})::int`,
          dueCards: sql<number>`count(*) filter (where ${userCardStates.dueAt} is null or ${userCardStates.dueAt} <= now())::int`,
        })
        .from(userDecks)
        .leftJoin(userCardStates, eq(userCardStates.userDeckId, userDecks.id))
        .leftJoin(cardDefinitions, eq(userCardStates.cardDefinitionId, cardDefinitions.id))
        .where(
          and(
            eq(userDecks.userId, userId),
            isNull(userDecks.archivedAt),
            sql`(${cardDefinitions.id} is null or ${cardDefinitions.archivedAt} is null)`,
          ),
        );

      const limitInfo = await getAiLimitInfo(userId);
      const usageCount = await getAiUsageCount(userId, limitInfo.periodStart);

      return JSON.stringify({
        name: user?.name,
        tier: user?.tier,
        memberSince: user?.createdAt,
        deckCount: stats?.deckCount ?? 0,
        totalCards: stats?.totalCards ?? 0,
        dueCards: stats?.dueCards ?? 0,
        aiUsage: { used: usageCount, limit: limitInfo.limit, period: limitInfo.period },
      });
    },
    {
      name: "get_user_details",
      description:
        "Get the current user's profile info, study statistics (deck count, card counts, due cards), and AI usage. Call this when the user asks about their account, progress, or stats.",
      schema: z.object({}),
    },
  );

  // ── list_folders ──

  const listFolders = tool(
    async () => {
      const rows = await db
        .select({
          id: folders.id,
          name: folders.name,
          role: folderMembers.role,
          deckCount: sql<number>`(
            select count(*)::int from deck_definitions
            where deck_definitions.folder_id = ${folders.id}
              and deck_definitions.archived_at is null
          )`,
        })
        .from(folderMembers)
        .innerJoin(folders, eq(folderMembers.folderId, folders.id))
        .where(
          and(
            eq(folderMembers.userId, userId),
            eq(folderMembers.status, "active"),
            isNull(folders.archivedAt),
          ),
        )
        .orderBy(folders.name);

      return JSON.stringify({ folders: rows });
    },
    {
      name: "list_folders",
      description:
        "List all folders the user has access to, with their role and deck count. Call this when the user asks about their library, folders, or organization.",
      schema: z.object({}),
    },
  );

  // ── list_decks ──

  const listDecks = tool(
    async ({ folderId }: { folderId?: string }) => {
      let folderIds: string[];
      if (folderId) {
        const memberFolderIds = await getUserFolderIds(userId);
        if (!memberFolderIds.includes(folderId)) {
          return JSON.stringify({ error: "You don't have access to this folder" });
        }
        folderIds = [folderId];
      } else {
        folderIds = await getUserFolderIds(userId);
      }

      if (folderIds.length === 0) {
        return JSON.stringify({ decks: [] });
      }

      const deckRows = await db
        .select({
          id: deckDefinitions.id,
          title: deckDefinitions.title,
          folderId: deckDefinitions.folderId,
          folderName: folders.name,
        })
        .from(deckDefinitions)
        .innerJoin(folders, eq(deckDefinitions.folderId, folders.id))
        .where(
          and(inArray(deckDefinitions.folderId, folderIds), isNull(deckDefinitions.archivedAt)),
        )
        .orderBy(deckDefinitions.title);

      if (deckRows.length === 0) {
        return JSON.stringify({ decks: [] });
      }

      const deckIds = deckRows.map((d) => d.id);

      const statRows = await db
        .select({
          deckDefinitionId: userDecks.deckDefinitionId,
          totalCards: sql<number>`count(${userCardStates.id})::int`,
          dueCount: sql<number>`count(*) filter (where ${userCardStates.dueAt} is not null and ${userCardStates.dueAt} <= now())::int`,
          newCount: sql<number>`count(*) filter (where ${userCardStates.srsState} = 'new')::int`,
        })
        .from(userDecks)
        .leftJoin(userCardStates, eq(userCardStates.userDeckId, userDecks.id))
        .where(
          and(
            eq(userDecks.userId, userId),
            inArray(userDecks.deckDefinitionId, deckIds),
            isNull(userDecks.archivedAt),
          ),
        )
        .groupBy(userDecks.deckDefinitionId);

      const statsMap = new Map(statRows.map((s) => [s.deckDefinitionId, s]));

      const tagRows = await db
        .select({
          deckDefinitionId: deckTags.deckDefinitionId,
          tagName: tags.name,
        })
        .from(deckTags)
        .innerJoin(tags, eq(deckTags.tagId, tags.id))
        .where(inArray(deckTags.deckDefinitionId, deckIds));

      const tagsMap = new Map<string, string[]>();
      for (const r of tagRows) {
        const arr = tagsMap.get(r.deckDefinitionId) ?? [];
        arr.push(r.tagName);
        tagsMap.set(r.deckDefinitionId, arr);
      }

      const decks = deckRows.map((d) => {
        const s = statsMap.get(d.id);
        return {
          id: d.id,
          title: d.title,
          folderId: d.folderId,
          folderName: d.folderName,
          cardCount: s?.totalCards ?? 0,
          dueCount: s?.dueCount ?? 0,
          newCount: s?.newCount ?? 0,
          tags: tagsMap.get(d.id) ?? [],
        };
      });

      return JSON.stringify({ decks });
    },
    {
      name: "list_decks",
      description:
        "List decks the user has access to, optionally filtered by folder. Returns deck names, card counts, due/new counts, and tags. Call this when the user asks about their decks or what they're studying.",
      schema: z.object({
        folderId: z
          .string()
          .uuid()
          .optional()
          .describe("Optional folder ID to filter decks. Omit to list all decks."),
      }),
    },
  );

  // ── get_deck_details ──

  const getDeckDetails = tool(
    async ({ deckId }: { deckId: string }) => {
      const allowed = await canViewDeck(deckId, userId);
      if (!allowed) {
        return JSON.stringify({ error: "You don't have access to this deck" });
      }

      const [deck] = await db
        .select({
          id: deckDefinitions.id,
          title: deckDefinitions.title,
          description: deckDefinitions.description,
          folderId: deckDefinitions.folderId,
          folderName: folders.name,
          viewPolicy: deckDefinitions.viewPolicy,
          createdAt: deckDefinitions.createdAt,
        })
        .from(deckDefinitions)
        .innerJoin(folders, eq(deckDefinitions.folderId, folders.id))
        .where(eq(deckDefinitions.id, deckId));

      if (!deck) {
        return JSON.stringify({ error: "Deck not found" });
      }

      const tagRows = await db
        .select({ name: tags.name })
        .from(deckTags)
        .innerJoin(tags, eq(deckTags.tagId, tags.id))
        .where(eq(deckTags.deckDefinitionId, deckId));

      const [stats] = await db
        .select({
          total: sql<number>`count(${userCardStates.id})::int`,
          newCount: sql<number>`count(*) filter (where ${userCardStates.srsState} = 'new')::int`,
          learning: sql<number>`count(*) filter (where ${userCardStates.srsState} = 'learning')::int`,
          due: sql<number>`count(*) filter (where ${userCardStates.dueAt} is not null and ${userCardStates.dueAt} <= now())::int`,
        })
        .from(userDecks)
        .leftJoin(userCardStates, eq(userCardStates.userDeckId, userDecks.id))
        .where(
          and(
            eq(userDecks.userId, userId),
            eq(userDecks.deckDefinitionId, deckId),
            isNull(userDecks.archivedAt),
          ),
        );

      const [studyInfo] = await db
        .select({ lastStudiedAt: userDecks.lastStudiedAt })
        .from(userDecks)
        .where(
          and(
            eq(userDecks.userId, userId),
            eq(userDecks.deckDefinitionId, deckId),
            isNull(userDecks.archivedAt),
          ),
        );

      return JSON.stringify({
        id: deck.id,
        title: deck.title,
        description: deck.description ? truncate(deck.description, 500) : null,
        folderName: deck.folderName,
        viewPolicy: deck.viewPolicy,
        tags: tagRows.map((r) => r.name),
        stats: {
          total: stats?.total ?? 0,
          new: stats?.newCount ?? 0,
          learning: stats?.learning ?? 0,
          due: stats?.due ?? 0,
        },
        lastStudiedAt: studyInfo?.lastStudiedAt ?? null,
        createdAt: deck.createdAt,
      });
    },
    {
      name: "get_deck_details",
      description:
        "Get detailed info about a specific deck including description, tags, and study stats (total, new, learning, due cards). Call this when the user asks about a specific deck's details or progress.",
      schema: z.object({
        deckId: z.string().uuid().describe("The deck ID to look up."),
      }),
    },
  );

  // ── list_cards ──

  const listCards = tool(
    async ({ deckId, limit }: { deckId: string; limit?: number }) => {
      const allowed = await canViewDeck(deckId, userId);
      if (!allowed) {
        return JSON.stringify({ error: "You don't have access to this deck" });
      }

      const [deck] = await db
        .select({
          linkedDeckDefinitionId: deckDefinitions.linkedDeckDefinitionId,
        })
        .from(deckDefinitions)
        .where(eq(deckDefinitions.id, deckId));

      const sourceDeckId = deck?.linkedDeckDefinitionId ?? deckId;
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
        "List cards in a deck with a short preview of each card's content. Returns card type, preview text, and tags. Use get_card for full content. Call this when the user asks what cards are in a deck.",
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

  // ── get_card ──

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
        return JSON.stringify({ error: "Card not found" });
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
        "Get the full content of a specific card by ID. Returns the card type, full content fields (HTML stripped), and tags. Call this when the user asks about a specific card's content or wants to review/improve it.",
      schema: z.object({
        cardId: z.string().uuid().describe("The card ID to look up."),
      }),
    },
  );

  return [getUserDetails, listFolders, listDecks, getDeckDetails, listCards, getCard];
}
