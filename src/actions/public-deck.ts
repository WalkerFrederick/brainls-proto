"use server";

import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import { deckDefinitions, cardDefinitions, deckTags, tags } from "@/db/schema";
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

export async function listPublicDecks(opts?: { tag?: string }): Promise<
  Result<
    Array<{
      id: string;
      title: string;
      description: string | null;
      cardCount: number;
      createdByName: string;
      createdByUserId: string;
      createdAt: Date;
      tags: string[];
    }>
  >
> {
  const tagFilter = opts?.tag?.trim().toLowerCase();

  let deckRows;

  if (tagFilter) {
    deckRows = await db
      .select({
        id: deckDefinitions.id,
        title: deckDefinitions.title,
        description: deckDefinitions.description,
        createdByName: users.name,
        createdByUserId: deckDefinitions.createdByUserId,
        createdAt: deckDefinitions.createdAt,
      })
      .from(deckDefinitions)
      .innerJoin(users, eq(deckDefinitions.createdByUserId, users.id))
      .innerJoin(deckTags, eq(deckTags.deckDefinitionId, deckDefinitions.id))
      .innerJoin(tags, eq(deckTags.tagId, tags.id))
      .where(
        and(
          eq(deckDefinitions.viewPolicy, "public"),
          isNull(deckDefinitions.archivedAt),
          eq(tags.name, tagFilter),
        ),
      )
      .orderBy(desc(deckDefinitions.createdAt));
  } else {
    deckRows = await db
      .select({
        id: deckDefinitions.id,
        title: deckDefinitions.title,
        description: deckDefinitions.description,
        createdByName: users.name,
        createdByUserId: deckDefinitions.createdByUserId,
        createdAt: deckDefinitions.createdAt,
      })
      .from(deckDefinitions)
      .innerJoin(users, eq(deckDefinitions.createdByUserId, users.id))
      .where(and(eq(deckDefinitions.viewPolicy, "public"), isNull(deckDefinitions.archivedAt)))
      .orderBy(desc(deckDefinitions.createdAt));
  }

  const allDeckIds = deckRows.map((d) => d.id);
  const deckTagMap = new Map<string, string[]>();

  if (allDeckIds.length > 0) {
    const tagRows = await db
      .select({
        deckDefinitionId: deckTags.deckDefinitionId,
        tagName: tags.name,
      })
      .from(deckTags)
      .innerJoin(tags, eq(deckTags.tagId, tags.id))
      .where(
        sql`${deckTags.deckDefinitionId} IN (${sql.join(
          allDeckIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );

    for (const row of tagRows) {
      const existing = deckTagMap.get(row.deckDefinitionId) ?? [];
      existing.push(row.tagName);
      deckTagMap.set(row.deckDefinitionId, existing);
    }
  }

  const result = await Promise.all(
    deckRows.map(async (deck) => {
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
        createdByUserId: deck.createdByUserId,
        createdAt: deck.createdAt,
        tags: (deckTagMap.get(deck.id) ?? []).sort(),
      };
    }),
  );

  return ok(result);
}
