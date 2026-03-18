import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, deckDefinitions, cardDefinitions, userDecks, userCardStates } from "@/db/schema";

export async function createDefaultDeck(folderId: string, userId: string): Promise<string> {
  const [deck] = await db
    .insert(deckDefinitions)
    .values({
      folderId,
      title: "Default Deck",
      slug: `default-deck-${userId}`,
      description: "Your default deck — experiment with different card types here.",
      viewPolicy: "private",
      createdByUserId: userId,
      updatedByUserId: userId,
    })
    .returning();

  const frontBackCard = await db
    .insert(cardDefinitions)
    .values({
      deckDefinitionId: deck.id,
      cardType: "front_back",
      contentJson: {
        front: "What is **spaced repetition**?",
        back: "A study technique where you review material at increasing intervals. Cards you know well appear less often; cards you struggle with come back sooner.",
      },
      createdByUserId: userId,
      updatedByUserId: userId,
    })
    .returning({ id: cardDefinitions.id });

  const mcqCard = await db
    .insert(cardDefinitions)
    .values({
      deckDefinitionId: deck.id,
      cardType: "multiple_choice",
      contentJson: {
        question: "Which of these is a benefit of spaced repetition?",
        choices: [
          "It lets you cram everything the night before",
          "It reduces total study time while improving retention",
          "It only works for language learning",
          "It requires reviewing every card every day",
        ],
        correctChoiceIndexes: [1],
      },
      createdByUserId: userId,
      updatedByUserId: userId,
    })
    .returning({ id: cardDefinitions.id });

  const clozeText =
    "The {{c1::hippocampus}} is the brain region responsible for forming new {{c2::memories}}.";
  const [clozeParent] = await db
    .insert(cardDefinitions)
    .values({
      deckDefinitionId: deck.id,
      cardType: "cloze",
      contentJson: { text: clozeText },
      createdByUserId: userId,
      updatedByUserId: userId,
    })
    .returning({ id: cardDefinitions.id });

  const clozeChild1 = await db
    .insert(cardDefinitions)
    .values({
      deckDefinitionId: deck.id,
      cardType: "cloze",
      contentJson: { text: clozeText, clozeIndex: 1 },
      parentCardId: clozeParent.id,
      createdByUserId: userId,
      updatedByUserId: userId,
    })
    .returning({ id: cardDefinitions.id });

  const clozeChild2 = await db
    .insert(cardDefinitions)
    .values({
      deckDefinitionId: deck.id,
      cardType: "cloze",
      contentJson: { text: clozeText, clozeIndex: 2 },
      parentCardId: clozeParent.id,
      createdByUserId: userId,
      updatedByUserId: userId,
    })
    .returning({ id: cardDefinitions.id });

  const shortcutCard = await db
    .insert(cardDefinitions)
    .values({
      deckDefinitionId: deck.id,
      cardType: "keyboard_shortcut",
      contentJson: {
        prompt: "Copy to clipboard",
        shortcut: { key: "c", ctrl: true, shift: false, alt: false, meta: false },
        explanation: "Ctrl+C copies the current selection to the clipboard.",
      },
      createdByUserId: userId,
      updatedByUserId: userId,
    })
    .returning({ id: cardDefinitions.id });

  const studyableCardIds = [
    frontBackCard[0].id,
    mcqCard[0].id,
    clozeChild1[0].id,
    clozeChild2[0].id,
    shortcutCard[0].id,
  ];

  const [userDeck] = await db
    .insert(userDecks)
    .values({ userId, deckDefinitionId: deck.id })
    .returning({ id: userDecks.id });

  await db.insert(userCardStates).values(
    studyableCardIds.map((cardId) => ({
      userDeckId: userDeck.id,
      cardDefinitionId: cardId,
      srsState: "new",
      stability: "0.0000",
      difficulty: "0.000",
      reps: 0,
      lapses: 0,
    })),
  );

  await db.update(users).set({ defaultDeckId: deck.id }).where(eq(users.id, userId));

  return deck.id;
}
