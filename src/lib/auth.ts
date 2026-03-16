import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { createScratchPad } from "@/lib/scratch-pad";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      username: { type: "string", required: false, input: true },
      status: { type: "string", required: false, defaultValue: "active" },
      personalFolderId: { type: "string", required: false },
      defaultDeckId: { type: "string", required: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const [folder] = await db
            .insert(schema.folders)
            .values({
              name: `${user.name ?? "My"}'s Space`,
              slug: `personal-${user.id}`,
              createdByUserId: user.id,
            })
            .returning({ id: schema.folders.id });

          await db.insert(schema.folderSettings).values({
            folderId: folder.id,
          });

          await db.insert(schema.folderMembers).values({
            folderId: folder.id,
            userId: user.id,
            role: "owner",
            status: "active",
            joinedAt: new Date(),
          });

          await db
            .update(schema.users)
            .set({ personalFolderId: folder.id })
            .where(eq(schema.users.id, user.id));

          await createScratchPad(folder.id, user.id);

          if (user.email) {
            await db
              .update(schema.folderMembers)
              .set({ userId: user.id })
              .where(
                and(
                  eq(schema.folderMembers.invitedEmail, user.email),
                  isNull(schema.folderMembers.userId),
                ),
              );
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
