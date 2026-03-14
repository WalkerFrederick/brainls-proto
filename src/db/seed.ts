import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

async function seed() {
  const client = postgres(DATABASE_URL!);
  const db = drizzle(client, { schema });

  console.log("Seeding database...");

  const [user1] = await db
    .insert(schema.users)
    .values({
      email: "alice@example.com",
      name: "Alice Johnson",
      username: "alice",
      emailVerified: true,
      status: "active",
    })
    .returning();

  const [user2] = await db
    .insert(schema.users)
    .values({
      email: "bob@example.com",
      name: "Bob Smith",
      username: "bob",
      emailVerified: true,
      status: "active",
    })
    .returning();

  console.log(`Created users: ${user1.email}, ${user2.email}`);

  const [personalWs] = await db
    .insert(schema.workspaces)
    .values({
      name: "Alice's Personal",
      slug: "alice-personal",
      kind: "personal",
      createdByUserId: user1.id,
    })
    .returning();

  const [sharedWs] = await db
    .insert(schema.workspaces)
    .values({
      name: "Study Group",
      slug: "study-group",
      kind: "shared",
      description: "A shared workspace for collaborative study",
      createdByUserId: user1.id,
    })
    .returning();

  await db.insert(schema.workspaceSettings).values([
    { workspaceId: personalWs.id },
    { workspaceId: sharedWs.id, allowMemberInvites: true, allowViewerDeckUse: true },
  ]);

  await db.insert(schema.workspaceMembers).values([
    {
      workspaceId: personalWs.id,
      userId: user1.id,
      role: "owner",
      status: "active",
      joinedAt: new Date(),
    },
    {
      workspaceId: sharedWs.id,
      userId: user1.id,
      role: "owner",
      status: "active",
      joinedAt: new Date(),
    },
    {
      workspaceId: sharedWs.id,
      userId: user2.id,
      role: "editor",
      status: "active",
      joinedAt: new Date(),
    },
  ]);

  await db
    .update(schema.users)
    .set({ personalWorkspaceId: personalWs.id })
    .where(eq(schema.users.id, user1.id));

  console.log(`Created workspaces: ${personalWs.name}, ${sharedWs.name}`);

  const [bioDeck] = await db
    .insert(schema.deckDefinitions)
    .values({
      workspaceId: personalWs.id,
      title: "Biology 101",
      slug: "biology-101",
      description: "Fundamental biology concepts",
      viewPolicy: "private",
      usePolicy: "none",
      forkPolicy: "none",
      createdByUserId: user1.id,
      updatedByUserId: user1.id,
    })
    .returning();

  const [spanishDeck] = await db
    .insert(schema.deckDefinitions)
    .values({
      workspaceId: sharedWs.id,
      title: "Spanish Vocabulary",
      slug: "spanish-vocabulary",
      description: "Common Spanish words and phrases",
      viewPolicy: "workspace",
      usePolicy: "open",
      forkPolicy: "workspace_members",
      createdByUserId: user1.id,
      updatedByUserId: user1.id,
    })
    .returning();

  console.log(`Created decks: ${bioDeck.title}, ${spanishDeck.title}`);

  const bioCards = [
    { front: "What is the powerhouse of the cell?", back: "The mitochondria" },
    { front: "What is DNA?", back: "Deoxyribonucleic acid - carries genetic instructions" },
    { front: "What is photosynthesis?", back: "The process by which plants convert light to energy" },
    { front: "What is osmosis?", back: "Movement of water through a semipermeable membrane" },
    { front: "What are the four nucleotide bases?", back: "Adenine, Thymine, Guanine, Cytosine" },
  ];

  for (const card of bioCards) {
    await db.insert(schema.cardDefinitions).values({
      deckDefinitionId: bioDeck.id,
      cardType: "front_back",
      contentJson: card,
      createdByUserId: user1.id,
      updatedByUserId: user1.id,
    });
  }

  const spanishMcCards = [
    {
      question: 'What does "hola" mean?',
      choices: ["Goodbye", "Hello", "Please", "Thank you"],
      correctChoiceIndexes: [1],
    },
    {
      question: 'What does "gracias" mean?',
      choices: ["Sorry", "Hello", "Thank you", "Please"],
      correctChoiceIndexes: [2],
    },
    {
      question: 'What is the Spanish word for "water"?',
      choices: ["Fuego", "Agua", "Tierra", "Aire"],
      correctChoiceIndexes: [1],
    },
  ];

  for (const card of spanishMcCards) {
    await db.insert(schema.cardDefinitions).values({
      deckDefinitionId: spanishDeck.id,
      cardType: "multiple_choice",
      contentJson: card,
      createdByUserId: user1.id,
      updatedByUserId: user1.id,
    });
  }

  const spanishFbCards = [
    { front: "Buenos días", back: "Good morning" },
    { front: "¿Cómo estás?", back: "How are you?" },
    { front: "Por favor", back: "Please" },
  ];

  for (const card of spanishFbCards) {
    await db.insert(schema.cardDefinitions).values({
      deckDefinitionId: spanishDeck.id,
      cardType: "front_back",
      contentJson: card,
      createdByUserId: user1.id,
      updatedByUserId: user1.id,
    });
  }

  console.log(`Created ${bioCards.length + spanishMcCards.length + spanishFbCards.length} cards`);

  console.log("Seed complete!");
  await client.end();
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
