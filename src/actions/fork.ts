"use server";

import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { deckDefinitions, cardDefinitions } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";
import { canForkDeck, requireWorkspaceRole } from "@/lib/permissions";

export async function forkDeck(
  sourceDeckId: string,
  targetWorkspaceId: string,
): Promise<Result<{ id: string }>> {
  const session = await requireSession();

  const canFork = await canForkDeck(sourceDeckId, session.user.id);
  if (!canFork) return err("Not allowed to fork this deck");

  const perm = await requireWorkspaceRole(targetWorkspaceId, session.user.id, "editor");
  if (!perm.allowed) return err(perm.error);

  const [sourceDeck] = await db
    .select()
    .from(deckDefinitions)
    .where(eq(deckDefinitions.id, sourceDeckId));

  if (!sourceDeck) return err("Source deck not found");

  const [forkedDeck] = await db
    .insert(deckDefinitions)
    .values({
      workspaceId: targetWorkspaceId,
      title: `${sourceDeck.title} (fork)`,
      slug: `${sourceDeck.slug}-fork-${Date.now()}`,
      description: sourceDeck.description,
      forkedFromDeckDefinitionId: sourceDeckId,
      createdByUserId: session.user.id,
      updatedByUserId: session.user.id,
    })
    .returning({ id: deckDefinitions.id });

  const sourceCards = await db
    .select()
    .from(cardDefinitions)
    .where(
      and(
        eq(cardDefinitions.deckDefinitionId, sourceDeckId),
        isNull(cardDefinitions.archivedAt),
        eq(cardDefinitions.status, "active"),
      ),
    );

  if (sourceCards.length > 0) {
    await db.insert(cardDefinitions).values(
      sourceCards.map((card) => ({
        deckDefinitionId: forkedDeck.id,
        cardType: card.cardType,
        contentJson: card.contentJson,
        parentCardId: card.id,
        parentVersionAtGeneration: card.version,
        createdByUserId: session.user.id,
        updatedByUserId: session.user.id,
      })),
    );
  }

  return ok({ id: forkedDeck.id });
}
