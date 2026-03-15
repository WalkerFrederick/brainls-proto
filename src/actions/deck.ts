"use server";

import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { deckDefinitions } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";
import { CreateDeckSchema, UpdateDeckSchema } from "@/lib/schemas";
import { requireWorkspaceRole, canViewDeck, canEditDeck } from "@/lib/permissions";
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

  const { workspaceId, title, description } = parsed.data;
  const perm = await requireWorkspaceRole(workspaceId, session.user.id, "editor");
  if (!perm.allowed) return err(perm.error);

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const [deck] = await db
    .insert(deckDefinitions)
    .values({
      workspaceId,
      title,
      slug,
      description,
      createdByUserId: session.user.id,
      updatedByUserId: session.user.id,
    })
    .returning({ id: deckDefinitions.id });

  return ok({ id: deck.id });
}

export async function updateDeck(input: unknown): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const parsed = UpdateDeckSchema.safeParse(input);
  if (!parsed.success) return err("Validation failed");

  const { deckId, ...updates } = parsed.data;
  const canEdit = await canEditDeck(deckId, session.user.id);
  if (!canEdit) return err("Permission denied");

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
  const canView = await canViewDeck(deckId, session.user.id);
  if (!canView) return err("Permission denied");

  const [deck] = await db.select().from(deckDefinitions).where(eq(deckDefinitions.id, deckId));

  if (!deck) return err("Deck not found");
  return ok(deck);
}

export async function listDecks(
  workspaceId: string,
  opts?: { limit?: number; offset?: number },
): Promise<Result<Array<typeof deckDefinitions.$inferSelect>>> {
  if (!isValidUuid(workspaceId)) return err("Invalid workspace ID");
  const session = await requireSession();
  const perm = await requireWorkspaceRole(workspaceId, session.user.id, "viewer");
  if (!perm.allowed) return err(perm.error);

  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const rows = await db
    .select()
    .from(deckDefinitions)
    .where(and(eq(deckDefinitions.workspaceId, workspaceId), isNull(deckDefinitions.archivedAt)))
    .limit(limit)
    .offset(offset);

  return ok(rows);
}

export async function archiveDeck(deckId: string): Promise<Result<{ id: string }>> {
  if (!isValidUuid(deckId)) return err("Invalid deck ID");
  const session = await requireSession();

  const [deck] = await db.select().from(deckDefinitions).where(eq(deckDefinitions.id, deckId));
  if (!deck) return err("Deck not found");

  const perm = await requireWorkspaceRole(deck.workspaceId, session.user.id, "admin");
  if (!perm.allowed) return err("Only workspace owners and admins can archive decks");

  await db
    .update(deckDefinitions)
    .set({ archivedAt: new Date(), updatedAt: new Date(), updatedByUserId: session.user.id })
    .where(eq(deckDefinitions.id, deckId));

  return ok({ id: deckId });
}
