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
  folderSettings,
  tags,
  deckTags,
  cardTags,
} from "@/db/schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { getAiLimitInfo, getAiUsageCount } from "@/lib/tiers";
import { canViewDeck, canEditDeck, requireFolderRole } from "@/lib/permissions";
import { stripHtml } from "@/lib/sanitize-html";
import { insertCard, updateCardContent } from "@/lib/card-helpers";
import { upsertTags } from "@/lib/tag-helpers";

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
        return JSON.stringify({
          error: `Deck not found (id: ${deckId}). Verify the deck ID is correct.`,
        });
      }

      const allowed = await canViewDeck(deckId, userId);
      if (!allowed) {
        return JSON.stringify({ error: "You don't have access to this deck" });
      }

      const [tagRows, [stats]] = await Promise.all([
        db
          .select({ name: tags.name })
          .from(deckTags)
          .innerJoin(tags, eq(deckTags.tagId, tags.id))
          .where(eq(deckTags.deckDefinitionId, deckId)),
        db
          .select({
            total: sql<number>`count(${userCardStates.id})::int`,
            newCount: sql<number>`count(*) filter (where ${userCardStates.srsState} = 'new')::int`,
            learning: sql<number>`count(*) filter (where ${userCardStates.srsState} = 'learning')::int`,
            due: sql<number>`count(*) filter (where ${userCardStates.dueAt} is not null and ${userCardStates.dueAt} <= now())::int`,
            lastStudiedAt: sql<string | null>`max(${userDecks.lastStudiedAt})`,
          })
          .from(userDecks)
          .leftJoin(userCardStates, eq(userCardStates.userDeckId, userDecks.id))
          .where(
            and(
              eq(userDecks.userId, userId),
              eq(userDecks.deckDefinitionId, deckId),
              isNull(userDecks.archivedAt),
            ),
          ),
      ]);

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
        lastStudiedAt: stats?.lastStudiedAt ?? null,
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
        "Get the full content of a specific card by ID. Returns the card type, full content fields (HTML stripped), and tags. Call this when the user asks about a specific card's content or wants to review/improve it.",
      schema: z.object({
        cardId: z.string().uuid().describe("The card ID to look up."),
      }),
    },
  );

  // ── create_folder ──

  const createFolder = tool(
    async ({ name, description }: { name: string; description?: string }) => {
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 255) {
        return JSON.stringify({ error: "Folder name must be 2–255 characters" });
      }
      if (!/[a-zA-Z0-9]/.test(trimmed)) {
        return JSON.stringify({ error: "Folder name must contain at least one letter or number" });
      }

      const slug = trimmed
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const [folder] = await db.transaction(async (tx) => {
        const [f] = await tx
          .insert(folders)
          .values({
            name: trimmed,
            slug,
            description: description?.trim() || null,
            createdByUserId: userId,
          })
          .returning({ id: folders.id });

        await tx.insert(folderSettings).values({ folderId: f.id });
        await tx.insert(folderMembers).values({
          folderId: f.id,
          userId,
          role: "owner",
          status: "active",
          joinedAt: new Date(),
        });

        return [f];
      });

      return JSON.stringify({ id: folder.id, name: trimmed });
    },
    {
      name: "create_folder",
      description:
        "Create a new folder in the user's library. The user becomes the owner. Call this when the user wants to organize decks into a new folder.",
      schema: z.object({
        name: z.string().min(2).max(255).describe("Folder name."),
        description: z.string().max(2048).optional().describe("Optional folder description."),
      }),
    },
  );

  // ── update_folder ──

  const updateFolder = tool(
    async ({
      folderId,
      name,
      description,
    }: {
      folderId: string;
      name?: string;
      description?: string;
    }) => {
      const [folderRow] = await db
        .select({ id: folders.id })
        .from(folders)
        .where(and(eq(folders.id, folderId), isNull(folders.archivedAt)));

      if (!folderRow) {
        return JSON.stringify({
          error: `Folder not found (id: ${folderId}). Verify the folder ID is correct.`,
        });
      }

      const perm = await requireFolderRole(folderId, userId, "admin");
      if (!perm.allowed) {
        return JSON.stringify({ error: perm.error });
      }

      if (!name && description === undefined) {
        return JSON.stringify({
          error: "Provide at least one field to update (name or description)",
        });
      }

      if (name !== undefined) {
        const trimmed = name.trim();
        if (trimmed.length < 2 || trimmed.length > 255) {
          return JSON.stringify({ error: "Folder name must be 2–255 characters" });
        }
        if (!/[a-zA-Z0-9]/.test(trimmed)) {
          return JSON.stringify({
            error: "Folder name must contain at least one letter or number",
          });
        }
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description.trim() || null;

      await db.update(folders).set(updates).where(eq(folders.id, folderId));

      return JSON.stringify({
        id: folderId,
        updated: Object.keys(updates).filter((k) => k !== "updatedAt"),
      });
    },
    {
      name: "update_folder",
      description: "Update a folder's name or description. Requires admin role in the folder.",
      schema: z.object({
        folderId: z.string().uuid().describe("The folder ID to update."),
        name: z.string().min(2).max(255).optional().describe("New folder name."),
        description: z
          .string()
          .max(2048)
          .optional()
          .describe("New folder description. Pass empty string to clear."),
      }),
    },
  );

  // ── create_deck ──

  const createDeck = tool(
    async ({
      folderId,
      title,
      description,
    }: {
      folderId: string;
      title: string;
      description?: string;
    }) => {
      const [folderRow] = await db
        .select({ id: folders.id })
        .from(folders)
        .where(and(eq(folders.id, folderId), isNull(folders.archivedAt)));

      if (!folderRow) {
        return JSON.stringify({
          error: `Folder not found (id: ${folderId}). Verify the folder ID is correct.`,
        });
      }

      const perm = await requireFolderRole(folderId, userId, "editor");
      if (!perm.allowed) {
        return JSON.stringify({ error: perm.error });
      }

      const trimmed = title.trim();
      if (trimmed.length < 2 || trimmed.length > 500) {
        return JSON.stringify({ error: "Deck title must be 2–500 characters" });
      }

      const slug = trimmed
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const [deck] = await db.transaction(async (tx) => {
        const [d] = await tx
          .insert(deckDefinitions)
          .values({
            folderId,
            title: trimmed,
            slug,
            description: description?.trim() || null,
            createdByUserId: userId,
            updatedByUserId: userId,
          })
          .returning({ id: deckDefinitions.id });

        await tx.insert(userDecks).values({
          userId,
          deckDefinitionId: d.id,
        });

        return [d];
      });

      return JSON.stringify({ id: deck.id, title: trimmed, folderId });
    },
    {
      name: "create_deck",
      description:
        "Create a new deck in a folder. Requires editor role. Also adds the deck to the user's study library. Call this when the user wants to start a new deck.",
      schema: z.object({
        folderId: z.string().uuid().describe("The folder to create the deck in."),
        title: z.string().min(2).max(500).describe("Deck title."),
        description: z.string().max(5000).optional().describe("Optional deck description."),
      }),
    },
  );

  // ── update_deck ──

  const updateDeck = tool(
    async ({
      deckId,
      title,
      description,
    }: {
      deckId: string;
      title?: string;
      description?: string;
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
        return JSON.stringify({ error: "You don't have permission to edit this deck" });
      }

      if (!title && description === undefined) {
        return JSON.stringify({
          error: "Provide at least one field to update (title or description)",
        });
      }

      if (title !== undefined) {
        const trimmed = title.trim();
        if (trimmed.length < 2 || trimmed.length > 500) {
          return JSON.stringify({ error: "Deck title must be 2–500 characters" });
        }
        if (!/[a-zA-Z0-9]/.test(trimmed)) {
          return JSON.stringify({ error: "Deck title must contain at least one letter or number" });
        }
      }
      if (description !== undefined && description.length > 5000) {
        return JSON.stringify({ error: "Description must be under 5000 characters" });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date(), updatedByUserId: userId };
      if (title !== undefined) updates.title = title.trim();
      if (description !== undefined) updates.description = description.trim() || null;

      await db.update(deckDefinitions).set(updates).where(eq(deckDefinitions.id, deckId));

      return JSON.stringify({
        id: deckId,
        updated: Object.keys(updates).filter((k) => k !== "updatedAt" && k !== "updatedByUserId"),
      });
    },
    {
      name: "update_deck",
      description: "Update a deck's title or description. Requires editor role.",
      schema: z.object({
        deckId: z.string().uuid().describe("The deck ID to update."),
        title: z.string().min(2).max(500).optional().describe("New deck title."),
        description: z
          .string()
          .max(5000)
          .optional()
          .describe("New deck description. Pass empty string to clear."),
      }),
    },
  );

  // ── create_card ──

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

  // ── update_card ──

  const updateCardTool = tool(
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

  // ── set_tags ──

  const setTagsTool = tool(
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
    getUserDetails,
    listFolders,
    listDecks,
    getDeckDetails,
    listCards,
    getCard,
    createFolder,
    updateFolder,
    createDeck,
    updateDeck,
    createCard,
    updateCardTool,
    setTagsTool,
  ];
}
