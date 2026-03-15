import { eq } from "drizzle-orm";
import { db } from "@/db";
import { deckDefinitions } from "@/db/schema";

export type ResolvedDeck = {
  sourceDeckId: string;
  isLinked: boolean;
  isAbandoned: boolean;
};

/**
 * Resolves a deck to its card source. If the deck is a linked copy,
 * returns the original deck's ID and checks whether that source is archived.
 */
export async function resolveSourceDeck(deckId: string): Promise<ResolvedDeck> {
  const [deck] = await db
    .select({
      linkedDeckDefinitionId: deckDefinitions.linkedDeckDefinitionId,
    })
    .from(deckDefinitions)
    .where(eq(deckDefinitions.id, deckId));

  if (!deck?.linkedDeckDefinitionId) {
    return { sourceDeckId: deckId, isLinked: false, isAbandoned: false };
  }

  const [source] = await db
    .select({ archivedAt: deckDefinitions.archivedAt })
    .from(deckDefinitions)
    .where(eq(deckDefinitions.id, deck.linkedDeckDefinitionId));

  return {
    sourceDeckId: deck.linkedDeckDefinitionId,
    isLinked: true,
    isAbandoned: source?.archivedAt !== null && source?.archivedAt !== undefined,
  };
}
