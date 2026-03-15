import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";

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
      personalWorkspaceId: { type: "string", required: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const [workspace] = await db
            .insert(schema.workspaces)
            .values({
              name: `${user.name ?? "My"}'s Space`,
              slug: `personal-${user.id}`,
              kind: "personal",
              createdByUserId: user.id,
            })
            .returning({ id: schema.workspaces.id });

          await db.insert(schema.workspaceSettings).values({
            workspaceId: workspace.id,
          });

          await db.insert(schema.workspaceMembers).values({
            workspaceId: workspace.id,
            userId: user.id,
            role: "owner",
            status: "active",
            joinedAt: new Date(),
          });

          await db
            .update(schema.users)
            .set({ personalWorkspaceId: workspace.id })
            .where(eq(schema.users.id, user.id));

          if (user.email) {
            await db
              .update(schema.workspaceMembers)
              .set({ userId: user.id })
              .where(
                and(
                  eq(schema.workspaceMembers.invitedEmail, user.email),
                  isNull(schema.workspaceMembers.userId),
                ),
              );
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
