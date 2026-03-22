import { eq, and, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { cardDefinitions, deckDefinitions, userDecks, userCardStates } from "@/db/schema";
import { ok, err, type Result } from "@/lib/result";
import { validateCardContent, type CardType } from "@/lib/schemas/card-content";
import { cleanupRemovedAssets } from "@/lib/asset-cleanup";
import { getUniqueClozeIndices } from "@/lib/cloze";
import { getDefaultCardState } from "@brainls/fsrs";

export async function insertCard(params: {
  deckDefinitionId: string;
  cardType: string;
  contentJson: Record<string, unknown>;
  userId: string;
  createReverse?: boolean;
}): Promise<Result<{ id: string }>> {
  const { deckDefinitionId, cardType, contentJson, userId, createReverse } = params;

  const contentResult = validateCardContent(cardType as CardType, contentJson);
  if (!contentResult.success) return err("VALIDATION_FAILED", contentResult.error);

  const validatedContent = contentResult.data as Record<string, unknown>;

  if (cardType === "cloze") {
    const text = String(validatedContent.text ?? "");
    const indices = getUniqueClozeIndices(text);
    if (indices.length === 0) {
      return err(
        "VALIDATION_FAILED",
        "Cloze text must contain at least one cloze deletion (e.g. {{c1::answer}})",
      );
    }

    const [parent] = await db
      .insert(cardDefinitions)
      .values({
        deckDefinitionId,
        cardType: "cloze",
        contentJson: { text },
        createdByUserId: userId,
        updatedByUserId: userId,
      })
      .returning({ id: cardDefinitions.id });

    const children = await db
      .insert(cardDefinitions)
      .values(
        indices.map((clozeIndex) => ({
          deckDefinitionId,
          cardType: "cloze",
          contentJson: { text, clozeIndex },
          parentCardId: parent.id,
          createdByUserId: userId,
          updatedByUserId: userId,
        })),
      )
      .returning({ id: cardDefinitions.id });

    await createCardStatesForSubscribers(
      deckDefinitionId,
      children.map((c) => c.id),
    );

    return ok({ id: parent.id });
  }

  const [card] = await db
    .insert(cardDefinitions)
    .values({
      deckDefinitionId,
      cardType,
      contentJson: validatedContent,
      createdByUserId: userId,
      updatedByUserId: userId,
    })
    .returning({ id: cardDefinitions.id });

  const studyableIds = [card.id];

  if (createReverse && cardType === "front_back") {
    const reverseContent = { front: validatedContent.back, back: validatedContent.front };
    const [reverseCard] = await db
      .insert(cardDefinitions)
      .values({
        deckDefinitionId,
        cardType: "front_back",
        contentJson: reverseContent,
        createdByUserId: userId,
        updatedByUserId: userId,
      })
      .returning({ id: cardDefinitions.id });
    studyableIds.push(reverseCard.id);
  }

  await createCardStatesForSubscribers(deckDefinitionId, studyableIds);

  return ok({ id: card.id });
}

async function createCardStatesForSubscribers(deckDefinitionId: string, cardIds: string[]) {
  if (cardIds.length === 0) return;

  const linkedDeckIds = await db
    .select({ id: deckDefinitions.id })
    .from(deckDefinitions)
    .where(
      and(
        eq(deckDefinitions.linkedDeckDefinitionId, deckDefinitionId),
        isNull(deckDefinitions.archivedAt),
      ),
    );

  const allDeckDefIds = [deckDefinitionId, ...linkedDeckIds.map((d) => d.id)];

  const subscribedDecks = await db
    .select({ id: userDecks.id })
    .from(userDecks)
    .where(
      and(
        or(...allDeckDefIds.map((id) => eq(userDecks.deckDefinitionId, id))),
        isNull(userDecks.archivedAt),
      ),
    );

  if (subscribedDecks.length === 0) return;

  const defaultState = getDefaultCardState();
  const rows = subscribedDecks.flatMap((ud) =>
    cardIds.map((cardDefinitionId) => ({
      userDeckId: ud.id,
      cardDefinitionId,
      srsState: defaultState.srsState,
      stability: String(defaultState.stability),
      difficulty: String(defaultState.difficulty),
      reps: 0,
      lapses: 0,
    })),
  );

  await db.insert(userCardStates).values(rows);
}

export async function updateCardContent(params: {
  cardId: string;
  contentJson: Record<string, unknown>;
  userId: string;
}): Promise<Result<{ id: string }>> {
  const { cardId, contentJson, userId } = params;

  const [card] = await db.select().from(cardDefinitions).where(eq(cardDefinitions.id, cardId));
  if (!card) return err("NOT_FOUND", "Card not found");

  const contentResult = validateCardContent(card.cardType as CardType, contentJson);
  if (!contentResult.success) return err("VALIDATION_FAILED", contentResult.error);

  const validatedContent = contentResult.data as Record<string, unknown>;
  const oldContentJson = card.contentJson;

  if (card.cardType === "cloze" && !card.parentCardId) {
    const text = String(validatedContent.text ?? "");
    const newIndices = getUniqueClozeIndices(text);
    if (newIndices.length === 0) {
      return err(
        "VALIDATION_FAILED",
        "Cloze text must contain at least one cloze deletion (e.g. {{c1::answer}})",
      );
    }

    await db
      .update(cardDefinitions)
      .set({
        contentJson: { text },
        version: card.version + 1,
        updatedByUserId: userId,
        updatedAt: new Date(),
      })
      .where(eq(cardDefinitions.id, cardId));

    const existingChildren = await db
      .select({
        id: cardDefinitions.id,
        contentJson: cardDefinitions.contentJson,
      })
      .from(cardDefinitions)
      .where(and(eq(cardDefinitions.parentCardId, cardId), isNull(cardDefinitions.archivedAt)));

    const existingIndices = new Map<number, string>();
    for (const child of existingChildren) {
      const cj = child.contentJson as Record<string, unknown>;
      const idx = Number(cj.clozeIndex);
      if (idx) existingIndices.set(idx, child.id);
    }

    const newSet = new Set(newIndices);
    const existingSet = new Set(existingIndices.keys());

    const toAdd = newIndices.filter((i) => !existingSet.has(i));
    const toRemove = [...existingSet].filter((i) => !newSet.has(i));
    const toUpdate = newIndices.filter((i) => existingSet.has(i));

    for (const idx of toRemove) {
      const childId = existingIndices.get(idx)!;
      await db
        .update(cardDefinitions)
        .set({ archivedAt: new Date(), updatedAt: new Date(), updatedByUserId: userId })
        .where(eq(cardDefinitions.id, childId));
    }

    for (const idx of toUpdate) {
      const childId = existingIndices.get(idx)!;
      await db
        .update(cardDefinitions)
        .set({
          contentJson: { text, clozeIndex: idx },
          updatedAt: new Date(),
          updatedByUserId: userId,
        })
        .where(eq(cardDefinitions.id, childId));
    }

    if (toAdd.length > 0) {
      const added = await db
        .insert(cardDefinitions)
        .values(
          toAdd.map((clozeIndex) => ({
            deckDefinitionId: card.deckDefinitionId,
            cardType: "cloze",
            contentJson: { text, clozeIndex },
            parentCardId: cardId,
            createdByUserId: userId,
            updatedByUserId: userId,
          })),
        )
        .returning({ id: cardDefinitions.id });

      await createCardStatesForSubscribers(
        card.deckDefinitionId,
        added.map((c) => c.id),
      );
    }

    await cleanupRemovedAssets(oldContentJson, { text }, cardId);
    return ok({ id: cardId });
  }

  await db
    .update(cardDefinitions)
    .set({
      contentJson: validatedContent,
      version: card.version + 1,
      updatedByUserId: userId,
      updatedAt: new Date(),
    })
    .where(eq(cardDefinitions.id, cardId));

  await cleanupRemovedAssets(oldContentJson, validatedContent, cardId);

  return ok({ id: cardId });
}
