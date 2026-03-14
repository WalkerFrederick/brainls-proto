"use server";

import { eq, and, isNull, sql, asc } from "drizzle-orm";
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
import { SubmitReviewSchema } from "@/lib/schemas";
import { canUseDeck } from "@/lib/permissions";
import { processReview, getDefaultCardState, type Rating, type CardState } from "@/lib/srs";
import { isValidUuid } from "@/lib/validate-uuid";

export async function addDeckToLibrary(deckDefinitionId: string): Promise<Result<{ id: string }>> {
  if (!isValidUuid(deckDefinitionId)) return err("Invalid deck ID");
  const session = await requireSession();

  const canUse = await canUseDeck(deckDefinitionId, session.user.id);
  if (!canUse) return err("Permission denied");

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

  const cards = await db
    .select({ id: cardDefinitions.id })
    .from(cardDefinitions)
    .where(
      and(
        eq(cardDefinitions.deckDefinitionId, deckDefinitionId),
        isNull(cardDefinitions.archivedAt),
        eq(cardDefinitions.status, "active"),
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

  const { userCardStateId, rating, responseMs, idempotencyKey } = parsed.data;

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

  await db
    .update(userDecks)
    .set({ lastStudiedAt: new Date(), updatedAt: new Date() })
    .where(eq(userDecks.id, cardState.userDeckId));

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
  const existingCardIds = db
    .select({ cardDefinitionId: userCardStates.cardDefinitionId })
    .from(userCardStates)
    .where(eq(userCardStates.userDeckId, userDeckId));

  const newCards = await db
    .select({ id: cardDefinitions.id })
    .from(cardDefinitions)
    .where(
      and(
        eq(cardDefinitions.deckDefinitionId, deckDefinitionId),
        isNull(cardDefinitions.archivedAt),
        eq(cardDefinitions.status, "active"),
        sql`${cardDefinitions.id} NOT IN (${existingCardIds})`,
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
