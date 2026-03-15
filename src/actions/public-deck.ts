"use server";

import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { deckDefinitions, cardDefinitions } from "@/db/schema";
import { ok, err, type Result } from "@/lib/result";
import { isValidUuid } from "@/lib/validate-uuid";

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

  const rows = await db
    .select()
    .from(cardDefinitions)
    .where(
      and(
        eq(cardDefinitions.deckDefinitionId, deckId),
        isNull(cardDefinitions.archivedAt),
        isNull(cardDefinitions.parentCardId),
      ),
    );

  return ok(rows);
}
