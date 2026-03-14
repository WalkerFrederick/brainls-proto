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
    opts?: { viewPolicy?: string; usePolicy?: string; forkPolicy?: string; description?: string },
  ) {
    const [deck] = await db
      .insert(schema.deckDefinitions)
      .values({
        workspaceId,
        title,
        slug,
        description: opts?.description,
        viewPolicy: opts?.viewPolicy ?? "private",
        usePolicy: opts?.usePolicy ?? "none",
        forkPolicy: opts?.forkPolicy ?? "none",
        createdByUserId: userId,
        updatedByUserId: userId,
      })
      .returning();
    return deck;
  }

  // ── Helper: create cards ───────────────────────────────────────
  async function createCards(
    deckId: string,
    userId: string,
    cardType: string,
    cards: Record<string, unknown>[],
  ) {
    for (const contentJson of cards) {
      await db.insert(schema.cardDefinitions).values({
        deckDefinitionId: deckId,
        cardType,
        contentJson,
        createdByUserId: userId,
        updatedByUserId: userId,
      });
    }
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
    {
      front: "What is photosynthesis?",
      back: "The process by which plants convert light to energy",
    },
    { front: "What is osmosis?", back: "Movement of water through a semipermeable membrane" },
    { front: "What are the four nucleotide bases?", back: "Adenine, Thymine, Guanine, Cytosine" },
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

  console.log("  Allison's Personal: Biology 101 (5 cards), World Capitals (4 cards)");

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
      usePolicy: "open",
      forkPolicy: "workspace_members",
    },
  );
  await createCards(jsDeck.id, users.allison.id, "front_back", [
    {
      front: "What is a closure?",
      back: "A function that retains access to its lexical scope even when called outside that scope",
    },
    {
      front: "Difference between == and ===?",
      back: "== performs type coercion, === checks value and type (strict equality)",
    },
    {
      front: "What is the event loop?",
      back: "A mechanism that processes the callback queue after the call stack is empty",
    },
    {
      front: "What does 'hoisting' mean?",
      back: "Variable and function declarations are moved to the top of their scope during compilation",
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
      usePolicy: "open",
      forkPolicy: "workspace_members",
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
    "  Allison's Team — Owner Role: JS Fundamentals (4), Data Structures (5) — Bob is editor",
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
      usePolicy: "open",
      forkPolicy: "workspace_members",
    },
  );
  await createCards(chemDeck.id, users.bob.id, "front_back", [
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
    usePolicy: "open",
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
    usePolicy: "open",
    forkPolicy: "any_user",
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
      usePolicy: "open",
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
    usePolicy: "open",
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
    usePolicy: "open",
  });

  console.log("  Eve's Book Club — Pending Invite: Allison invited as viewer");

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
    ✦ Allison's Personal              → owner   (2 decks)
    ✦ Allison's Team — Owner Role     → owner   (2 decks, Bob=editor)
    ✦ Bob's Lab — Allison Viewer      → viewer  (2 decks)
    ✦ Carol's Studio — Allison Editor → editor  (2 decks)

  Allison's pending invites:
    ✉ Dave's Research — Pending Invite  → invited as editor
    ✉ Eve's Book Club — Pending Invite  → invited as viewer
`);

  await client.end();
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
