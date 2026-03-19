"use server";

import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { cardDefinitions, deckDefinitions, cardTags, tags } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { safeAction } from "@/lib/errors";
import { ok, err, type Result } from "@/lib/result";
import { CreateCardSchema, UpdateCardSchema } from "@/lib/schemas";
import { validateCardContent, type CardType } from "@/lib/schemas/card-content";
import { canEditDeck, canViewDeck } from "@/lib/permissions";
import { isValidUuid } from "@/lib/validate-uuid";
import { cleanupRemovedAssets } from "@/lib/asset-cleanup";
import { getUniqueClozeIndices } from "@/lib/cloze";
import { resolveSourceDeck } from "@/lib/deck-resolver";

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

    const contentResult = validateCardContent(cardType as CardType, contentJson);
    if (!contentResult.success) return err("VALIDATION_FAILED", contentResult.error);

    const validatedContent = contentResult.data as Record<string, unknown>;

    if (cardType === "cloze") {
      const text = String(validatedContent.text ?? "");
      const indices = getUniqueClozeIndices(text);
      if (indices.length === 0) {
        return err(
          "VALIDATION_FAILED",
          "Cloze text must contain at least one cloze deletion (e.g. {{c1::answer}})",
        );
      }

      const [parent] = await db
        .insert(cardDefinitions)
        .values({
          deckDefinitionId,
          cardType: "cloze",
          contentJson: { text },
          createdByUserId: session.user.id,
          updatedByUserId: session.user.id,
        })
        .returning({ id: cardDefinitions.id });

      await db.insert(cardDefinitions).values(
        indices.map((clozeIndex) => ({
          deckDefinitionId,
          cardType: "cloze",
          contentJson: { text, clozeIndex },
          parentCardId: parent.id,
          createdByUserId: session.user.id,
          updatedByUserId: session.user.id,
        })),
      );

      return ok({ id: parent.id });
    }

    const [card] = await db
      .insert(cardDefinitions)
      .values({
        deckDefinitionId,
        cardType,
        contentJson: validatedContent,
        createdByUserId: session.user.id,
        updatedByUserId: session.user.id,
      })
      .returning({ id: cardDefinitions.id });

    if (createReverse && cardType === "front_back") {
      const reverseContent = { front: validatedContent.back, back: validatedContent.front };
      await db.insert(cardDefinitions).values({
        deckDefinitionId,
        cardType: "front_back",
        contentJson: reverseContent,
        createdByUserId: session.user.id,
        updatedByUserId: session.user.id,
      });
    }

    return ok({ id: card.id });
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

    const contentResult = validateCardContent(card.cardType as CardType, contentJson);
    if (!contentResult.success) return err("VALIDATION_FAILED", contentResult.error);

    const validatedContent = contentResult.data as Record<string, unknown>;
    const oldContentJson = card.contentJson;

    if (card.cardType === "cloze" && !card.parentCardId) {
      const text = String(validatedContent.text ?? "");
      const newIndices = getUniqueClozeIndices(text);
      if (newIndices.length === 0) {
        return err(
          "VALIDATION_FAILED",
          "Cloze text must contain at least one cloze deletion (e.g. {{c1::answer}})",
        );
      }

      await db
        .update(cardDefinitions)
        .set({
          contentJson: { text },
          version: card.version + 1,
          updatedByUserId: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(cardDefinitions.id, cardId));

      const existingChildren = await db
        .select({
          id: cardDefinitions.id,
          contentJson: cardDefinitions.contentJson,
        })
        .from(cardDefinitions)
        .where(and(eq(cardDefinitions.parentCardId, cardId), isNull(cardDefinitions.archivedAt)));

      const existingIndices = new Map<number, string>();
      for (const child of existingChildren) {
        const cj = child.contentJson as Record<string, unknown>;
        const idx = Number(cj.clozeIndex);
        if (idx) existingIndices.set(idx, child.id);
      }

      const newSet = new Set(newIndices);
      const existingSet = new Set(existingIndices.keys());

      const toAdd = newIndices.filter((i) => !existingSet.has(i));
      const toRemove = [...existingSet].filter((i) => !newSet.has(i));
      const toUpdate = newIndices.filter((i) => existingSet.has(i));

      if (toRemove.length > 0) {
        for (const idx of toRemove) {
          const childId = existingIndices.get(idx)!;
          await db
            .update(cardDefinitions)
            .set({
              archivedAt: new Date(),
              updatedAt: new Date(),
              updatedByUserId: session.user.id,
            })
            .where(eq(cardDefinitions.id, childId));
        }
      }

      if (toUpdate.length > 0) {
        for (const idx of toUpdate) {
          const childId = existingIndices.get(idx)!;
          await db
            .update(cardDefinitions)
            .set({
              contentJson: { text, clozeIndex: idx },
              updatedAt: new Date(),
              updatedByUserId: session.user.id,
            })
            .where(eq(cardDefinitions.id, childId));
        }
      }

      if (toAdd.length > 0) {
        await db.insert(cardDefinitions).values(
          toAdd.map((clozeIndex) => ({
            deckDefinitionId: card.deckDefinitionId,
            cardType: "cloze",
            contentJson: { text, clozeIndex },
            parentCardId: cardId,
            createdByUserId: session.user.id,
            updatedByUserId: session.user.id,
          })),
        );
      }

      await cleanupRemovedAssets(oldContentJson, { text }, cardId);
      return ok({ id: cardId });
    }

    await db
      .update(cardDefinitions)
      .set({
        contentJson: validatedContent,
        version: card.version + 1,
        updatedByUserId: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(cardDefinitions.id, cardId));

    await cleanupRemovedAssets(oldContentJson, validatedContent, cardId);

    return ok({ id: cardId });
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
