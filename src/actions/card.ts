"use server";

import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { cardDefinitions, deckDefinitions } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";
import { CreateCardSchema, UpdateCardSchema } from "@/lib/schemas";
import { validateCardContent, type CardType } from "@/lib/schemas/card-content";
import { canEditDeck, canViewDeck } from "@/lib/permissions";
import { isValidUuid } from "@/lib/validate-uuid";
import { cleanupRemovedAssets } from "@/lib/asset-cleanup";

export async function createCard(input: unknown): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const parsed = CreateCardSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      "Validation failed",
      Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v ?? []]),
      ),
    );
  }

  const { deckDefinitionId, cardType, contentJson } = parsed.data;

  const [deck] = await db
    .select()
    .from(deckDefinitions)
    .where(eq(deckDefinitions.id, deckDefinitionId));

  if (!deck) return err("Deck not found");

  const canEdit = await canEditDeck(deckDefinitionId, session.user.id);
  if (!canEdit) return err("Permission denied");

  const contentResult = validateCardContent(cardType as CardType, contentJson);
  if (!contentResult.success) return err(contentResult.error);

  const [card] = await db
    .insert(cardDefinitions)
    .values({
      deckDefinitionId,
      cardType,
      contentJson: contentResult.data,
      createdByUserId: session.user.id,
      updatedByUserId: session.user.id,
    })
    .returning({ id: cardDefinitions.id });

  return ok({ id: card.id });
}

export async function updateCard(input: unknown): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const parsed = UpdateCardSchema.safeParse(input);
  if (!parsed.success) return err("Validation failed");

  const { cardId, contentJson } = parsed.data;

  const [card] = await db.select().from(cardDefinitions).where(eq(cardDefinitions.id, cardId));

  if (!card) return err("Card not found");

  const canEdit = await canEditDeck(card.deckDefinitionId, session.user.id);
  if (!canEdit) return err("Permission denied");

  const contentResult = validateCardContent(card.cardType as CardType, contentJson);
  if (!contentResult.success) return err(contentResult.error);

  const oldContentJson = card.contentJson;

  await db
    .update(cardDefinitions)
    .set({
      contentJson: contentResult.data,
      version: card.version + 1,
      updatedByUserId: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(cardDefinitions.id, cardId));

  await cleanupRemovedAssets(oldContentJson, contentResult.data, cardId);

  return ok({ id: cardId });
}

export async function getCard(
  cardId: string,
): Promise<Result<typeof cardDefinitions.$inferSelect>> {
  if (!isValidUuid(cardId)) return err("Invalid card ID");
  const session = await requireSession();

  const [card] = await db.select().from(cardDefinitions).where(eq(cardDefinitions.id, cardId));

  if (!card) return err("Card not found");

  const canView = await canViewDeck(card.deckDefinitionId, session.user.id);
  if (!canView) return err("Permission denied");

  return ok(card);
}

export async function listCards(
  deckDefinitionId: string,
  opts?: { limit?: number; offset?: number },
): Promise<Result<Array<typeof cardDefinitions.$inferSelect>>> {
  if (!isValidUuid(deckDefinitionId)) return err("Invalid deck ID");
  const session = await requireSession();

  const canView = await canViewDeck(deckDefinitionId, session.user.id);
  if (!canView) return err("Permission denied");

  const limit = opts?.limit ?? 100;
  const offset = opts?.offset ?? 0;

  const rows = await db
    .select()
    .from(cardDefinitions)
    .where(
      and(
        eq(cardDefinitions.deckDefinitionId, deckDefinitionId),
        isNull(cardDefinitions.archivedAt),
      ),
    )
    .limit(limit)
    .offset(offset);

  return ok(rows);
}

export async function archiveCard(cardId: string): Promise<Result<{ id: string }>> {
  if (!isValidUuid(cardId)) return err("Invalid card ID");
  const session = await requireSession();

  const [card] = await db.select().from(cardDefinitions).where(eq(cardDefinitions.id, cardId));

  if (!card) return err("Card not found");

  const canEdit = await canEditDeck(card.deckDefinitionId, session.user.id);
  if (!canEdit) return err("Permission denied");

  await db
    .update(cardDefinitions)
    .set({
      archivedAt: new Date(),
      updatedAt: new Date(),
      updatedByUserId: session.user.id,
    })
    .where(eq(cardDefinitions.id, cardId));

  await cleanupRemovedAssets(card.contentJson, {}, cardId);

  return ok({ id: cardId });
}
