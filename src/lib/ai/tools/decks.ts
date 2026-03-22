import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "@/db";
import { deckDefinitions, userDecks, userCardStates, folders, tags, deckTags } from "@/db/schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { canViewDeck, canEditDeck, requireFolderRole } from "@/lib/permissions";
import { truncate, getUserFolderIds } from "./helpers";
import type { ToolDefinition } from "../types";

export function createDeckTools(userId: string): ToolDefinition[] {
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
          linkedDeckDefinitionId: deckDefinitions.linkedDeckDefinitionId,
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
      const sourceDeckIds = deckRows.map((d) => d.linkedDeckDefinitionId ?? d.id);
      const allDeckIds = [...new Set([...deckIds, ...sourceDeckIds])];

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
            inArray(userDecks.deckDefinitionId, allDeckIds),
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
        const isLinked = !!d.linkedDeckDefinitionId;
        const statsKey = d.linkedDeckDefinitionId ?? d.id;
        const s = statsMap.get(statsKey);
        return {
          id: d.id,
          title: d.title,
          folderId: d.folderId,
          folderName: d.folderName,
          ...(isLinked && { isLinked: true }),
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
        "List decks the user has access to, optionally filtered by folder. Returns deck names, card counts, due/new counts, and tags.",
      schema: z.object({
        folderId: z
          .string()
          .uuid()
          .optional()
          .describe("Optional folder ID to filter decks. Omit to list all decks."),
      }),
    },
  );

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
          linkedDeckDefinitionId: deckDefinitions.linkedDeckDefinitionId,
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

      const isLinked = !!deck.linkedDeckDefinitionId;
      const statsDeckId = deck.linkedDeckDefinitionId ?? deckId;

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
              eq(userDecks.deckDefinitionId, statsDeckId),
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
        ...(isLinked && { isLinked: true }),
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
        "Get detailed info about a specific deck including description, tags, and study stats.",
      schema: z.object({
        deckId: z.string().uuid().describe("The deck ID to look up."),
      }),
    },
  );

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
        "Create a new deck in a folder. Requires editor role. Also adds the deck to the user's study library.",
      schema: z.object({
        folderId: z.string().uuid().describe("The folder to create the deck in."),
        title: z.string().min(2).max(500).describe("Deck title."),
        description: z.string().max(5000).optional().describe("Optional deck description."),
      }),
    },
  );

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

  const archiveDeck = tool(
    async ({ deckId }: { deckId: string }) => {
      const [deck] = await db
        .select({
          id: deckDefinitions.id,
          folderId: deckDefinitions.folderId,
        })
        .from(deckDefinitions)
        .where(eq(deckDefinitions.id, deckId));

      if (!deck) {
        return JSON.stringify({ error: `Deck not found (id: ${deckId})` });
      }

      const perm = await requireFolderRole(deck.folderId, userId, "admin");
      if (!perm.allowed) {
        return JSON.stringify({ error: perm.error });
      }

      await db
        .update(deckDefinitions)
        .set({ archivedAt: new Date(), updatedAt: new Date(), updatedByUserId: userId })
        .where(eq(deckDefinitions.id, deckId));

      return JSON.stringify({ id: deckId, archived: true });
    },
    {
      name: "archive_deck",
      description:
        "Remove (archive) a deck. The deck is hidden from the user but not permanently deleted. Requires admin role.",
      schema: z.object({
        deckId: z.string().uuid().describe("The deck ID to archive."),
      }),
    },
  );

  return [
    {
      tool: listDecks,
      category: "read" as const,
      examples: ['User: "What decks do I have?" → Call list_decks'],
    },
    {
      tool: getDeckDetails,
      category: "read" as const,
      examples: [
        'User: "Tell me about my Biology deck" → Call list_decks first to get the ID, then get_deck_details',
      ],
    },
    {
      tool: createDeck,
      category: "write" as const,
      examples: [
        'User: "Make me a deck for organic chemistry" → Call list_folders to pick a folder, then create_deck',
      ],
    },
    {
      tool: updateDeck,
      category: "write" as const,
      examples: [],
    },
    {
      tool: archiveDeck,
      category: "write" as const,
      examples: ['User: "Remove that deck" → Call archive_deck with the deck ID'],
    },
  ];
}
