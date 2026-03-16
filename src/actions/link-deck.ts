"use server";

import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  deckDefinitions,
  folderMembers,
  folders,
  userDecks,
  cardDefinitions,
  userCardStates,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";
import { canViewDeck, requireFolderRole, canEditDeck } from "@/lib/permissions";
import { isValidUuid } from "@/lib/validate-uuid";
import { getDefaultCardState } from "@/lib/srs";

export async function linkDeckToFolder(
  sourceDeckId: string,
  targetFolderId: string,
): Promise<Result<{ id: string }>> {
  if (!isValidUuid(sourceDeckId)) return err("Invalid source deck ID");
  if (!isValidUuid(targetFolderId)) return err("Invalid target folder ID");

  const session = await requireSession();

  const canView = await canViewDeck(sourceDeckId, session.user.id);
  if (!canView) return err("You don't have permission to view this deck");

  const perm = await requireFolderRole(targetFolderId, session.user.id, "editor");
  if (!perm.allowed) return err(perm.error);

  const [sourceDeck] = await db
    .select()
    .from(deckDefinitions)
    .where(eq(deckDefinitions.id, sourceDeckId));

  if (!sourceDeck) return err("Source deck not found");

  if (sourceDeck.linkedDeckDefinitionId) {
    return err("Cannot link a deck that is itself a linked copy");
  }

  if (sourceDeck.archivedAt) {
    return err("Cannot create a linked copy of an archived deck");
  }

  if (sourceDeck.folderId === targetFolderId) {
    return err("Cannot create a linked copy in the same folder as the original");
  }

  const existing = await db
    .select({ id: deckDefinitions.id })
    .from(deckDefinitions)
    .where(
      and(
        eq(deckDefinitions.folderId, targetFolderId),
        eq(deckDefinitions.linkedDeckDefinitionId, sourceDeckId),
        isNull(deckDefinitions.archivedAt),
      ),
    );

  if (existing.length > 0) {
    return err("This deck is already linked in the target folder");
  }

  const [linked] = await db
    .insert(deckDefinitions)
    .values({
      folderId: targetFolderId,
      title: sourceDeck.title,
      slug: `${sourceDeck.slug}-linked-${Date.now()}`,
      description: sourceDeck.description,
      viewPolicy: "private",
      linkedDeckDefinitionId: sourceDeckId,
      createdByUserId: session.user.id,
      updatedByUserId: session.user.id,
    })
    .returning({ id: deckDefinitions.id });

  const existingUd = await db
    .select({ id: userDecks.id })
    .from(userDecks)
    .where(
      and(
        eq(userDecks.userId, session.user.id),
        eq(userDecks.deckDefinitionId, sourceDeckId),
        isNull(userDecks.archivedAt),
      ),
    );

  if (existingUd.length === 0) {
    const [ud] = await db
      .insert(userDecks)
      .values({ userId: session.user.id, deckDefinitionId: sourceDeckId })
      .returning({ id: userDecks.id });

    const cards = await db
      .select({ id: cardDefinitions.id })
      .from(cardDefinitions)
      .where(
        and(
          eq(cardDefinitions.deckDefinitionId, sourceDeckId),
          isNull(cardDefinitions.archivedAt),
          eq(cardDefinitions.status, "active"),
        ),
      );

    if (cards.length > 0) {
      const defaultState = getDefaultCardState();
      await db.insert(userCardStates).values(
        cards.map((c) => ({
          userDeckId: ud.id,
          cardDefinitionId: c.id,
          ...defaultState,
        })),
      );
    }
  }

  return ok({ id: linked.id });
}

export async function unlinkDeckFromFolder(linkedDeckId: string): Promise<Result<{ id: string }>> {
  if (!isValidUuid(linkedDeckId)) return err("Invalid deck ID");

  const session = await requireSession();

  const [deck] = await db
    .select()
    .from(deckDefinitions)
    .where(
      and(eq(deckDefinitions.id, linkedDeckId), isNotNull(deckDefinitions.linkedDeckDefinitionId)),
    );

  if (!deck) return err("Linked deck not found");

  const canEdit = await canEditDeck(linkedDeckId, session.user.id);
  if (!canEdit) return err("Permission denied");

  const sourceDeckId = deck.linkedDeckDefinitionId!;

  await db
    .update(deckDefinitions)
    .set({
      archivedAt: new Date(),
      updatedAt: new Date(),
      updatedByUserId: session.user.id,
    })
    .where(eq(deckDefinitions.id, linkedDeckId));

  await archiveStudyDataIfOrphaned(session.user.id, sourceDeckId);

  return ok({ id: linkedDeckId });
}

/**
 * After unlinking, check if the user still has access to the source deck
 * (either directly via folder membership or through another active link).
 * If not, archive their userDecks row so study data doesn't linger orphaned.
 */
export async function archiveStudyDataIfOrphaned(
  userId: string,
  sourceDeckId: string,
): Promise<void> {
  const userFolderIds = (
    await db
      .select({ folderId: folderMembers.folderId })
      .from(folderMembers)
      .where(and(eq(folderMembers.userId, userId), eq(folderMembers.status, "active")))
  ).map((r) => r.folderId);

  if (userFolderIds.length === 0) {
    await archiveUserDeckForSource(userId, sourceDeckId);
    return;
  }

  const [sourceDeck] = await db
    .select({ folderId: deckDefinitions.folderId, archivedAt: deckDefinitions.archivedAt })
    .from(deckDefinitions)
    .where(eq(deckDefinitions.id, sourceDeckId));

  if (!sourceDeck) {
    await archiveUserDeckForSource(userId, sourceDeckId);
    return;
  }

  if (!sourceDeck.archivedAt && userFolderIds.includes(sourceDeck.folderId)) {
    return;
  }

  const remainingLinks = await db
    .select({ folderId: deckDefinitions.folderId })
    .from(deckDefinitions)
    .where(
      and(
        eq(deckDefinitions.linkedDeckDefinitionId, sourceDeckId),
        isNull(deckDefinitions.archivedAt),
      ),
    );

  const hasAccessibleLink = remainingLinks.some((link) => userFolderIds.includes(link.folderId));

  if (hasAccessibleLink) return;

  await archiveUserDeckForSource(userId, sourceDeckId);
}

async function archiveUserDeckForSource(userId: string, sourceDeckId: string): Promise<void> {
  await db
    .update(userDecks)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(userDecks.userId, userId),
        eq(userDecks.deckDefinitionId, sourceDeckId),
        isNull(userDecks.archivedAt),
      ),
    );
}

export type FolderPickerItem = {
  id: string;
  name: string;
  hasLink: boolean;
  hasCopy: boolean;
  isSource: boolean;
  hasExistingSrsData: boolean;
};

export async function listFoldersForPicker(
  sourceDeckId: string,
): Promise<Result<FolderPickerItem[]>> {
  if (!isValidUuid(sourceDeckId)) return err("Invalid deck ID");
  const session = await requireSession();

  const memberships = await db
    .select({
      folderId: folderMembers.folderId,
      role: folderMembers.role,
    })
    .from(folderMembers)
    .where(and(eq(folderMembers.userId, session.user.id), eq(folderMembers.status, "active")));

  const editorFolderIds = memberships
    .filter((m) => ["owner", "admin", "editor"].includes(m.role))
    .map((m) => m.folderId);

  if (editorFolderIds.length === 0) return ok([]);

  const [sourceDeck] = await db
    .select({ folderId: deckDefinitions.folderId })
    .from(deckDefinitions)
    .where(eq(deckDefinitions.id, sourceDeckId));

  const sourceFolderId = sourceDeck?.folderId ?? null;

  const existingSrsDecks = await db
    .select({ id: userDecks.id })
    .from(userDecks)
    .where(
      and(
        eq(userDecks.userId, session.user.id),
        eq(userDecks.deckDefinitionId, sourceDeckId),
        isNull(userDecks.archivedAt),
      ),
    );
  const hasExistingSrsData = existingSrsDecks.length > 0;

  const result: FolderPickerItem[] = [];

  for (const fId of editorFolderIds) {
    const [f] = await db
      .select({ id: folders.id, name: folders.name })
      .from(folders)
      .where(and(eq(folders.id, fId), isNull(folders.archivedAt)));

    if (!f) continue;

    const linkedDecks = await db
      .select({ id: deckDefinitions.id })
      .from(deckDefinitions)
      .where(
        and(
          eq(deckDefinitions.folderId, fId),
          eq(deckDefinitions.linkedDeckDefinitionId, sourceDeckId),
          isNull(deckDefinitions.archivedAt),
        ),
      );

    const copiedDecks = await db
      .select({ id: deckDefinitions.id })
      .from(deckDefinitions)
      .where(
        and(
          eq(deckDefinitions.folderId, fId),
          eq(deckDefinitions.copiedFromDeckDefinitionId, sourceDeckId),
          isNull(deckDefinitions.archivedAt),
        ),
      );

    result.push({
      id: f.id,
      name: f.name,
      hasLink: linkedDecks.length > 0,
      hasCopy: copiedDecks.length > 0,
      isSource: fId === sourceFolderId,
      hasExistingSrsData,
    });
  }

  return ok(result);
}
