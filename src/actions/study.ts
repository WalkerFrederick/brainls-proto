"use server";

import { eq, and, isNull, sql, asc, or, ne, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  userDecks,
  userCardStates,
  reviewLogs,
  cardDefinitions,
  deckDefinitions,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";
import { SubmitReviewSchema, CustomStudySchema } from "@/lib/schemas";
import { canViewDeck } from "@/lib/permissions";
import { processReview, getDefaultCardState, type Rating, type CardState } from "@/lib/srs";
import { isValidUuid } from "@/lib/validate-uuid";
import { resolveSourceDeck } from "@/lib/deck-resolver";

export async function addDeckToLibrary(deckDefinitionId: string): Promise<Result<{ id: string }>> {
  if (!isValidUuid(deckDefinitionId)) return err("Invalid deck ID");
  const session = await requireSession();

  const canView = await canViewDeck(deckDefinitionId, session.user.id);
  if (!canView) return err("Permission denied");

  const existing = await db
    .select()
    .from(userDecks)
    .where(
      and(eq(userDecks.userId, session.user.id), eq(userDecks.deckDefinitionId, deckDefinitionId)),
    );

  if (existing.length > 0) {
    if (existing[0].archivedAt) {
      await db
        .update(userDecks)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(eq(userDecks.id, existing[0].id));
      return ok({ id: existing[0].id });
    }
    return ok({ id: existing[0].id });
  }

  const [userDeck] = await db
    .insert(userDecks)
    .values({
      userId: session.user.id,
      deckDefinitionId,
    })
    .returning({ id: userDecks.id });

  const { sourceDeckId } = await resolveSourceDeck(deckDefinitionId);

  const cards = await db
    .select({ id: cardDefinitions.id })
    .from(cardDefinitions)
    .where(
      and(
        eq(cardDefinitions.deckDefinitionId, sourceDeckId),
        isNull(cardDefinitions.archivedAt),
        eq(cardDefinitions.status, "active"),
        or(ne(cardDefinitions.cardType, "cloze"), isNotNull(cardDefinitions.parentCardId)),
      ),
    );

  if (cards.length > 0) {
    const defaultState = getDefaultCardState();
    await db.insert(userCardStates).values(
      cards.map((card) => ({
        userDeckId: userDeck.id,
        cardDefinitionId: card.id,
        srsState: defaultState.srsState,
        easeFactor: String(defaultState.easeFactor),
        reps: 0,
        lapses: 0,
      })),
    );
  }

  return ok({ id: userDeck.id });
}

export async function getStudySession(
  userDeckId: string,
  opts?: { limit?: number },
): Promise<
  Result<{
    userDeckId: string;
    deckTitle: string;
    cards: Array<{
      userCardStateId: string;
      cardDefinitionId: string;
      cardType: string;
      contentJson: unknown;
      srsState: string;
      intervalDays: number | null;
      easeFactor: string | null;
      reps: number | null;
      lapses: number | null;
    }>;
    totalDue: number;
  }>
> {
  if (!isValidUuid(userDeckId)) return err("Invalid user deck ID");
  const session = await requireSession();

  const [userDeck] = await db
    .select()
    .from(userDecks)
    .where(and(eq(userDecks.id, userDeckId), eq(userDecks.userId, session.user.id)));

  if (!userDeck) return err("User deck not found");

  const [deck] = await db
    .select()
    .from(deckDefinitions)
    .where(eq(deckDefinitions.id, userDeck.deckDefinitionId));

  if (!deck) return err("Deck definition not found");

  await syncNewCards(userDeckId, userDeck.deckDefinitionId);

  const limit = opts?.limit ?? 20;
  const nowIso = new Date().toISOString();

  const dueCards = await db
    .select({
      userCardStateId: userCardStates.id,
      cardDefinitionId: userCardStates.cardDefinitionId,
      cardType: cardDefinitions.cardType,
      contentJson: cardDefinitions.contentJson,
      srsState: userCardStates.srsState,
      intervalDays: userCardStates.intervalDays,
      easeFactor: userCardStates.easeFactor,
      reps: userCardStates.reps,
      lapses: userCardStates.lapses,
    })
    .from(userCardStates)
    .innerJoin(cardDefinitions, eq(userCardStates.cardDefinitionId, cardDefinitions.id))
    .where(
      and(
        eq(userCardStates.userDeckId, userDeckId),
        sql`(${userCardStates.dueAt} IS NULL OR ${userCardStates.dueAt} <= ${nowIso})`,
        isNull(cardDefinitions.archivedAt),
      ),
    )
    .orderBy(asc(userCardStates.dueAt))
    .limit(limit);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userCardStates)
    .where(
      and(
        eq(userCardStates.userDeckId, userDeckId),
        sql`(${userCardStates.dueAt} IS NULL OR ${userCardStates.dueAt} <= ${nowIso})`,
      ),
    );

  return ok({
    userDeckId,
    deckTitle: deck.title,
    cards: dueCards,
    totalDue: Number(countResult.count),
  });
}

export async function submitReview(
  input: unknown,
): Promise<Result<{ userCardStateId: string; nextDueAt: string }>> {
  const session = await requireSession();
  const parsed = SubmitReviewSchema.safeParse(input);
  if (!parsed.success) return err("Validation failed");

  const { userCardStateId, rating, responseMs, idempotencyKey, skipSrsUpdate } = parsed.data;

  const existingLog = await db
    .select()
    .from(reviewLogs)
    .where(eq(reviewLogs.idempotencyKey, idempotencyKey));

  if (existingLog.length > 0) {
    return ok({
      userCardStateId,
      nextDueAt: existingLog[0].createdAt.toISOString(),
    });
  }

  const [cardState] = await db
    .select()
    .from(userCardStates)
    .where(eq(userCardStates.id, userCardStateId));

  if (!cardState) return err("Card state not found");

  const [userDeck] = await db
    .select()
    .from(userDecks)
    .where(and(eq(userDecks.id, cardState.userDeckId), eq(userDecks.userId, session.user.id)));

  if (!userDeck) return err("Permission denied");

  const currentState: CardState = {
    srsState: (cardState.srsState as CardState["srsState"]) ?? "new",
    intervalDays: cardState.intervalDays ?? 0,
    easeFactor: Number(cardState.easeFactor) || 2.5,
    reps: cardState.reps ?? 0,
    lapses: cardState.lapses ?? 0,
  };

  const result = processReview(currentState, rating as Rating);

  if (!skipSrsUpdate) {
    await db
      .update(userCardStates)
      .set({
        srsState: result.nextState.srsState,
        dueAt: result.nextDueAt,
        intervalDays: result.nextState.intervalDays,
        easeFactor: String(result.nextState.easeFactor),
        reps: result.nextState.reps,
        lapses: result.nextState.lapses,
        lastReviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userCardStates.id, userCardStateId));
  }

  await db.insert(reviewLogs).values({
    userDeckId: cardState.userDeckId,
    userCardStateId,
    cardDefinitionId: cardState.cardDefinitionId,
    idempotencyKey,
    rating,
    wasCorrect: rating !== "again",
    responseMs: responseMs ?? null,
    srsStateBefore: currentState.srsState,
    srsStateAfter: result.nextState.srsState,
    intervalDaysBefore: currentState.intervalDays,
    intervalDaysAfter: result.nextState.intervalDays,
    easeFactorBefore: String(currentState.easeFactor),
    easeFactorAfter: String(result.nextState.easeFactor),
    srsVersionUsed: userDeck.srsConfigVersion,
  });

  if (!skipSrsUpdate) {
    await db
      .update(userDecks)
      .set({ lastStudiedAt: new Date(), updatedAt: new Date() })
      .where(eq(userDecks.id, cardState.userDeckId));
  }

  return ok({
    userCardStateId,
    nextDueAt: result.nextDueAt.toISOString(),
  });
}

export async function listUserDecks(): Promise<
  Result<
    Array<{
      id: string;
      deckTitle: string;
      deckDefinitionId: string;
      lastStudiedAt: Date | null;
      totalCards: number;
      dueCards: number;
    }>
  >
> {
  const session = await requireSession();
  const nowIso = new Date().toISOString();

  const decks = await db
    .select({
      id: userDecks.id,
      deckDefinitionId: userDecks.deckDefinitionId,
      lastStudiedAt: userDecks.lastStudiedAt,
      deckTitle: deckDefinitions.title,
    })
    .from(userDecks)
    .innerJoin(deckDefinitions, eq(userDecks.deckDefinitionId, deckDefinitions.id))
    .where(and(eq(userDecks.userId, session.user.id), isNull(userDecks.archivedAt)));

  const result = await Promise.all(
    decks.map(async (deck) => {
      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(userCardStates)
        .where(eq(userCardStates.userDeckId, deck.id));

      const [dueResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(userCardStates)
        .where(
          and(
            eq(userCardStates.userDeckId, deck.id),
            sql`(${userCardStates.dueAt} IS NULL OR ${userCardStates.dueAt} <= ${nowIso})`,
          ),
        );

      return {
        id: deck.id,
        deckTitle: deck.deckTitle,
        deckDefinitionId: deck.deckDefinitionId,
        lastStudiedAt: deck.lastStudiedAt,
        totalCards: Number(totalResult.count),
        dueCards: Number(dueResult.count),
      };
    }),
  );

  return ok(result);
}

export async function getDeckStudyStats(deckDefinitionId: string): Promise<
  Result<{
    inLibrary: boolean;
    newCount: number;
    learningCount: number;
    dueCount: number;
    totalStudied: number;
  } | null>
> {
  if (!isValidUuid(deckDefinitionId)) return err("Invalid deck ID");
  const session = await requireSession();

  const [userDeck] = await db
    .select({ id: userDecks.id })
    .from(userDecks)
    .where(
      and(
        eq(userDecks.userId, session.user.id),
        eq(userDecks.deckDefinitionId, deckDefinitionId),
        isNull(userDecks.archivedAt),
      ),
    );

  if (!userDeck) {
    return ok(null);
  }

  const nowIso = new Date().toISOString();

  const rows = await db
    .select({
      srsState: userCardStates.srsState,
      isDue: sql<boolean>`(${userCardStates.dueAt} IS NOT NULL AND ${userCardStates.dueAt} <= ${nowIso})`,
    })
    .from(userCardStates)
    .where(eq(userCardStates.userDeckId, userDeck.id));

  let newCount = 0;
  let learningCount = 0;
  let dueCount = 0;
  let totalStudied = 0;

  for (const row of rows) {
    switch (row.srsState) {
      case "new":
        newCount++;
        break;
      case "learning":
      case "relearning":
        learningCount++;
        totalStudied++;
        break;
      case "review":
        totalStudied++;
        if (row.isDue) dueCount++;
        break;
    }
  }

  return ok({ inLibrary: true, newCount, learningCount, dueCount, totalStudied });
}

async function syncNewCards(userDeckId: string, deckDefinitionId: string) {
  const { sourceDeckId } = await resolveSourceDeck(deckDefinitionId);

  const existingCardIds = db
    .select({ cardDefinitionId: userCardStates.cardDefinitionId })
    .from(userCardStates)
    .where(eq(userCardStates.userDeckId, userDeckId));

  const newCards = await db
    .select({ id: cardDefinitions.id })
    .from(cardDefinitions)
    .where(
      and(
        eq(cardDefinitions.deckDefinitionId, sourceDeckId),
        isNull(cardDefinitions.archivedAt),
        eq(cardDefinitions.status, "active"),
        sql`${cardDefinitions.id} NOT IN (${existingCardIds})`,
        or(ne(cardDefinitions.cardType, "cloze"), isNotNull(cardDefinitions.parentCardId)),
      ),
    );

  if (newCards.length === 0) return;

  const defaultState = getDefaultCardState();
  await db.insert(userCardStates).values(
    newCards.map((card) => ({
      userDeckId,
      cardDefinitionId: card.id,
      srsState: defaultState.srsState,
      easeFactor: String(defaultState.easeFactor),
      reps: 0,
      lapses: 0,
    })),
  );
}

export async function getReviewHeatmapData(): Promise<Result<{ date: string; count: number }[]>> {
  const session = await requireSession();

  const startOfYear = new Date(new Date().getFullYear(), 0, 1);

  const myDeckIds = db
    .select({ id: userDecks.id })
    .from(userDecks)
    .where(eq(userDecks.userId, session.user.id));

  const rows = await db
    .select({
      date: sql<string>`to_char(${reviewLogs.reviewedAt}::date, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviewLogs)
    .where(
      and(
        sql`${reviewLogs.userDeckId} IN (${myDeckIds})`,
        sql`${reviewLogs.reviewedAt} >= ${startOfYear.toISOString()}`,
      ),
    )
    .groupBy(sql`${reviewLogs.reviewedAt}::date`)
    .orderBy(sql`${reviewLogs.reviewedAt}::date`);

  return ok(rows);
}

/**
 * Ensures the user has userDecks + userCardStates for every accessible deck
 * containing cards with the given tags. This auto-provisions decks the user
 * can view but hasn't explicitly "studied" yet, so custom study sessions
 * work immediately.
 */
async function ensureLibraryForTags(userId: string, tagNames: string[]) {
  const tagNameParams = sql.join(
    tagNames.map((n) => sql`${n}`),
    sql`, `,
  );

  const taggedCardFilter = sql`(
    SELECT cd.id FROM card_definitions cd
    JOIN card_tags ct ON ct.card_definition_id = cd.id
    JOIN tags t ON ct.tag_id = t.id
    WHERE t.name IN (${tagNameParams})
    UNION
    SELECT cd.id FROM card_definitions cd
    JOIN card_tags ct ON ct.card_definition_id = cd.parent_card_id
    JOIN tags t ON ct.tag_id = t.id
    WHERE cd.parent_card_id IS NOT NULL
      AND t.name IN (${tagNameParams})
  )`;

  // Find distinct deck IDs the user can access that have matching tagged cards
  type DeckRow = { deckId: string; linkedDeckDefinitionId: string | null };

  const accessibleRows = await db.execute<DeckRow>(sql`
    SELECT DISTINCT dd.id as "deckId", dd.linked_deck_definition_id as "linkedDeckDefinitionId"
    FROM deck_definitions dd
    JOIN workspace_members wm ON wm.workspace_id = dd.workspace_id
      AND wm.user_id = ${userId} AND wm.status = 'active'
    JOIN card_definitions cd ON cd.deck_definition_id = dd.id
    WHERE dd.archived_at IS NULL
      AND cd.id IN ${taggedCardFilter}
  `);

  const linkedRows = await db.execute<DeckRow>(sql`
    SELECT DISTINCT dd.id as "deckId", dd.linked_deck_definition_id as "linkedDeckDefinitionId"
    FROM deck_definitions dd
    JOIN workspace_members wm ON wm.workspace_id = dd.workspace_id
      AND wm.user_id = ${userId} AND wm.status = 'active'
    JOIN card_definitions cd ON cd.deck_definition_id = dd.linked_deck_definition_id
    WHERE dd.archived_at IS NULL
      AND dd.linked_deck_definition_id IS NOT NULL
      AND cd.id IN ${taggedCardFilter}
  `);

  const allDecks = [...accessibleRows, ...linkedRows] as DeckRow[];
  const seen = new Set<string>();
  const uniqueDecks = allDecks.filter((d) => {
    if (seen.has(d.deckId)) return false;
    seen.add(d.deckId);
    return true;
  });

  for (const deck of uniqueDecks) {
    const [existing] = await db
      .select({ id: userDecks.id })
      .from(userDecks)
      .where(and(eq(userDecks.userId, userId), eq(userDecks.deckDefinitionId, deck.deckId)));

    if (existing) continue;

    const [userDeck] = await db
      .insert(userDecks)
      .values({ userId, deckDefinitionId: deck.deckId })
      .returning({ id: userDecks.id });

    const sourceDeckId = deck.linkedDeckDefinitionId ?? deck.deckId;
    const cards = await db
      .select({ id: cardDefinitions.id })
      .from(cardDefinitions)
      .where(
        and(
          eq(cardDefinitions.deckDefinitionId, sourceDeckId),
          isNull(cardDefinitions.archivedAt),
          eq(cardDefinitions.status, "active"),
          or(ne(cardDefinitions.cardType, "cloze"), isNotNull(cardDefinitions.parentCardId)),
        ),
      );

    if (cards.length > 0) {
      const defaultState = getDefaultCardState();
      await db.insert(userCardStates).values(
        cards.map((card) => ({
          userDeckId: userDeck.id,
          cardDefinitionId: card.id,
          srsState: defaultState.srsState,
          easeFactor: String(defaultState.easeFactor),
          reps: 0,
          lapses: 0,
        })),
      );
    }
  }
}

export async function getCustomStudySession(input: unknown): Promise<
  Result<{
    title: string;
    cards: Array<{
      userCardStateId: string;
      cardDefinitionId: string;
      cardType: string;
      contentJson: unknown;
      srsState: string;
      intervalDays: number | null;
      easeFactor: string | null;
      reps: number | null;
      lapses: number | null;
    }>;
    totalDue: number;
  }>
> {
  const session = await requireSession();
  const parsed = CustomStudySchema.safeParse(input);
  if (!parsed.success) return err("Validation failed");

  const { tagNames } = parsed.data;

  await ensureLibraryForTags(session.user.id, tagNames);

  const nowIso = new Date().toISOString();

  const myDeckIds = db
    .select({ id: userDecks.id })
    .from(userDecks)
    .where(and(eq(userDecks.userId, session.user.id), isNull(userDecks.archivedAt)));

  const taggedCardFilter = sql`${cardDefinitions.id} IN (
    SELECT cd.id FROM card_definitions cd
    JOIN card_tags ct ON ct.card_definition_id = cd.id
    JOIN tags t ON ct.tag_id = t.id
    WHERE t.name IN (${sql.join(
      tagNames.map((n) => sql`${n}`),
      sql`, `,
    )})
    UNION
    SELECT cd.id FROM card_definitions cd
    JOIN card_tags ct ON ct.card_definition_id = cd.parent_card_id
    JOIN tags t ON ct.tag_id = t.id
    WHERE cd.parent_card_id IS NOT NULL
      AND t.name IN (${sql.join(
        tagNames.map((n) => sql`${n}`),
        sql`, `,
      )})
  )`;

  const dueCards = await db
    .select({
      userCardStateId: userCardStates.id,
      cardDefinitionId: userCardStates.cardDefinitionId,
      cardType: cardDefinitions.cardType,
      contentJson: cardDefinitions.contentJson,
      srsState: userCardStates.srsState,
      intervalDays: userCardStates.intervalDays,
      easeFactor: userCardStates.easeFactor,
      reps: userCardStates.reps,
      lapses: userCardStates.lapses,
      dueAt: userCardStates.dueAt,
    })
    .from(userCardStates)
    .innerJoin(cardDefinitions, eq(userCardStates.cardDefinitionId, cardDefinitions.id))
    .where(
      and(
        sql`${userCardStates.userDeckId} IN (${myDeckIds})`,
        sql`(${userCardStates.dueAt} IS NULL OR ${userCardStates.dueAt} <= ${nowIso})`,
        isNull(cardDefinitions.archivedAt),
        taggedCardFilter,
      ),
    )
    .orderBy(asc(userCardStates.dueAt))
    .limit(50);

  const [countResult] = await db
    .select({ count: sql<number>`count(DISTINCT ${userCardStates.id})` })
    .from(userCardStates)
    .innerJoin(cardDefinitions, eq(userCardStates.cardDefinitionId, cardDefinitions.id))
    .where(
      and(
        sql`${userCardStates.userDeckId} IN (${myDeckIds})`,
        sql`(${userCardStates.dueAt} IS NULL OR ${userCardStates.dueAt} <= ${nowIso})`,
        isNull(cardDefinitions.archivedAt),
        taggedCardFilter,
      ),
    );

  const title = `Custom: ${tagNames.join(", ")}`;

  return ok({
    title,
    cards: dueCards,
    totalDue: Number(countResult.count),
  });
}

export async function countCustomStudyCards(
  input: unknown,
): Promise<Result<{ cardCount: number; deckCount: number }>> {
  const session = await requireSession();
  const parsed = CustomStudySchema.safeParse(input);
  if (!parsed.success) return err("Validation failed");

  const { tagNames } = parsed.data;

  await ensureLibraryForTags(session.user.id, tagNames);

  const nowIso = new Date().toISOString();

  const myDeckIds = db
    .select({ id: userDecks.id })
    .from(userDecks)
    .where(and(eq(userDecks.userId, session.user.id), isNull(userDecks.archivedAt)));

  const taggedCardFilter = sql`${cardDefinitions.id} IN (
    SELECT cd.id FROM card_definitions cd
    JOIN card_tags ct ON ct.card_definition_id = cd.id
    JOIN tags t ON ct.tag_id = t.id
    WHERE t.name IN (${sql.join(
      tagNames.map((n) => sql`${n}`),
      sql`, `,
    )})
    UNION
    SELECT cd.id FROM card_definitions cd
    JOIN card_tags ct ON ct.card_definition_id = cd.parent_card_id
    JOIN tags t ON ct.tag_id = t.id
    WHERE cd.parent_card_id IS NOT NULL
      AND t.name IN (${sql.join(
        tagNames.map((n) => sql`${n}`),
        sql`, `,
      )})
  )`;

  const rows = await db
    .select({
      cardCount: sql<number>`count(DISTINCT ${userCardStates.id})::int`,
      deckCount: sql<number>`count(DISTINCT ${userCardStates.userDeckId})::int`,
    })
    .from(userCardStates)
    .innerJoin(cardDefinitions, eq(userCardStates.cardDefinitionId, cardDefinitions.id))
    .where(
      and(
        sql`${userCardStates.userDeckId} IN (${myDeckIds})`,
        sql`(${userCardStates.dueAt} IS NULL OR ${userCardStates.dueAt} <= ${nowIso})`,
        isNull(cardDefinitions.archivedAt),
        taggedCardFilter,
      ),
    );

  return ok({
    cardCount: rows[0]?.cardCount ?? 0,
    deckCount: rows[0]?.deckCount ?? 0,
  });
}
