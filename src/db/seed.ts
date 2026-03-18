import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import * as schema from "./schema";
import {
  BIOLOGY_FRONT_BACK,
  BIOLOGY_CLOZE,
  WORLD_CAPITALS_MC,
  JS_FRONT_BACK,
  JS_CLOZE,
  JS_KEYBOARD_SHORTCUTS,
  DATA_STRUCTURES_MC,
  DATA_STRUCTURES_FRONT_BACK,
  CHEMISTRY_FRONT_BACK,
  PHYSICS_MC,
  ART_HISTORY_FRONT_BACK,
  SPANISH_MC,
  SPANISH_FRONT_BACK,
  WORLD_CAPITALS_FRONT_BACK,
  ENGLISH_IDIOMS_FRONT_BACK,
  PROGRAMMING_FUNDAMENTALS_MC,
  PROGRAMMING_FUNDAMENTALS_CLOZE,
  PROGRAMMING_FUNDAMENTALS_SHORTCUTS,
  MUSIC_THEORY_FRONT_BACK,
  CS101_FRONT_BACK,
  CS101_MC,
  CS101_CLOZE,
} from "./seed-data";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const DEFAULT_PASSWORD = "TestTest123!";

const TEST_USERS = [
  { email: "allisonfrederick@outlook.com", name: "Allison Frederick", username: "allison" },
  { email: "bob.chen@example.com", name: "Bob Chen", username: "bob" },
  { email: "carol.davis@example.com", name: "Carol Davis", username: "carol" },
  { email: "dave.wilson@example.com", name: "Dave Wilson", username: "dave" },
  { email: "eve.martinez@example.com", name: "Eve Martinez", username: "eve" },
] as const;

async function seed() {
  const client = postgres(DATABASE_URL!);
  const db = drizzle(client, { schema });
  const hashedPw = await hashPassword(DEFAULT_PASSWORD);

  console.log("Seeding database...");
  console.log(`All users share password: ${DEFAULT_PASSWORD}\n`);

  // ── Users & Accounts ──────────────────────────────────────────────
  const users: Record<string, typeof schema.users.$inferSelect> = {};

  for (const u of TEST_USERS) {
    const [user] = await db
      .insert(schema.users)
      .values({
        email: u.email,
        name: u.name,
        username: u.username,
        emailVerified: true,
        status: "active",
      })
      .returning();

    await db.insert(schema.accounts).values({
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: hashedPw,
    });

    users[u.username] = user;
    console.log(`  User: ${u.name} <${u.email}>`);
  }

  // ── Helper: create folder + settings + owner membership ─────
  async function createFolder(name: string, slug: string, ownerId: string) {
    const [folder] = await db
      .insert(schema.folders)
      .values({ name, slug, createdByUserId: ownerId })
      .returning();

    await db.insert(schema.folderSettings).values({ folderId: folder.id });

    await db.insert(schema.folderMembers).values({
      folderId: folder.id,
      userId: ownerId,
      role: "owner",
      status: "active",
      joinedAt: new Date(),
    });

    return folder;
  }

  // ── Helper: add member to folder ────────────────────────────
  async function addMember(folderId: string, userId: string, role: string) {
    await db.insert(schema.folderMembers).values({
      folderId,
      userId,
      role,
      status: "active",
      joinedAt: new Date(),
    });
  }

  // ── Helper: invite member (pending) ─────────────────────────────
  async function inviteMember(folderId: string, userId: string, role: string) {
    await db.insert(schema.folderMembers).values({
      folderId,
      userId,
      role,
      status: "invited",
    });
  }

  // ── Helper: create deck ────────────────────────────────────────
  async function createDeck(
    folderId: string,
    title: string,
    slug: string,
    userId: string,
    opts?: { viewPolicy?: string; description?: string },
  ) {
    const [deck] = await db
      .insert(schema.deckDefinitions)
      .values({
        folderId,
        title,
        slug,
        description: opts?.description,
        viewPolicy: opts?.viewPolicy ?? "private",
        createdByUserId: userId,
        updatedByUserId: userId,
      })
      .returning();
    return deck;
  }

  // ── Helper: create cards (returns created card IDs) ──────────
  async function createCards(
    deckId: string,
    userId: string,
    cardType: string,
    cards: Record<string, unknown>[],
  ): Promise<string[]> {
    const createdIds: string[] = [];
    for (const contentJson of cards) {
      if (cardType === "cloze") {
        const text = String(contentJson.text ?? "");
        const indices = getClozeIndices(text);

        const [parent] = await db
          .insert(schema.cardDefinitions)
          .values({
            deckDefinitionId: deckId,
            cardType: "cloze",
            contentJson: { text },
            createdByUserId: userId,
            updatedByUserId: userId,
          })
          .returning({ id: schema.cardDefinitions.id });

        createdIds.push(parent.id);

        for (const clozeIndex of indices) {
          await db.insert(schema.cardDefinitions).values({
            deckDefinitionId: deckId,
            cardType: "cloze",
            contentJson: { text, clozeIndex },
            parentCardId: parent.id,
            createdByUserId: userId,
            updatedByUserId: userId,
          });
        }
      } else {
        const [row] = await db
          .insert(schema.cardDefinitions)
          .values({
            deckDefinitionId: deckId,
            cardType,
            contentJson,
            createdByUserId: userId,
            updatedByUserId: userId,
          })
          .returning({ id: schema.cardDefinitions.id });
        createdIds.push(row.id);
      }
    }
    return createdIds;
  }

  function getClozeIndices(text: string): number[] {
    const re = /\{\{c(\d+)::[^}]*?\}\}/g;
    const indices = new Set<number>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      indices.add(parseInt(m[1], 10));
    }
    return [...indices].sort((a, b) => a - b);
  }

  // ── Default Folders (all 5 users) ─────────────────────────
  const allisonPersonal = await createFolder(
    "Allison's Default Folder",
    "allison-default-folder",
    users.allison.id,
  );
  const bobPersonal = await createFolder(
    "Bob's Default Folder",
    "bob-default-folder",
    users.bob.id,
  );
  const carolPersonal = await createFolder(
    "Carol's Default Folder",
    "carol-default-folder",
    users.carol.id,
  );
  const davePersonal = await createFolder(
    "Dave's Default Folder",
    "dave-default-folder",
    users.dave.id,
  );
  const evePersonal = await createFolder(
    "Eve's Default Folder",
    "eve-default-folder",
    users.eve.id,
  );

  await db
    .update(schema.users)
    .set({ personalFolderId: allisonPersonal.id })
    .where(eq(schema.users.id, users.allison.id));
  await db
    .update(schema.users)
    .set({ personalFolderId: bobPersonal.id })
    .where(eq(schema.users.id, users.bob.id));
  await db
    .update(schema.users)
    .set({ personalFolderId: carolPersonal.id })
    .where(eq(schema.users.id, users.carol.id));
  await db
    .update(schema.users)
    .set({ personalFolderId: davePersonal.id })
    .where(eq(schema.users.id, users.dave.id));
  await db
    .update(schema.users)
    .set({ personalFolderId: evePersonal.id })
    .where(eq(schema.users.id, users.eve.id));

  console.log("\n  Default folders created for all 5 users");

  // ── Default Deck (default deck per user) ─────────────────────────
  async function createDefaultDeck(folderId: string, userId: string) {
    const [deck] = await db
      .insert(schema.deckDefinitions)
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

    const [fb] = await db
      .insert(schema.cardDefinitions)
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
      .returning({ id: schema.cardDefinitions.id });

    const [mcq] = await db
      .insert(schema.cardDefinitions)
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
      .returning({ id: schema.cardDefinitions.id });

    const clozeText =
      "The {{c1::hippocampus}} is the brain region responsible for forming new {{c2::memories}}.";
    const [clozeParent] = await db
      .insert(schema.cardDefinitions)
      .values({
        deckDefinitionId: deck.id,
        cardType: "cloze",
        contentJson: { text: clozeText },
        createdByUserId: userId,
        updatedByUserId: userId,
      })
      .returning({ id: schema.cardDefinitions.id });

    const [cc1] = await db
      .insert(schema.cardDefinitions)
      .values({
        deckDefinitionId: deck.id,
        cardType: "cloze",
        contentJson: { text: clozeText, clozeIndex: 1 },
        parentCardId: clozeParent.id,
        createdByUserId: userId,
        updatedByUserId: userId,
      })
      .returning({ id: schema.cardDefinitions.id });

    const [cc2] = await db
      .insert(schema.cardDefinitions)
      .values({
        deckDefinitionId: deck.id,
        cardType: "cloze",
        contentJson: { text: clozeText, clozeIndex: 2 },
        parentCardId: clozeParent.id,
        createdByUserId: userId,
        updatedByUserId: userId,
      })
      .returning({ id: schema.cardDefinitions.id });

    const [kb] = await db
      .insert(schema.cardDefinitions)
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
      .returning({ id: schema.cardDefinitions.id });

    const studyableIds = [fb.id, mcq.id, cc1.id, cc2.id, kb.id];

    const [userDeck] = await db
      .insert(schema.userDecks)
      .values({ userId, deckDefinitionId: deck.id })
      .returning({ id: schema.userDecks.id });

    await db.insert(schema.userCardStates).values(
      studyableIds.map((cardId) => ({
        userDeckId: userDeck.id,
        cardDefinitionId: cardId,
        srsState: "new",
        stability: "0.0000",
        difficulty: "0.000",
        reps: 0,
        lapses: 0,
      })),
    );

    await db
      .update(schema.users)
      .set({ defaultDeckId: deck.id })
      .where(eq(schema.users.id, userId));

    return deck;
  }

  await createDefaultDeck(allisonPersonal.id, users.allison.id);
  await createDefaultDeck(bobPersonal.id, users.bob.id);
  await createDefaultDeck(carolPersonal.id, users.carol.id);
  await createDefaultDeck(davePersonal.id, users.dave.id);
  await createDefaultDeck(evePersonal.id, users.eve.id);

  console.log("  Default Deck created for all 5 users");

  // ── Allison's Default Folder — decks ────────────────────
  const bioDeck = await createDeck(
    allisonPersonal.id,
    "Biology 101",
    "biology-101",
    users.allison.id,
    { description: "Fundamental biology concepts" },
  );
  await createCards(bioDeck.id, users.allison.id, "front_back", BIOLOGY_FRONT_BACK);
  const bioClozeIds = await createCards(bioDeck.id, users.allison.id, "cloze", BIOLOGY_CLOZE);

  const capitalsDeck = await createDeck(
    allisonPersonal.id,
    "World Capitals (MC)",
    "world-capitals-mc",
    users.allison.id,
    { description: "Test your knowledge of world capitals with multiple choice" },
  );
  await createCards(capitalsDeck.id, users.allison.id, "multiple_choice", WORLD_CAPITALS_MC);

  // ── CS 101 — big deck (100 cards) ─────────────────────────────
  const cs101Deck = await createDeck(
    allisonPersonal.id,
    "Computer Science 101",
    "cs-101",
    users.allison.id,
    {
      description:
        "Comprehensive CS fundamentals — algorithms, data structures, networking, databases, and more",
    },
  );
  await createCards(cs101Deck.id, users.allison.id, "front_back", CS101_FRONT_BACK);
  await createCards(cs101Deck.id, users.allison.id, "multiple_choice", CS101_MC);
  await createCards(cs101Deck.id, users.allison.id, "cloze", CS101_CLOZE);

  console.log(
    "  Allison's Default Folder: Biology 101 (6 cards), World Capitals MC (4 cards), CS 101 (100 cards)",
  );

  // ── Allison's Shared Folder (Owner) — Bob is editor ────────
  const allisonShared = await createFolder(
    "Allison's Team — Owner Role",
    "allison-team-owner",
    users.allison.id,
  );
  await addMember(allisonShared.id, users.bob.id, "editor");

  const jsDeck = await createDeck(
    allisonShared.id,
    "JavaScript Fundamentals",
    "js-fundamentals",
    users.allison.id,
    {
      description: "Core JS concepts for interviews",
      viewPolicy: "folder",
    },
  );
  const jsCardIds = await createCards(jsDeck.id, users.allison.id, "front_back", JS_FRONT_BACK);
  const jsClozeIds = await createCards(jsDeck.id, users.allison.id, "cloze", JS_CLOZE);
  await createCards(jsDeck.id, users.allison.id, "keyboard_shortcut", JS_KEYBOARD_SHORTCUTS);

  const dsDeck = await createDeck(
    allisonShared.id,
    "Data Structures",
    "data-structures",
    users.allison.id,
    {
      description: "Common data structures and their trade-offs",
      viewPolicy: "folder",
    },
  );
  await createCards(dsDeck.id, users.allison.id, "multiple_choice", DATA_STRUCTURES_MC);
  await createCards(dsDeck.id, users.allison.id, "front_back", DATA_STRUCTURES_FRONT_BACK);

  console.log(
    "  Allison's Team — Owner Role: JS Fundamentals (6), Data Structures (5) — Bob is editor",
  );

  // ── Bob's Shared Folder — Allison is VIEWER ────────────────
  const bobShared = await createFolder(
    "Bob's Lab — Allison Viewer",
    "bob-lab-allison-viewer",
    users.bob.id,
  );
  await addMember(bobShared.id, users.allison.id, "viewer");
  await addMember(bobShared.id, users.dave.id, "editor");

  const chemDeck = await createDeck(
    bobShared.id,
    "Chemistry Basics",
    "chemistry-basics",
    users.bob.id,
    {
      description: "Intro chemistry review",
      viewPolicy: "folder",
    },
  );
  const chemCardIds = await createCards(
    chemDeck.id,
    users.bob.id,
    "front_back",
    CHEMISTRY_FRONT_BACK,
  );

  const physicsDeck = await createDeck(bobShared.id, "Physics 101", "physics-101", users.bob.id, {
    description: "Newtonian mechanics fundamentals",
    viewPolicy: "folder",
  });
  await createCards(physicsDeck.id, users.bob.id, "multiple_choice", PHYSICS_MC);

  console.log(
    "  Bob's Lab — Allison Viewer: Chemistry Basics (3), Physics 101 (2) — Dave is editor",
  );

  // ── Carol's Shared Folder — Allison is EDITOR ──────────────
  const carolShared = await createFolder(
    "Carol's Studio — Allison Editor",
    "carol-studio-allison-editor",
    users.carol.id,
  );
  await addMember(carolShared.id, users.allison.id, "editor");
  await addMember(carolShared.id, users.eve.id, "viewer");

  const artDeck = await createDeck(carolShared.id, "Art History", "art-history", users.carol.id, {
    description: "Major art movements and artists",
    viewPolicy: "folder",
  });
  await createCards(artDeck.id, users.carol.id, "front_back", ART_HISTORY_FRONT_BACK);

  const spanishDeck = await createDeck(
    carolShared.id,
    "Spanish Vocabulary",
    "spanish-vocab",
    users.carol.id,
    {
      description: "Common Spanish words and phrases",
      viewPolicy: "folder",
    },
  );
  await createCards(spanishDeck.id, users.carol.id, "multiple_choice", SPANISH_MC);
  await createCards(spanishDeck.id, users.carol.id, "front_back", SPANISH_FRONT_BACK);

  console.log(
    "  Carol's Studio — Allison Editor: Art History (4), Spanish Vocab (6) — Eve is viewer",
  );

  // ── Dave's Shared Folder — Allison INVITED as editor ───────
  const daveShared = await createFolder(
    "Dave's Research — Pending Invite",
    "dave-research-pending",
    users.dave.id,
  );
  await addMember(daveShared.id, users.eve.id, "viewer");
  await inviteMember(daveShared.id, users.allison.id, "editor");

  await createDeck(daveShared.id, "Machine Learning Intro", "ml-intro", users.dave.id, {
    description: "Fundamentals of ML and neural networks",
    viewPolicy: "folder",
  });

  console.log("  Dave's Research — Pending Invite: Allison invited as editor");

  // ── Eve's Shared Folder — Allison INVITED as viewer ────────
  const eveShared = await createFolder(
    "Eve's Book Club — Pending Invite",
    "eve-book-club-pending",
    users.eve.id,
  );
  await addMember(eveShared.id, users.carol.id, "editor");
  await inviteMember(eveShared.id, users.allison.id, "viewer");

  await createDeck(eveShared.id, "Classic Literature", "classic-lit", users.eve.id, {
    description: "Key themes and quotes from classic novels",
    viewPolicy: "folder",
  });

  console.log("  Eve's Book Club — Pending Invite: Allison invited as viewer");

  // ── Public Decks (browseable by anyone) ─────────────────────────
  const bobPublicDeck = await createDeck(
    bobPersonal.id,
    "World Capitals",
    "world-capitals",
    users.bob.id,
    { description: "Test your knowledge of world capitals", viewPolicy: "public" },
  );
  await createCards(bobPublicDeck.id, users.bob.id, "front_back", WORLD_CAPITALS_FRONT_BACK);

  const carolPublicDeck = await createDeck(
    carolPersonal.id,
    "Common English Idioms",
    "english-idioms",
    users.carol.id,
    { description: "Popular English idioms and their meanings", viewPolicy: "public" },
  );
  await createCards(carolPublicDeck.id, users.carol.id, "front_back", ENGLISH_IDIOMS_FRONT_BACK);

  const davePublicDeck = await createDeck(
    davePersonal.id,
    "Programming Fundamentals",
    "programming-fundamentals",
    users.dave.id,
    { description: "Core programming concepts for beginners", viewPolicy: "public" },
  );
  await createCards(
    davePublicDeck.id,
    users.dave.id,
    "multiple_choice",
    PROGRAMMING_FUNDAMENTALS_MC,
  );
  await createCards(davePublicDeck.id, users.dave.id, "cloze", PROGRAMMING_FUNDAMENTALS_CLOZE);
  await createCards(
    davePublicDeck.id,
    users.dave.id,
    "keyboard_shortcut",
    PROGRAMMING_FUNDAMENTALS_SHORTCUTS,
  );

  console.log(
    "  Public decks: World Capitals (5), English Idioms (4), Programming Fundamentals (6)",
  );

  // ── Linked Decks ──────────────────────────────────────────────
  console.log("\nCreating linked decks...");

  // Link Bob's World Capitals into Allison's default folder
  const [linkedWorldCapitals] = await db
    .insert(schema.deckDefinitions)
    .values({
      folderId: allisonPersonal.id,
      title: bobPublicDeck.title,
      slug: `${bobPublicDeck.slug}-linked`,
      description: bobPublicDeck.description,
      viewPolicy: "private",
      linkedDeckDefinitionId: bobPublicDeck.id,
      createdByUserId: users.allison.id,
      updatedByUserId: users.allison.id,
    })
    .returning();
  console.log(
    `  Linked "World Capitals" into Allison's Default Folder (${linkedWorldCapitals.id})`,
  );

  // Link Carol's English Idioms into Allison's shared folder
  const [linkedIdioms] = await db
    .insert(schema.deckDefinitions)
    .values({
      folderId: allisonShared.id,
      title: carolPublicDeck.title,
      slug: `${carolPublicDeck.slug}-linked`,
      description: carolPublicDeck.description,
      viewPolicy: "private",
      linkedDeckDefinitionId: carolPublicDeck.id,
      createdByUserId: users.allison.id,
      updatedByUserId: users.allison.id,
    })
    .returning();
  console.log(`  Linked "English Idioms" into Allison's Team (${linkedIdioms.id})`);

  const eveAbandonedDeck = await createDeck(
    evePersonal.id,
    "Eve's Music Theory",
    "eve-music-theory",
    users.eve.id,
    { description: "Music theory basics — now abandoned", viewPolicy: "public" },
  );
  await createCards(eveAbandonedDeck.id, users.eve.id, "front_back", MUSIC_THEORY_FRONT_BACK);
  const [linkedAbandoned] = await db
    .insert(schema.deckDefinitions)
    .values({
      folderId: allisonPersonal.id,
      title: eveAbandonedDeck.title,
      slug: `${eveAbandonedDeck.slug}-linked`,
      description: eveAbandonedDeck.description,
      viewPolicy: "private",
      linkedDeckDefinitionId: eveAbandonedDeck.id,
      createdByUserId: users.allison.id,
      updatedByUserId: users.allison.id,
    })
    .returning();
  await db
    .update(schema.deckDefinitions)
    .set({ archivedAt: new Date() })
    .where(eq(schema.deckDefinitions.id, eveAbandonedDeck.id));
  console.log(
    `  Linked "Eve's Music Theory" (ABANDONED) into Allison's Default Folder (${linkedAbandoned.id})`,
  );

  // ── Seed user libraries (userDecks + userCardStates) ──────────
  console.log("\nSeeding user libraries...");

  async function addToLibrary(userId: string, deckId: string) {
    const existing = await db
      .select({ id: schema.userDecks.id })
      .from(schema.userDecks)
      .where(
        and(eq(schema.userDecks.userId, userId), eq(schema.userDecks.deckDefinitionId, deckId)),
      );

    if (existing.length > 0) return existing[0].id;

    const [userDeck] = await db
      .insert(schema.userDecks)
      .values({ userId, deckDefinitionId: deckId })
      .returning({ id: schema.userDecks.id });

    const allCards = await db
      .select({
        id: schema.cardDefinitions.id,
        cardType: schema.cardDefinitions.cardType,
        parentCardId: schema.cardDefinitions.parentCardId,
        status: schema.cardDefinitions.status,
        archivedAt: schema.cardDefinitions.archivedAt,
      })
      .from(schema.cardDefinitions)
      .where(eq(schema.cardDefinitions.deckDefinitionId, deckId));

    const studyableCards = allCards.filter(
      (c) =>
        c.status === "active" &&
        !c.archivedAt &&
        (c.cardType !== "cloze" || c.parentCardId !== null),
    );

    if (studyableCards.length > 0) {
      await db.insert(schema.userCardStates).values(
        studyableCards.map((c) => ({
          userDeckId: userDeck.id,
          cardDefinitionId: c.id,
          srsState: "new",
          stability: "0.0000",
          difficulty: "0.000",
          reps: 0,
          lapses: 0,
        })),
      );
    }
    return userDeck.id;
  }

  // Allison's own decks
  await addToLibrary(users.allison.id, bioDeck.id);
  await addToLibrary(users.allison.id, capitalsDeck.id);
  await addToLibrary(users.allison.id, cs101Deck.id);
  await addToLibrary(users.allison.id, jsDeck.id);
  await addToLibrary(users.allison.id, dsDeck.id);
  // Linked decks: study state is keyed to the SOURCE deck
  await addToLibrary(users.allison.id, bobPublicDeck.id);
  await addToLibrary(users.allison.id, carolPublicDeck.id);
  await addToLibrary(users.allison.id, eveAbandonedDeck.id);
  // Decks from folders Allison is a member of
  await addToLibrary(users.allison.id, chemDeck.id);
  await addToLibrary(users.allison.id, physicsDeck.id);
  await addToLibrary(users.allison.id, artDeck.id);
  await addToLibrary(users.allison.id, spanishDeck.id);

  console.log("  Added 12 decks to Allison's library with userCardStates");

  // ── Tags ────────────────────────────────────────────────────────
  console.log("\nSeeding tags...");

  async function upsertTag(name: string): Promise<string> {
    const [row] = await db
      .insert(schema.tags)
      .values({ name: name.toLowerCase().trim() })
      .onConflictDoNothing()
      .returning({ id: schema.tags.id });
    if (row) return row.id;
    const [existing] = await db
      .select({ id: schema.tags.id })
      .from(schema.tags)
      .where(eq(schema.tags.name, name.toLowerCase().trim()));
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

  async function tagCard(cardId: string, tagNames: string[]) {
    for (const name of tagNames) {
      const tagId = await upsertTag(name);
      await db
        .insert(schema.cardTags)
        .values({ cardDefinitionId: cardId, tagId })
        .onConflictDoNothing();
    }
  }

  await tagDeck(bioDeck.id, ["biology", "science", "intro"]);
  await tagDeck(capitalsDeck.id, ["geography", "trivia"]);
  await tagDeck(cs101Deck.id, [
    "computer-science",
    "programming",
    "algorithms",
    "networking",
    "databases",
  ]);
  await tagDeck(jsDeck.id, ["javascript", "programming", "interviews"]);
  await tagDeck(dsDeck.id, ["data-structures", "programming", "computer-science"]);
  await tagDeck(chemDeck.id, ["chemistry", "science", "intro", "chem101"]);
  await tagDeck(physicsDeck.id, ["physics", "science"]);
  await tagDeck(artDeck.id, ["art", "history"]);
  await tagDeck(spanishDeck.id, ["spanish", "language"]);
  await tagDeck(bobPublicDeck.id, ["geography", "trivia"]);
  await tagDeck(carolPublicDeck.id, ["english", "language", "idioms"]);
  await tagDeck(davePublicDeck.id, ["programming", "computer-science"]);
  await tagDeck(eveAbandonedDeck.id, ["music", "theory"]);

  for (const cardId of bioClozeIds) {
    await tagCard(cardId, ["biology", "chem101"]);
  }
  for (const cardId of jsCardIds) {
    await tagCard(cardId, ["javascript", "interviews"]);
  }
  for (const cardId of jsClozeIds) {
    await tagCard(cardId, ["javascript", "advanced"]);
  }
  for (const cardId of chemCardIds) {
    await tagCard(cardId, ["chem101", "chemistry"]);
  }

  console.log("  Tagged 13 decks and sample cards");

  // ── Summary ────────────────────────────────────────────────────
  console.log(`
Seed complete!

  Login credentials (all users):
    Password: ${DEFAULT_PASSWORD}

  Users:
    allisonfrederick@outlook.com  — Allison Frederick
    bob.chen@example.com          — Bob Chen
    carol.davis@example.com       — Carol Davis
    dave.wilson@example.com       — Dave Wilson
    eve.martinez@example.com      — Eve Martinez

  Allison's folder membership:
    ✦ Allison's Default Folder         → owner   (3 decks + 2 linked + Default Deck)
    ✦ Allison's Team — Owner Role     → owner   (2 decks + 1 linked)
    ✦ Bob's Lab — Allison Viewer      → viewer  (2 decks)
    ✦ Carol's Studio — Allison Editor → editor  (2 decks)

  Allison's pending invites:
    ✉ Dave's Research — Pending Invite  → invited as editor
    ✉ Eve's Book Club — Pending Invite  → invited as viewer

  Allison's library (userDecks + userCardStates seeded):
    📚 Biology 101, World Capitals MC, CS 101 (100 cards!), JS Fundamentals, Data Structures
    📚 World Capitals (Bob's, via link), English Idioms (Carol's, via link), Music Theory (Eve's, abandoned)
    👀 Chemistry Basics, Physics 101 (Bob's Lab), Art History, Spanish Vocab (Carol's Studio)

  Public decks (visible on /browse):
    🌐 World Capitals (Bob)               → 5 cards
    🌐 Common English Idioms (Carol)      → 4 cards
    🌐 Programming Fundamentals (Dave)    → 6 cards
    🌐 Eve's Music Theory (Eve)           → 2 cards (archived)

  Linked decks in Allison's folders:
    🔗 World Capitals → Allison's Default Folder
    🔗 Common English Idioms → Allison's Team
    ⚠️  Eve's Music Theory → Allison's Default Folder (ABANDONED)
`);

  await client.end();
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
