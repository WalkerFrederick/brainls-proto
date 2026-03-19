"use server";

import { eq, sql, ilike, inArray } from "drizzle-orm";
import { db } from "@/db";
import { tags, deckTags, cardTags, deckDefinitions, cardDefinitions } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { safeAction } from "@/lib/errors";
import { canEditDeck } from "@/lib/permissions";
import { ok, err, type Result } from "@/lib/result";
import { SetDeckTagsSchema, SetCardTagsSchema, SearchTagsSchema } from "@/lib/schemas";
import { isValidUuid } from "@/lib/validate-uuid";

async function upsertTags(names: string[]): Promise<Map<string, string>> {
  if (names.length === 0) return new Map();

  const unique = [...new Set(names)];

  const existing = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(inArray(tags.name, unique));

  const nameToId = new Map(existing.map((t) => [t.name, t.id]));
  const missing = unique.filter((n) => !nameToId.has(n));

  if (missing.length > 0) {
    const inserted = await db
      .insert(tags)
      .values(missing.map((name) => ({ name })))
      .onConflictDoNothing()
      .returning({ id: tags.id, name: tags.name });

    for (const t of inserted) {
      nameToId.set(t.name, t.id);
    }

    if (nameToId.size < unique.length) {
      const stillMissing = unique.filter((n) => !nameToId.has(n));
      if (stillMissing.length > 0) {
        const refetched = await db
          .select({ id: tags.id, name: tags.name })
          .from(tags)
          .where(inArray(tags.name, stillMissing));
        for (const t of refetched) {
          nameToId.set(t.name, t.id);
        }
      }
    }
  }

  return nameToId;
}

export const searchTags = safeAction(
  "searchTags",
  async (input: unknown): Promise<Result<{ id: string; name: string; usageCount: number }[]>> => {
    await requireSession();
    const parsed = SearchTagsSchema.safeParse(input);
    if (!parsed.success) return err("VALIDATION_FAILED", "Validation failed");

    const { query } = parsed.data;

    const cardCount = sql<number>`(
    SELECT count(*)::int FROM card_tags WHERE card_tags.tag_id = ${tags.id}
  )`;
    const deckCount = sql<number>`(
    SELECT count(*)::int FROM deck_tags WHERE deck_tags.tag_id = ${tags.id}
  )`;

    const baseQuery = db
      .select({
        id: tags.id,
        name: tags.name,
        usageCount: sql<number>`(${cardCount} + ${deckCount})`,
      })
      .from(tags);

    const rows = query
      ? await baseQuery
          .where(ilike(tags.name, `%${query}%`))
          .orderBy(sql`(${cardCount} + ${deckCount}) DESC`)
          .limit(20)
      : await baseQuery.orderBy(sql`(${cardCount} + ${deckCount}) DESC`).limit(20);

    return ok(rows);
  },
);

export const setDeckTags = safeAction(
  "setDeckTags",
  async (input: unknown): Promise<Result<string[]>> => {
    const session = await requireSession();
    const parsed = SetDeckTagsSchema.safeParse(input);
    if (!parsed.success) return err("VALIDATION_FAILED", "Validation failed");

    const { deckDefinitionId, tagNames } = parsed.data;
    if (!isValidUuid(deckDefinitionId)) return err("VALIDATION_FAILED", "Invalid deck ID");

    const [deck] = await db
      .select({ folderId: deckDefinitions.folderId })
      .from(deckDefinitions)
      .where(eq(deckDefinitions.id, deckDefinitionId));
    if (!deck) return err("NOT_FOUND", "Deck not found");

    const canEdit = await canEditDeck(deckDefinitionId, session.user.id);
    if (!canEdit) return err("PERMISSION_DENIED", "Permission denied");

    const uniqueNames = [...new Set(tagNames)];
    const nameToId = await upsertTags(uniqueNames);

    await db.delete(deckTags).where(eq(deckTags.deckDefinitionId, deckDefinitionId));

    if (uniqueNames.length > 0) {
      const tagIds = uniqueNames.map((n) => nameToId.get(n)).filter(Boolean) as string[];
      if (tagIds.length > 0) {
        await db.insert(deckTags).values(tagIds.map((tagId) => ({ deckDefinitionId, tagId })));
      }
    }

    return ok(uniqueNames);
  },
);

export const setCardTags = safeAction(
  "setCardTags",
  async (input: unknown): Promise<Result<string[]>> => {
    const session = await requireSession();
    const parsed = SetCardTagsSchema.safeParse(input);
    if (!parsed.success) return err("VALIDATION_FAILED", "Validation failed");

    const { cardDefinitionId, tagNames } = parsed.data;
    if (!isValidUuid(cardDefinitionId)) return err("VALIDATION_FAILED", "Invalid card ID");

    const [card] = await db
      .select({ deckDefinitionId: cardDefinitions.deckDefinitionId })
      .from(cardDefinitions)
      .where(eq(cardDefinitions.id, cardDefinitionId));
    if (!card) return err("NOT_FOUND", "Card not found");

    const canEdit = await canEditDeck(card.deckDefinitionId, session.user.id);
    if (!canEdit) return err("PERMISSION_DENIED", "Permission denied");

    const uniqueNames = [...new Set(tagNames)];
    const nameToId = await upsertTags(uniqueNames);

    await db.delete(cardTags).where(eq(cardTags.cardDefinitionId, cardDefinitionId));

    if (uniqueNames.length > 0) {
      const tagIds = uniqueNames.map((n) => nameToId.get(n)).filter(Boolean) as string[];
      if (tagIds.length > 0) {
        await db.insert(cardTags).values(tagIds.map((tagId) => ({ cardDefinitionId, tagId })));
      }
    }

    return ok(uniqueNames);
  },
);

export const getDeckTags = safeAction(
  "getDeckTags",
  async (deckDefinitionId: string): Promise<Result<string[]>> => {
    if (!isValidUuid(deckDefinitionId)) return err("VALIDATION_FAILED", "Invalid deck ID");
    const rows = await db
      .select({ name: tags.name })
      .from(deckTags)
      .innerJoin(tags, eq(deckTags.tagId, tags.id))
      .where(eq(deckTags.deckDefinitionId, deckDefinitionId))
      .orderBy(tags.name);
    return ok(rows.map((r) => r.name));
  },
);

export const getCardTags = safeAction(
  "getCardTags",
  async (cardDefinitionId: string): Promise<Result<string[]>> => {
    if (!isValidUuid(cardDefinitionId)) return err("VALIDATION_FAILED", "Invalid card ID");
    const rows = await db
      .select({ name: tags.name })
      .from(cardTags)
      .innerJoin(tags, eq(cardTags.tagId, tags.id))
      .where(eq(cardTags.cardDefinitionId, cardDefinitionId))
      .orderBy(tags.name);
    return ok(rows.map((r) => r.name));
  },
);
