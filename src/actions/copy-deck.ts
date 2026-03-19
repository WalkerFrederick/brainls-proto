"use server";

import { eq, and, isNull, inArray } from "drizzle-orm";
import { db } from "@/db";
import { deckDefinitions, cardDefinitions, userDecks, userCardStates } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";
import { canViewDeck, requireFolderRole } from "@/lib/permissions";
import { isValidUuid } from "@/lib/validate-uuid";
import { resolveSourceDeck } from "@/lib/deck-resolver";
import { getDefaultCardState } from "@brainls/fsrs";
import { safeAction } from "@/lib/errors";

export const copyDeck = safeAction(
  "copyDeck",
  async (
    sourceDeckId: string,
    targetFolderId: string,
    retainSrsData: boolean = false,
  ): Promise<Result<{ id: string }>> => {
    if (!isValidUuid(sourceDeckId)) return err("VALIDATION_FAILED", "Invalid source deck ID");
    if (!isValidUuid(targetFolderId)) return err("VALIDATION_FAILED", "Invalid target folder ID");
    const session = await requireSession();

    const canView = await canViewDeck(sourceDeckId, session.user.id);
    if (!canView) return err("PERMISSION_DENIED", "Not allowed to copy this deck");

    const perm = await requireFolderRole(targetFolderId, session.user.id, "editor");
    if (!perm.allowed) return err(perm.code, perm.error);

    const [sourceDeck] = await db
      .select()
      .from(deckDefinitions)
      .where(eq(deckDefinitions.id, sourceDeckId));

    if (!sourceDeck) return err("NOT_FOUND", "Source deck not found");

    const { sourceDeckId: cardSourceId } = await resolveSourceDeck(sourceDeckId);

    const [copiedDeck] = await db
      .insert(deckDefinitions)
      .values({
        folderId: targetFolderId,
        title: `${sourceDeck.title} (copy)`,
        slug: `${sourceDeck.slug}-copy-${Date.now()}`,
        description: sourceDeck.description,
        copiedFromDeckDefinitionId: sourceDeckId,
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

    const sourceToNewCardId = new Map<string, string>();

    if (regularCards.length > 0) {
      const inserted = await db
        .insert(cardDefinitions)
        .values(
          regularCards.map((card) => ({
            deckDefinitionId: copiedDeck.id,
            cardType: card.cardType,
            contentJson: card.contentJson,
            createdByUserId: session.user.id,
            updatedByUserId: session.user.id,
          })),
        )
        .returning({ id: cardDefinitions.id });
      regularCards.forEach((card, i) => {
        sourceToNewCardId.set(card.id, inserted[i].id);
      });
    }

    for (const parent of clozeParents) {
      const [newParent] = await db
        .insert(cardDefinitions)
        .values({
          deckDefinitionId: copiedDeck.id,
          cardType: "cloze",
          contentJson: parent.contentJson,
          createdByUserId: session.user.id,
          updatedByUserId: session.user.id,
        })
        .returning({ id: cardDefinitions.id });

      sourceToNewCardId.set(parent.id, newParent.id);

      const children = clozeChildren.filter((c) => c.parentCardId === parent.id);
      if (children.length > 0) {
        const inserted = await db
          .insert(cardDefinitions)
          .values(
            children.map((child) => ({
              deckDefinitionId: copiedDeck.id,
              cardType: "cloze",
              contentJson: child.contentJson,
              parentCardId: newParent.id,
              createdByUserId: session.user.id,
              updatedByUserId: session.user.id,
            })),
          )
          .returning({ id: cardDefinitions.id });
        children.forEach((child, i) => {
          sourceToNewCardId.set(child.id, inserted[i].id);
        });
      }
    }

    if (retainSrsData) {
      await migrateUserCardStates(session.user.id, cardSourceId, copiedDeck.id, sourceToNewCardId);
    } else {
      const [ud] = await db
        .insert(userDecks)
        .values({ userId: session.user.id, deckDefinitionId: copiedDeck.id })
        .returning({ id: userDecks.id });

      const studyableSourceCards = sourceCards.filter(
        (c) => c.cardType !== "cloze" || c.parentCardId !== null,
      );

      if (studyableSourceCards.length > 0) {
        const defaultState = getDefaultCardState();
        await db.insert(userCardStates).values(
          studyableSourceCards.map((c) => ({
            userDeckId: ud.id,
            cardDefinitionId: sourceToNewCardId.get(c.id)!,
            srsState: defaultState.srsState,
            stability: String(defaultState.stability),
            difficulty: String(defaultState.difficulty),
            reps: 0,
            lapses: 0,
          })),
        );
      }
    }

    return ok({ id: copiedDeck.id });
  },
);

async function migrateUserCardStates(
  userId: string,
  cardSourceDeckId: string,
  copiedDeckId: string,
  sourceToNewCardId: Map<string, string>,
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

  const statesToMigrate = allStates.filter((s) => sourceToNewCardId.has(s.cardDefinitionId));
  if (statesToMigrate.length === 0) return;

  const [newUserDeck] = await db
    .insert(userDecks)
    .values({
      userId,
      deckDefinitionId: copiedDeckId,
    })
    .returning({ id: userDecks.id });

  await db.insert(userCardStates).values(
    statesToMigrate.map((state) => {
      const newCardId = sourceToNewCardId.get(state.cardDefinitionId)!;
      return {
        userDeckId: newUserDeck.id,
        cardDefinitionId: newCardId,
        srsState: state.srsState,
        dueAt: state.dueAt,
        intervalDays: state.intervalDays,
        stability: state.stability,
        difficulty: state.difficulty,
        reps: state.reps,
        lapses: state.lapses,
        lastReviewedAt: state.lastReviewedAt,
        srsVersionAtLastReview: state.srsVersionAtLastReview,
      };
    }),
  );
}
