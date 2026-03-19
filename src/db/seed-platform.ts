import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import * as schema from "./schema";
import {
  PLATFORM_USER_ID,
  PLATFORM_FOLDER_ID,
  PLATFORM_USER_EMAIL,
  PLATFORM_USER_NAME,
  PLATFORM_FOLDER_NAME,
} from "../lib/platform";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

async function seedPlatform() {
  const client = postgres(DATABASE_URL!);
  const db = drizzle(client, { schema });

  console.log("Seeding platform content...\n");

  // ── Platform User ─────────────────────────────────────────────
  const existingUser = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, PLATFORM_USER_ID))
    .limit(1);

  if (existingUser.length === 0) {
    const randomHash = await hashPassword(crypto.randomUUID());

    await db.insert(schema.users).values({
      id: PLATFORM_USER_ID,
      email: PLATFORM_USER_EMAIL,
      name: PLATFORM_USER_NAME,
      username: "brainls",
      emailVerified: false,
      status: "active",
    });

    await db.insert(schema.accounts).values({
      userId: PLATFORM_USER_ID,
      accountId: PLATFORM_USER_ID,
      providerId: "credential",
      password: randomHash,
    });

    console.log(`  Created platform user: ${PLATFORM_USER_NAME} <${PLATFORM_USER_EMAIL}>`);
  } else {
    console.log("  Platform user already exists, skipping");
  }

  // ── Platform Folder ───────────────────────────────────────────
  const existingFolder = await db
    .select({ id: schema.folders.id })
    .from(schema.folders)
    .where(eq(schema.folders.id, PLATFORM_FOLDER_ID))
    .limit(1);

  if (existingFolder.length === 0) {
    await db.insert(schema.folders).values({
      id: PLATFORM_FOLDER_ID,
      name: PLATFORM_FOLDER_NAME,
      slug: "brainls-official",
      createdByUserId: PLATFORM_USER_ID,
    });

    await db.insert(schema.folderSettings).values({
      folderId: PLATFORM_FOLDER_ID,
    });

    await db.insert(schema.folderMembers).values({
      folderId: PLATFORM_FOLDER_ID,
      userId: PLATFORM_USER_ID,
      role: "owner",
      status: "active",
      joinedAt: new Date(),
    });

    console.log(`  Created platform folder: ${PLATFORM_FOLDER_NAME}`);
  } else {
    console.log("  Platform folder already exists, skipping");
  }

  // ── Helpers ───────────────────────────────────────────────────

  async function createDeckIfMissing(
    slug: string,
    title: string,
    description: string,
  ): Promise<{ id: string; created: boolean }> {
    const existing = await db
      .select({ id: schema.deckDefinitions.id })
      .from(schema.deckDefinitions)
      .where(eq(schema.deckDefinitions.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      return { id: existing[0].id, created: false };
    }

    const [deck] = await db
      .insert(schema.deckDefinitions)
      .values({
        folderId: PLATFORM_FOLDER_ID,
        title,
        slug,
        description,
        viewPolicy: "public",
        createdByUserId: PLATFORM_USER_ID,
        updatedByUserId: PLATFORM_USER_ID,
      })
      .returning();

    return { id: deck.id, created: true };
  }

  async function createCards(deckId: string, cardType: string, cards: Record<string, unknown>[]) {
    for (const contentJson of cards) {
      await db.insert(schema.cardDefinitions).values({
        deckDefinitionId: deckId,
        cardType,
        contentJson,
        createdByUserId: PLATFORM_USER_ID,
        updatedByUserId: PLATFORM_USER_ID,
      });
    }
  }

  async function upsertTag(name: string): Promise<string> {
    const normalized = name.toLowerCase().trim();
    const [row] = await db
      .insert(schema.tags)
      .values({ name: normalized })
      .onConflictDoNothing()
      .returning({ id: schema.tags.id });
    if (row) return row.id;
    const [existing] = await db
      .select({ id: schema.tags.id })
      .from(schema.tags)
      .where(eq(schema.tags.name, normalized));
    return existing.id;
  }

  async function tagDeck(deckId: string, tagNames: string[]) {
    for (const name of tagNames) {
      const tagId = await upsertTag(name);
      await db
        .insert(schema.deckTags)
        .values({ deckDefinitionId: deckId, tagId })
        .onConflictDoNothing();
    }
  }

  // ── Deck 1: Getting Started with BrainLS ──────────────────────
  const gettingStarted = await createDeckIfMissing(
    "brainls-getting-started",
    "Getting Started with BrainLS",
    "Learn the basics of BrainLS and how to get the most out of spaced repetition.",
  );

  if (gettingStarted.created) {
    await createCards(gettingStarted.id, "front_back", [
      {
        front: "<p>What is spaced repetition?</p>",
        back: "<p>A learning technique that reviews material at increasing intervals to move knowledge into long-term memory.</p>",
      },
      {
        front: "<p>What are the main card types in BrainLS?</p>",
        back: "<p>Front/Back, Multiple Choice, Cloze Deletion, and Keyboard Shortcut.</p>",
      },
      {
        front: "<p>What is a cloze deletion?</p>",
        back: "<p>A card where part of the text is hidden (e.g. {{c1::answer}}) and you must recall the missing piece.</p>",
      },
      {
        front: "<p>How do folders work in BrainLS?</p>",
        back: "<p>Folders group decks together. You have a personal folder and can create or join shared folders with other users.</p>",
      },
      {
        front: "<p>What is the difference between a linked deck and a copied deck?</p>",
        back: "<p>A linked deck stays in sync with the original and shares study progress. A copied deck is independent — you can edit it freely.</p>",
      },
      {
        front: "<p>How does the rating system work after reviewing a card?</p>",
        back: "<p>You rate how well you recalled the answer (Again, Hard, Good, Easy). This adjusts the card's next review interval using the SM-2 algorithm.</p>",
      },
    ]);
    await tagDeck(gettingStarted.id, ["brainls", "tutorial"]);
    console.log("  Created deck: Getting Started with BrainLS (6 cards)");
  } else {
    console.log("  Deck 'Getting Started with BrainLS' already exists, skipping");
  }

  // ── Deck 2: World Capitals ────────────────────────────────────
  const worldCapitals = await createDeckIfMissing(
    "brainls-world-capitals",
    "World Capitals",
    "Test your knowledge of capital cities around the world.",
  );

  if (worldCapitals.created) {
    await createCards(worldCapitals.id, "front_back", [
      { front: "<p>What is the capital of France?</p>", back: "<p>Paris</p>" },
      { front: "<p>What is the capital of Japan?</p>", back: "<p>Tokyo</p>" },
      { front: "<p>What is the capital of Brazil?</p>", back: "<p>Brasília</p>" },
      { front: "<p>What is the capital of Australia?</p>", back: "<p>Canberra</p>" },
      { front: "<p>What is the capital of Canada?</p>", back: "<p>Ottawa</p>" },
      { front: "<p>What is the capital of Egypt?</p>", back: "<p>Cairo</p>" },
      { front: "<p>What is the capital of Germany?</p>", back: "<p>Berlin</p>" },
      { front: "<p>What is the capital of South Korea?</p>", back: "<p>Seoul</p>" },
      { front: "<p>What is the capital of Argentina?</p>", back: "<p>Buenos Aires</p>" },
      { front: "<p>What is the capital of Thailand?</p>", back: "<p>Bangkok</p>" },
    ]);
    await tagDeck(worldCapitals.id, ["geography", "trivia"]);
    console.log("  Created deck: World Capitals (10 cards)");
  } else {
    console.log("  Deck 'World Capitals' already exists, skipping");
  }

  // ── Deck 3: Common Keyboard Shortcuts ─────────────────────────
  const shortcuts = await createDeckIfMissing(
    "brainls-keyboard-shortcuts",
    "Common Keyboard Shortcuts",
    "Essential keyboard shortcuts for everyday computing productivity.",
  );

  if (shortcuts.created) {
    await createCards(shortcuts.id, "keyboard_shortcut", [
      {
        prompt: "<p>Copy the selected text or item</p>",
        shortcut: { key: "c", ctrl: true, shift: false, alt: false, meta: false },
        explanation: "<p>Ctrl+C copies the current selection to the clipboard.</p>",
      },
      {
        prompt: "<p>Paste from clipboard</p>",
        shortcut: { key: "v", ctrl: true, shift: false, alt: false, meta: false },
        explanation: "<p>Ctrl+V pastes the contents of the clipboard.</p>",
      },
      {
        prompt: "<p>Undo the last action</p>",
        shortcut: { key: "z", ctrl: true, shift: false, alt: false, meta: false },
        explanation: "<p>Ctrl+Z reverses the most recent action.</p>",
      },
      {
        prompt: "<p>Redo the last undone action</p>",
        shortcut: { key: "z", ctrl: true, shift: true, alt: false, meta: false },
        explanation: "<p>Ctrl+Shift+Z (or Ctrl+Y) re-applies an undone action.</p>",
      },
      {
        prompt: "<p>Select all text or items</p>",
        shortcut: { key: "a", ctrl: true, shift: false, alt: false, meta: false },
        explanation: "<p>Ctrl+A selects everything in the current context.</p>",
      },
      {
        prompt: "<p>Save the current file</p>",
        shortcut: { key: "s", ctrl: true, shift: false, alt: false, meta: false },
        explanation: "<p>Ctrl+S saves the active document.</p>",
      },
      {
        prompt: "<p>Open the find/search dialog</p>",
        shortcut: { key: "f", ctrl: true, shift: false, alt: false, meta: false },
        explanation: "<p>Ctrl+F opens a search bar in most applications.</p>",
      },
      {
        prompt: "<p>Switch to the next browser tab</p>",
        shortcut: { key: "Tab", ctrl: true, shift: false, alt: false, meta: false },
        explanation: "<p>Ctrl+Tab cycles forward through open browser tabs.</p>",
      },
    ]);
    await tagDeck(shortcuts.id, ["productivity", "shortcuts"]);
    console.log("  Created deck: Common Keyboard Shortcuts (8 cards)");
  } else {
    console.log("  Deck 'Common Keyboard Shortcuts' already exists, skipping");
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log(`
Platform seed complete!

  Platform user:   ${PLATFORM_USER_NAME} <${PLATFORM_USER_EMAIL}>
  Platform folder: ${PLATFORM_FOLDER_NAME}

  Decks (all public):
    - Getting Started with BrainLS  (6 front/back cards)    [brainls, tutorial]
    - World Capitals                (10 front/back cards)   [geography, trivia]
    - Common Keyboard Shortcuts     (8 shortcut cards)      [productivity, shortcuts]
`);

  await client.end();
}

seedPlatform().catch((e) => {
  console.error("Platform seed failed:", e);
  process.exit(1);
});
