import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import * as schema from "./schema";

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

  // ── Helper: create workspace + settings + owner membership ─────
  async function createWorkspace(
    name: string,
    slug: string,
    kind: "personal" | "shared",
    ownerId: string,
  ) {
    const [ws] = await db
      .insert(schema.workspaces)
      .values({ name, slug, kind, createdByUserId: ownerId })
      .returning();

    await db.insert(schema.workspaceSettings).values({ workspaceId: ws.id });

    await db.insert(schema.workspaceMembers).values({
      workspaceId: ws.id,
      userId: ownerId,
      role: "owner",
      status: "active",
      joinedAt: new Date(),
    });

    return ws;
  }

  // ── Helper: add member to workspace ────────────────────────────
  async function addMember(workspaceId: string, userId: string, role: string) {
    await db.insert(schema.workspaceMembers).values({
      workspaceId,
      userId,
      role,
      status: "active",
      joinedAt: new Date(),
    });
  }

  // ── Helper: invite member (pending) ─────────────────────────────
  async function inviteMember(workspaceId: string, userId: string, role: string) {
    await db.insert(schema.workspaceMembers).values({
      workspaceId,
      userId,
      role,
      status: "invited",
    });
  }

  // ── Helper: create deck ────────────────────────────────────────
  async function createDeck(
    workspaceId: string,
    title: string,
    slug: string,
    userId: string,
    opts?: { viewPolicy?: string; description?: string },
  ) {
    const [deck] = await db
      .insert(schema.deckDefinitions)
      .values({
        workspaceId,
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

  // ── Personal Workspaces (all 5 users) ─────────────────────────
  const allisonPersonal = await createWorkspace(
    "Allison's Personal",
    "allison-personal",
    "personal",
    users.allison.id,
  );
  const bobPersonal = await createWorkspace(
    "Bob's Personal",
    "bob-personal",
    "personal",
    users.bob.id,
  );
  const carolPersonal = await createWorkspace(
    "Carol's Personal",
    "carol-personal",
    "personal",
    users.carol.id,
  );
  const davePersonal = await createWorkspace(
    "Dave's Personal",
    "dave-personal",
    "personal",
    users.dave.id,
  );
  const evePersonal = await createWorkspace(
    "Eve's Personal",
    "eve-personal",
    "personal",
    users.eve.id,
  );

  await db
    .update(schema.users)
    .set({ personalWorkspaceId: allisonPersonal.id })
    .where(eq(schema.users.id, users.allison.id));
  await db
    .update(schema.users)
    .set({ personalWorkspaceId: bobPersonal.id })
    .where(eq(schema.users.id, users.bob.id));
  await db
    .update(schema.users)
    .set({ personalWorkspaceId: carolPersonal.id })
    .where(eq(schema.users.id, users.carol.id));
  await db
    .update(schema.users)
    .set({ personalWorkspaceId: davePersonal.id })
    .where(eq(schema.users.id, users.dave.id));
  await db
    .update(schema.users)
    .set({ personalWorkspaceId: evePersonal.id })
    .where(eq(schema.users.id, users.eve.id));

  console.log("\n  Personal workspaces created for all 5 users");

  // ── Allison's Personal Workspace — 2 decks ────────────────────
  const bioDeck = await createDeck(
    allisonPersonal.id,
    "Biology 101",
    "biology-101",
    users.allison.id,
    {
      description: "Fundamental biology concepts",
    },
  );
  await createCards(bioDeck.id, users.allison.id, "front_back", [
    { front: "What is the powerhouse of the cell?", back: "The mitochondria" },
    { front: "What is DNA?", back: "Deoxyribonucleic acid — carries genetic instructions" },
    { front: "What is osmosis?", back: "Movement of water through a semipermeable membrane" },
  ]);
  const bioClozeIds = await createCards(bioDeck.id, users.allison.id, "cloze", [
    { text: "The {{c1::mitochondria}} is the powerhouse of the {{c2::cell}}." },
    {
      text: "{{c1::Photosynthesis}} converts {{c2::light energy}} into {{c3::chemical energy}} in plants.",
    },
    {
      text: "The four nucleotide bases are {{c1::Adenine}}, {{c1::Thymine}}, {{c1::Guanine}}, and {{c1::Cytosine}}.",
    },
  ]);

  const capitalsDeck = await createDeck(
    allisonPersonal.id,
    "World Capitals",
    "world-capitals",
    users.allison.id,
    {
      description: "Test your knowledge of world capitals",
    },
  );
  await createCards(capitalsDeck.id, users.allison.id, "multiple_choice", [
    {
      question: "What is the capital of France?",
      choices: ["Lyon", "Marseille", "Paris", "Nice"],
      correctChoiceIndexes: [2],
    },
    {
      question: "What is the capital of Japan?",
      choices: ["Osaka", "Tokyo", "Kyoto", "Nagoya"],
      correctChoiceIndexes: [1],
    },
    {
      question: "What is the capital of Brazil?",
      choices: ["Rio de Janeiro", "São Paulo", "Brasília", "Salvador"],
      correctChoiceIndexes: [2],
    },
    {
      question: "What is the capital of Australia?",
      choices: ["Sydney", "Melbourne", "Canberra", "Perth"],
      correctChoiceIndexes: [2],
    },
  ]);

  console.log(
    "  Allison's Personal: Biology 101 (6 cards: 3 front/back, 3 cloze), World Capitals (4 cards)",
  );

  // ── Allison's Shared Workspace (Owner) — Bob is editor ────────
  const allisonShared = await createWorkspace(
    "Allison's Team — Owner Role",
    "allison-team-owner",
    "shared",
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
      viewPolicy: "workspace",
    },
  );
  const jsCardIds = await createCards(jsDeck.id, users.allison.id, "front_back", [
    {
      front: "What is a closure?",
      back: "A function that retains access to its lexical scope even when called outside that scope",
    },
    {
      front: "Difference between == and ===?",
      back: "== performs type coercion, === checks value and type (strict equality)",
    },
  ]);
  const jsClozeIds = await createCards(jsDeck.id, users.allison.id, "cloze", [
    {
      text: "The {{c1::event loop}} processes the {{c2::callback queue}} after the {{c2::call stack}} is empty.",
    },
    {
      text: "{{c1::Hoisting}} moves {{c2::variable}} and {{c2::function}} declarations to the top of their scope.",
    },
  ]);
  await createCards(jsDeck.id, users.allison.id, "keyboard_shortcut", [
    {
      prompt: "Open the browser dev tools console",
      shortcut: { key: "j", ctrl: true, shift: true, alt: false, meta: false },
      explanation: "Ctrl+Shift+J opens the console directly in Chrome",
    },
    {
      prompt: "Comment out the selected lines in VS Code",
      shortcut: { key: "/", ctrl: true, shift: false, alt: false, meta: false },
      explanation: "Ctrl+/ toggles line comments in most editors",
    },
  ]);

  const dsDeck = await createDeck(
    allisonShared.id,
    "Data Structures",
    "data-structures",
    users.allison.id,
    {
      description: "Common data structures and their trade-offs",
      viewPolicy: "workspace",
    },
  );
  await createCards(dsDeck.id, users.allison.id, "multiple_choice", [
    {
      question: "Which data structure uses FIFO ordering?",
      choices: ["Stack", "Queue", "Tree", "Graph"],
      correctChoiceIndexes: [1],
    },
    {
      question: "What is the average time complexity of hash table lookup?",
      choices: ["O(n)", "O(log n)", "O(1)", "O(n log n)"],
      correctChoiceIndexes: [2],
    },
    {
      question: "Which traversal visits the root node first?",
      choices: ["Inorder", "Preorder", "Postorder", "Level-order"],
      correctChoiceIndexes: [1],
    },
  ]);
  await createCards(dsDeck.id, users.allison.id, "front_back", [
    {
      front: "What is a linked list?",
      back: "A linear data structure where each element points to the next",
    },
    {
      front: "Stack vs Queue?",
      back: "Stack is LIFO (last in, first out); Queue is FIFO (first in, first out)",
    },
  ]);

  console.log(
    "  Allison's Team — Owner Role: JS Fundamentals (6: 2 f/b, 2 cloze, 2 shortcuts), Data Structures (5) — Bob is editor",
  );

  // ── Bob's Shared Workspace — Allison is VIEWER ────────────────
  const bobShared = await createWorkspace(
    "Bob's Lab — Allison Viewer",
    "bob-lab-allison-viewer",
    "shared",
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
      viewPolicy: "workspace",
    },
  );
  const chemCardIds = await createCards(chemDeck.id, users.bob.id, "front_back", [
    {
      front: "What is Avogadro's number?",
      back: "6.022 × 10²³ — the number of particles in one mole",
    },
    { front: "What is pH?", back: "A measure of hydrogen ion concentration; scale 0–14" },
    {
      front: "What is an isotope?",
      back: "Atoms of the same element with different numbers of neutrons",
    },
  ]);

  const physicsDeck = await createDeck(bobShared.id, "Physics 101", "physics-101", users.bob.id, {
    description: "Newtonian mechanics fundamentals",
    viewPolicy: "workspace",
  });
  await createCards(physicsDeck.id, users.bob.id, "multiple_choice", [
    {
      question: "What is Newton's second law?",
      choices: ["F = ma", "E = mc²", "F = mv", "a = v/t"],
      correctChoiceIndexes: [0],
    },
    {
      question: "What unit measures force?",
      choices: ["Joule", "Watt", "Newton", "Pascal"],
      correctChoiceIndexes: [2],
    },
  ]);

  console.log(
    "  Bob's Lab — Allison Viewer: Chemistry Basics (3), Physics 101 (2) — Dave is editor",
  );

  // ── Carol's Shared Workspace — Allison is EDITOR ──────────────
  const carolShared = await createWorkspace(
    "Carol's Studio — Allison Editor",
    "carol-studio-allison-editor",
    "shared",
    users.carol.id,
  );
  await addMember(carolShared.id, users.allison.id, "editor");
  await addMember(carolShared.id, users.eve.id, "viewer");

  const artDeck = await createDeck(carolShared.id, "Art History", "art-history", users.carol.id, {
    description: "Major art movements and artists",
    viewPolicy: "workspace",
  });
  await createCards(artDeck.id, users.carol.id, "front_back", [
    { front: "Who painted the Mona Lisa?", back: "Leonardo da Vinci (c. 1503–1519)" },
    { front: "What art movement did Monet belong to?", back: "Impressionism" },
    { front: "Who painted 'The Starry Night'?", back: "Vincent van Gogh (1889)" },
    {
      front: "What is Baroque art known for?",
      back: "Dramatic lighting, rich colors, grandeur, and emotional intensity",
    },
  ]);

  const spanishDeck = await createDeck(
    carolShared.id,
    "Spanish Vocabulary",
    "spanish-vocab",
    users.carol.id,
    {
      description: "Common Spanish words and phrases",
      viewPolicy: "workspace",
    },
  );
  await createCards(spanishDeck.id, users.carol.id, "multiple_choice", [
    {
      question: "What does 'hola' mean?",
      choices: ["Goodbye", "Hello", "Please", "Thank you"],
      correctChoiceIndexes: [1],
    },
    {
      question: "What does 'gracias' mean?",
      choices: ["Sorry", "Hello", "Thank you", "Please"],
      correctChoiceIndexes: [2],
    },
    {
      question: "What is the Spanish word for 'water'?",
      choices: ["Fuego", "Agua", "Tierra", "Aire"],
      correctChoiceIndexes: [1],
    },
  ]);
  await createCards(spanishDeck.id, users.carol.id, "front_back", [
    { front: "Buenos días", back: "Good morning" },
    { front: "¿Cómo estás?", back: "How are you?" },
    { front: "Por favor", back: "Please" },
  ]);

  console.log(
    "  Carol's Studio — Allison Editor: Art History (4), Spanish Vocab (6) — Eve is viewer",
  );

  // ── Dave's Shared Workspace — Allison INVITED as editor ───────
  const daveShared = await createWorkspace(
    "Dave's Research — Pending Invite",
    "dave-research-pending",
    "shared",
    users.dave.id,
  );
  await addMember(daveShared.id, users.eve.id, "viewer");
  await inviteMember(daveShared.id, users.allison.id, "editor");

  await createDeck(daveShared.id, "Machine Learning Intro", "ml-intro", users.dave.id, {
    description: "Fundamentals of ML and neural networks",
    viewPolicy: "workspace",
  });

  console.log("  Dave's Research — Pending Invite: Allison invited as editor");

  // ── Eve's Shared Workspace — Allison INVITED as viewer ────────
  const eveShared = await createWorkspace(
    "Eve's Book Club — Pending Invite",
    "eve-book-club-pending",
    "shared",
    users.eve.id,
  );
  await addMember(eveShared.id, users.carol.id, "editor");
  await inviteMember(eveShared.id, users.allison.id, "viewer");

  await createDeck(eveShared.id, "Classic Literature", "classic-lit", users.eve.id, {
    description: "Key themes and quotes from classic novels",
    viewPolicy: "workspace",
  });

  console.log("  Eve's Book Club — Pending Invite: Allison invited as viewer");

  // ── Public Decks (browseable by anyone) ─────────────────────────
  const bobPublicDeck = await createDeck(
    bobPersonal.id,
    "World Capitals",
    "world-capitals",
    users.bob.id,
    {
      description: "Test your knowledge of world capitals",
      viewPolicy: "public",
    },
  );
  await createCards(bobPublicDeck.id, users.bob.id, "front_back", [
    { front: "What is the capital of Japan?", back: "Tokyo" },
    { front: "What is the capital of Australia?", back: "Canberra" },
    { front: "What is the capital of Brazil?", back: "Brasília" },
    { front: "What is the capital of Canada?", back: "Ottawa" },
    { front: "What is the capital of Egypt?", back: "Cairo" },
  ]);

  const carolPublicDeck = await createDeck(
    carolPersonal.id,
    "Common English Idioms",
    "english-idioms",
    users.carol.id,
    {
      description: "Popular English idioms and their meanings",
      viewPolicy: "public",
    },
  );
  await createCards(carolPublicDeck.id, users.carol.id, "front_back", [
    { front: "Break the ice", back: "To initiate conversation in a social setting" },
    { front: "Hit the nail on the head", back: "To be exactly right about something" },
    { front: "Piece of cake", back: "Something very easy to do" },
    { front: "Under the weather", back: "Feeling ill or sick" },
  ]);

  const davePublicDeck = await createDeck(
    davePersonal.id,
    "Programming Fundamentals",
    "programming-fundamentals",
    users.dave.id,
    {
      description: "Core programming concepts for beginners",
      viewPolicy: "public",
    },
  );
  await createCards(davePublicDeck.id, users.dave.id, "multiple_choice", [
    {
      question: "Which data structure uses FIFO ordering?",
      choices: ["Stack", "Queue", "Tree", "Graph"],
      correctChoiceIndexes: [1],
    },
    {
      question: "What does HTML stand for?",
      choices: [
        "Hyper Text Markup Language",
        "High Tech Modern Language",
        "Hyper Transfer Markup Language",
        "Home Tool Markup Language",
      ],
      correctChoiceIndexes: [0],
    },
  ]);
  await createCards(davePublicDeck.id, users.dave.id, "cloze", [
    { text: "The time complexity of {{c1::binary search}} is {{c2::O(log n)}}." },
    {
      text: "In Git, {{c1::git commit}} saves staged changes and {{c2::git push}} uploads them to the remote.",
    },
  ]);
  await createCards(davePublicDeck.id, users.dave.id, "keyboard_shortcut", [
    {
      prompt: "Save the current file",
      shortcut: { key: "s", ctrl: true, shift: false, alt: false, meta: false },
    },
    {
      prompt: "Undo the last action",
      shortcut: { key: "z", ctrl: true, shift: false, alt: false, meta: false },
    },
  ]);

  console.log(
    "  Public decks: World Capitals (5), English Idioms (4), Programming Fundamentals (6: 2 mc, 2 cloze, 2 shortcuts)",
  );

  // ── Linked Decks ──────────────────────────────────────────────
  console.log("\nCreating linked decks...");

  // Link Bob's World Capitals into Allison's personal workspace
  const [linkedWorldCapitals] = await db
    .insert(schema.deckDefinitions)
    .values({
      workspaceId: allisonPersonal.id,
      title: bobPublicDeck.title,
      slug: `${bobPublicDeck.slug}-linked`,
      description: bobPublicDeck.description,
      viewPolicy: "private",
      linkedDeckDefinitionId: bobPublicDeck.id,
      createdByUserId: users.allison.id,
      updatedByUserId: users.allison.id,
    })
    .returning();
  console.log(`  Linked "World Capitals" into Allison's Personal (${linkedWorldCapitals.id})`);

  // Link Carol's English Idioms into Allison's shared workspace
  const [linkedIdioms] = await db
    .insert(schema.deckDefinitions)
    .values({
      workspaceId: allisonShared.id,
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

  // Create an Eve deck, link it to Allison, then archive it (abandoned)
  const eveAbandonedDeck = await createDeck(
    evePersonal.id,
    "Eve's Music Theory",
    "eve-music-theory",
    users.eve.id,
    {
      description: "Music theory basics — now abandoned",
      viewPolicy: "public",
    },
  );
  await createCards(eveAbandonedDeck.id, users.eve.id, "front_back", [
    { front: "How many semitones in an octave?", back: "12" },
    { front: "What does 'forte' mean?", back: "Play loudly" },
  ]);
  const [linkedAbandoned] = await db
    .insert(schema.deckDefinitions)
    .values({
      workspaceId: allisonPersonal.id,
      title: eveAbandonedDeck.title,
      slug: `${eveAbandonedDeck.slug}-linked`,
      description: eveAbandonedDeck.description,
      viewPolicy: "private",
      linkedDeckDefinitionId: eveAbandonedDeck.id,
      createdByUserId: users.allison.id,
      updatedByUserId: users.allison.id,
    })
    .returning();
  // Archive the source to simulate abandonment
  await db
    .update(schema.deckDefinitions)
    .set({ archivedAt: new Date() })
    .where(eq(schema.deckDefinitions.id, eveAbandonedDeck.id));
  console.log(
    `  Linked "Eve's Music Theory" (ABANDONED) into Allison's Personal (${linkedAbandoned.id})`,
  );

  // ── Seed user libraries (userDecks + userCardStates) ──────────
  console.log("\nSeeding user libraries...");

  async function addToLibrary(userId: string, deckId: string, sourceDeckId?: string) {
    const [userDeck] = await db
      .insert(schema.userDecks)
      .values({ userId, deckDefinitionId: deckId })
      .returning({ id: schema.userDecks.id });

    const cardSource = sourceDeckId ?? deckId;
    const allCards = await db
      .select({
        id: schema.cardDefinitions.id,
        cardType: schema.cardDefinitions.cardType,
        parentCardId: schema.cardDefinitions.parentCardId,
        status: schema.cardDefinitions.status,
        archivedAt: schema.cardDefinitions.archivedAt,
      })
      .from(schema.cardDefinitions)
      .where(eq(schema.cardDefinitions.deckDefinitionId, cardSource));

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
          easeFactor: "2.500",
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
  await addToLibrary(users.allison.id, jsDeck.id);
  await addToLibrary(users.allison.id, dsDeck.id);
  // Allison's linked decks (cards come from source)
  await addToLibrary(users.allison.id, linkedWorldCapitals.id, bobPublicDeck.id);
  await addToLibrary(users.allison.id, linkedIdioms.id, carolPublicDeck.id);
  await addToLibrary(users.allison.id, linkedAbandoned.id, eveAbandonedDeck.id);
  // Decks from workspaces Allison is a member of
  await addToLibrary(users.allison.id, chemDeck.id);
  await addToLibrary(users.allison.id, physicsDeck.id);
  await addToLibrary(users.allison.id, artDeck.id);
  await addToLibrary(users.allison.id, spanishDeck.id);

  console.log("  Added 11 decks to Allison's library with userCardStates");

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

  console.log("  Tagged 12 decks and sample cards");

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

  Allison's workspace membership:
    ✦ Allison's Personal              → owner   (2 decks + 2 linked)
    ✦ Allison's Team — Owner Role     → owner   (2 decks + 1 linked)
    ✦ Bob's Lab — Allison Viewer      → viewer  (2 decks)
    ✦ Carol's Studio — Allison Editor → editor  (2 decks)

  Allison's pending invites:
    ✉ Dave's Research — Pending Invite  → invited as editor
    ✉ Eve's Book Club — Pending Invite  → invited as viewer

  Allison's library (userDecks + userCardStates seeded):
    📚 Biology 101, World Capitals, JS Fundamentals, Data Structures
    🔗 World Capitals (linked), English Idioms (linked), Music Theory (abandoned)
    👀 Chemistry Basics, Physics 101 (Bob's Lab), Art History, Spanish Vocab (Carol's Studio)

  Public decks (visible on /browse):
    🌐 World Capitals (Bob)               → 5 cards
    🌐 Common English Idioms (Carol)      → 4 cards
    🌐 Programming Fundamentals (Dave)    → 3 cards
    🌐 Eve's Music Theory (Eve)           → 2 cards (archived)

  Linked decks in Allison's workspaces:
    🔗 World Capitals → Allison's Personal
    🔗 Common English Idioms → Allison's Team
    ⚠️  Eve's Music Theory → Allison's Personal (ABANDONED)
`);

  await client.end();
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
