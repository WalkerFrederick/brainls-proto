"use server";

import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { cardDefinitions, deckDefinitions, cardTags, tags } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { safeAction } from "@/lib/errors";
import { ok, err, type Result } from "@/lib/result";
import { CreateCardSchema, UpdateCardSchema } from "@/lib/schemas";
import { canEditDeck, canViewDeck } from "@/lib/permissions";
import { isValidUuid } from "@/lib/validate-uuid";
import { resolveSourceDeck } from "@/lib/deck-resolver";
import { cleanupRemovedAssets } from "@/lib/asset-cleanup";
import { insertCard, updateCardContent } from "@/lib/card-helpers";

export const createCard = safeAction(
  "createCard",
  async (input: unknown): Promise<Result<{ id: string }>> => {
    const session = await requireSession();
    const parsed = CreateCardSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "VALIDATION_FAILED",
        "Validation failed",
        Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v ?? []]),
        ),
      );
    }

    const { deckDefinitionId, cardType, contentJson, createReverse } = parsed.data;

    const [deck] = await db
      .select()
      .from(deckDefinitions)
      .where(eq(deckDefinitions.id, deckDefinitionId));

    if (!deck) return err("NOT_FOUND", "Deck not found");

    const canEdit = await canEditDeck(deckDefinitionId, session.user.id);
    if (!canEdit) return err("PERMISSION_DENIED", "Permission denied");

    return insertCard({
      deckDefinitionId,
      cardType,
      contentJson,
      userId: session.user.id,
      createReverse,
    });
  },
);

export const updateCard = safeAction(
  "updateCard",
  async (input: unknown): Promise<Result<{ id: string }>> => {
    const session = await requireSession();
    const parsed = UpdateCardSchema.safeParse(input);
    if (!parsed.success) return err("VALIDATION_FAILED", "Validation failed");

    const { cardId, contentJson } = parsed.data;

    const [card] = await db.select().from(cardDefinitions).where(eq(cardDefinitions.id, cardId));

    if (!card) return err("NOT_FOUND", "Card not found");

    const canEdit = await canEditDeck(card.deckDefinitionId, session.user.id);
    if (!canEdit) return err("PERMISSION_DENIED", "Permission denied");

    return updateCardContent({ cardId, contentJson, userId: session.user.id });
  },
);

export const getCard = safeAction(
  "getCard",
  async (cardId: string): Promise<Result<typeof cardDefinitions.$inferSelect>> => {
    if (!isValidUuid(cardId)) return err("VALIDATION_FAILED", "Invalid card ID");
    const session = await requireSession();

    const [card] = await db.select().from(cardDefinitions).where(eq(cardDefinitions.id, cardId));

    if (!card) return err("NOT_FOUND", "Card not found");

    const canView = await canViewDeck(card.deckDefinitionId, session.user.id);
    if (!canView) return err("PERMISSION_DENIED", "Permission denied");

    return ok(card);
  },
);

export const archiveCard = safeAction(
  "archiveCard",
  async (cardId: string): Promise<Result<{ id: string }>> => {
    if (!isValidUuid(cardId)) return err("VALIDATION_FAILED", "Invalid card ID");
    const session = await requireSession();

    const [card] = await db.select().from(cardDefinitions).where(eq(cardDefinitions.id, cardId));

    if (!card) return err("NOT_FOUND", "Card not found");

    const canEdit = await canEditDeck(card.deckDefinitionId, session.user.id);
    if (!canEdit) return err("PERMISSION_DENIED", "Permission denied");

    await db
      .update(cardDefinitions)
      .set({
        archivedAt: new Date(),
        updatedAt: new Date(),
        updatedByUserId: session.user.id,
      })
      .where(eq(cardDefinitions.id, cardId));

    if (card.cardType === "cloze" && !card.parentCardId) {
      await db
        .update(cardDefinitions)
        .set({
          archivedAt: new Date(),
          updatedAt: new Date(),
          updatedByUserId: session.user.id,
        })
        .where(and(eq(cardDefinitions.parentCardId, cardId), isNull(cardDefinitions.archivedAt)));
    }

    await cleanupRemovedAssets(card.contentJson, {}, cardId);

    return ok({ id: cardId });
  },
);

export const listCards = safeAction(
  "listCards",
  async (
    deckDefinitionId: string,
    opts?: { limit?: number; offset?: number; tag?: string },
  ): Promise<
    Result<{
      cards: Array<typeof cardDefinitions.$inferSelect & { tags: string[] }>;
      totalCount: number;
    }>
  > => {
    if (!isValidUuid(deckDefinitionId)) return err("VALIDATION_FAILED", "Invalid deck ID");
    const session = await requireSession();

    const canView = await canViewDeck(deckDefinitionId, session.user.id);
    if (!canView) return err("PERMISSION_DENIED", "Permission denied");

    const { sourceDeckId } = await resolveSourceDeck(deckDefinitionId);

    const limit = opts?.limit ?? 100;
    const offset = opts?.offset ?? 0;
    const tagFilter = opts?.tag?.trim().toLowerCase();

    let rows: (typeof cardDefinitions.$inferSelect)[];
    let totalCount: number;

    if (tagFilter) {
      const [dataRows, countResult] = await Promise.all([
        db
          .select({
            id: cardDefinitions.id,
            deckDefinitionId: cardDefinitions.deckDefinitionId,
            cardType: cardDefinitions.cardType,
            status: cardDefinitions.status,
            contentJson: cardDefinitions.contentJson,
            parentCardId: cardDefinitions.parentCardId,
            parentVersionAtGeneration: cardDefinitions.parentVersionAtGeneration,
            version: cardDefinitions.version,
            createdByUserId: cardDefinitions.createdByUserId,
            updatedByUserId: cardDefinitions.updatedByUserId,
            createdAt: cardDefinitions.createdAt,
            updatedAt: cardDefinitions.updatedAt,
            archivedAt: cardDefinitions.archivedAt,
          })
          .from(cardDefinitions)
          .innerJoin(cardTags, eq(cardTags.cardDefinitionId, cardDefinitions.id))
          .innerJoin(tags, eq(cardTags.tagId, tags.id))
          .where(
            and(
              eq(cardDefinitions.deckDefinitionId, sourceDeckId),
              isNull(cardDefinitions.archivedAt),
              isNull(cardDefinitions.parentCardId),
              eq(tags.name, tagFilter),
            ),
          )
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)`.mapWith(Number) })
          .from(cardDefinitions)
          .innerJoin(cardTags, eq(cardTags.cardDefinitionId, cardDefinitions.id))
          .innerJoin(tags, eq(cardTags.tagId, tags.id))
          .where(
            and(
              eq(cardDefinitions.deckDefinitionId, sourceDeckId),
              isNull(cardDefinitions.archivedAt),
              isNull(cardDefinitions.parentCardId),
              eq(tags.name, tagFilter),
            ),
          )
          .then((r) => r[0]?.count ?? 0),
      ]);
      rows = dataRows;
      totalCount = countResult;
    } else {
      const [dataRows, countResult] = await Promise.all([
        db
          .select()
          .from(cardDefinitions)
          .where(
            and(
              eq(cardDefinitions.deckDefinitionId, sourceDeckId),
              isNull(cardDefinitions.archivedAt),
              isNull(cardDefinitions.parentCardId),
            ),
          )
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)`.mapWith(Number) })
          .from(cardDefinitions)
          .where(
            and(
              eq(cardDefinitions.deckDefinitionId, sourceDeckId),
              isNull(cardDefinitions.archivedAt),
              isNull(cardDefinitions.parentCardId),
            ),
          )
          .then((r) => r[0]?.count ?? 0),
      ]);
      rows = dataRows;
      totalCount = countResult;
    }

    const cardIds = rows.map((r) => r.id);
    const tagMap = new Map<string, string[]>();

    if (cardIds.length > 0) {
      const tagRows = await db
        .select({
          cardDefinitionId: cardTags.cardDefinitionId,
          tagName: tags.name,
        })
        .from(cardTags)
        .innerJoin(tags, eq(cardTags.tagId, tags.id))
        .where(
          sql`${cardTags.cardDefinitionId} IN (${sql.join(
            cardIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );

      for (const row of tagRows) {
        const existing = tagMap.get(row.cardDefinitionId) ?? [];
        existing.push(row.tagName);
        tagMap.set(row.cardDefinitionId, existing);
      }
    }

    const result = rows.map((row) => ({
      ...row,
      tags: (tagMap.get(row.id) ?? []).sort(),
    }));

    return ok({ cards: result, totalCount });
  },
);
