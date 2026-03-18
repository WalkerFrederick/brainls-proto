import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { createDefaultDeck } from "@/lib/scratch-pad";
import { sendEmail } from "@/lib/email";
import { VerifyEmail } from "@/emails/verify-email";
import { ResetPassword } from "@/emails/reset-password";

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
    async sendResetPassword({ user, url }) {
      await sendEmail({
        to: user.email,
        subject: "Reset your BrainLS password",
        react: ResetPassword({ url, userName: user.name }),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      await sendEmail({
        to: user.email,
        subject: "Verify your BrainLS email",
        react: VerifyEmail({ url, userName: user.name }),
      });
    },
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
              name: `${user.name ?? "My"}'s Default Folder`,
              slug: `default-folder-${user.id}`,
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

          await createDefaultDeck(folder.id, user.id);

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
