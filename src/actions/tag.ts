"use server";

import { eq, sql, ilike } from "drizzle-orm";
import { db } from "@/db";
import { tags, deckTags, cardTags, deckDefinitions, cardDefinitions, userDecks } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { safeAction } from "@/lib/errors";
import { canEditDeck } from "@/lib/permissions";
import { ok, err, type Result } from "@/lib/result";
import {
  SetDeckTagsSchema,
  SetCardTagsSchema,
  SearchTagsSchema,
  SuggestCardTagsSchema,
} from "@/lib/schemas";
import { isValidUuid } from "@/lib/validate-uuid";
import { suggestTags, logAiCall, estimateCost, checkAiLimit, handleAiError } from "@/lib/ai";
import { stripHtml } from "@/lib/sanitize-html";
import { upsertTags } from "@/lib/tag-helpers";

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

export const suggestCardTags = safeAction(
  "suggestCardTags",
  async (input: unknown): Promise<Result<string[]>> => {
    const session = await requireSession();
    const parsed = SuggestCardTagsSchema.safeParse(input);
    if (!parsed.success) return err("VALIDATION_FAILED", "Validation failed");

    const { deckDefinitionId, cardContent, cardType, existingCardTags } = parsed.data;
    if (!isValidUuid(deckDefinitionId)) return err("VALIDATION_FAILED", "Invalid deck ID");

    const limitResult = await checkAiLimit(session.user.id);
    if (limitResult) return limitResult as Result<never>;

    const [deck] = await db
      .select({
        id: deckDefinitions.id,
        title: deckDefinitions.title,
        description: deckDefinitions.description,
      })
      .from(deckDefinitions)
      .where(eq(deckDefinitions.id, deckDefinitionId));
    if (!deck) return err("NOT_FOUND", "Deck not found");

    const deckTagRows = await db
      .select({ name: tags.name })
      .from(deckTags)
      .innerJoin(tags, eq(deckTags.tagId, tags.id))
      .where(eq(deckTags.deckDefinitionId, deckDefinitionId));

    const userTagRows = await db
      .select({
        name: tags.name,
        cnt: sql<number>`count(*)::int`,
      })
      .from(cardTags)
      .innerJoin(cardDefinitions, eq(cardTags.cardDefinitionId, cardDefinitions.id))
      .innerJoin(userDecks, eq(cardDefinitions.deckDefinitionId, userDecks.deckDefinitionId))
      .innerJoin(tags, eq(cardTags.tagId, tags.id))
      .where(eq(userDecks.userId, session.user.id))
      .groupBy(tags.name)
      .orderBy(sql`count(*) DESC`)
      .limit(50);

    const strippedContent = cardContent ? stripHtml(cardContent).slice(0, 2000) : null;

    const inputSnapshot = { deckTitle: deck.title, cardContent: strippedContent?.slice(0, 200) };
    const startMs = Date.now();
    let result;
    try {
      result = await suggestTags({
        deckTitle: deck.title,
        deckDescription: deck.description,
        deckTags: deckTagRows.map((r) => r.name),
        cardContent: strippedContent,
        cardType: cardType ?? null,
        existingCardTags: existingCardTags ?? [],
        userTags: userTagRows.map((r) => r.name),
      });
    } catch (e: unknown) {
      return handleAiError(e, {
        userId: session.user.id,
        action: "suggestCardTags",
        startMs,
        inputSnapshot,
      });
    }
    const durationMs = Date.now() - startMs;

    if (!result) return err("INTERNAL_ERROR", "AI features are not configured");

    const excluded = new Set([
      ...(existingCardTags ?? []).map((t) => t.toLowerCase()),
      ...deckTagRows.map((r) => r.name.toLowerCase()),
    ]);
    const filtered = result.tags.filter((t) => !excluded.has(t));

    const cost = estimateCost(result.provider, result.usage.inputTokens, result.usage.outputTokens);
    logAiCall({
      userId: session.user.id,
      action: "suggestTags",
      model: result.provider.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      estimatedCostUsd: cost,
      durationMs,
      input: inputSnapshot,
      output: result.tags,
    });

    return ok(filtered);
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
