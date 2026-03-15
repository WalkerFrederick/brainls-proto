"use server";

import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import { deckDefinitions, cardDefinitions } from "@/db/schema";
import { users } from "@/db/schema";
import { ok, err, type Result } from "@/lib/result";
import { isValidUuid } from "@/lib/validate-uuid";
import { resolveSourceDeck } from "@/lib/deck-resolver";

const PUBLIC_VIEW_POLICIES = new Set(["public", "link"]);

export async function getPublicDeck(
  deckId: string,
): Promise<Result<typeof deckDefinitions.$inferSelect>> {
  if (!isValidUuid(deckId)) return err("Invalid deck ID");

  const [deck] = await db.select().from(deckDefinitions).where(eq(deckDefinitions.id, deckId));

  if (!deck) return err("Deck not found");
  if (!PUBLIC_VIEW_POLICIES.has(deck.viewPolicy)) {
    return err("This deck is not publicly viewable");
  }

  return ok(deck);
}

export async function listPublicCards(
  deckId: string,
): Promise<Result<Array<typeof cardDefinitions.$inferSelect>>> {
  if (!isValidUuid(deckId)) return err("Invalid deck ID");

  const [deck] = await db
    .select({ viewPolicy: deckDefinitions.viewPolicy })
    .from(deckDefinitions)
    .where(eq(deckDefinitions.id, deckId));

  if (!deck) return err("Deck not found");
  if (!PUBLIC_VIEW_POLICIES.has(deck.viewPolicy)) {
    return err("This deck is not publicly viewable");
  }

  const { sourceDeckId } = await resolveSourceDeck(deckId);

  const rows = await db
    .select()
    .from(cardDefinitions)
    .where(
      and(
        eq(cardDefinitions.deckDefinitionId, sourceDeckId),
        isNull(cardDefinitions.archivedAt),
        isNull(cardDefinitions.parentCardId),
      ),
    );

  return ok(rows);
}

export async function listPublicDecks(): Promise<
  Result<
    Array<{
      id: string;
      title: string;
      description: string | null;
      cardCount: number;
      createdByName: string;
      createdAt: Date;
    }>
  >
> {
  const decks = await db
    .select({
      id: deckDefinitions.id,
      title: deckDefinitions.title,
      description: deckDefinitions.description,
      createdByName: users.name,
      createdAt: deckDefinitions.createdAt,
    })
    .from(deckDefinitions)
    .innerJoin(users, eq(deckDefinitions.createdByUserId, users.id))
    .where(and(eq(deckDefinitions.viewPolicy, "public"), isNull(deckDefinitions.archivedAt)))
    .orderBy(desc(deckDefinitions.createdAt));

  const result = await Promise.all(
    decks.map(async (deck) => {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(cardDefinitions)
        .where(
          and(
            eq(cardDefinitions.deckDefinitionId, deck.id),
            isNull(cardDefinitions.archivedAt),
            isNull(cardDefinitions.parentCardId),
          ),
        );

      return {
        id: deck.id,
        title: deck.title,
        description: deck.description,
        cardCount: Number(countResult.count),
        createdByName: deck.createdByName ?? "Unknown",
        createdAt: deck.createdAt,
      };
    }),
  );

  return ok(result);
}
