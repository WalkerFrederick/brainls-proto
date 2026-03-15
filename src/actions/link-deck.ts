"use server";

import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { deckDefinitions, workspaceMembers, workspaces } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";
import { canViewDeck, requireWorkspaceRole, canEditDeck } from "@/lib/permissions";
import { isValidUuid } from "@/lib/validate-uuid";

export async function linkDeckToWorkspace(
  sourceDeckId: string,
  targetWorkspaceId: string,
): Promise<Result<{ id: string }>> {
  if (!isValidUuid(sourceDeckId)) return err("Invalid source deck ID");
  if (!isValidUuid(targetWorkspaceId)) return err("Invalid target workspace ID");

  const session = await requireSession();

  const canView = await canViewDeck(sourceDeckId, session.user.id);
  if (!canView) return err("You don't have permission to view this deck");

  const perm = await requireWorkspaceRole(targetWorkspaceId, session.user.id, "editor");
  if (!perm.allowed) return err(perm.error);

  const [sourceDeck] = await db
    .select()
    .from(deckDefinitions)
    .where(eq(deckDefinitions.id, sourceDeckId));

  if (!sourceDeck) return err("Source deck not found");

  if (sourceDeck.linkedDeckDefinitionId) {
    return err("Cannot link a deck that is itself a linked copy");
  }

  const existing = await db
    .select({ id: deckDefinitions.id })
    .from(deckDefinitions)
    .where(
      and(
        eq(deckDefinitions.workspaceId, targetWorkspaceId),
        eq(deckDefinitions.linkedDeckDefinitionId, sourceDeckId),
        isNull(deckDefinitions.archivedAt),
      ),
    );

  if (existing.length > 0) {
    return err("This deck is already linked in the target workspace");
  }

  const [linked] = await db
    .insert(deckDefinitions)
    .values({
      workspaceId: targetWorkspaceId,
      title: sourceDeck.title,
      slug: `${sourceDeck.slug}-linked-${Date.now()}`,
      description: sourceDeck.description,
      viewPolicy: "private",
      linkedDeckDefinitionId: sourceDeckId,
      createdByUserId: session.user.id,
      updatedByUserId: session.user.id,
    })
    .returning({ id: deckDefinitions.id });

  return ok({ id: linked.id });
}

export async function unlinkDeckFromWorkspace(
  linkedDeckId: string,
): Promise<Result<{ id: string }>> {
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

  await db
    .update(deckDefinitions)
    .set({
      archivedAt: new Date(),
      updatedAt: new Date(),
      updatedByUserId: session.user.id,
    })
    .where(eq(deckDefinitions.id, linkedDeckId));

  return ok({ id: linkedDeckId });
}

export type WorkspacePickerItem = {
  id: string;
  name: string;
  kind: string;
  hasLink: boolean;
  hasFork: boolean;
};

export async function listWorkspacesForPicker(
  sourceDeckId: string,
): Promise<Result<WorkspacePickerItem[]>> {
  if (!isValidUuid(sourceDeckId)) return err("Invalid deck ID");
  const session = await requireSession();

  const memberships = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.userId, session.user.id), eq(workspaceMembers.status, "active")),
    );

  const editorWorkspaceIds = memberships
    .filter((m) => ["owner", "admin", "editor"].includes(m.role))
    .map((m) => m.workspaceId);

  if (editorWorkspaceIds.length === 0) return ok([]);

  const result: WorkspacePickerItem[] = [];

  for (const wsId of editorWorkspaceIds) {
    const [ws] = await db
      .select({ id: workspaces.id, name: workspaces.name, kind: workspaces.kind })
      .from(workspaces)
      .where(and(eq(workspaces.id, wsId), isNull(workspaces.archivedAt)));

    if (!ws) continue;

    const linkedDecks = await db
      .select({ id: deckDefinitions.id })
      .from(deckDefinitions)
      .where(
        and(
          eq(deckDefinitions.workspaceId, wsId),
          eq(deckDefinitions.linkedDeckDefinitionId, sourceDeckId),
          isNull(deckDefinitions.archivedAt),
        ),
      );

    const forkedDecks = await db
      .select({ id: deckDefinitions.id })
      .from(deckDefinitions)
      .where(
        and(
          eq(deckDefinitions.workspaceId, wsId),
          eq(deckDefinitions.forkedFromDeckDefinitionId, sourceDeckId),
          isNull(deckDefinitions.archivedAt),
        ),
      );

    result.push({
      id: ws.id,
      name: ws.name,
      kind: ws.kind,
      hasLink: linkedDecks.length > 0,
      hasFork: forkedDecks.length > 0,
    });
  }

  return ok(result);
}
