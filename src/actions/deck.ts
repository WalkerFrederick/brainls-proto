"use server";

import { eq, and, isNull, ilike, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { deckDefinitions, userDecks, folderMembers, folders } from "@/db/schema";
import { archiveStudyDataIfOrphaned } from "@/actions/link-deck";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";
import { CreateDeckSchema, UpdateDeckSchema } from "@/lib/schemas";
import { requireFolderRole, canViewDeck, canEditDeck } from "@/lib/permissions";
import { isValidUuid } from "@/lib/validate-uuid";

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
    return err("The Scratch Pad is your default deck and cannot be archived.");
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
