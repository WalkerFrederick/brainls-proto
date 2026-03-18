"use server";

import { eq, and, isNull, ilike, inArray, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  deckDefinitions,
  userDecks,
  folderMembers,
  cardDefinitions,
  userCardStates,
  deckTags,
  tags,
} from "@/db/schema";
import { archiveStudyDataIfOrphaned } from "@/actions/link-deck";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";
import { CreateDeckSchema, UpdateDeckSchema } from "@/lib/schemas";
import {
  requireFolderRole,
  canViewDeck,
  canEditDeck,
  canEditDeckInFolder,
  getFolderMember,
} from "@/lib/permissions";
import { isValidUuid } from "@/lib/validate-uuid";
import { resolveSourceDeckFromData } from "@/lib/deck-resolver";

export async function createDeck(input: unknown): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const parsed = CreateDeckSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      "Validation failed",
      Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v ?? []]),
      ),
    );
  }

  const { folderId, title, description } = parsed.data;
  const perm = await requireFolderRole(folderId, session.user.id, "editor");
  if (!perm.allowed) return err(perm.error);

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const [deck] = await db
    .insert(deckDefinitions)
    .values({
      folderId,
      title,
      slug,
      description,
      createdByUserId: session.user.id,
      updatedByUserId: session.user.id,
    })
    .returning({ id: deckDefinitions.id });

  await db.insert(userDecks).values({
    userId: session.user.id,
    deckDefinitionId: deck.id,
  });

  return ok({ id: deck.id });
}

export async function updateDeck(input: unknown): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const parsed = UpdateDeckSchema.safeParse(input);
  if (!parsed.success) return err("Validation failed");

  const { deckId, ...updates } = parsed.data;
  const canEdit = await canEditDeck(deckId, session.user.id);
  if (!canEdit) return err("Permission denied");

  if (updates.viewPolicy !== undefined) {
    const [deck] = await db
      .select({
        folderId: deckDefinitions.folderId,
        linkedDeckDefinitionId: deckDefinitions.linkedDeckDefinitionId,
      })
      .from(deckDefinitions)
      .where(eq(deckDefinitions.id, deckId));

    if (deck.linkedDeckDefinitionId) {
      return err("Linked decks cannot change visibility — only the source deck owner can do that");
    }

    const perm = await requireFolderRole(deck.folderId, session.user.id, "admin");
    if (!perm.allowed) return err("Only admins and owners can change deck visibility");
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedByUserId: session.user.id,
  };
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.viewPolicy !== undefined) updateData.viewPolicy = updates.viewPolicy;

  await db.update(deckDefinitions).set(updateData).where(eq(deckDefinitions.id, deckId));

  return ok({ id: deckId });
}

export async function getDeck(
  deckId: string,
): Promise<Result<typeof deckDefinitions.$inferSelect>> {
  if (!isValidUuid(deckId)) return err("Invalid deck ID");
  const session = await requireSession();

  const [deck] = await db.select().from(deckDefinitions).where(eq(deckDefinitions.id, deckId));
  if (!deck) return err("Deck not found");

  if (deck.archivedAt) {
    const canView = await canViewDeck(deckId, session.user.id);
    if (!canView) return err("The author has archived this deck");
  } else {
    const canView = await canViewDeck(deckId, session.user.id);
    if (!canView) return err("Permission denied");
  }

  return ok(deck);
}

export async function listDecks(
  folderId: string,
  opts?: { limit?: number; offset?: number },
): Promise<Result<Array<typeof deckDefinitions.$inferSelect>>> {
  if (!isValidUuid(folderId)) return err("Invalid folder ID");
  const session = await requireSession();
  const perm = await requireFolderRole(folderId, session.user.id, "viewer");
  if (!perm.allowed) return err(perm.error);

  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const rows = await db
    .select()
    .from(deckDefinitions)
    .where(and(eq(deckDefinitions.folderId, folderId), isNull(deckDefinitions.archivedAt)))
    .limit(limit)
    .offset(offset);

  return ok(rows);
}

export async function archiveDeck(deckId: string): Promise<Result<{ id: string }>> {
  if (!isValidUuid(deckId)) return err("Invalid deck ID");
  const session = await requireSession();

  if (session.user.defaultDeckId === deckId) {
    return err("Your default deck cannot be archived.");
  }

  const [deck] = await db.select().from(deckDefinitions).where(eq(deckDefinitions.id, deckId));
  if (!deck) return err("Deck not found");

  const perm = await requireFolderRole(deck.folderId, session.user.id, "admin");
  if (!perm.allowed) return err("Only folder owners and admins can archive decks");

  await db
    .update(deckDefinitions)
    .set({ archivedAt: new Date(), updatedAt: new Date(), updatedByUserId: session.user.id })
    .where(eq(deckDefinitions.id, deckId));

  if (deck.linkedDeckDefinitionId) {
    await archiveStudyDataIfOrphaned(session.user.id, deck.linkedDeckDefinitionId);
  }

  return ok({ id: deckId });
}

export async function listEditableDecks(): Promise<
  Result<
    Array<{
      folderId: string;
      folderName: string;
      deckId: string;
      deckTitle: string;
    }>
  >
> {
  const session = await requireSession();

  const { folderMembers, folders } = await import("@/db/schema");

  const memberRows = await db
    .select({
      folderId: folders.id,
      folderName: folders.name,
      role: folderMembers.role,
    })
    .from(folderMembers)
    .innerJoin(folders, eq(folderMembers.folderId, folders.id))
    .where(and(eq(folderMembers.userId, session.user.id), eq(folderMembers.status, "active")));

  const editable = memberRows.filter(
    (f) => f.role === "owner" || f.role === "admin" || f.role === "editor",
  );

  const rows: Array<{
    folderId: string;
    folderName: string;
    deckId: string;
    deckTitle: string;
  }> = [];

  for (const f of editable) {
    const decks = await db
      .select({
        id: deckDefinitions.id,
        title: deckDefinitions.title,
        linked: deckDefinitions.linkedDeckDefinitionId,
      })
      .from(deckDefinitions)
      .where(and(eq(deckDefinitions.folderId, f.folderId), isNull(deckDefinitions.archivedAt)));

    for (const d of decks) {
      if (d.linked) continue;
      rows.push({
        folderId: f.folderId,
        folderName: f.folderName,
        deckId: d.id,
        deckTitle: d.title,
      });
    }
  }

  return ok(rows);
}

export async function searchLibraryDecks(
  query: string,
): Promise<Result<{ id: string; title: string }[]>> {
  const session = await requireSession();

  const memberRows = await db
    .select({ folderId: folderMembers.folderId })
    .from(folderMembers)
    .where(and(eq(folderMembers.userId, session.user.id), eq(folderMembers.status, "active")));

  if (memberRows.length === 0) return ok([]);

  const fIds = memberRows.map((r) => r.folderId);

  const conditions = [inArray(deckDefinitions.folderId, fIds), isNull(deckDefinitions.archivedAt)];

  const trimmed = query.trim();
  if (trimmed) {
    conditions.push(ilike(deckDefinitions.title, `%${trimmed}%`));
  }

  const rows = await db
    .select({
      id: deckDefinitions.id,
      title: deckDefinitions.title,
    })
    .from(deckDefinitions)
    .where(and(...conditions))
    .orderBy(desc(deckDefinitions.updatedAt))
    .limit(8);

  return ok(rows);
}

export async function moveDeck(
  deckDefinitionId: string,
  targetFolderId: string,
): Promise<Result<{ id: string }>> {
  if (!isValidUuid(deckDefinitionId)) return err("Invalid deck ID");
  if (!isValidUuid(targetFolderId)) return err("Invalid folder ID");

  const session = await requireSession();

  const [deck] = await db
    .select({
      id: deckDefinitions.id,
      folderId: deckDefinitions.folderId,
      linkedDeckDefinitionId: deckDefinitions.linkedDeckDefinitionId,
    })
    .from(deckDefinitions)
    .where(and(eq(deckDefinitions.id, deckDefinitionId), isNull(deckDefinitions.archivedAt)));

  if (!deck) return err("Deck not found");
  if (session.user.defaultDeckId === deckDefinitionId)
    return err("Your default deck cannot be moved.");
  if (deck.folderId === targetFolderId) return err("Deck is already in this folder");

  if (deck.linkedDeckDefinitionId) {
    const [existing] = await db
      .select({ id: deckDefinitions.id })
      .from(deckDefinitions)
      .where(
        and(
          eq(deckDefinitions.folderId, targetFolderId),
          eq(deckDefinitions.linkedDeckDefinitionId, deck.linkedDeckDefinitionId),
          isNull(deckDefinitions.archivedAt),
        ),
      )
      .limit(1);

    if (existing) return err("The target folder already has a linked copy of this deck.");
  }

  const sourcePerm = await requireFolderRole(deck.folderId, session.user.id, "owner");
  if (!sourcePerm.allowed) return err("You must be the owner of the source folder");

  const targetPerm = await requireFolderRole(targetFolderId, session.user.id, "owner");
  if (!targetPerm.allowed) return err("You must be the owner of the target folder");

  await db
    .update(deckDefinitions)
    .set({ folderId: targetFolderId, updatedAt: new Date(), updatedByUserId: session.user.id })
    .where(eq(deckDefinitions.id, deckDefinitionId));

  return ok({ id: deckDefinitionId });
}

export type DeckSummary = {
  title: string;
  description: string | null;
  viewPolicy: string;
  createdByUserId: string;
  folderId: string;
  archivedAt: Date | null;
  linkedDeckDefinitionId: string | null;
  tags: string[];
  studyCardCount: number;
  rootCardCount: number;
  isEditor: boolean;
  canArchive: boolean;
  canChangeVisibility: boolean;
  isLinked: boolean;
  isAbandoned: boolean;
  sourceDeckId: string;
  newCardsPerDay: number;
  stats: { newCount: number; learningCount: number; dueCount: number } | null;
};

export async function getDeckSummary(deckId: string): Promise<Result<DeckSummary>> {
  if (!isValidUuid(deckId)) return err("Invalid deck ID");
  const session = await requireSession();

  const [deck] = await db.select().from(deckDefinitions).where(eq(deckDefinitions.id, deckId));
  if (!deck) return err("Deck not found");

  if (deck.archivedAt) {
    const canView = await canViewDeck(deckId, session.user.id);
    if (!canView) return err("The author has archived this deck");
  } else {
    const canView = await canViewDeck(deckId, session.user.id);
    if (!canView) return err("Permission denied");
  }

  const { sourceDeckId, isLinked, isAbandoned } = await resolveSourceDeckFromData(
    deckId,
    deck.linkedDeckDefinitionId,
  );

  const [tagRows, countRow, isEditor, member, userDeckRow] = await Promise.all([
    db
      .select({ name: tags.name })
      .from(deckTags)
      .innerJoin(tags, eq(deckTags.tagId, tags.id))
      .where(eq(deckTags.deckDefinitionId, deckId))
      .orderBy(tags.name),

    db
      .select({
        studyCardCount: sql<number>`
          count(*) filter (where ${cardDefinitions.parentCardId} is null and ${cardDefinitions.cardType} != 'cloze' and ${cardDefinitions.archivedAt} is null)
          +
          count(*) filter (where ${cardDefinitions.parentCardId} is not null and ${cardDefinitions.archivedAt} is null)
        `.mapWith(Number),
        rootCardCount: sql<number>`
          count(*) filter (where ${cardDefinitions.parentCardId} is null and ${cardDefinitions.archivedAt} is null)
        `.mapWith(Number),
      })
      .from(cardDefinitions)
      .where(eq(cardDefinitions.deckDefinitionId, sourceDeckId))
      .then((rows) => rows[0] ?? { studyCardCount: 0, rootCardCount: 0 }),

    canEditDeckInFolder(deck.folderId, session.user.id),

    getFolderMember(deck.folderId, session.user.id),

    db
      .select({ id: userDecks.id, newCardsPerDay: userDecks.newCardsPerDay })
      .from(userDecks)
      .where(
        and(
          eq(userDecks.userId, session.user.id),
          eq(userDecks.deckDefinitionId, sourceDeckId),
          isNull(userDecks.archivedAt),
        ),
      )
      .then((rows) => rows[0] ?? null),
  ]);

  const memberRole = member?.role ?? null;
  const canArchive = memberRole === "owner" || memberRole === "admin";
  const canChangeVisibility = canArchive && !deck.linkedDeckDefinitionId;

  let stats: DeckSummary["stats"] = null;
  if (userDeckRow) {
    const nowIso = new Date().toISOString();
    const stateRows = await db
      .select({
        srsState: userCardStates.srsState,
        isDue: sql<boolean>`(${userCardStates.dueAt} IS NOT NULL AND ${userCardStates.dueAt} <= ${nowIso})`,
      })
      .from(userCardStates)
      .innerJoin(cardDefinitions, eq(userCardStates.cardDefinitionId, cardDefinitions.id))
      .where(
        and(eq(userCardStates.userDeckId, userDeckRow.id), isNull(cardDefinitions.archivedAt)),
      );

    let newCount = 0;
    let learningCount = 0;
    let dueCount = 0;
    for (const row of stateRows) {
      switch (row.srsState) {
        case "new":
          newCount++;
          break;
        case "learning":
        case "relearning":
          learningCount++;
          if (row.isDue) dueCount++;
          break;
        case "review":
          if (row.isDue) dueCount++;
          break;
      }
    }
    stats = { newCount, learningCount, dueCount };
  }

  return ok({
    title: deck.title,
    description: deck.description,
    viewPolicy: deck.viewPolicy,
    createdByUserId: deck.createdByUserId,
    folderId: deck.folderId,
    archivedAt: deck.archivedAt,
    linkedDeckDefinitionId: deck.linkedDeckDefinitionId,
    tags: tagRows.map((r) => r.name),
    studyCardCount: countRow.studyCardCount,
    rootCardCount: countRow.rootCardCount,
    isEditor,
    canArchive,
    canChangeVisibility,
    isLinked,
    isAbandoned,
    sourceDeckId,
    newCardsPerDay: userDeckRow?.newCardsPerDay ?? 20,
    stats,
  });
}
