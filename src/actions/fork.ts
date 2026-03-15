"use server";

import { eq, and, isNull, inArray } from "drizzle-orm";
import { db } from "@/db";
import { deckDefinitions, cardDefinitions, userDecks, userCardStates } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";
import { canViewDeck, requireWorkspaceRole } from "@/lib/permissions";
import { isValidUuid } from "@/lib/validate-uuid";
import { resolveSourceDeck } from "@/lib/deck-resolver";

export async function forkDeck(
  sourceDeckId: string,
  targetWorkspaceId: string,
): Promise<Result<{ id: string }>> {
  if (!isValidUuid(sourceDeckId)) return err("Invalid source deck ID");
  if (!isValidUuid(targetWorkspaceId)) return err("Invalid target workspace ID");
  const session = await requireSession();

  const canView = await canViewDeck(sourceDeckId, session.user.id);
  if (!canView) return err("Not allowed to fork this deck");

  const perm = await requireWorkspaceRole(targetWorkspaceId, session.user.id, "editor");
  if (!perm.allowed) return err(perm.error);

  const [sourceDeck] = await db
    .select()
    .from(deckDefinitions)
    .where(eq(deckDefinitions.id, sourceDeckId));

  if (!sourceDeck) return err("Source deck not found");

  const { sourceDeckId: cardSourceId } = await resolveSourceDeck(sourceDeckId);

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
        eq(cardDefinitions.deckDefinitionId, cardSourceId),
        isNull(cardDefinitions.archivedAt),
        eq(cardDefinitions.status, "active"),
      ),
    );

  const clozeParents = sourceCards.filter((c) => c.cardType === "cloze" && !c.parentCardId);
  const clozeChildren = sourceCards.filter((c) => c.cardType === "cloze" && c.parentCardId);
  const regularCards = sourceCards.filter((c) => c.cardType !== "cloze");

  const sourceToForkCardId = new Map<string, string>();

  if (regularCards.length > 0) {
    const inserted = await db
      .insert(cardDefinitions)
      .values(
        regularCards.map((card) => ({
          deckDefinitionId: forkedDeck.id,
          cardType: card.cardType,
          contentJson: card.contentJson,
          createdByUserId: session.user.id,
          updatedByUserId: session.user.id,
        })),
      )
      .returning({ id: cardDefinitions.id });
    regularCards.forEach((card, i) => {
      sourceToForkCardId.set(card.id, inserted[i].id);
    });
  }

  for (const parent of clozeParents) {
    const [newParent] = await db
      .insert(cardDefinitions)
      .values({
        deckDefinitionId: forkedDeck.id,
        cardType: "cloze",
        contentJson: parent.contentJson,
        createdByUserId: session.user.id,
        updatedByUserId: session.user.id,
      })
      .returning({ id: cardDefinitions.id });

    sourceToForkCardId.set(parent.id, newParent.id);

    const children = clozeChildren.filter((c) => c.parentCardId === parent.id);
    if (children.length > 0) {
      const inserted = await db
        .insert(cardDefinitions)
        .values(
          children.map((child) => ({
            deckDefinitionId: forkedDeck.id,
            cardType: "cloze",
            contentJson: child.contentJson,
            parentCardId: newParent.id,
            createdByUserId: session.user.id,
            updatedByUserId: session.user.id,
          })),
        )
        .returning({ id: cardDefinitions.id });
      children.forEach((child, i) => {
        sourceToForkCardId.set(child.id, inserted[i].id);
      });
    }
  }

  await migrateUserCardStatesToFork(
    session.user.id,
    cardSourceId,
    forkedDeck.id,
    sourceToForkCardId,
  );

  return ok({ id: forkedDeck.id });
}

async function migrateUserCardStatesToFork(
  userId: string,
  cardSourceDeckId: string,
  forkedDeckId: string,
  sourceToForkCardId: Map<string, string>,
): Promise<void> {
  const linkedDecks = await db
    .select({ id: deckDefinitions.id })
    .from(deckDefinitions)
    .where(
      and(
        eq(deckDefinitions.linkedDeckDefinitionId, cardSourceDeckId),
        isNull(deckDefinitions.archivedAt),
      ),
    );
  const linkedDeckIds = linkedDecks.map((d) => d.id);
  const candidateDeckIds = [cardSourceDeckId, ...linkedDeckIds];

  const existingUserDecks = await db
    .select({ id: userDecks.id })
    .from(userDecks)
    .where(
      and(
        eq(userDecks.userId, userId),
        isNull(userDecks.archivedAt),
        inArray(userDecks.deckDefinitionId, candidateDeckIds),
      ),
    );

  if (existingUserDecks.length === 0) return;

  const allStates = await db
    .select()
    .from(userCardStates)
    .where(
      inArray(
        userCardStates.userDeckId,
        existingUserDecks.map((d) => d.id),
      ),
    );

  const statesToMigrate = allStates.filter((s) => sourceToForkCardId.has(s.cardDefinitionId));
  if (statesToMigrate.length === 0) return;

  const [newUserDeck] = await db
    .insert(userDecks)
    .values({
      userId,
      deckDefinitionId: forkedDeckId,
    })
    .returning({ id: userDecks.id });

  await db.insert(userCardStates).values(
    statesToMigrate.map((state) => {
      const newCardId = sourceToForkCardId.get(state.cardDefinitionId)!;
      return {
        userDeckId: newUserDeck.id,
        cardDefinitionId: newCardId,
        srsState: state.srsState,
        dueAt: state.dueAt,
        intervalDays: state.intervalDays,
        easeFactor: state.easeFactor,
        reps: state.reps,
        lapses: state.lapses,
        lastReviewedAt: state.lastReviewedAt,
        srsVersionAtLastReview: state.srsVersionAtLastReview,
      };
    }),
  );
}
