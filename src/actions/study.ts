"use server";

import { eq, and, isNull, sql, asc, or, ne, isNotNull, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  userDecks,
  userCardStates,
  reviewLogs,
  cardDefinitions,
  deckDefinitions,
  folderMembers,
  folders,
  deckTags,
  tags,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";
import { SubmitReviewSchema, CustomStudySchema } from "@/lib/schemas";
import { canViewDeck } from "@/lib/permissions";
import {
  processReview,
  getDefaultCardState,
  nextInterval,
  DEFAULT_PARAMETERS,
  type Rating,
  type CardState,
} from "@/lib/srs";
import { isValidUuid } from "@/lib/validate-uuid";
import { resolveSourceDeck } from "@/lib/deck-resolver";

export async function addDeckToLibrary(deckDefinitionId: string): Promise<Result<{ id: string }>> {
  if (!isValidUuid(deckDefinitionId)) return err("Invalid deck ID");
  const session = await requireSession();

  const canView = await canViewDeck(deckDefinitionId, session.user.id);
  if (!canView) return err("Permission denied");

  const { sourceDeckId } = await resolveSourceDeck(deckDefinitionId);

  const existing = await db
    .select()
    .from(userDecks)
    .where(
      and(eq(userDecks.userId, session.user.id), eq(userDecks.deckDefinitionId, sourceDeckId)),
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
      deckDefinitionId: sourceDeckId,
    })
    .returning({ id: userDecks.id });

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
        stability: String(defaultState.stability),
        difficulty: String(defaultState.difficulty),
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
      stability: string | null;
      difficulty: string | null;
      reps: number | null;
      lapses: number | null;
      learningStep: number | null;
    }>;
    totalDue: number;
  }>
> {
  if (!isValidUuid(userDeckId)) return err("Invalid user deck ID");
  const session = await requireSession();

  const [userDeck] = await db
    .select()
    .from(userDecks)
    .where(
      and(
        eq(userDecks.id, userDeckId),
        eq(userDecks.userId, session.user.id),
        isNull(userDecks.archivedAt),
      ),
    );

  if (!userDeck) return err("User deck not found");

  const [deck] = await db
    .select()
    .from(deckDefinitions)
    .where(eq(deckDefinitions.id, userDeck.deckDefinitionId));

  if (!deck) return err("Deck definition not found");

  await syncNewCards(userDeckId, userDeck.deckDefinitionId);

  const limit = opts?.limit ?? 20;
  const effectiveNow = new Date();
  const nowIso = effectiveNow.toISOString();

  const cardFields = {
    userCardStateId: userCardStates.id,
    cardDefinitionId: userCardStates.cardDefinitionId,
    cardType: cardDefinitions.cardType,
    contentJson: cardDefinitions.contentJson,
    srsState: userCardStates.srsState,
    intervalDays: userCardStates.intervalDays,
    stability: userCardStates.stability,
    difficulty: userCardStates.difficulty,
    reps: userCardStates.reps,
    lapses: userCardStates.lapses,
    learningStep: userCardStates.learningStep,
  };

  const dueCards = await db
    .select(cardFields)
    .from(userCardStates)
    .innerJoin(cardDefinitions, eq(userCardStates.cardDefinitionId, cardDefinitions.id))
    .where(
      and(
        eq(userCardStates.userDeckId, userDeckId),
        sql`${userCardStates.dueAt} <= ${nowIso}`,
        isNull(cardDefinitions.archivedAt),
      ),
    )
    .orderBy(asc(userCardStates.dueAt))
    .limit(limit);

  const startOfToday = new Date(effectiveNow);
  startOfToday.setHours(0, 0, 0, 0);

  const [newStudiedTodayResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviewLogs)
    .where(
      and(
        eq(reviewLogs.userDeckId, userDeckId),
        sql`${reviewLogs.reviewedAt} >= ${startOfToday.toISOString()}`,
        eq(reviewLogs.srsStateBefore, "new"),
      ),
    );

  const newCardsStudiedToday = newStudiedTodayResult?.count ?? 0;
  const newCardBudget = Math.max(0, userDeck.newCardsPerDay - newCardsStudiedToday);

  let newCards: typeof dueCards = [];
  if (newCardBudget > 0) {
    newCards = await db
      .select(cardFields)
      .from(userCardStates)
      .innerJoin(cardDefinitions, eq(userCardStates.cardDefinitionId, cardDefinitions.id))
      .where(
        and(
          eq(userCardStates.userDeckId, userDeckId),
          eq(userCardStates.srsState, "new"),
          isNull(userCardStates.dueAt),
          isNull(cardDefinitions.archivedAt),
        ),
      )
      .orderBy(asc(userCardStates.createdAt))
      .limit(newCardBudget);
  }

  const allCards = [...dueCards, ...newCards];

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userCardStates)
    .innerJoin(cardDefinitions, eq(userCardStates.cardDefinitionId, cardDefinitions.id))
    .where(
      and(
        eq(userCardStates.userDeckId, userDeckId),
        sql`(${userCardStates.dueAt} IS NULL OR ${userCardStates.dueAt} <= ${nowIso})`,
        isNull(cardDefinitions.archivedAt),
      ),
    );

  return ok({
    userDeckId,
    deckTitle: deck.title,
    cards: allCards,
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
    stability: Number(cardState.stability) || 0,
    difficulty: Number(cardState.difficulty) || 0,
    reps: cardState.reps ?? 0,
    lapses: cardState.lapses ?? 0,
    learningStep: cardState.learningStep ?? 0,
    lastReview: cardState.lastReviewedAt ?? undefined,
  };

  const effectiveNow = new Date();
  const result = processReview(currentState, rating as Rating, DEFAULT_PARAMETERS, effectiveNow);

  if (!skipSrsUpdate) {
    await db
      .update(userCardStates)
      .set({
        srsState: result.nextState.srsState,
        dueAt: result.nextDueAt,
        intervalDays: nextInterval(result.nextState.stability, DEFAULT_PARAMETERS.desiredRetention),
        stability: String(result.nextState.stability),
        difficulty: String(result.nextState.difficulty),
        reps: result.nextState.reps,
        lapses: result.nextState.lapses,
        learningStep: result.nextState.learningStep,
        lastReviewedAt: effectiveNow,
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
    reviewedAt: effectiveNow,
    srsStateBefore: currentState.srsState,
    srsStateAfter: result.nextState.srsState,
    intervalDaysBefore: cardState.intervalDays,
    intervalDaysAfter: nextInterval(
      result.nextState.stability,
      DEFAULT_PARAMETERS.desiredRetention,
    ),
    stabilityBefore: String(currentState.stability),
    stabilityAfter: String(result.nextState.stability),
    difficultyBefore: String(currentState.difficulty),
    difficultyAfter: String(result.nextState.difficulty),
    srsVersionUsed: userDeck.srsConfigVersion,
  });

  if (!skipSrsUpdate) {
    await db
      .update(userDecks)
      .set({ lastStudiedAt: effectiveNow, updatedAt: new Date() })
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
    .where(
      and(
        eq(userDecks.userId, session.user.id),
        isNull(userDecks.archivedAt),
        isNull(deckDefinitions.archivedAt),
      ),
    );

  const result = await Promise.all(
    decks.map(async (deck) => {
      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(userCardStates)
        .innerJoin(cardDefinitions, eq(userCardStates.cardDefinitionId, cardDefinitions.id))
        .where(and(eq(userCardStates.userDeckId, deck.id), isNull(cardDefinitions.archivedAt)));

      const [dueResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(userCardStates)
        .innerJoin(cardDefinitions, eq(userCardStates.cardDefinitionId, cardDefinitions.id))
        .where(
          and(
            eq(userCardStates.userDeckId, deck.id),
            sql`(${userCardStates.dueAt} IS NULL OR ${userCardStates.dueAt} <= ${nowIso})`,
            isNull(cardDefinitions.archivedAt),
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

export type LibraryDeck = {
  deckDefinitionId: string;
  title: string;
  description: string | null;
  viewPolicy: string;
  linkedDeckDefinitionId: string | null;
  copiedFromDeckDefinitionId: string | null;
  isAbandoned: boolean;
  tags: string[];
  folders: Array<{ id: string; name: string; role: string }>;
  userDeckId: string | null;
  totalCards: number;
  dueCards: number;
  newCount: number;
  learningCount: number;
  reviewDueCount: number;
  lastStudiedAt: Date | null;
};

export async function listLibraryDecks(): Promise<Result<LibraryDeck[]>> {
  const session = await requireSession();
  const nowIso = new Date().toISOString();

  const memberRows = await db
    .select({
      folderId: folderMembers.folderId,
      folderName: folders.name,
      role: folderMembers.role,
    })
    .from(folderMembers)
    .innerJoin(folders, eq(folderMembers.folderId, folders.id))
    .where(and(eq(folderMembers.userId, session.user.id), eq(folderMembers.status, "active")));

  if (memberRows.length === 0) return ok([]);

  const fMap = new Map(memberRows.map((r) => [r.folderId, r]));
  const fIds = [...fMap.keys()];

  const allDecks = await db
    .select({
      id: deckDefinitions.id,
      title: deckDefinitions.title,
      description: deckDefinitions.description,
      viewPolicy: deckDefinitions.viewPolicy,
      linkedDeckDefinitionId: deckDefinitions.linkedDeckDefinitionId,
      copiedFromDeckDefinitionId: deckDefinitions.copiedFromDeckDefinitionId,
      folderId: deckDefinitions.folderId,
    })
    .from(deckDefinitions)
    .where(and(inArray(deckDefinitions.folderId, fIds), isNull(deckDefinitions.archivedAt)));

  // Deduplicate: linked decks group under their source deck ID
  const grouped = new Map<
    string,
    {
      sourceDeckId: string;
      title: string;
      description: string | null;
      viewPolicy: string;
      linkedDeckDefinitionId: string | null;
      copiedFromDeckDefinitionId: string | null;
      folderIds: Set<string>;
      representativeDeckId: string;
    }
  >();

  for (const deck of allDecks) {
    const key = deck.linkedDeckDefinitionId ?? deck.id;

    const existing = grouped.get(key);
    if (existing) {
      existing.folderIds.add(deck.folderId);
    } else {
      grouped.set(key, {
        sourceDeckId: key,
        title: deck.title,
        description: deck.description,
        viewPolicy: deck.viewPolicy,
        linkedDeckDefinitionId: deck.linkedDeckDefinitionId,
        copiedFromDeckDefinitionId: deck.copiedFromDeckDefinitionId,
        folderIds: new Set([deck.folderId]),
        representativeDeckId: deck.id,
      });
    }
  }

  // Check abandoned status for linked decks
  const linkedSourceIds = [...grouped.values()]
    .filter((g) => g.linkedDeckDefinitionId)
    .map((g) => g.sourceDeckId);

  const abandonedSet = new Set<string>();
  if (linkedSourceIds.length > 0) {
    const sourceDecks = await db
      .select({ id: deckDefinitions.id, archivedAt: deckDefinitions.archivedAt })
      .from(deckDefinitions)
      .where(inArray(deckDefinitions.id, linkedSourceIds));
    for (const s of sourceDecks) {
      if (s.archivedAt) abandonedSet.add(s.id);
    }
  }

  // Fetch study stats: userDecks keyed by source deck ID
  const allUserDecks = await db
    .select({
      id: userDecks.id,
      deckDefinitionId: userDecks.deckDefinitionId,
      lastStudiedAt: userDecks.lastStudiedAt,
    })
    .from(userDecks)
    .where(and(eq(userDecks.userId, session.user.id), isNull(userDecks.archivedAt)));

  const userDeckMap = new Map(allUserDecks.map((ud) => [ud.deckDefinitionId, ud]));

  // Batch card counts by SRS state
  const userDeckIds = allUserDecks.map((ud) => ud.id);
  type DeckStats = {
    totalCards: number;
    newCount: number;
    learningCount: number;
    reviewDueCount: number;
    dueCards: number;
  };
  const statsMap = new Map<string, DeckStats>();

  if (userDeckIds.length > 0) {
    const isDueExpr = sql`(${userCardStates.dueAt} IS NULL OR ${userCardStates.dueAt} <= ${nowIso})`;

    const rows = await db
      .select({
        userDeckId: userCardStates.userDeckId,
        totalCards: sql<number>`count(*)::int`,
        newCount: sql<number>`count(*) filter (where ${userCardStates.srsState} = 'new')::int`,
        learningCount: sql<number>`count(*) filter (where ${userCardStates.srsState} in ('learning', 'relearning'))::int`,
        reviewDueCount: sql<number>`count(*) filter (where ${userCardStates.srsState} = 'review' and ${isDueExpr})::int`,
        dueCards: sql<number>`count(*) filter (where ${isDueExpr})::int`,
      })
      .from(userCardStates)
      .innerJoin(cardDefinitions, eq(userCardStates.cardDefinitionId, cardDefinitions.id))
      .where(
        and(inArray(userCardStates.userDeckId, userDeckIds), isNull(cardDefinitions.archivedAt)),
      )
      .groupBy(userCardStates.userDeckId);

    for (const r of rows) {
      statsMap.set(r.userDeckId, {
        totalCards: r.totalCards,
        newCount: r.newCount,
        learningCount: r.learningCount,
        reviewDueCount: r.reviewDueCount,
        dueCards: r.dueCards,
      });
    }
  }

  // Fetch tags in bulk
  const allDeckIds = allDecks.map((d) => d.id);
  const deckTagMap = new Map<string, string[]>();

  if (allDeckIds.length > 0) {
    const tagRows = await db
      .select({
        deckDefinitionId: deckTags.deckDefinitionId,
        tagName: tags.name,
      })
      .from(deckTags)
      .innerJoin(tags, eq(deckTags.tagId, tags.id))
      .where(inArray(deckTags.deckDefinitionId, allDeckIds));

    for (const row of tagRows) {
      const existing = deckTagMap.get(row.deckDefinitionId) ?? [];
      existing.push(row.tagName);
      deckTagMap.set(row.deckDefinitionId, existing);
    }
  }

  const libraryDecks: LibraryDeck[] = [];

  for (const group of grouped.values()) {
    const ud = userDeckMap.get(group.sourceDeckId);
    const deckFolders = [...group.folderIds]
      .map((fId) => fMap.get(fId))
      .filter(Boolean)
      .map((f) => ({ id: f!.folderId, name: f!.folderName, role: f!.role }));

    const tagSet = new Set<string>();
    for (const deck of allDecks) {
      const key = deck.linkedDeckDefinitionId ?? deck.id;
      if (key === group.sourceDeckId) {
        for (const t of deckTagMap.get(deck.id) ?? []) tagSet.add(t);
      }
    }

    libraryDecks.push({
      deckDefinitionId: group.representativeDeckId,
      title: group.title,
      description: group.description,
      viewPolicy: group.viewPolicy,
      linkedDeckDefinitionId: group.linkedDeckDefinitionId,
      copiedFromDeckDefinitionId: group.copiedFromDeckDefinitionId,
      isAbandoned: abandonedSet.has(group.sourceDeckId),
      tags: [...tagSet].sort(),
      folders: deckFolders,
      userDeckId: ud?.id ?? null,
      totalCards: ud ? (statsMap.get(ud.id)?.totalCards ?? 0) : 0,
      dueCards: ud ? (statsMap.get(ud.id)?.dueCards ?? 0) : 0,
      newCount: ud ? (statsMap.get(ud.id)?.newCount ?? 0) : 0,
      learningCount: ud ? (statsMap.get(ud.id)?.learningCount ?? 0) : 0,
      reviewDueCount: ud ? (statsMap.get(ud.id)?.reviewDueCount ?? 0) : 0,
      lastStudiedAt: ud?.lastStudiedAt ?? null,
    });
  }

  libraryDecks.sort((a, b) => {
    if (a.dueCards !== b.dueCards) return b.dueCards - a.dueCards;
    return a.title.localeCompare(b.title);
  });

  return ok(libraryDecks);
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

  const { sourceDeckId } = await resolveSourceDeck(deckDefinitionId);

  const [userDeck] = await db
    .select({ id: userDecks.id })
    .from(userDecks)
    .where(
      and(
        eq(userDecks.userId, session.user.id),
        eq(userDecks.deckDefinitionId, sourceDeckId),
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
    .innerJoin(cardDefinitions, eq(userCardStates.cardDefinitionId, cardDefinitions.id))
    .where(and(eq(userCardStates.userDeckId, userDeck.id), isNull(cardDefinitions.archivedAt)));

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
        if (row.isDue) dueCount++;
        break;
      case "review":
        totalStudied++;
        if (row.isDue) dueCount++;
        break;
    }
  }

  return ok({ inLibrary: true, newCount, learningCount, dueCount, totalStudied });
}

export type CardStudyState = {
  cardDefinitionId: string;
  parentCardId: string | null;
  srsState: string;
  dueAt: Date | null;
  contentJson: unknown;
};

export async function getCardStudyStates(
  deckDefinitionId: string,
): Promise<Result<CardStudyState[]>> {
  if (!isValidUuid(deckDefinitionId)) return err("Invalid deck ID");
  const session = await requireSession();

  const { sourceDeckId } = await resolveSourceDeck(deckDefinitionId);

  const [userDeck] = await db
    .select({ id: userDecks.id })
    .from(userDecks)
    .where(
      and(
        eq(userDecks.userId, session.user.id),
        eq(userDecks.deckDefinitionId, sourceDeckId),
        isNull(userDecks.archivedAt),
      ),
    );

  if (!userDeck) return ok([]);

  const rows = await db
    .select({
      cardDefinitionId: userCardStates.cardDefinitionId,
      parentCardId: cardDefinitions.parentCardId,
      srsState: userCardStates.srsState,
      dueAt: userCardStates.dueAt,
      contentJson: cardDefinitions.contentJson,
    })
    .from(userCardStates)
    .innerJoin(cardDefinitions, eq(userCardStates.cardDefinitionId, cardDefinitions.id))
    .where(and(eq(userCardStates.userDeckId, userDeck.id), isNull(cardDefinitions.archivedAt)));

  return ok(rows);
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
      stability: String(defaultState.stability),
      difficulty: String(defaultState.difficulty),
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
      date: sql<string>`to_char((${reviewLogs.reviewedAt} AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviewLogs)
    .where(
      and(
        sql`${reviewLogs.userDeckId} IN (${myDeckIds})`,
        sql`${reviewLogs.reviewedAt} >= ${startOfYear.toISOString()}`,
      ),
    )
    .groupBy(sql`(${reviewLogs.reviewedAt} AT TIME ZONE 'UTC')::date`)
    .orderBy(sql`(${reviewLogs.reviewedAt} AT TIME ZONE 'UTC')::date`);

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
    UNION
    SELECT cd.id FROM card_definitions cd
    JOIN deck_tags dt ON dt.deck_definition_id = cd.deck_definition_id
    JOIN tags t ON dt.tag_id = t.id
    WHERE t.name IN (${tagNameParams})
  )`;

  // Find distinct deck IDs the user can access that have matching tagged cards
  type DeckRow = { deckId: string; linkedDeckDefinitionId: string | null };

  const accessibleResult = await db.execute<DeckRow>(sql`
    SELECT DISTINCT dd.id as "deckId", dd.linked_deck_definition_id as "linkedDeckDefinitionId"
    FROM deck_definitions dd
    JOIN folder_members fm ON fm.folder_id = dd.folder_id
      AND fm.user_id = ${userId} AND fm.status = 'active'
    JOIN card_definitions cd ON cd.deck_definition_id = dd.id
    WHERE dd.archived_at IS NULL
      AND cd.id IN ${taggedCardFilter}
  `);

  const linkedResult = await db.execute<DeckRow>(sql`
    SELECT DISTINCT dd.id as "deckId", dd.linked_deck_definition_id as "linkedDeckDefinitionId"
    FROM deck_definitions dd
    JOIN folder_members fm ON fm.folder_id = dd.folder_id
      AND fm.user_id = ${userId} AND fm.status = 'active'
    JOIN card_definitions cd ON cd.deck_definition_id = dd.linked_deck_definition_id
    WHERE dd.archived_at IS NULL
      AND dd.linked_deck_definition_id IS NOT NULL
      AND cd.id IN ${taggedCardFilter}
  `);

  const allDecks = [...accessibleResult, ...linkedResult] as DeckRow[];
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
          stability: String(defaultState.stability),
          difficulty: String(defaultState.difficulty),
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
      stability: string | null;
      difficulty: string | null;
      reps: number | null;
      lapses: number | null;
      learningStep: number | null;
    }>;
    totalDue: number;
  }>
> {
  const session = await requireSession();
  const parsed = CustomStudySchema.safeParse(input);
  if (!parsed.success) return err("Validation failed");

  const { tagNames } = parsed.data;

  try {
    await ensureLibraryForTags(session.user.id, tagNames);
  } catch {
    // Non-fatal: session still works even if library sync fails
  }

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
    UNION
    SELECT cd.id FROM card_definitions cd
    JOIN deck_tags dt ON dt.deck_definition_id = cd.deck_definition_id
    JOIN tags t ON dt.tag_id = t.id
    WHERE t.name IN (${sql.join(
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
      stability: userCardStates.stability,
      difficulty: userCardStates.difficulty,
      reps: userCardStates.reps,
      lapses: userCardStates.lapses,
      learningStep: userCardStates.learningStep,
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

  try {
    await ensureLibraryForTags(session.user.id, tagNames);
  } catch {
    // Non-fatal: counting still works even if library sync fails
  }

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
    UNION
    SELECT cd.id FROM card_definitions cd
    JOIN deck_tags dt ON dt.deck_definition_id = cd.deck_definition_id
    JOIN tags t ON dt.tag_id = t.id
    WHERE t.name IN (${sql.join(
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

export async function advanceTime(
  userDeckId: string,
  minutes: number,
): Promise<Result<{ updated: number }>> {
  if (process.env.NODE_ENV === "production") return err("Not available in production");
  if (!isValidUuid(userDeckId)) return err("Invalid user deck ID");
  if (minutes <= 0 || minutes > 525600) return err("Minutes must be between 1 and 525600");
  const session = await requireSession();

  const [userDeck] = await db
    .select({ id: userDecks.id })
    .from(userDecks)
    .where(and(eq(userDecks.id, userDeckId), eq(userDecks.userId, session.user.id)));

  if (!userDeck) return err("Permission denied");

  const intervalStr = `${minutes} minutes`;
  await db
    .update(userCardStates)
    .set({
      dueAt: sql`${userCardStates.dueAt} - ${intervalStr}::interval`,
      lastReviewedAt: sql`${userCardStates.lastReviewedAt} - ${intervalStr}::interval`,
      updatedAt: new Date(),
    })
    .where(and(eq(userCardStates.userDeckId, userDeckId), isNotNull(userCardStates.dueAt)));

  return ok({ updated: 1 });
}

export async function getNewCardsPerDay(deckDefinitionId: string): Promise<Result<number>> {
  if (!isValidUuid(deckDefinitionId)) return err("Invalid deck ID");
  const session = await requireSession();

  const { sourceDeckId } = await resolveSourceDeck(deckDefinitionId);

  const [row] = await db
    .select({ newCardsPerDay: userDecks.newCardsPerDay })
    .from(userDecks)
    .where(
      and(
        eq(userDecks.userId, session.user.id),
        eq(userDecks.deckDefinitionId, sourceDeckId),
        isNull(userDecks.archivedAt),
      ),
    );

  return ok(row?.newCardsPerDay ?? 20);
}

export async function updateNewCardsPerDay(
  deckDefinitionId: string,
  value: number,
): Promise<Result<{ updated: boolean }>> {
  if (!isValidUuid(deckDefinitionId)) return err("Invalid deck ID");
  if (!Number.isInteger(value) || value < 0 || value > 9999) {
    return err("New cards per day must be an integer between 0 and 9999");
  }
  const session = await requireSession();

  const { sourceDeckId } = await resolveSourceDeck(deckDefinitionId);

  const [userDeck] = await db
    .select({ id: userDecks.id })
    .from(userDecks)
    .where(
      and(
        eq(userDecks.userId, session.user.id),
        eq(userDecks.deckDefinitionId, sourceDeckId),
        isNull(userDecks.archivedAt),
      ),
    );

  if (!userDeck) return err("Deck not in your library");

  await db
    .update(userDecks)
    .set({ newCardsPerDay: value, updatedAt: new Date() })
    .where(eq(userDecks.id, userDeck.id));

  return ok({ updated: true });
}
